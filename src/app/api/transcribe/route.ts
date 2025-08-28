import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
import { extractAndTranscribeAudio } from '@/lib/audio-extractor';



export async function POST(request: NextRequest) {
  try {
    // Read request body once at the beginning
    const body = await request.json();
    const { youtubeId, transcript: clientTranscript, language = 'pl' } = body;
    
    // Try both authentication systems during migration
    let userId: string | null = null;
    let googleId: string | undefined = undefined;
    
    // Method 1: Try Google OAuth (new system)
    try {
      if (body.googleId && typeof body.googleId === 'string') {
        googleId = body.googleId;
        // Get user by googleId to get database userId
        const user = await prisma.user.findUnique({
          where: { googleId: googleId },
          select: { id: true }
        });
        if (user) {
          userId = user.id;
        }
      }
    } catch {
      // Body might not have googleId, continue
    }
    
    // Method 2: Fallback to Clerk (old system)
    if (!userId) {
      const clerkAuth = await auth();
      if (clerkAuth.userId) {
        // Get user by clerkId
        const user = await prisma.user.findUnique({
          where: { clerkId: clerkAuth.userId },
          select: { id: true, googleId: true }
        });
        if (user) {
          userId = user.id;
          googleId = user.googleId || undefined; // Convert null to undefined
        }
      }
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
    
    // Simplified workflow: Audio extraction + Gladia API transcription
    if (!transcript) {
      console.log('🚀 Starting Gladia API transcription workflow...');
      
      try {
        // Primary strategy: Audio extraction + Gladia API
        console.log('🎵 Extracting audio and transcribing with Gladia API...');
        const result = await extractAndTranscribeAudio(youtubeId, {
          language: language,
          maxDuration: 60 * 60 // 60 minutes
        });
        
        transcript = result.transcript;
        source = result.source;
        
        console.log(`✅ Gladia transcription completed: ${transcript ? transcript.length : 0} characters`);
        console.log(`📊 Video processed: ${result.videoDetails.title}`);
        
        if (!transcript || transcript.trim().length === 0) {
          throw new Error('Gladia transcription returned empty result');
        }
        
      } catch (audioError) {
        console.error('❌ Gladia transcription workflow failed:', audioError);
        
        // Enhanced error details for debugging
        const errorMessage = audioError instanceof Error ? audioError.message : 'Unknown error';
        
        console.error('❌ Detailed error:', {
          youtubeId,
          workflow: 'yt-dlp-gladia',
          error: errorMessage,
          errorType: audioError instanceof Error ? audioError.constructor.name : typeof audioError
        });
        
        return NextResponse.json({
          error: 'Nie można wygenerować transkrypcji dla tego filmu',
          details: 'Wystąpił problem podczas pobierania audio lub generowania transkrypcji.',
          technicalDetails: errorMessage,
          troubleshooting: {
            possibleReasons: [
              'Film może być prywatny, zablokowany lub ograniczony',
              'Film jest dłuższy niż 60 minut',
              'Problemy z połączeniem lub dostępnością usług',
              'Format audio nie jest obsługiwany'
            ],
            suggestions: [
              'Sprawdź czy film jest publicznie dostępny',
              'Spróbuj z krótszym filmem (do 60 minut)', 
              'Spróbuj z filmem z popularnego kanału',
              'Spróbuj ponownie za chwilę'
            ],
            debugInfo: {
              gladiaApiKeyPresent: !!process.env.GLADIA_API_KEY,
              videoMaxDuration: '60 minutes'
            }
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