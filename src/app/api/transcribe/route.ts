import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { checkUsageLimit, logVideoUsage } from '@/lib/usageMiddleware';
import { YouTubeAPI } from '@/lib/youtube';
import fs from 'fs';
import path from 'path';
import ytdl from '@distube/ytdl-core';

// Rate limiting configuration
const requestQueue = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10;

// Check if user has exceeded rate limit
async function checkRateLimit(userId: string): Promise<boolean> {
  const now = Date.now();
  const userRequests = requestQueue.get(userId) || [];
  
  // Filter out requests older than the window
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  // Add current request and update queue
  recentRequests.push(now);
  requestQueue.set(userId, recentRequests);
  return true;
}

// Download audio from YouTube using ytdl-core
async function downloadAudioWithYtdlCore(youtubeId: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp');
  const audioPath = path.join(tempDir, `${youtubeId}.webm`);
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Check if audio already exists (cache for 24 hours)
  if (fs.existsSync(audioPath)) {
    const stats = fs.statSync(audioPath);
    const hoursSinceCreation = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (hoursSinceCreation < 24) {
      console.log(`💾 Using cached audio for ${youtubeId}`);
      return audioPath;
    } else {
      // Delete old cached file
      fs.unlinkSync(audioPath);
    }
  }
  
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  
  try {
    console.log(`🎵 Downloading audio for ${youtubeId}...`);
    
    // Get video info first to check if it exists
    const info = await ytdl.getInfo(videoUrl);
    console.log(`📹 Video found: ${info.videoDetails.title}`);
    
    // Create audio stream - download only audio in highest quality
    const audioStream = ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
    });
    
    // Create write stream
    const writeStream = fs.createWriteStream(audioPath);
    
    // Pipe audio stream to file
    audioStream.pipe(writeStream);
    
    // Return promise that resolves when download is complete
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        const stats = fs.statSync(audioPath);
        console.log(`✅ Audio downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        resolve(audioPath);
      });
      
      writeStream.on('error', (error) => {
        console.error('❌ Error writing audio file:', error);
        reject(error);
      });
      
      audioStream.on('error', (error) => {
        console.error('❌ Error downloading audio:', error);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error(`❌ Error with ytdl-core:`, error instanceof Error ? error.message : 'Unknown error');
    
    // Handle specific ytdl errors
    if (error instanceof Error) {
      if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        throw new Error('RATE_LIMIT');
      }
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        throw new Error('VIDEO_FORBIDDEN');
      }
      if (error.message.includes('404') || error.message.includes('not found')) {
        throw new Error('VIDEO_NOT_FOUND');
      }
      if (error.message.includes('private') || error.message.includes('unavailable')) {
        throw new Error('VIDEO_UNAVAILABLE');
      }
    }
    
    throw error;
  }
}

// Upload audio file to Gladia API
async function uploadAudioToGladia(audioPath: string, apiKey: string): Promise<string> {
  try {
    console.log(`📤 Uploading audio to Gladia...`);
    
    // Read audio file into buffer
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    
    // Create form data with audio file
    const formData = new FormData();
    formData.append('audio', audioBlob, path.basename(audioPath));
    
    // Upload to Gladia /v2/upload endpoint
    const response = await fetch('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': apiKey,
        // Don't set Content-Type - let fetch set it automatically for FormData
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Gladia upload error:`, error);
      throw new Error(`Gladia upload error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    const audioUrl = result.audio_url;
    
    if (!audioUrl) {
      console.error('❌ No audio_url in Gladia upload response:', result);
      throw new Error('No audio_url received from Gladia upload');
    }
    
    console.log(`✅ Audio uploaded successfully: ${audioUrl}`);
    return audioUrl;
    
  } catch (error) {
    console.error(`❌ Error uploading audio to Gladia:`, error);
    throw error;
  }
}

// Transcribe audio using Gladia API (two-step process)
async function transcribeWithGladia(audioPath: string): Promise<string> {
  const apiKey = process.env.GLADIA_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_GLADIA_API_KEY_HERE') {
    throw new Error('Gladia API key not configured. Please add your API key to .env.local');
  }
  
  try {
    console.log(`🎙️ Starting Gladia transcription workflow...`);
    
    // Step 1: Upload audio file
    const audioUrl = await uploadAudioToGladia(audioPath, apiKey);
    
    // Step 2: Start transcription with JSON request
    console.log(`🚀 Starting transcription for uploaded audio...`);
    
    const response = await fetch('https://api.gladia.io/v2/pre-recorded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gladia-key': apiKey,
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        detect_language: true
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Gladia transcription start error:`, error);
      throw new Error(`Gladia transcription start error: ${response.status} - ${error}`);
    }
    
    const { id } = await response.json();
    console.log(`🆔 Gladia transcription ID: ${id}`);
    
    // Get file size for adaptive polling
    const stats = fs.statSync(audioPath);
    const sizeMB = stats.size / (1024 * 1024);
    
    // Adaptive polling strategy based on file size
    const getPollingInterval = (attempt: number, fileSizeMB: number): number => {
      // Base interval: 3-10 seconds based on file size
      const baseInterval = Math.min(10000, Math.max(3000, fileSizeMB * 1000));
      
      // Exponential backoff for longer files after 3 attempts
      if (attempt <= 3) {
        return baseInterval;
      } else {
        const multiplier = Math.min(1.5, 1 + (attempt - 3) * 0.1);
        return Math.floor(baseInterval * multiplier);
      }
    };
    
    // Estimate processing time and max attempts
    const estimatedSeconds = Math.ceil(sizeMB * 2.5); // ~2.5 seconds per MB
    const maxAttempts = Math.min(40, Math.max(15, Math.ceil(estimatedSeconds / 5) + 10));
    
    console.log(`📊 Audio size: ${sizeMB.toFixed(1)}MB, estimated processing: ~${estimatedSeconds}s, max attempts: ${maxAttempts}`);
    
    // Poll for results with adaptive intervals
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      const pollingInterval = getPollingInterval(attempts, sizeMB);
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      
      const statusResponse = await fetch(`https://api.gladia.io/v2/pre-recorded/${id}`, {
        headers: {
          'x-gladia-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (!statusResponse.ok) {
        const error = await statusResponse.text();
        console.error(`❌ Gladia status check error:`, error);
        throw new Error(`Gladia status check error: ${statusResponse.status}`);
      }
      
      const result = await statusResponse.json();
      
      if (result.status === 'done') {
        console.log(`✅ Gladia transcription completed`);
        
        // Extract transcript from result
        if (result.result?.transcription?.full_transcript) {
          return result.result.transcription.full_transcript;
        } else if (result.result?.transcription?.utterances) {
          // Fallback to utterances if full_transcript not available
          return result.result.transcription.utterances
            .map((u: any) => u.text)
            .join(' ');
        }
        
        console.error('❌ No transcript found in Gladia response');
        throw new Error('No transcript found in Gladia response');
      } else if (result.status === 'error') {
        console.error(`❌ Gladia transcription failed:`, result.error);
        throw new Error(`Gladia transcription failed: ${result.error}`);
      }
      
      // Calculate and show progress
      const progress = Math.min(90, (attempts / maxAttempts) * 100);
      console.log(`⏳ Waiting for Gladia... (attempt ${attempts}/${maxAttempts}, ${progress.toFixed(0)}% estimated)`);
      
      // Early exit if we're way over estimated time
      if (attempts > estimatedSeconds / 3 && attempts > 10) {
        console.log(`⚠️ Processing taking longer than expected (${attempts * pollingInterval / 1000}s vs estimated ${estimatedSeconds}s)`);
      }
    }
    
    throw new Error('Gladia transcription timeout - took too long to process');
    
  } catch (error) {
    console.error(`❌ Gladia transcription error:`, error);
    throw error;
  } finally {
    // Clean up audio file after transcription attempt
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
        console.log(`🗑️ Cleaned up audio file: ${audioPath}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Could not clean up audio file:`, cleanupError);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check rate limit for this user
    const canProceed = await checkRateLimit(userId);
    if (!canProceed) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please wait a minute before trying again.',
          retryAfter: 60
        },
        { status: 429 }
      );
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

    // New workflow: Audio → Gladia → Transcript
    console.log(`🚀 Starting transcription workflow for ${youtubeId}`);
    
    // Step 1: Download audio using ytdl-core
    const audioPath = await downloadAudioWithYtdlCore(youtubeId);
    
    // Step 2: Transcribe using Gladia
    const transcript = await transcribeWithGladia(audioPath);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('Empty transcript received from Gladia');
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
    const minutesUsed = usageCheck.requiredMinutes || youtubeAPI.parseDurationToMinutes(videoDetails.contentDetails.duration);
    const videoDuration = youtubeAPI.formatDuration(videoDetails.contentDetails.duration);
    
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
      source: 'gladia',
      usageInfo: {
        minutesUsed,
        videoDuration,
        remainingMinutes: usageCheck.remainingMinutes - minutesUsed
      }
    });
    
  } catch (error) {
    console.error('Transcribe API error:', error);
    
    if (error instanceof Error) {
      // Handle specific error cases with user-friendly messages
      if (error.message === 'RATE_LIMIT') {
        return NextResponse.json(
          { 
            error: 'YouTube is currently rate limiting requests. Please try again in a few minutes.',
            retryAfter: 300, // 5 minutes
            code: 'RATE_LIMIT'
          },
          { status: 429 }
        );
      }
      if (error.message === 'VIDEO_FORBIDDEN') {
        return NextResponse.json(
          { 
            error: 'This video may be private, age-restricted, or not available in your region.',
            code: 'VIDEO_FORBIDDEN'
          },
          { status: 403 }
        );
      }
      if (error.message === 'VIDEO_NOT_FOUND') {
        return NextResponse.json(
          { 
            error: 'Video not found. Please check the URL and try again.',
            code: 'VIDEO_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      if (error.message === 'VIDEO_UNAVAILABLE') {
        return NextResponse.json(
          { 
            error: 'This video is unavailable or has been deleted.',
            code: 'VIDEO_UNAVAILABLE'
          },
          { status: 404 }
        );
      }
      if (error.message.includes('Gladia API key not configured')) {
        return NextResponse.json(
          { 
            error: 'Transcription service not configured. Please contact support.',
            code: 'CONFIG_ERROR'
          },
          { status: 500 }
        );
      }
      if (error.message.includes('Gladia')) {
        return NextResponse.json(
          { 
            error: 'Transcription service temporarily unavailable. Please try again later.',
            code: 'TRANSCRIPTION_ERROR'
          },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to transcribe video. Please try again later.',
        code: 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}