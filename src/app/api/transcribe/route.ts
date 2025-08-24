import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
import { extractAndTranscribeAudio } from '@/lib/audio-extractor';
import { getYouTubeTranscriptWithRetry } from '@/lib/youtube-transcript-extractor';



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
    
    // Multi-tier fallback strategy for transcription
    if (!transcript) {
      console.log('Starting multi-tier transcription workflow...');
      
      // Strategy 1: Try YouTube official captions (works on Vercel)
      console.log('📝 Strategy 1: Trying YouTube official captions...');
      try {
        const youtubeTranscript = await getYouTubeTranscriptWithRetry(youtubeId, 2);
        if (youtubeTranscript && youtubeTranscript.trim().length > 0) {
          transcript = youtubeTranscript;
          source = 'youtube-captions';
          console.log(`✅ YouTube captions found: ${transcript.length} characters`);
        } else {
          console.log('⚠️ YouTube captions not available or empty');
        }
      } catch (captionsError) {
        console.log('❌ YouTube captions failed:', captionsError instanceof Error ? captionsError.message : 'Unknown error');
      }
      
      // Strategy 2: Fallback to audio extraction (may fail on Vercel due to bot detection)
      if (!transcript) {
        console.log('🎵 Strategy 2: Falling back to audio extraction + Gladia...');
        try {
          const result = await extractAndTranscribeAudio(youtubeId, {
            language: language,
            maxDuration: 60 * 60 // 60 minutes
          });
          
          transcript = result.transcript;
          source = result.source;
          
          console.log(`✅ Audio transcription completed: ${transcript ? transcript.length : 0} characters`);
          console.log(`📊 Video processed: ${result.videoDetails.title}`);
          
          if (!transcript || transcript.trim().length === 0) {
            throw new Error('Audio transcription returned empty result');
          }
        } catch (audioError) {
          console.error('❌ Audio transcription workflow failed:', audioError);
          
          // Enhanced error details for debugging
          const errorMessage = audioError instanceof Error ? audioError.message : 'Unknown error';
          
          console.error('❌ Detailed error:', {
            youtubeId,
            workflow: 'ytdl-core-gladia',
            error: errorMessage,
            errorType: audioError instanceof Error ? audioError.constructor.name : typeof audioError
          });
          
          // Final failure - no transcription method worked
          return NextResponse.json({
            error: 'Nie można pobrać transkrypcji dla tego filmu',
            details: 'Próbowaliśmy kilka metod transkrypcji, ale żadna nie zadziałała.',
            technicalDetails: errorMessage,
            troubleshooting: {
              strategiesTried: [
                'YouTube official captions (failed or unavailable)',
                'Audio extraction + Gladia API (failed)'
              ],
              possibleReasons: [
                'Film nie ma napisów ani dostępnego audio',
                'YouTube blokuje requesty (bot detection)',
                'Film jest prywatny lub zablokowany',
                'Film jest dłuższy niż 60 minut',
                'Problemy z Gladia API'
              ],
              gladiaApiKeyPresent: !!process.env.GLADIA_API_KEY,
              suggestions: [
                'Spróbuj z innym filmem YouTube',
                'Sprawdź czy film ma napisy lub jest publicznie dostępny',
                'Sprawdź czy GLADIA_API_KEY jest poprawny'
              ]
            }
          }, { status: 422 });
        }
      }
      
      // If we still don't have transcript after both strategies
      if (!transcript) {
        return NextResponse.json({
          error: 'Nie można pobrać transkrypcji dla tego filmu',
          details: 'Film nie ma dostępnych napisów ani możliwości ekstrakcji audio.',
          troubleshooting: {
            strategiesTried: [
              'YouTube official captions (not available)',
              'Audio extraction (skipped or failed)'
            ],
            suggestions: [
              'Spróbuj z filmem który ma napisy',
              'Sprawdź czy film jest publicznie dostępny'
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