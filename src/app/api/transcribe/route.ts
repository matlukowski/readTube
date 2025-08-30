import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-helpers';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
import { extractAndTranscribeAudio } from '@/lib/audio-extractor';
import { getAIService } from '@/lib/ai';



export async function POST(request: NextRequest) {
  try {
    // Authenticate request using Bearer token
    const authResult = await authenticateRequest(request);
    const user = authResult.user;
    
    // Read request body once at the beginning
    const body = await request.json();
    const { youtubeId, transcript: clientTranscript, language = 'pl' } = body;
    
    // Validate the request
    transcribeRequestSchema.parse({ youtubeId });

    // 🛡️ Check usage limits BEFORE proceeding with transcription
    console.log(`🔍 Checking usage limits for video ${youtubeId}`);
    const usageCheck = await checkUsageLimit(youtubeId, user.id);
    
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

    // Local transcription workflow: yt-dlp audio extraction -> Local Whisper
    console.log(`🚀 Starting yt-dlp + Local Whisper transcription workflow for ${youtubeId}`);
    
    let transcript = clientTranscript;
    let source = 'client';
    
    // Optimized workflow: Streaming audio extraction + Local Whisper with progress
    if (!transcript) {
      console.log('🌊 Starting optimized streaming Whisper transcription workflow...');
      
      try {
        // Get video info first to determine optimal model size
        const youtubeAPI = new YouTubeAPI(process.env.YOUTUBE_API_KEY!);
        let videoDurationMinutes = 0;
        try {
          const videoDetails = await youtubeAPI.getVideoDetails(youtubeId);
          videoDurationMinutes = youtubeAPI.parseDurationToMinutes(videoDetails.contentDetails?.duration || 'PT0S');
        } catch (error) {
          console.warn('⚠️ Could not get video duration, using default model size');
        }
        
        // Smart model selection based on duration for optimal speed/quality balance
        let optimalModelSize: 'tiny' | 'small' | 'base' = 'tiny';
        if (videoDurationMinutes < 5) {
          optimalModelSize = 'small'; // Better quality for short videos
        } else if (videoDurationMinutes < 15) {
          optimalModelSize = 'tiny'; // Good balance for medium videos
        } else {
          optimalModelSize = 'tiny'; // Prioritize speed for long videos
        }
        
        console.log(`🎯 Video duration: ${videoDurationMinutes} min → Using ${optimalModelSize} model for optimal performance`);
        
        // Streaming audio extraction with progress tracking
        console.log('🎵 Starting streaming audio extraction and transcription...');
        const result = await extractAndTranscribeAudio(youtubeId, {
          language: language,
          maxDuration: 60 * 60, // 60 minutes
          whisperModelSize: optimalModelSize,
          enableStreaming: true, // Enable streaming for better performance
          onProgress: (progress) => {
            console.log(`📊 Progress: ${progress.percent.toFixed(1)}% (${progress.processedSeconds}/${progress.totalSeconds}s)`);
            // TODO: In future, send progress updates to client via WebSocket or SSE
          }
        });
        
        transcript = result.transcript;
        source = result.source;
        
        console.log(`✅ Optimized streaming transcription completed: ${transcript ? transcript.length : 0} characters`);
        console.log(`📊 Video processed: ${result.videoDetails.title}`);
        console.log(`⚡ Processing time: ${result.processingInfo.processingTimeMs}ms (Model: ${result.processingInfo.whisperModel})`);
        console.log(`💾 Memory efficient: Used streaming pipeline instead of ${Math.round(videoDurationMinutes * 10)}MB+ buffer`);
        
        if (!transcript || transcript.trim().length === 0) {
          throw new Error('Local Whisper transcription returned empty result');
        }
        
      } catch (audioError) {
        console.error('❌ Optimized streaming transcription workflow failed:', audioError);
        
        // Enhanced error details for debugging
        const errorMessage = audioError instanceof Error ? audioError.message : 'Unknown error';
        
        console.error('❌ Detailed error:', {
          youtubeId,
          workflow: 'streaming-whisper-optimized',
          modelSize: optimalModelSize,
          videoDuration: `${videoDurationMinutes} minutes`,
          error: errorMessage,
          errorType: audioError instanceof Error ? audioError.constructor.name : typeof audioError
        });
        
        return NextResponse.json({
          error: 'Nie można wygenerować transkrypcji dla tego filmu',
          details: 'Wystąpił problem podczas zoptymalizowanej transkrypcji strumieniowej.',
          technicalDetails: errorMessage,
          troubleshooting: {
            possibleReasons: [
              'Film może być prywatny, zablokowany lub ograniczony',
              'Film jest dłuższy niż 60 minut',
              'FFmpeg nie jest zainstalowany lub nieprawidłowo skonfigurowany',
              'Problem z modelem Whisper lub brakiem pamięci',
              'Problemy z połączeniem internetowym podczas streamingu'
            ],
            suggestions: [
              'Sprawdź czy film jest publicznie dostępny',
              'Spróbuj z krótszym filmem (do 60 minut)', 
              'Zainstaluj FFmpeg: winget install ffmpeg',
              'Zrestartuj aplikację po instalacji FFmpeg',
              'Sprawdź połączenie internetowe',
              'Spróbuj z filmem z popularnego kanału'
            ],
            optimizations: {
              streamingEnabled: true,
              modelPreloadingEnabled: true,
              optimalModelSize: optimalModelSize,
              estimatedMemoryUsage: `~10MB (down from ${Math.round(videoDurationMinutes * 10)}MB+)`,
              parallelProcessing: 'Transcription starts during download'
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

    // Use raw Whisper transcript directly (preserve full content)
    // OpenAI formatting was shortening content from ~7000 to ~3000 characters
    // Raw Whisper provides better quality and complete information
    console.log(`✅ Using raw Whisper transcript: ${transcript.length} characters`);
    const formattedTranscript = transcript;

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

    // Save raw Whisper transcript to database (full content preserved)
    await prisma.video.upsert({
      where: { youtubeId },
      update: { 
        transcript: formattedTranscript, // Raw Whisper transcript (full content)
      },
      create: {
        youtubeId,
        title: videoDetails.snippet.title || 'Pending',
        channelName: 'Pending',
        thumbnail: '',
        transcript: formattedTranscript, // Raw Whisper transcript (full content)
      },
    });

    // 📊 Log usage AFTER successful transcription
    const minutesUsed = usageCheck.requiredMinutes || (videoDetails.contentDetails?.duration ? youtubeAPI.parseDurationToMinutes(videoDetails.contentDetails.duration) : 0);
    const videoDuration = videoDetails.contentDetails?.duration ? youtubeAPI.formatDuration(videoDetails.contentDetails.duration) : 'Unknown';
    
    await logVideoUsage({
      youtubeId,
      videoTitle: videoDetails.snippet.title || 'Unknown Title',
      videoDuration,
      minutesUsed,
      userId: user.id
    });

    console.log(`✅ Transcription completed and ${minutesUsed} minutes logged for user`);

    return NextResponse.json({ 
      transcript: formattedTranscript, // Return raw Whisper transcript (full content)
      cached: false,
      source: source, // Raw source without formatting
      usageInfo: {
        minutesUsed,
        videoDuration,
        remainingMinutes: usageCheck.remainingMinutes - minutesUsed
      }
    });
    
  } catch (error) {
    console.error('Transcribe API error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication failed')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Brak możliwości wykonania podsumowania dla tego filmu'
      },
      { status: 422 }
    );
  }
}