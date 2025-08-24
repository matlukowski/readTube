import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
import { pythonTranscriptClient } from '@/lib/python-transcript-client';
import { extractAndTranscribeAudio } from '@/lib/audio-extractor';

// Get transcript from Python API (primary method)
async function getYouTubeTranscript(youtubeId: string, language: string = 'pl'): Promise<string | null> {
  console.log(`🐍 Starting Python API transcript extraction for ${youtubeId}`);
  
  // Determine preferred languages based on request language
  const preferredLanguages = language === 'pl' ? ['pl', 'pl-PL', 'en', 'en-US'] : [language, 'en', 'en-US'];
  
  // Use Python API with retry mechanism
  return await pythonTranscriptClient.getTranscriptWithRetry(youtubeId, preferredLanguages, 2);
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

    // Simplified workflow: Python API -> Gladia fallback
    console.log(`🚀 Starting simplified transcription workflow for ${youtubeId}`);
    
    let transcript = clientTranscript;
    let source = 'client';
    
    // Level 1: Try client-provided transcript (captions) - if provided
    if (!transcript) {
      console.log('No client transcript provided, trying Python API...');
      
      // Level 2: Try Python API (primary method)
      try {
        transcript = await getYouTubeTranscript(youtubeId, language);
        source = 'python-api';
      } catch (pythonError) {
        console.log('Python API failed, trying audio transcription...');
        console.log(`❌ Python API error: ${pythonError instanceof Error ? pythonError.message : 'Unknown error'}`);
        
        // Level 3: Try audio transcription with Gladia API (fallback)
        try {
          console.log('🎵 Attempting audio transcription via Gladia...');
          console.log(`🔧 Debug: GLADIA_API_KEY present: ${!!process.env.GLADIA_API_KEY}`);
          console.log(`🔧 Debug: YouTube ID: ${youtubeId}, Language: ${language}`);
          
          const audioResult = await extractAndTranscribeAudio(youtubeId, { 
            language: language === 'auto' ? undefined : language 
          });
          
          if (audioResult && audioResult.transcript) {
            transcript = audioResult.transcript;
            source = 'gladia-audio';
            console.log('✅ Audio transcription successful via Gladia');
            console.log(`📊 Audio details: ${audioResult.processingInfo.audioFormat}, ${audioResult.processingInfo.durationSeconds}s`);
          } else {
            throw new Error('Audio transcription returned empty result');
          }
        } catch (audioError) {
          console.error('❌ All transcription methods failed:', audioError);
          
          // Enhanced error details for debugging
          const errorMessage = audioError instanceof Error ? audioError.message : 'Unknown error';
          const pythonErrorMessage = pythonError instanceof Error ? pythonError.message : 'Unknown error';
          
          console.error('❌ Detailed error:', {
            youtubeId,
            pythonApiError: pythonErrorMessage,
            audioError: errorMessage,
            errorType: audioError instanceof Error ? audioError.constructor.name : typeof audioError
          });
          
          // All methods failed - return comprehensive error
          return NextResponse.json({
            error: 'Nie można pobrać transkrypcji dla tego filmu',
            details: 'Próbowaliśmy pobrać napisy przez Python API i transkrypcję audio, ale żaden sposób nie zadziałał.',
            technicalDetails: {
              pythonApi: pythonErrorMessage,
              audioTranscription: errorMessage
            },
            troubleshooting: {
              pythonApiAvailable: false,
              audioExtractionFailed: true,
              suggestions: [
                'Sprawdź czy Python API jest uruchomione i dostępne',
                'Sprawdź czy film ma włączone napisy automatyczne',
                'Sprawdź czy film nie jest prywatny lub zablokowany', 
                'Sprawdź czy film nie jest dłuższy niż 30 minut',
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