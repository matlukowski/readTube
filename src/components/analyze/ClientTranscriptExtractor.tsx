'use client';

import { useEffect } from 'react';
import { useYouTubeTranscript } from '@/hooks/useYouTubeTranscript';

interface ClientTranscriptExtractorProps {
  videoId: string | null;
  onTranscriptReady: (transcript: string) => void;
  onError: (error: string) => void;
  isActive: boolean;
}

export default function ClientTranscriptExtractor({
  videoId,
  onTranscriptReady,
  onError,
  isActive
}: ClientTranscriptExtractorProps) {
  const { extractTranscript, isExtracting, error, progress } = useYouTubeTranscript();

  useEffect(() => {
    if (videoId && isActive && !isExtracting) {
      extractTranscript(videoId).then(transcript => {
        if (transcript) {
          onTranscriptReady(transcript);
        }
      });
    }
  }, [videoId, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error) {
      onError(error);
    }
  }, [error, onError]);

  if (!isActive || !videoId) return null;

  return (
    <div className="hidden">
      {/* Hidden component for client-side extraction */}
      {isExtracting && <span data-extracting="true">{progress}</span>}
    </div>
  );
}