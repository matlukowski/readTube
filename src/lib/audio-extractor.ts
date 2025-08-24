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
  console.log(`🔧 Debug: Options: ${JSON.stringify(options)}`);

  // Validate YouTube ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    console.error(`❌ Invalid YouTube ID format: ${youtubeId}`);
    throw new Error('Invalid YouTube ID format');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  console.log(`🔧 Debug: Video URL: ${videoUrl}`);

  // Step 1: Get video info to check availability and get audio stream
  console.log('📡 Step 1: Getting video info from YouTube...');
  let info;
  try {
    info = await ytdl.getInfo(videoUrl);
    console.log(`✅ Step 1 complete: Video info retrieved`);
  } catch (ytdlError) {
    console.error(`❌ Step 1 failed: ytdl.getInfo error:`, ytdlError);
    throw ytdlError;
  }
    
  try {
    if (!info) {
      throw new Error('Could not fetch video information');
    }

    console.log(`📊 Step 1 details: "${info.videoDetails.title}"`);
    
    // Step 2: Check video duration (limit to prevent abuse)
    console.log('⏱️ Step 2: Checking video duration...');
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
    console.log(`🔧 Debug: Duration: ${durationSeconds} seconds (${Math.round(durationSeconds/60)} minutes)`);
    
    if (durationSeconds > maxDuration) {
      const errorMsg = `Video too long (${Math.round(durationSeconds/60)} minutes). Maximum allowed: ${maxDuration/60} minutes.`;
      console.error(`❌ Step 2 failed: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`✅ Step 2 complete: Duration check passed`);

    // Step 3: Get audio stream URL
    console.log('🎧 Step 3: Finding best audio stream...');
    let audioFormats;
    try {
      audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      console.log(`🔧 Debug: Found ${audioFormats.length} audio formats`);
    } catch (formatError) {
      console.error(`❌ Step 3 failed: Format filtering error:`, formatError);
      throw formatError;
    }
    
    if (!audioFormats.length) {
      console.error(`❌ Step 3 failed: No audio streams found`);
      throw new Error('No audio streams found for this video');
    }

    // Choose best audio format (prefer m4a/mp4a, fallback to webm)
    const bestAudio = audioFormats.find(f => 
      f.container === 'mp4' && f.audioCodec?.includes('mp4a')
    ) || audioFormats.find(f => 
      f.container === 'webm' && f.audioCodec?.includes('opus')
    ) || audioFormats[0];

    console.log(`🎵 Selected audio format: ${bestAudio.container} (${bestAudio.audioCodec})`);
    console.log(`✅ Step 3 complete: Audio format selected`);

    // Step 4: Stream audio directly to buffer
    console.log('⬇️ Step 4: Streaming audio data...');
    let audioStream;
    try {
      audioStream = ytdl(videoUrl, {
        format: bestAudio,
        highWaterMark: 1024 * 1024, // 1MB chunks
      });
      console.log(`🔧 Debug: Audio stream created successfully`);
    } catch (streamError) {
      console.error(`❌ Step 4 failed: Stream creation error:`, streamError);
      throw streamError;
    }

    // Convert Node.js stream to buffer for Gladia
    const chunks: Buffer[] = [];
    
    audioStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    let audioBuffer;
    try {
      audioBuffer = await new Promise<Buffer>((resolve, reject) => {
        audioStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`📦 Audio buffer ready: ${buffer.length} bytes`);
          resolve(buffer);
        });
        audioStream.on('error', (streamError) => {
          console.error(`❌ Step 4 failed: Stream error:`, streamError);
          reject(streamError);
        });
      });
      console.log(`✅ Step 4 complete: Audio data streamed`);
    } catch (bufferError) {
      console.error(`❌ Step 4 failed: Buffer creation error:`, bufferError);
      throw bufferError;
    }

    // Step 5: Initialize Gladia client
    console.log('🤖 Step 5: Starting Gladia transcription...');
    let gladiaClient;
    try {
      gladiaClient = createGladiaClient();
      console.log(`✅ Step 5a: Gladia client created successfully`);
    } catch (gladiaError) {
      console.error(`❌ Step 5 failed: Gladia client creation error:`, gladiaError);
      throw gladiaError;
    }
    
    // Step 6: Call Gladia API for transcription
    console.log('📤 Step 6: Calling Gladia API...');
    let transcript;
    try {
      const transcriptionConfig = {
        language: language === 'auto' ? undefined : language,
        diarization: false, // Disable for faster processing
        code_switching: true, // Enable multiple languages
      };
      console.log(`🔧 Debug: Gladia config: ${JSON.stringify(transcriptionConfig)}`);
      
      transcript = await gladiaClient.transcribeAudio(audioBuffer, transcriptionConfig, 300000); // 5 minute timeout
      console.log(`🔧 Debug: Gladia returned transcript length: ${transcript ? transcript.length : 'null'}`);
      console.log(`✅ Step 6 complete: Gladia API call successful`);
    } catch (transcriptionError) {
      console.error(`❌ Step 6 failed: Gladia transcription error:`, transcriptionError);
      throw transcriptionError;
    }

    if (!transcript || transcript.trim().length === 0) {
      console.error(`❌ Final validation failed: Empty transcript`);
      throw new Error('Transcription completed but resulted in empty text');
    }

    console.log(`✅ Audio transcription completed: ${transcript.length} characters`);
    console.log(`🔧 Debug: Transcript preview: ${transcript.substring(0, 100)}...`);

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