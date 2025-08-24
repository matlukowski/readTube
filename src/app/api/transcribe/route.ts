import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
import { getYouTubeTranscriptWithRetry } from '@/lib/youtube-transcript-extractor';

// Get transcript from YouTube using direct extraction (GetSubs-style)
async function getYouTubeTranscript(youtubeId: string): Promise<string | null> {
  console.log(`🚀 Starting GetSubs-style transcript extraction for ${youtubeId}`);
  
  // Use our robust direct extraction method
  return await getYouTubeTranscriptWithRetry(youtubeId, 3);
}



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

    // Multi-level fallback workflow for transcript extraction
    console.log(`🚀 Starting transcription workflow for ${youtubeId}`);
    
    let transcript = clientTranscript;
    let source = 'client';
    
    // Level 1: Try client-provided transcript (captions)
    if (!transcript) {
      console.log('No client transcript provided, trying server-side caption extraction...');
      
      // Level 2: Try server-side caption extraction as fallback
      try {
        transcript = await getYouTubeTranscript(youtubeId);
        source = 'server-captions';
      } catch {
        console.log('Server-side caption extraction failed, trying audio transcription...');
        
        // Level 3: Try audio transcription with Gladia API
        try {
          console.log('🎵 Attempting audio transcription via Gladia...');
          const audioResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/audio-extract`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || 'internal'}`
            },
            body: JSON.stringify({ 
              youtubeId, 
              language 
            })
          });
          
          if (audioResponse.ok) {
            const audioData = await audioResponse.json();
            transcript = audioData.transcript;
            source = 'gladia-audio';
            console.log('✅ Audio transcription successful via Gladia');
          } else {
            const audioError = await audioResponse.json();
            console.error('❌ Audio transcription failed:', audioError.error);
            throw new Error(audioError.error || 'Audio transcription failed');
          }
        } catch (audioError) {
          console.error('❌ All transcription methods failed:', audioError);
          
          // All methods failed - return comprehensive error
          return NextResponse.json({
            error: 'Nie można pobrać transkrypcji dla tego filmu',
            details: 'Próbowaliśmy pobrać napisy i transkrypcję audio, ale żaden sposób nie zadziałał.',
            troubleshooting: {
              captionsAvailable: false,
              audioExtractionFailed: true,
              suggestions: [
                'Sprawdź czy film ma włączone napisy automatyczne',
                'Sprawdź czy film nie jest prywatny lub zablokowany',
                'Spróbuj z innym filmem YouTube'
              ]
            }
          }, { status: 422 });
        }
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