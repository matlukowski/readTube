import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
// @ts-expect-error - no types available for youtube-captions-scraper
import { getSubtitles } from 'youtube-captions-scraper';

interface Caption {
  text: string;
  start?: string;
  dur?: string;
}

// Get transcript from YouTube captions (manual or automatic)
async function getYouTubeTranscript(youtubeId: string): Promise<string | null> {
  try {
    console.log(`🎬 Fetching YouTube captions for ${youtubeId}...`);
    
    // Try different languages in order of preference
    const languages = ['pl', 'en', 'en-US', 'pl-PL', 'auto', 'es', 'de', 'fr'];
    
    for (const lang of languages) {
      try {
        console.log(`🔍 Trying language: ${lang}`);
        
        const captions = await getSubtitles({
          videoID: youtubeId,
          lang: lang === 'auto' ? 'en' : lang // fallback for auto
        }) as Caption[];
        
        if (captions && captions.length > 0) {
          console.log(`✅ Captions found in language: ${lang} (${captions.length} segments)`);
          
          // Convert captions to clean text suitable for AI processing
          const plainText = captions
            .map((item: Caption) => item.text || '')
            .join(' ')
            .replace(/\[.*?\]/g, '')     // Remove [Music], [Applause], etc.
            .replace(/\(.*?\)/g, '')     // Remove (background noise), etc.
            .replace(/&amp;/g, '&')     // Decode HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')        // Normalize whitespace
            .trim();
          
          if (plainText.length > 0) {
            console.log(`✅ YouTube captions extracted: ${plainText.length} characters`);
            console.log(`📝 Preview: ${plainText.substring(0, 200)}...`);
            return plainText;
          }
        }
      } catch {
        console.log(`Language ${lang} not available, trying next...`);
        continue;
      }
    }
    
    // If no language worked, try the old library as fallback
    console.log(`⚠️ youtube-captions-scraper failed, trying fallback...`);
    try {
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcriptArray = await YoutubeTranscript.fetchTranscript(youtubeId);
      
      if (transcriptArray && transcriptArray.length > 0) {
        const plainText = transcriptArray
          .map(item => item.text)
          .join(' ')
          .replace(/\[.*?\]/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        
        if (plainText.length > 0) {
          console.log(`✅ Fallback library success: ${plainText.length} characters`);
          return plainText;
        }
      }
    } catch (fallbackError) {
      console.log(`❌ Fallback library also failed:`, fallbackError);
    }
    
    console.log(`❌ No captions found for ${youtubeId} in any language or method`);
    return null;
    
  } catch (error) {
    console.error(`❌ YouTube captions extraction failed:`, error);
    return null;
  }
}



export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { youtubeId } = transcribeRequestSchema.parse(body);

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

    // New simplified workflow: YouTube Captions Only
    console.log(`🚀 Starting transcription workflow for ${youtubeId}`);
    
    // Get transcript from YouTube captions (manual or automatic)
    const transcript = await getYouTubeTranscript(youtubeId);
    
    if (!transcript || transcript.length === 0) {
      return NextResponse.json({
        error: 'Brak możliwości wykonania podsumowania dla tego filmu'
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
      source: 'youtube-captions',
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