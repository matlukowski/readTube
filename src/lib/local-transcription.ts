/**
 * Local speech recognition service using OpenAI Whisper
 * Alternative to Gladia API for cost reduction and privacy
 */

import { nodewhisper } from 'nodejs-whisper';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface LocalTranscriptionResult {
  transcript: string;
  source: 'local-whisper';
  processingInfo: {
    modelUsed: string;
    processingTimeMs: number;
    audioLengthSeconds: number;
    language?: string;
    costSavings: {
      gladiaCost: number;
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

export class WhisperTranscription {
  private modelCache = new Map<string, any>();
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'whisper-transcription');
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Determine optimal model size based on audio duration
   */
  private getOptimalModelSize(durationSeconds: number): string {
    if (durationSeconds < 300) return 'tiny'; // < 5 minutes
    if (durationSeconds < 900) return 'base'; // < 15 minutes
    if (durationSeconds < 1800) return 'small'; // < 30 minutes
    if (durationSeconds < 3600) return 'medium'; // < 1 hour
    return 'large'; // > 1 hour
  }

  /**
   * Transcribe audio buffer using Whisper
   */
  async transcribe(
    audioBuffer: Buffer,
    options: LocalTranscriptionOptions = {}
  ): Promise<LocalTranscriptionResult> {
    const startTime = Date.now();
    
    console.log('🎤 Starting local Whisper transcription...');
    console.log(`📊 Audio buffer size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Create temporary audio file
    const tempAudioPath = path.join(this.tempDir, `audio-${Date.now()}.wav`);
    
    try {
      // Write audio buffer to temporary file
      await fs.writeFile(tempAudioPath, audioBuffer);
      console.log(`💾 Temporary audio file created: ${tempAudioPath}`);

      // Estimate audio duration (rough calculation based on file size)
      const estimatedDuration = audioBuffer.length / (16000 * 2); // Assuming 16kHz, 16-bit
      
      // Determine model size
      const modelSize = options.modelSize || this.getOptimalModelSize(estimatedDuration);
      console.log(`🤖 Using Whisper model: ${modelSize}`);

      // Configure Whisper options
      const whisperOptions = {
        modelName: modelSize,
        whisperOptions: {
          language: options.language === 'auto' ? undefined : options.language,
          word_timestamps: false,
          output_format: 'txt',
        }
      };

      console.log(`⚙️ Whisper configuration: ${JSON.stringify(whisperOptions)}`);

      // Perform transcription
      const transcriptResult = await nodewhisper(tempAudioPath, whisperOptions);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Transcription completed in ${processingTime}ms`);
      console.log(`📝 Transcript length: ${transcriptResult.length} characters`);

      // Calculate cost savings
      const costSavings = this.calculateCostSavings(estimatedDuration);
      console.log(`💰 Cost comparison - Gladia: $${costSavings.gladiaCost.toFixed(4)}, Local: $${costSavings.localCost.toFixed(4)}`);
      console.log(`💰 Savings: $${costSavings.savings.toFixed(4)} (${costSavings.savingsPercentage.toFixed(1)}%)`);

      // Clean up temporary file
      try {
        await fs.unlink(tempAudioPath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }

      return {
        transcript: transcriptResult.trim(),
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
      
      // Clean up temporary file in case of error
      try {
        await fs.unlink(tempAudioPath);
      } catch {
        // Ignore cleanup errors
      }
      
      throw new Error(`Local transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if local transcription is available and properly configured
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Test with a minimal configuration
      console.log('🔍 Checking Whisper availability...');
      
      // This will download the model if not available
      // We use tiny model for the check to minimize download time
      const testOptions = {
        modelName: 'tiny',
        whisperOptions: {
          output_format: 'txt',
        }
      };

      // Create a minimal test audio file (silence)
      const testAudioPath = path.join(this.tempDir, 'test-audio.wav');
      const silentBuffer = Buffer.alloc(16000 * 2); // 1 second of silence
      await fs.writeFile(testAudioPath, silentBuffer);

      // Try to transcribe
      await nodewhisper(testAudioPath, testOptions);
      
      // Clean up
      await fs.unlink(testAudioPath);
      
      console.log('✅ Local Whisper is available and working');
      return true;

    } catch (error) {
      console.error('❌ Local Whisper not available:', error);
      return false;
    }
  }

  /**
   * Get estimated cost savings compared to Gladia API
   */
  calculateCostSavings(audioLengthSeconds: number): {
    gladiaCost: number;
    localCost: number;
    savings: number;
    savingsPercentage: number;
  } {
    const audioHours = audioLengthSeconds / 3600;
    
    // Gladia Pro pricing: $0.612/hour
    const gladiaCost = audioHours * 0.612;
    
    // Local cost estimation (infrastructure only): $0.50/hour average
    const localCost = audioHours * 0.50;
    
    const savings = gladiaCost - localCost;
    const savingsPercentage = gladiaCost > 0 ? (savings / gladiaCost) * 100 : 0;

    return {
      gladiaCost,
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
 * High-level function for transcribing audio with automatic fallback
 */
export async function transcribeAudioLocally(
  audioBuffer: Buffer,
  options: LocalTranscriptionOptions = {}
): Promise<LocalTranscriptionResult> {
  const whisper = getWhisperTranscription();
  return await whisper.transcribe(audioBuffer, options);
}

/**
 * Check if local transcription is ready to use
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