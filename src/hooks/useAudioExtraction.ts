// React hook for YouTube audio extraction and Gladia transcription
import { useState, useCallback } from 'react';

interface AudioExtractionResult {
  transcript: string;
  source: string;
  videoDetails?: {
    title: string;
    duration: string;
    author: string;
  };
  processingInfo?: {
    audioFormat: string;
    audioCodec: string;
    durationSeconds: number;
    transcriptionLength: number;
  };
}

interface AudioAvailability {
  available: boolean;
  duration: number;
  tooLong: boolean;
  title: string;
  audioFormatsCount: number;
  error?: string;
}

interface UseAudioExtractionResult {
  extractAudio: (videoId: string, language?: string) => Promise<AudioExtractionResult | null>;
  checkAvailability: (videoId: string) => Promise<AudioAvailability | null>;
  isExtracting: boolean;
  isChecking: boolean;
  error: string | null;
  progress: string;
}

export function useAudioExtraction(): UseAudioExtractionResult {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const checkAvailability = useCallback(async (videoId: string): Promise<AudioAvailability | null> => {
    setIsChecking(true);
    setError(null);

    try {
      console.log(`🔍 Checking audio availability for ${videoId}...`);
      
      const response = await fetch(`/api/audio-extract?id=${videoId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check audio availability');
      }

      const result = await response.json();
      console.log(`📊 Audio availability: ${result.available}`);
      
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check audio availability';
      setError(errorMessage);
      console.error('❌ Audio availability check failed:', err);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const extractAudio = useCallback(async (videoId: string, language: string = 'auto'): Promise<AudioExtractionResult | null> => {
    setIsExtracting(true);
    setError(null);
    setProgress('Sprawdzanie dostępności audio...');

    try {
      // First check if audio extraction is possible
      const availability = await checkAvailability(videoId);
      
      if (!availability?.available) {
        throw new Error(availability?.error || 'Audio extraction not available for this video');
      }

      if (availability.tooLong) {
        throw new Error(`Film jest za długi (${Math.round(availability.duration/60)} minut). Maksimum: 30 minut.`);
      }

      console.log(`🎵 Starting audio extraction for ${videoId}...`);
      setProgress('Pobieranie audio z YouTube...');

      const response = await fetch('/api/audio-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          youtubeId: videoId, 
          language 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Audio extraction failed');
      }

      setProgress('Przetwarzanie transkrypcji...');
      const result = await response.json();

      if (!result.transcript) {
        throw new Error('No transcript received from audio extraction');
      }

      console.log(`✅ Audio extraction completed: ${result.transcript.length} characters`);
      setProgress('Transkrypcja audio zakończona!');
      
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Audio extraction failed';
      setError(errorMessage);
      console.error('❌ Audio extraction failed:', err);
      return null;
    } finally {
      setIsExtracting(false);
      // Clear progress after a short delay
      setTimeout(() => setProgress(''), 2000);
    }
  }, [checkAvailability]);

  return {
    extractAudio,
    checkAvailability,
    isExtracting,
    isChecking,
    error,
    progress
  };
}

// Utility hook for combined caption + audio extraction workflow
export function useMultiModalExtraction() {
  const [extractionMethod, setExtractionMethod] = useState<'captions' | 'audio' | null>(null);
  const [overallProgress, setOverallProgress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const audioExtraction = useAudioExtraction();

  const extractWithFallback = useCallback(async (videoId: string, language: string = 'auto') => {
    setIsProcessing(true);
    setOverallProgress('Rozpoczynanie ekstrakcji...');
    
    try {
      // This would typically be called after caption extraction fails
      setOverallProgress('Próba pobrania napisów nie powiodła się, przechodzę na transkrypcję audio...');
      setExtractionMethod('audio');
      
      const result = await audioExtraction.extractAudio(videoId, language);
      
      if (result) {
        setOverallProgress('✅ Transkrypcja audio zakończona pomyślnie!');
        return result;
      } else {
        throw new Error('All extraction methods failed');
      }
      
    } catch (error) {
      setOverallProgress('❌ Wszystkie metody ekstrackcji zawiodły');
      throw error;
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setOverallProgress('');
        setExtractionMethod(null);
      }, 3000);
    }
  }, [audioExtraction]);

  return {
    extractWithFallback,
    extractionMethod,
    overallProgress: overallProgress || audioExtraction.progress,
    isProcessing: isProcessing || audioExtraction.isExtracting,
    error: audioExtraction.error,
    checkAvailability: audioExtraction.checkAvailability
  };
}