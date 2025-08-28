/**
 * Transcription configuration management
 * Handles switching between local Whisper and Gladia API based on environment settings
 */

export interface TranscriptionConfig {
  useLocalTranscription: boolean;
  whisperModelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  fallbackToGladia: boolean;
  forceGladiaForLongAudio: boolean;
  maxLocalDuration: number; // seconds
}

/**
 * Get transcription configuration from environment variables
 */
export function getTranscriptionConfig(): TranscriptionConfig {
  const useLocal = process.env.USE_LOCAL_TRANSCRIPTION === 'true';
  const modelSize = (process.env.WHISPER_MODEL_SIZE as 'tiny' | 'base' | 'small' | 'medium' | 'large') || 'small';
  const fallback = process.env.LOCAL_TRANSCRIPTION_FALLBACK !== 'false';
  
  // Force Gladia for very long audio (>30 minutes) to avoid memory issues
  const maxLocalDuration = parseInt(process.env.MAX_LOCAL_TRANSCRIPTION_DURATION || '1800'); // 30 minutes default
  
  return {
    useLocalTranscription: useLocal,
    whisperModelSize: modelSize,
    fallbackToGladia: fallback,
    forceGladiaForLongAudio: true,
    maxLocalDuration
  };
}

/**
 * Determine if local transcription should be used based on audio duration and config
 */
export function shouldUseLocalTranscription(durationSeconds: number): {
  useLocal: boolean;
  reason: string;
  config: TranscriptionConfig;
} {
  const config = getTranscriptionConfig();
  
  if (!config.useLocalTranscription) {
    return {
      useLocal: false,
      reason: 'Local transcription disabled in environment configuration',
      config
    };
  }
  
  if (!process.env.GLADIA_API_KEY && !config.fallbackToGladia) {
    return {
      useLocal: true,
      reason: 'No Gladia API key available, forced to use local transcription',
      config
    };
  }
  
  if (config.forceGladiaForLongAudio && durationSeconds > config.maxLocalDuration) {
    return {
      useLocal: false,
      reason: `Audio too long (${Math.round(durationSeconds/60)}min > ${Math.round(config.maxLocalDuration/60)}min), using Gladia API`,
      config
    };
  }
  
  return {
    useLocal: true,
    reason: 'Using local transcription as configured',
    config
  };
}

/**
 * Get optimal model size based on audio duration and system resources
 */
export function getOptimalModelSize(durationSeconds: number, forcedSize?: string): 'tiny' | 'base' | 'small' | 'medium' | 'large' {
  if (forcedSize) {
    return forcedSize as 'tiny' | 'base' | 'small' | 'medium' | 'large';
  }
  
  const config = getTranscriptionConfig();
  
  // If user configured a specific size, respect it
  if (config.whisperModelSize) {
    return config.whisperModelSize;
  }
  
  // Auto-select based on duration
  if (durationSeconds < 300) return 'tiny'; // < 5 minutes
  if (durationSeconds < 900) return 'base'; // < 15 minutes
  if (durationSeconds < 1800) return 'small'; // < 30 minutes
  if (durationSeconds < 3600) return 'medium'; // < 1 hour
  return 'large'; // > 1 hour
}

/**
 * Check if all required environment variables are set for transcription
 */
export function checkTranscriptionEnvironment(): {
  localAvailable: boolean;
  gladiaAvailable: boolean;
  recommendedSetup: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const localAvailable = true; // nodejs-whisper doesn't require API keys
  const gladiaAvailable = !!process.env.GLADIA_API_KEY;
  
  if (!gladiaAvailable) {
    warnings.push('GLADIA_API_KEY not set - Gladia fallback unavailable');
  }
  
  if (process.env.USE_LOCAL_TRANSCRIPTION === 'true' && !gladiaAvailable) {
    warnings.push('Local transcription enabled without Gladia fallback - risk of failures');
  }
  
  let recommendedSetup = '';
  if (localAvailable && gladiaAvailable) {
    recommendedSetup = 'Hybrid setup recommended - local-first with Gladia fallback';
  } else if (localAvailable && !gladiaAvailable) {
    recommendedSetup = 'Local-only setup - consider adding Gladia API key for fallback';
  } else if (!localAvailable && gladiaAvailable) {
    recommendedSetup = 'Gladia-only setup - working but consider local transcription for cost savings';
  } else {
    recommendedSetup = 'No transcription methods available - please configure';
  }
  
  return {
    localAvailable,
    gladiaAvailable,
    recommendedSetup,
    warnings
  };
}

/**
 * Log transcription configuration for debugging
 */
export function logTranscriptionConfig(): void {
  const config = getTranscriptionConfig();
  const env = checkTranscriptionEnvironment();
  
  console.log('🔧 Transcription Configuration:');
  console.log(`   Local transcription: ${config.useLocalTranscription ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   Whisper model size: ${config.whisperModelSize}`);
  console.log(`   Gladia fallback: ${config.fallbackToGladia ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   Max local duration: ${Math.round(config.maxLocalDuration/60)} minutes`);
  console.log(`   Gladia API available: ${env.gladiaAvailable ? 'YES' : 'NO'}`);
  
  if (env.warnings.length > 0) {
    console.log('⚠️ Configuration warnings:');
    env.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  console.log(`💡 Recommendation: ${env.recommendedSetup}`);
}