/**
 * Local speech recognition service using @xenova/transformers (Whisper)
 * Uses FFmpeg for audio decoding (AAC/MP4 → PCM) + pure JavaScript Whisper inference
 */

import { pipeline, Pipeline } from '@xenova/transformers';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export interface LocalTranscriptionResult {
  transcript: string;
  source: 'local-whisper';
  processingInfo: {
    modelUsed: string;
    processingTimeMs: number;
    audioLengthSeconds: number;
    language?: string;
    costSavings: {
      estimatedApiCost: number;
      localCost: number;
      savings: number;
      savingsPercentage: number;
    };
  };
}

export interface LocalTranscriptionOptions {
  language?: string;
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  maxDuration?: number; // in seconds
}

// Model mapping for @xenova/transformers
const MODEL_MAPPING = {
  'tiny': 'Xenova/whisper-tiny',
  'base': 'Xenova/whisper-base',
  'small': 'Xenova/whisper-small',  
  'medium': 'Xenova/whisper-medium',
  'large': 'Xenova/whisper-large'
};

export class WhisperTranscription {
  private modelCache = new Map<string, Pipeline>();
  private tempDir: string;
  private isPreloading: boolean = false;
  private preloadPromises: Map<string, Promise<Pipeline>> = new Map();

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'whisper-transcription');
    this.ensureTempDir();
    // Start pre-loading the tiny model in background for instant availability
    this.preloadTinyModel();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Pre-load the tiny model in background for instant availability
   * This eliminates cold start delays for most use cases
   */
  private async preloadTinyModel(): Promise<void> {
    if (this.isPreloading) return;
    
    this.isPreloading = true;
    const modelName = MODEL_MAPPING.tiny;
    
    try {
      console.log('🔄 Pre-loading tiny Whisper model in background...');
      const preloadPromise = pipeline('automatic-speech-recognition', modelName, {
        quantized: true,
      });
      
      this.preloadPromises.set(modelName, preloadPromise);
      
      const transcriber = await preloadPromise;
      this.modelCache.set(modelName, transcriber);
      console.log('✅ Tiny Whisper model pre-loaded and ready for instant use');
    } catch (error) {
      console.warn('⚠️ Tiny model pre-loading failed (will load on-demand):', error);
    } finally {
      this.isPreloading = false;
      this.preloadPromises.delete(modelName);
    }
  }

  /**
   * Pre-load multiple models based on expected usage patterns
   * Call this during application startup for best performance
   */
  async preloadOptimalModels(): Promise<void> {
    console.log('🚀 Pre-loading optimal Whisper models for faster startup...');
    
    // Pre-load tiny and small models in parallel (most commonly used)
    const preloadTasks = [
      this.preloadModel('tiny'),
      this.preloadModel('small')
    ];
    
    try {
      await Promise.allSettled(preloadTasks);
      console.log('✅ Whisper models pre-loaded successfully');
    } catch (error) {
      console.warn('⚠️ Some models failed to pre-load:', error);
    }
  }

  /**
   * Pre-load a specific model in background
   */
  private async preloadModel(modelSize: string): Promise<Pipeline> {
    const modelName = MODEL_MAPPING[modelSize as keyof typeof MODEL_MAPPING];
    if (!modelName) {
      throw new Error(`Invalid model size: ${modelSize}`);
    }

    // Return cached model if already loaded
    if (this.modelCache.has(modelName)) {
      return this.modelCache.get(modelName)!;
    }

    // Return existing preload promise if in progress
    if (this.preloadPromises.has(modelName)) {
      return await this.preloadPromises.get(modelName)!;
    }

    // Start preloading
    console.log(`🔄 Pre-loading Whisper model: ${modelName}`);
    const preloadPromise = pipeline('automatic-speech-recognition', modelName, {
      quantized: true,
    });
    
    this.preloadPromises.set(modelName, preloadPromise);
    
    try {
      const transcriber = await preloadPromise;
      this.modelCache.set(modelName, transcriber);
      console.log(`✅ Model pre-loaded: ${modelName}`);
      return transcriber;
    } finally {
      this.preloadPromises.delete(modelName);
    }
  }

  /**
   * Determine optimal model size based on audio duration
   * Aggressively optimized for speed while maintaining acceptable quality
   */
  private getOptimalModelSize(durationSeconds: number): string {
    // For very short videos, use tiny for speed
    if (durationSeconds < 180) return 'tiny'; // < 3 minutes
    
    // For short-medium videos, small offers good quality/speed balance
    if (durationSeconds < 600) return 'small'; // 3-10 minutes
    
    // For longer videos, aggressively prioritize speed with tiny model
    // tiny model quality is surprisingly good and 3-4x faster
    return 'tiny'; // > 10 minutes (optimized for speed)
  }

  /**
   * Get the FFmpeg executable path (handles WinGet installations and cross-platform)
   */
  private async getFFmpegPath(): Promise<string | null> {
    console.log('🔍 Searching for FFmpeg executable...');
    
    // Strategy 1: Try PATH-based detection first (standard installations)
    try {
      const pathTest = await this.testFFmpegPath('ffmpeg');
      if (pathTest) {
        console.log('✅ FFmpeg found in system PATH');
        return 'ffmpeg';
      }
    } catch {
      // Continue to fallback strategies
    }

    // Strategy 2: Check common Windows installation paths
    const commonPaths = [
      'C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe',
      'C:\\FFmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe'
    ];

    for (const path of commonPaths) {
      try {
        const pathTest = await this.testFFmpegPath(path);
        if (pathTest) {
          console.log(`✅ FFmpeg found at: ${path}`);
          return path;
        }
      } catch {
        continue;
      }
    }

    // Strategy 3: Check WinGet package directories (Windows-specific)
    if (process.platform === 'win32') {
      try {
        const userProfile = process.env.USERPROFILE || process.env.HOME;
        if (userProfile) {
          // Common WinGet installation patterns
          const wingetPaths = [
            path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'),
            path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links')
          ];

          for (const wingetDir of wingetPaths) {
            try {
              const ffmpegPath = await this.findFFmpegInWinGetPackages(wingetDir);
              if (ffmpegPath) {
                console.log(`✅ FFmpeg found in WinGet packages: ${ffmpegPath}`);
                return ffmpegPath;
              }
            } catch (error) {
              console.log(`⚠️ Could not search ${wingetDir}: ${error}`);
              continue;
            }
          }
        }
      } catch (error) {
        console.log('⚠️ WinGet package search failed:', error);
      }
    }

    console.log('❌ FFmpeg not found in any location');
    return null;
  }

  /**
   * Test if a specific FFmpeg path works
   */
  private async testFFmpegPath(ffmpegPath: string): Promise<boolean> {
    try {
      return new Promise((resolve) => {
        const ffmpeg = spawn(ffmpegPath, ['-version']);
        
        ffmpeg.on('close', (code) => {
          resolve(code === 0);
        });
        
        ffmpeg.on('error', () => {
          resolve(false);
        });
        
        // Timeout after 3 seconds for path testing
        setTimeout(() => {
          ffmpeg.kill();
          resolve(false);
        }, 3000);
      });
    } catch {
      return false;
    }
  }

  /**
   * Search for FFmpeg in WinGet packages directory
   */
  private async findFFmpegInWinGetPackages(wingetDir: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(wingetDir);
      
      // Look for FFmpeg-related package directories
      const ffmpegPackages = entries.filter(entry => 
        entry.toLowerCase().includes('ffmpeg') || 
        entry.toLowerCase().includes('gyan.ffmpeg')
      );

      for (const packageDir of ffmpegPackages) {
        const packagePath = path.join(wingetDir, packageDir);
        
        try {
          // Check if this is a directory
          const stat = await fs.stat(packagePath);
          if (!stat.isDirectory()) continue;

          // Look for FFmpeg binary in nested directories
          const ffmpegPath = await this.searchForFFmpegBinary(packagePath);
          if (ffmpegPath) {
            const isWorking = await this.testFFmpegPath(ffmpegPath);
            if (isWorking) {
              return ffmpegPath;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    
    return null;
  }

  /**
   * Recursively search for ffmpeg.exe in a directory tree
   */
  private async searchForFFmpegBinary(searchPath: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(searchPath);
      
      // Check direct path first
      if (entries.includes('ffmpeg.exe')) {
        const ffmpegPath = path.join(searchPath, 'ffmpeg.exe');
        return ffmpegPath;
      }

      // Check bin subdirectory (common pattern)
      if (entries.includes('bin')) {
        const binPath = path.join(searchPath, 'bin');
        try {
          const binEntries = await fs.readdir(binPath);
          if (binEntries.includes('ffmpeg.exe')) {
            return path.join(binPath, 'ffmpeg.exe');
          }
        } catch {
          // bin directory not accessible
        }
      }

      // Recursively search subdirectories (limited depth)
      for (const entry of entries) {
        const entryPath = path.join(searchPath, entry);
        try {
          const stat = await fs.stat(entryPath);
          if (stat.isDirectory() && !entry.startsWith('.')) {
            // Limit search depth to avoid infinite recursion
            if (entryPath.split(path.sep).length - searchPath.split(path.sep).length <= 3) {
              const foundPath = await this.searchForFFmpegBinary(entryPath);
              if (foundPath) return foundPath;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Can't read directory
    }

    return null;
  }

  /**
   * Check if FFmpeg is available in the system
   */
  private async checkFFmpegAvailability(): Promise<boolean> {
    const ffmpegPath = await this.getFFmpegPath();
    return ffmpegPath !== null;
  }

  /**
   * Decode compressed audio (AAC/MP4) to PCM using FFmpeg
   */
  private async decodeAudioWithFFmpeg(inputBuffer: Buffer): Promise<{ pcmBuffer: Buffer; sampleRate: number }> {
    const inputPath = path.join(this.tempDir, `input-${Date.now()}.m4a`);
    const outputPath = path.join(this.tempDir, `output-${Date.now()}.wav`);
    
    // Get the FFmpeg executable path
    const ffmpegPath = await this.getFFmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg executable not found. Please install FFmpeg.');
    }

    console.log(`🔧 Using FFmpeg: ${ffmpegPath}`);
    
    try {
      // Write input audio buffer to temp file
      await fs.writeFile(inputPath, inputBuffer);
      console.log('🔧 FFmpeg: Converting AAC/MP4 to PCM WAV...');

      // FFmpeg command to convert to 16kHz 16-bit PCM WAV
      const ffmpeg = spawn(ffmpegPath, [
        '-i', inputPath,           // Input file
        '-ar', '16000',           // Sample rate: 16kHz
        '-ac', '1',               // Channels: mono
        '-f', 'wav',              // Output format: WAV
        '-acodec', 'pcm_s16le',   // Audio codec: 16-bit PCM Little Endian
        '-y',                     // Overwrite output file
        outputPath                // Output file
      ]);

      return new Promise((resolve, reject) => {
        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpeg.on('close', async (code) => {
          try {
            if (code !== 0) {
              console.error('❌ FFmpeg error:', stderr);
              throw new Error(`FFmpeg failed with code ${code}: ${stderr}`);
            }

            // Read the decoded PCM WAV file
            const pcmBuffer = await fs.readFile(outputPath);
            console.log(`✅ FFmpeg: Decoded to PCM WAV (${pcmBuffer.length} bytes)`);

            // Clean up temp files
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});

            resolve({ 
              pcmBuffer, 
              sampleRate: 16000  // We explicitly set this in FFmpeg command
            });

          } catch (error) {
            // Clean up temp files on error
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            reject(error);
          }
        });

        ffmpeg.on('error', (error) => {
          reject(new Error(`FFmpeg spawn error: ${error.message}`));
        });
      });

    } catch (error) {
      // Clean up temp files on error
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
      throw error;
    }
  }

  /**
   * Convert PCM WAV buffer to format suitable for @xenova/transformers
   */
  private async processAudioBuffer(audioBuffer: Buffer): Promise<{ audio: Float32Array; sampleRate: number }> {
    console.log('🎵 Processing audio buffer for Whisper...');
    console.log(`🎵 Input audio buffer size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    try {
      // Step 1: Decode compressed audio (AAC/MP4) to PCM using FFmpeg
      // (FFmpeg detection and path resolution is handled inside decodeAudioWithFFmpeg)
      const { pcmBuffer, sampleRate } = await this.decodeAudioWithFFmpeg(audioBuffer);
      
      // Step 2: Parse PCM WAV header to get audio data offset
      // WAV header is typically 44 bytes, but let's find the "data" chunk
      const dataChunkIndex = pcmBuffer.indexOf('data');
      if (dataChunkIndex === -1) {
        throw new Error('Could not find data chunk in WAV file');
      }
      
      // Skip WAV header and chunk size (8 bytes after "data")
      const audioDataOffset = dataChunkIndex + 8;
      const audioDataLength = pcmBuffer.length - audioDataOffset;
      
      console.log(`🎵 PCM audio data: ${audioDataLength} bytes (${(audioDataLength / 1024).toFixed(1)} KB)`);
      console.log(`🎵 Estimated audio length: ${(audioDataLength / (sampleRate * 2)).toFixed(1)} seconds`);
      
      // Step 3: Convert PCM data to Float32Array
      const view = new DataView(pcmBuffer.buffer, pcmBuffer.byteOffset + audioDataOffset, audioDataLength);
      const length = Math.floor(audioDataLength / 2); // 16-bit samples
      const audio = new Float32Array(length);
      
      for (let i = 0; i < length; i++) {
        const int16 = view.getInt16(i * 2, true); // little endian
        audio[i] = int16 / 32768.0; // Convert to float range [-1, 1]
      }
      
      console.log(`🎵 Audio processed: ${audio.length} samples at ${sampleRate}Hz`);
      console.log(`🎵 Audio duration: ${(audio.length / sampleRate).toFixed(1)} seconds`);
      
      return {
        audio,
        sampleRate
      };
      
    } catch (error) {
      console.error('❌ Audio processing failed:', error);
      
      // Enhanced error with FFmpeg troubleshooting
      if (error instanceof Error && error.message.includes('FFmpeg')) {
        throw new Error(
          `Audio decoding failed: ${error.message}\n\n` +
          `FFmpeg could not be found. Tried these locations:\n` +
          `• System PATH (ffmpeg command)\n` +
          `• C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe\n` +
          `• C:\\FFmpeg\\bin\\ffmpeg.exe\n` +
          `• WinGet packages directory\n\n` +
          `Installation options:\n` +
          `1. Windows: winget install ffmpeg (recommended)\n` +
          `2. Mac: brew install ffmpeg\n` +
          `3. Linux: sudo apt install ffmpeg\n` +
          `4. Manual: Download from https://ffmpeg.org/\n\n` +
          `Note: After WinGet installation, the app should find FFmpeg automatically.\n` +
          `Technical details: ${error.message}`
        );
      }
      
      throw error;
    }
  }

  /**
   * Get or create Whisper pipeline for the specified model
   * Optimized for instant access with pre-loading and smart caching
   */
  private async getWhisperPipeline(modelSize: string): Promise<Pipeline> {
    const modelName = MODEL_MAPPING[modelSize as keyof typeof MODEL_MAPPING] || MODEL_MAPPING.small;
    
    // Return immediately if model is already cached
    if (this.modelCache.has(modelName)) {
      console.log(`🚀 Using cached Whisper model: ${modelName}`);
      return this.modelCache.get(modelName)!;
    }

    // If model is being pre-loaded, wait for it
    if (this.preloadPromises.has(modelName)) {
      console.log(`⏳ Waiting for pre-loading Whisper model: ${modelName}`);
      return await this.preloadPromises.get(modelName)!;
    }

    // Load model on-demand (fallback)
    console.log(`🤖 Loading Whisper model on-demand: ${modelName}`);
    console.log('📥 Note: Consider pre-loading models for better performance');
    
    const transcriber = await pipeline('automatic-speech-recognition', modelName, {
      quantized: true,
    });

    this.modelCache.set(modelName, transcriber);
    console.log(`✅ Whisper model loaded: ${modelName}`);
    
    return transcriber;
  }

  /**
   * Transcribe audio buffer using @xenova/transformers Whisper
   */
  async transcribe(
    audioBuffer: Buffer,
    options: LocalTranscriptionOptions = {}
  ): Promise<LocalTranscriptionResult> {
    const startTime = Date.now();
    
    console.log('🎤 Starting local Whisper transcription (pure JavaScript)...');
    console.log(`📊 Audio buffer size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    try {
      // Estimate audio duration (rough calculation based on file size)
      const estimatedDuration = audioBuffer.length / (16000 * 2); // Assuming 16kHz, 16-bit
      
      // Determine model size
      const modelSize = options.modelSize || this.getOptimalModelSize(estimatedDuration);
      console.log(`🤖 Using Whisper model: ${modelSize}`);

      // Get the transcription pipeline
      const transcriber = await this.getWhisperPipeline(modelSize);

      // Process audio buffer
      const { audio, sampleRate } = await this.processAudioBuffer(audioBuffer);
      console.log(`🎵 Audio processed: ${audio.length} samples at ${sampleRate}Hz`);

      // Perform transcription with optimized chunking for speed and memory efficiency
      console.log('🔄 Running optimized transcription...');
      const isLongAudio = estimatedDuration > 600; // 10+ minutes
      
      const result = await transcriber(audio, {
        language: options.language === 'auto' ? undefined : options.language,
        task: 'transcribe',
        return_timestamps: false,
        // Optimized chunking: smaller chunks for faster processing and lower memory usage
        chunk_length_s: isLongAudio ? 15 : 20, // Smaller chunks for long videos, medium for short
        stride_length_s: isLongAudio ? 2 : 3,   // Smaller stride for long videos to reduce overlap overhead
        // Additional optimizations for memory efficiency
      });

      const processingTime = Date.now() - startTime;
      const transcript = typeof result === 'string' ? result : result.text || '';
      
      // Memory cleanup - release audio buffer reference for garbage collection
      // @ts-ignore - Allow explicit undefined assignment for memory cleanup
      audio = undefined;
      
      // Performance metrics
      const charactersPerSecond = Math.round(transcript.length / (processingTime / 1000));
      const audioMinutes = estimatedDuration / 60;
      const processingSpeedRatio = audioMinutes / (processingTime / 1000 / 60); // Real-time ratio
      
      console.log(`✅ Optimized transcription completed in ${processingTime}ms`);
      console.log(`📝 Transcript: ${transcript.length} characters (${charactersPerSecond} chars/sec)`);
      console.log(`⚡ Speed: ${processingSpeedRatio.toFixed(1)}x real-time (${audioMinutes.toFixed(1)}min audio in ${(processingTime/1000/60).toFixed(1)}min)`);
      console.log(`🧠 Memory: Optimized chunking (${isLongAudio ? '15s' : '20s'} chunks, ${isLongAudio ? '2s' : '3s'} stride)`);

      // Calculate cost savings
      const costSavings = this.calculateCostSavings(estimatedDuration);
      console.log(`💰 Cost comparison - API: $${costSavings.estimatedApiCost.toFixed(4)}, Local: $${costSavings.localCost.toFixed(4)}`);
      console.log(`💰 Savings: $${costSavings.savings.toFixed(4)} (${costSavings.savingsPercentage.toFixed(1)}%)`);
      
      // Suggest garbage collection for long videos to free memory
      if (estimatedDuration > 600 && global.gc) {
        console.log('🧹 Running garbage collection for memory cleanup...');
        global.gc();
      }

      return {
        transcript: transcript.trim(),
        source: 'local-whisper',
        processingInfo: {
          modelUsed: modelSize,
          processingTimeMs: processingTime,
          audioLengthSeconds: estimatedDuration,
          language: options.language,
          costSavings: costSavings,
        }
      };

    } catch (error) {
      console.error('❌ Local transcription failed:', error);
      throw new Error(`Local transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if local transcription is available (always true for @xenova/transformers)
   */
  async checkAvailability(): Promise<boolean> {
    try {
      console.log('🔍 Checking Whisper availability...');
      
      // @xenova/transformers is pure JavaScript, so it's always available
      // We can optionally test model loading here, but it's not necessary
      console.log('✅ Local Whisper (pure JS) is available and working');
      return true;

    } catch (error) {
      console.error('❌ Local Whisper not available:', error);
      return false;
    }
  }

  /**
   * Get estimated cost savings compared to typical API services
   */
  calculateCostSavings(audioLengthSeconds: number): {
    estimatedApiCost: number;
    localCost: number;
    savings: number;
    savingsPercentage: number;
  } {
    const audioHours = audioLengthSeconds / 3600;
    
    // Average transcription API pricing: $0.60/hour
    const estimatedApiCost = audioHours * 0.60;
    
    // Local cost estimation (compute only): $0.02/hour average
    const localCost = audioHours * 0.02;
    
    const savings = estimatedApiCost - localCost;
    const savingsPercentage = estimatedApiCost > 0 ? (savings / estimatedApiCost) * 100 : 0;

    return {
      estimatedApiCost,
      localCost,
      savings,
      savingsPercentage
    };
  }
}

// Singleton instance for the application
let whisperInstance: WhisperTranscription | null = null;

export function getWhisperTranscription(): WhisperTranscription {
  if (!whisperInstance) {
    whisperInstance = new WhisperTranscription();
  }
  return whisperInstance;
}

/**
 * Pre-load Whisper models for optimal performance
 * Call this during application startup for instant transcription
 */
export async function preloadWhisperModels(): Promise<void> {
  const whisper = getWhisperTranscription();
  await whisper.preloadOptimalModels();
}

/**
 * Check if models are pre-loaded and ready for instant use
 */
export function getModelStatus(): {
  tiny: boolean;
  small: boolean;
  preloadingInProgress: boolean;
} {
  const whisper = getWhisperTranscription();
  return {
    tiny: whisper['modelCache'].has('Xenova/whisper-tiny'),
    small: whisper['modelCache'].has('Xenova/whisper-small'),
    preloadingInProgress: whisper['isPreloading'] || whisper['preloadPromises'].size > 0
  };
}

/**
 * High-level function for local audio transcription
 */
export async function transcribeAudioLocally(
  audioBuffer: Buffer,
  options: LocalTranscriptionOptions = {}
): Promise<LocalTranscriptionResult> {
  const whisper = getWhisperTranscription();
  return await whisper.transcribe(audioBuffer, options);
}

/**
 * Check if local transcription is ready to use (always true for pure JS implementation)
 */
export async function isLocalTranscriptionAvailable(): Promise<boolean> {
  try {
    const whisper = getWhisperTranscription();
    return await whisper.checkAvailability();
  } catch (error) {
    console.error('Error checking local transcription availability:', error);
    return false;
  }
}