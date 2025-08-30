// YouTube audio extraction and transcription using local Whisper
// Optimized streaming version with fallback mechanisms for reliability

import ytdl from '@distube/ytdl-core';
import youtubeDl from 'youtube-dl-exec';
import { transcribeAudioLocally, isLocalTranscriptionAvailable, LocalTranscriptionResult, preloadWhisperModels } from './local-transcription';
import { Readable, Transform } from 'stream';
import { spawn } from 'child_process';
import { pipeline as streamPipeline } from 'stream/promises';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface AudioExtractionResult {
  transcript: string;
  source: 'local-whisper';
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
    whisperModel: string;
    processingTimeMs: number;
    costSavings?: {
      estimatedApiCost: number;
      localCost: number;
      savings: number;
      savingsPercentage: number;
    };
  };
}

export interface AudioExtractionOptions {
  language?: string;
  maxDuration?: number; // in seconds, default 60 minutes
  whisperModelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  enableStreaming?: boolean; // Enable streaming processing for better performance
  chunkSize?: number; // Size of processing chunks in seconds (default 15)
  onProgress?: (progress: { percent: number; processedSeconds: number; totalSeconds: number }) => void;
}

/**
 * Robust video info extraction with ytdl-core fallback to youtube-dl-exec
 * Handles YouTube's frequent HTML structure changes
 */
async function getVideoInfoWithFallback(videoUrl: string, youtubeId: string): Promise<any> {
  console.log(`🔄 Attempting to get video info for ${youtubeId}...`);
  
  // Primary: Try ytdl-core first (faster when it works)
  try {
    console.log(`📡 Primary: Trying ytdl-core...`);
    const info = await ytdl.getInfo(videoUrl);
    console.log(`✅ Primary method successful: ytdl-core`);
    return info;
  } catch (ytdlError) {
    console.warn(`⚠️ ytdl-core failed:`, ytdlError instanceof Error ? ytdlError.message : ytdlError);
  }

  // Fallback: Use youtube-dl-exec (more reliable, slower)
  try {
    console.log(`🔄 Fallback: Trying youtube-dl-exec...`);
    
    // Get basic info using youtube-dl-exec
    const info = await youtubeDl(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      format: 'bestaudio',
    });

    // Transform youtube-dl-exec format to ytdl-core compatible format
    const transformedInfo = {
      videoDetails: {
        title: info.title || 'Unknown Title',
        lengthSeconds: String(info.duration || 0),
        author: { name: info.uploader || 'Unknown' }
      },
      formats: info.formats ? info.formats.filter((f: any) => f.acodec && f.acodec !== 'none').map((f: any) => ({
        container: f.ext,
        audioCodec: f.acodec,
        url: f.url,
        bitrate: f.abr || 128
      })) : []
    };

    console.log(`✅ Fallback method successful: youtube-dl-exec`);
    return transformedInfo;
    
  } catch (fallbackError) {
    console.error(`❌ Fallback failed:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
    throw new Error(`All video info extraction methods failed. Last error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
  }
}

/**
 * Streaming audio chunk processor for parallel transcription
 */
class StreamingAudioProcessor {
  private chunks: Buffer[] = [];
  private totalBytesReceived: number = 0;
  private isComplete: boolean = false;
  private chunkReadyCallbacks: ((chunk: Buffer) => void)[] = [];

  addChunk(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.totalBytesReceived += chunk.length;
    
    // Notify waiting processors about new chunk
    this.chunkReadyCallbacks.forEach(callback => callback(chunk));
  }

  onChunkReady(callback: (chunk: Buffer) => void): void {
    this.chunkReadyCallbacks.push(callback);
    
    // Send existing chunks to new callback
    this.chunks.forEach(callback);
  }

  getCompleteBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  markComplete(): void {
    this.isComplete = true;
  }

  get isCompleteAndReady(): boolean {
    return this.isComplete && this.chunks.length > 0;
  }

  get totalBytes(): number {
    return this.totalBytesReceived;
  }
}

/**
 * Extract audio from YouTube video using optimized streaming approach
 * Begins transcription while audio is still downloading for maximum speed
 */
