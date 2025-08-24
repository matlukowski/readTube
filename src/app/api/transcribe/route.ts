import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
import { extractAudioWithYtDlp, checkYtDlpAvailability } from '@/lib/yt-dlp-audio';
import { createGladiaClient } from '@/lib/gladia-client';



export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { youtubeId, transcript: clientTranscript, language = 'pl' } = body;
    
    // Validate the request
    transcribeRequestSchema.parse({ youtubeId });

    // 🛡️ Check usage limits BEFORE proceeding with transcription
    console.log(`🔍 Checking usage limits for video ${youtubeId}`);
    const usageCheck = await checkUsageLimit(youtubeId);
    
    if (!usageCheck.canAnalyze) {
      return NextResponse.json({
        error: usageCheck.message,
        usageInfo: {
          remainingMinutes: usageCheck.remainingMinutes,
          requiredMinutes: usageCheck.requiredMinutes,
          subscriptionStatus: usageCheck.user?.subscriptionStatus,
        },
        upgradeRequired: true
      }, { status: 402 }); // Payment Required
    }

    console.log(`✅ Usage check passed. User can analyze this ${usageCheck.requiredMinutes}-minute video`);

    // Check if transcript already exists in database with cache validation
    const existingVideo = await prisma.video.findUnique({
      where: { youtubeId },
      select: { 
        transcript: true,
        updatedAt: true 
      },
    });
    
    // Cache duration: 7 days
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
    const isCacheValid = existingVideo?.transcript && 
      existingVideo.updatedAt && 
      (Date.now() - new Date(existingVideo.updatedAt).getTime() < CACHE_DURATION);

    if (isCacheValid && existingVideo?.transcript) {
      console.log('📦 Returning cached transcript');
      return NextResponse.json({ 
        transcript: existingVideo.transcript,
        cached: true,
        source: 'cache',
        cacheAge: Math.round((Date.now() - new Date(existingVideo.updatedAt).getTime()) / 1000)
      });
    }

    // Simplified workflow: yt-dlp audio extraction -> Gladia transcription
    console.log(`🚀 Starting yt-dlp + Gladia transcription workflow for ${youtubeId}`);
    
    let transcript = clientTranscript;
    let source = 'client';
    
    // Skip client transcript for now - go straight to audio extraction
    if (!transcript) {
      console.log('Starting audio extraction and transcription...');
      
      try {
        // Check if yt-dlp is available
        console.log('🔍 Checking yt-dlp availability...');
        const ytDlpAvailable = await checkYtDlpAvailability();
        
        if (!ytDlpAvailable) {
          throw new Error('yt-dlp is not installed or not available. Please install yt-dlp first.');
        }
        
        console.log('✅ yt-dlp is available');
        
        // Extract audio using yt-dlp
        console.log('🎵 Extracting audio with yt-dlp...');
        const audioResult = await extractAudioWithYtDlp(youtubeId, {
          format: 'mp3',
          quality: 'best',
          maxDuration: 60 * 60 // 60 minutes
        });
        
        console.log(`📊 Audio extracted: ${audioResult.title} (${Math.round(audioResult.size / 1024 / 1024)}MB)`);
        
        // Transcribe using Gladia API
        console.log('🤖 Starting Gladia transcription...');
        console.log(`🔧 Debug: GLADIA_API_KEY present: ${!!process.env.GLADIA_API_KEY}`);
        
        const gladiaClient = createGladiaClient();
        const gladiaConfig = {
          language: language === 'auto' ? undefined : language,
          diarization: false, // Disable for faster processing
          code_switching: true, // Enable multiple languages
        };
        
        console.log(`🔧 Gladia config: ${JSON.stringify(gladiaConfig)}`);
        
        transcript = await gladiaClient.transcribeAudio(audioResult.audioBuffer, gladiaConfig, 300000); // 5 minute timeout
        source = 'yt-dlp-gladia';
        
        console.log(`✅ Transcription completed: ${transcript ? transcript.length : 0} characters`);
        
        if (!transcript || transcript.trim().length === 0) {
          throw new Error('Gladia returned empty transcription');
        }
        
      } catch (audioError) {
        console.error('❌ Audio transcription workflow failed:', audioError);
        
        // Enhanced error details for debugging
        const errorMessage = audioError instanceof Error ? audioError.message : 'Unknown error';
        
        console.error('❌ Detailed error:', {
          youtubeId,
          workflow: 'yt-dlp-gladia',
          error: errorMessage,
          errorType: audioError instanceof Error ? audioError.constructor.name : typeof audioError
        });
        
        // Return comprehensive error
        return NextResponse.json({
          error: 'Nie można pobrać transkrypcji dla tego filmu',
          details: 'Próbowaliśmy wyodrębnić audio z YouTube i przetworzyć go przez Gladia API, ale proces nie powiódł się.',
          technicalDetails: errorMessage,
          troubleshooting: {
            ytDlpAvailable: await checkYtDlpAvailability(),
            gladiaApiKeyPresent: !!process.env.GLADIA_API_KEY,
            suggestions: [
              'Sprawdź czy yt-dlp jest zainstalowany (pip install yt-dlp)',
              'Sprawdź czy GLADIA_API_KEY jest ustawiony',
              'Sprawdź czy film nie jest prywatny lub zablokowany', 
              'Sprawdź czy film nie jest dłuższy niż 60 minut',
              'Spróbuj z innym filmem YouTube'
            ]
          }
        }, { status: 422 });
      }
    }
    
    if (!transcript || transcript.length === 0) {
      return NextResponse.json({
        error: 'Transkrypcja jest pusta',
        details: 'Udało się połączyć z usługą transkrypcji, ale nie otrzymano żadnego tekstu.'
      }, { status: 422 });
    }
    
    console.log(`📊 Transcript extracted: ${transcript.length} characters`);

    // Get video details for usage logging
    const youtubeAPI = new YouTubeAPI(process.env.YOUTUBE_API_KEY!);
    let videoDetails;
    try {
      videoDetails = await youtubeAPI.getVideoDetails(youtubeId);
    } catch (error) {
      console.warn('⚠️ Could not fetch video details for usage logging:', error);
      videoDetails = {
        snippet: { title: 'Unknown Title' },
        contentDetails: { duration: 'PT0S' }
      };
    }

    // Save transcript to database
    await prisma.video.upsert({
      where: { youtubeId },
      update: { transcript },
      create: {
        youtubeId,
        title: videoDetails.snippet.title || 'Pending',
        channelName: 'Pending',
        thumbnail: '',
        transcript,
      },
    });

    // 📊 Log usage AFTER successful transcription
    const minutesUsed = usageCheck.requiredMinutes || (videoDetails.contentDetails?.duration ? youtubeAPI.parseDurationToMinutes(videoDetails.contentDetails.duration) : 0);
    const videoDuration = videoDetails.contentDetails?.duration ? youtubeAPI.formatDuration(videoDetails.contentDetails.duration) : 'Unknown';
    
    await logVideoUsage({
      youtubeId,
      videoTitle: videoDetails.snippet.title || 'Unknown Title',
      videoDuration,
      minutesUsed
    });

    console.log(`✅ Transcription completed and ${minutesUsed} minutes logged for user`);

    return NextResponse.json({ 
      transcript,
      cached: false,
      source,
      usageInfo: {
        minutesUsed,
        videoDuration,
        remainingMinutes: usageCheck.remainingMinutes - minutesUsed
      }
    });
    
  } catch (error) {
    console.error('Transcribe API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Brak możliwości wykonania podsumowania dla tego filmu'
      },
      { status: 422 }
    );
  }
}