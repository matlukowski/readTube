// Shared YouTube audio extraction and Gladia transcription logic
// Used by both API routes and direct server calls

import ytdl from '@distube/ytdl-core';
import { createGladiaClient } from './gladia-client';

export interface AudioExtractionResult {
  transcript: string;
  source: string;
  videoDetails: {
    title: string;
    duration: string;
    author?: string;
  };
  processingInfo: {
    audioFormat: string;
    audioCodec?: string;
    durationSeconds: number;
    transcriptionLength: number;
  };
}

export interface AudioExtractionOptions {
  language?: string;
  maxDuration?: number; // in seconds, default 30 minutes
}

/**
 * Extract audio from YouTube video and transcribe using Gladia API
 */
export async function extractAndTranscribeAudio(
  youtubeId: string,
  options: AudioExtractionOptions = {}
): Promise<AudioExtractionResult> {
  const { language = 'auto', maxDuration = 30 * 60 } = options;
  
  console.log(`🎵 Starting audio extraction and transcription for ${youtubeId}`);

  // Validate YouTube ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    throw new Error('Invalid YouTube ID format');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  try {
    // Step 1: Get video info to check availability and get audio stream
    console.log('📡 Getting video info from YouTube...');
    const info = await ytdl.getInfo(videoUrl);
    
    if (!info) {
      throw new Error('Could not fetch video information');
    }

    console.log(`📊 Video info retrieved: "${info.videoDetails.title}"`);
    
    // Check video duration (limit to prevent abuse)
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
    
    if (durationSeconds > maxDuration) {
      throw new Error(
        `Video too long (${Math.round(durationSeconds/60)} minutes). Maximum allowed: ${maxDuration/60} minutes.`
      );
    }

    // Step 2: Get audio stream URL
    console.log('🎧 Finding best audio stream...');
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (!audioFormats.length) {
      throw new Error('No audio streams found for this video');
    }

    // Choose best audio format (prefer m4a/mp4a, fallback to webm)
    const bestAudio = audioFormats.find(f => 
      f.container === 'mp4' && f.audioCodec?.includes('mp4a')
    ) || audioFormats.find(f => 
      f.container === 'webm' && f.audioCodec?.includes('opus')
    ) || audioFormats[0];

    console.log(`🎵 Selected audio format: ${bestAudio.container} (${bestAudio.audioCodec})`);

    // Step 3: Stream audio directly to Gladia (no temp files)
    console.log('⬇️ Streaming audio for transcription...');
    const audioStream = ytdl(videoUrl, {
      format: bestAudio,
      highWaterMark: 1024 * 1024, // 1MB chunks
    });

    // Convert Node.js stream to buffer for Gladia
    const chunks: Buffer[] = [];
    
    audioStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      audioStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', reject);
    });

    console.log(`📦 Audio buffer ready: ${audioBuffer.length} bytes`);

    // Step 4: Send to Gladia for transcription
    console.log('🤖 Starting Gladia transcription...');
    const gladiaClient = createGladiaClient();
    
    const transcript = await gladiaClient.transcribeAudio(audioBuffer, {
      language: language === 'auto' ? undefined : language,
      diarization: false, // Disable for faster processing
      code_switching: true, // Enable multiple languages
    }, 300000); // 5 minute timeout

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcription completed but resulted in empty text');
    }

    console.log(`✅ Audio transcription completed: ${transcript.length} characters`);

    return {
      transcript: transcript.trim(),
      source: 'gladia-audio',
      videoDetails: {
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author?.name
      },
      processingInfo: {
        audioFormat: bestAudio.container,
        audioCodec: bestAudio.audioCodec,
        durationSeconds,
        transcriptionLength: transcript.length
      }
    };

  } catch (error) {
    console.error('❌ Audio extraction and transcription failed:', error);
    
    // Enhance error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('Video unavailable')) {
        throw new Error('Video is not available or may be private/restricted');
      }
      
      if (error.message.includes('Sign in to confirm')) {
        throw new Error('Video requires age verification or sign-in');
      }
      
      if (error.message.includes('copyright')) {
        throw new Error('Video may be copyright-restricted');
      }
      
      if (error.message.includes('too long')) {
        throw error; // Pass through duration error as-is
      }
    }
    
    // Re-throw with context
    throw new Error(`Audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if audio extraction is available for a video (quick check)
 */
export async function checkAudioExtractionAvailability(youtubeId: string): Promise<{
  available: boolean;
  duration?: number;
  tooLong?: boolean;
  title?: string;
  audioFormatsCount?: number;
  error?: string;
}> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    
    // Quick check if video is accessible
    const info = await ytdl.getBasicInfo(videoUrl);
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
    const maxDuration = 30 * 60; // 30 minutes
    
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    return {
      available: audioFormats.length > 0,
      duration: durationSeconds,
      tooLong: durationSeconds > maxDuration,
      title: info.videoDetails.title,
      audioFormatsCount: audioFormats.length
    };
    
  } catch (error) {
    console.error('❌ Audio availability check failed:', error);
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Video check failed'
    };
  }
}