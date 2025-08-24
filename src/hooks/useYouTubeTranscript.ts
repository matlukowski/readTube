// React hook for client-side YouTube transcript extraction
import { useState, useCallback } from 'react';
import { youtubeExtractor } from '@/lib/client-youtube-extractor';

interface UseYouTubeTranscriptResult {
  extractTranscript: (videoId: string) => Promise<string | null>;
  isExtracting: boolean;
  error: string | null;
  progress: string;
}

export function useYouTubeTranscript(): UseYouTubeTranscriptResult {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const extractTranscript = useCallback(async (videoId: string): Promise<string | null> => {
    setIsExtracting(true);
    setError(null);
    setProgress('Initializing extraction...');

    try {
      // Update progress
      setProgress('Fetching video page...');
      
      // Extract transcript using client-side extractor
      const transcript = await youtubeExtractor.extractWithRetry(videoId, 3);
      
      if (!transcript) {
        setError('No captions available for this video');
        return null;
      }

      setProgress('Transcript extracted successfully!');
      return transcript;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract transcript';
      setError(errorMessage);
      console.error('Transcript extraction failed:', err);
      return null;
    } finally {
      setIsExtracting(false);
      // Clear progress after a short delay
      setTimeout(() => setProgress(''), 2000);
    }
  }, []);

  return {
    extractTranscript,
    isExtracting,
    error,
    progress
  };
}