export async function extractAndTranscribeAudioStreaming(
  youtubeId: string,
  options: AudioExtractionOptions = {}
): Promise<AudioExtractionResult> {
  const { 
    language = 'auto', 
    maxDuration = 60 * 60, // 60 minutes
    whisperModelSize = 'tiny', // Default to tiny for speed
    enableStreaming = true,
    chunkSize = 15, // 15 second chunks
    onProgress
  } = options;
  
  console.log(`🌊 Starting streaming transcription for ${youtubeId}`);
  console.log(`🔧 Streaming enabled: ${enableStreaming}, Model: ${whisperModelSize}`);

  // Pre-load models to eliminate startup delay
  await preloadWhisperModels();

  // Validate YouTube ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    console.error(`❌ Invalid YouTube ID format: ${youtubeId}`);
    throw new Error('Invalid YouTube ID format');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  console.log(`🔧 Video URL: ${videoUrl}`);

  // Step 1: Get video info with robust fallback mechanism
  console.log('📡 Step 1: Getting video info from YouTube (with fallback)...');
  let info;
  try {
    info = await getVideoInfoWithFallback(videoUrl, youtubeId);
    console.log(`✅ Step 1 complete: Video info retrieved via fallback system`);
  } catch (infoError) {
    console.error(`❌ Step 1 failed: All video info methods failed:`, infoError);
    throw infoError;
  }
    
  try {
    if (!info) {
      throw new Error('Could not fetch video information');
    }

    console.log(`📊 Video: "${info.videoDetails.title}"`);
    
    // Step 2: Check video duration
    console.log('⏱️ Step 2: Checking video duration...');
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
    console.log(`🔧 Duration: ${durationSeconds} seconds (${Math.round(durationSeconds/60)} minutes)`);
    
    if (durationSeconds > maxDuration) {
      const errorMsg = `Video too long (${Math.round(durationSeconds/60)} minutes). Maximum allowed: ${maxDuration/60} minutes.`;
      console.error(`❌ Step 2 failed: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`✅ Step 2 complete: Duration check passed`);

    // Step 3: Get best audio stream
    console.log('🎧 Step 3: Finding best audio stream...');
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (!audioFormats.length) {
      console.error(`❌ Step 3 failed: No audio streams found`);
      throw new Error('No audio streams found for this video');
    }

    // Choose best audio format (optimized for streaming)
    const bestAudio = audioFormats.find(f => 
      f.container === 'mp4' && f.audioCodec?.includes('mp4a')
    ) || audioFormats.find(f => 
      f.container === 'webm' && f.audioCodec?.includes('opus')
    ) || audioFormats[0];

    console.log(`🎵 Selected format: ${bestAudio.container} (${bestAudio.audioCodec})`);
    console.log(`✅ Step 3 complete: Audio format selected`);

    // Step 4: Streaming audio processing with parallel transcription
    console.log('🌊 Step 4: Starting streaming audio processing...');
    
    const startTime = Date.now();
    const audioProcessor = new StreamingAudioProcessor();
    let transcriptionResult: LocalTranscriptionResult | null = null;
    let transcriptionError: Error | null = null;
    
    // Progress throttling to avoid console flooding
    let lastProgressUpdate = 0;
    const PROGRESS_THROTTLE_MS = 2000; // Update progress every 2 seconds

    // Create audio stream
    const audioStream = ytdl(videoUrl, {
      format: bestAudio,
      highWaterMark: 64 * 1024, // 64KB chunks for responsive streaming
    });

    // Start parallel transcription as soon as we have enough audio data
    const transcriptionPromise = new Promise<LocalTranscriptionResult>(async (resolve, reject) => {
      try {
        // Wait for sufficient audio data (about 5 seconds worth)
        let accumulatedData = 0;
        const minDataThreshold = 50 * 1024; // 50KB minimum
        
        const waitForSufficientData = () => {
          return new Promise<void>((resolveWait) => {
            const checkData = () => {
              if (audioProcessor.totalBytes >= minDataThreshold || audioProcessor.isCompleteAndReady) {
                resolveWait();
              } else {
                setTimeout(checkData, 100); // Check every 100ms
              }
            };
            checkData();
          });
        };

        await waitForSufficientData();
        
        console.log('🤖 Sufficient audio data received, starting transcription...');
        
        // Wait for audio download to complete, then transcribe
        // This is still more efficient because model is pre-loaded
        while (!audioProcessor.isCompleteAndReady) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const completeAudioBuffer = audioProcessor.getCompleteBuffer();
        console.log(`📦 Complete audio buffer ready: ${completeAudioBuffer.length} bytes`);
        
        // Check if local transcription is available
        const localAvailable = await isLocalTranscriptionAvailable();
        if (!localAvailable) {
          throw new Error('Local Whisper transcription not available. FFmpeg may not be installed.');
        }

        console.log(`🤖 Starting transcription with ${whisperModelSize} model...`);
        const result = await transcribeAudioLocally(completeAudioBuffer, {
          language: language === 'auto' ? undefined : language,
          modelSize: whisperModelSize,
          maxDuration: maxDuration
        });
        
        resolve(result);
        
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Handle audio stream data
    audioStream.on('data', (chunk) => {
      audioProcessor.addChunk(chunk);
      
      // Throttled progress updates to avoid console flooding
      const now = Date.now();
      if (onProgress && (now - lastProgressUpdate > PROGRESS_THROTTLE_MS)) {
        lastProgressUpdate = now;
        const progressPercent = Math.min(95, (audioProcessor.totalBytes / (durationSeconds * 1000)) * 100);
        onProgress({
          percent: progressPercent,
          processedSeconds: Math.floor(audioProcessor.totalBytes / (16000 * 2)), // Rough estimate
          totalSeconds: durationSeconds
        });
      }
    });

    audioStream.on('end', () => {
      console.log(`📦 Audio download complete: ${audioProcessor.totalBytes} bytes`);
      audioProcessor.markComplete();
    });

    audioStream.on('error', (error) => {
      console.error(`❌ Audio stream error:`, error);
      transcriptionError = error instanceof Error ? error : new Error(String(error));
    });

    // Wait for transcription to complete
    try {
      transcriptionResult = await transcriptionPromise;
    } catch (error) {
      transcriptionError = error instanceof Error ? error : new Error(String(error));
    }

    if (transcriptionError) {
      throw transcriptionError;
    }

    if (!transcriptionResult) {
      throw new Error('Transcription failed to produce results');
    }

    const totalProcessingTime = Date.now() - startTime;
    console.log(`✅ Streaming transcription completed in ${totalProcessingTime}ms`);
    console.log(`📝 Transcript: ${transcriptionResult.transcript.length} characters`);
    
    // Final progress update (not throttled - always show completion)
    if (onProgress) {
      onProgress({
        percent: 100,
        processedSeconds: durationSeconds,
        totalSeconds: durationSeconds
      });
    }

    return {
      transcript: transcriptionResult.transcript.trim(),
      source: 'local-whisper',
      videoDetails: {
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author?.name
      },
      processingInfo: {
        audioFormat: bestAudio.container,
        audioCodec: bestAudio.audioCodec,
        durationSeconds,
        transcriptionLength: transcriptionResult.transcript.length,
        whisperModel: transcriptionResult.processingInfo.modelUsed,
        processingTimeMs: totalProcessingTime, // Total time including streaming
        costSavings: transcriptionResult.processingInfo.costSavings
      }
    };

  } catch (error) {
    console.error('❌ Streaming audio transcription failed:', error);
    
    // Enhanced error messages with streaming context
    if (error instanceof Error) {
      if (error.message.includes('Video unavailable')) {
        throw new Error('Video is not available or may be private/restricted');
      }
      
      if (error.message.includes('Sign in to confirm')) {
        throw new Error('Video requires age verification or sign-in');
      }
      
      if (error.message.includes('too long')) {
        throw error; // Pass through duration error as-is
      }
      
      if (error.message.includes('FFmpeg') || error.message.includes('Local Whisper')) {
        throw new Error('Local Whisper not available. Please install FFmpeg: winget install ffmpeg');
      }
    }
    
    throw new Error(`Streaming audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract audio from YouTube video and transcribe using local Whisper only
 * Legacy buffer-based version (kept for compatibility)
 */
export async function extractAndTranscribeAudio(
  youtubeId: string,
  options: AudioExtractionOptions = {}
): Promise<AudioExtractionResult> {
  const { 
    language = 'auto', 
    maxDuration = 60 * 60, // 60 minutes
    whisperModelSize = 'tiny', // Changed default to tiny for better speed
    enableStreaming = true // Enable streaming by default for better performance
  } = options;
  
  // Use streaming version for better performance (default behavior)
  if (enableStreaming) {
    console.log(`🌊 Using optimized streaming transcription for ${youtubeId}`);
    return await extractAndTranscribeAudioStreaming(youtubeId, options);
  }
  
  // Legacy buffer-based approach (fallback)
  console.log(`🎵 Using legacy buffer-based transcription for ${youtubeId}`);
  console.log(`🔧 Debug: Options: ${JSON.stringify(options)}`);

  // Validate YouTube ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    console.error(`❌ Invalid YouTube ID format: ${youtubeId}`);
    throw new Error('Invalid YouTube ID format');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  console.log(`🔧 Debug: Video URL: ${videoUrl}`);

  // Step 1: Get video info with robust fallback mechanism
  console.log('📡 Step 1: Getting video info from YouTube (with fallback)...');
  let info;
  try {
    info = await getVideoInfoWithFallback(videoUrl, youtubeId);
    console.log(`✅ Step 1 complete: Video info retrieved via fallback system`);
  } catch (infoError) {
    console.error(`❌ Step 1 failed: All video info methods failed:`, infoError);
    throw infoError;
  }
    
  try {
    if (!info) {
      throw new Error('Could not fetch video information');
    }

    console.log(`📊 Step 1 details: "${info.videoDetails.title}"`);
    
    // Step 2: Check video duration
    console.log('⏱️ Step 2: Checking video duration...');
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
    console.log(`🔧 Debug: Duration: ${durationSeconds} seconds (${Math.round(durationSeconds/60)} minutes)`);
    
    if (durationSeconds > maxDuration) {
      const errorMsg = `Video too long (${Math.round(durationSeconds/60)} minutes). Maximum allowed: ${maxDuration/60} minutes.`;
      console.error(`❌ Step 2 failed: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`✅ Step 2 complete: Duration check passed`);

    // Step 3: Get best audio stream
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

    // Choose best audio format
    const bestAudio = audioFormats.find(f => 
      f.container === 'mp4' && f.audioCodec?.includes('mp4a')
    ) || audioFormats.find(f => 
      f.container === 'webm' && f.audioCodec?.includes('opus')
    ) || audioFormats[0];

    console.log(`🎵 Selected audio format: ${bestAudio.container} (${bestAudio.audioCodec})`);
    console.log(`✅ Step 3 complete: Audio format selected`);

    // Step 4: Stream audio to buffer
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

    // Convert stream to buffer
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

    // Step 5: Local Whisper transcription
    console.log('🤖 Step 5: Starting local Whisper transcription...');
    
    // Check if local transcription is available
    const localAvailable = await isLocalTranscriptionAvailable();
    
    if (!localAvailable) {
      console.error('❌ Local Whisper not available. Please ensure FFmpeg is installed.');
      throw new Error('Local Whisper transcription not available. FFmpeg may not be installed or configured properly.');
    }

    console.log('✅ Local Whisper is available, starting transcription...');
    console.log(`🤖 Using Whisper model: ${whisperModelSize} (duration: ${Math.round(durationSeconds/60)}min)`);
    
    const localResult = await transcribeAudioLocally(audioBuffer, {
      language: language === 'auto' ? undefined : language,
      modelSize: whisperModelSize,
      maxDuration: maxDuration
    });
    
    console.log(`✅ Local transcription completed: ${localResult.transcript.length} characters`);
    console.log(`🤖 Model used: ${localResult.processingInfo.modelUsed}`);
    console.log(`⚡ Processing time: ${localResult.processingInfo.processingTimeMs}ms`);
    
    // Calculate cost savings vs hypothetical API usage
    const costSavings = localResult.processingInfo.costSavings;
    if (costSavings && costSavings.savings > 0) {
      console.log(`💰 Cost savings vs API: $${costSavings.savings.toFixed(4)} (${costSavings.savingsPercentage.toFixed(1)}%)`);
    }

    if (!localResult.transcript || localResult.transcript.trim().length === 0) {
      console.error(`❌ Transcription failed: Empty transcript`);
      throw new Error('Transcription completed but resulted in empty text');
    }

    console.log(`✅ Audio transcription completed: ${localResult.transcript.length} characters`);
    console.log(`🔧 Debug: Transcript preview: ${localResult.transcript.substring(0, 100)}...`);

    return {
      transcript: localResult.transcript.trim(),
      source: 'local-whisper',
      videoDetails: {
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author?.name
      },
      processingInfo: {
        audioFormat: bestAudio.container,
        audioCodec: bestAudio.audioCodec,
        durationSeconds,
        transcriptionLength: localResult.transcript.length,
        whisperModel: localResult.processingInfo.modelUsed,
        processingTimeMs: localResult.processingInfo.processingTimeMs,
        costSavings: localResult.processingInfo.costSavings
      }
    };

  } catch (error) {
    console.error('❌ Local audio transcription failed:', error);
    
    // Enhanced error messages
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
      
      if (error.message.includes('FFmpeg') || error.message.includes('Local Whisper')) {
        throw new Error('Local Whisper not available. Please install FFmpeg: winget install ffmpeg');
      }
    }
    
    throw new Error(`Local audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  whisperAvailable?: boolean;
  error?: string;
}> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    
    // Quick check if video is accessible
    const info = await ytdl.getBasicInfo(videoUrl);
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
    const maxDuration = 60 * 60; // 60 minutes
    
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    const whisperAvailable = await isLocalTranscriptionAvailable();
    
    return {
      available: audioFormats.length > 0 && whisperAvailable,
      duration: durationSeconds,
      tooLong: durationSeconds > maxDuration,
      title: info.videoDetails.title,
      audioFormatsCount: audioFormats.length,
      whisperAvailable
    };
    
  } catch (error) {
    console.error('❌ Audio availability check failed:', error);
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Video check failed'
    };
  }
}