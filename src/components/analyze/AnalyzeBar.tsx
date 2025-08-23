'use client';

import { useState } from 'react';
import { BookOpen, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AnalyzeBarProps {
  onAnalyze?: (youtubeId: string) => void;
  className?: string;
}

// Function to extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // Remove whitespace
  url = url.trim();
  
  // Handle various YouTube URL formats
  const patterns = [
    // https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // https://youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Just the video ID itself
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

export default function AnalyzeBar({ onAnalyze, className = '' }: AnalyzeBarProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const router = useRouter();

  const validateAndAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    try {
      if (!url.trim()) {
        setError('Proszę wprowadzić link YouTube');
        return;
      }

      const youtubeId = extractYouTubeId(url);
      
      if (!youtubeId) {
        setError('Nieprawidłowy link YouTube. Sprawdź format URL.');
        return;
      }

      console.log('✅ Extracted YouTube ID:', youtubeId);

      // If onAnalyze callback is provided, use it (for controlled usage)
      if (onAnalyze) {
        onAnalyze(youtubeId);
      } else {
        // Otherwise navigate to analyze page (default behavior)
        router.push(`/analyze?v=${youtubeId}`);
      }
    } catch (err) {
      console.error('Error in validateAndAnalyze:', err);
      setError('Wystąpił błąd podczas walidacji URL');
    } finally {
      setIsValidating(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      <form onSubmit={validateAndAnalyze} className="relative">
        <div className="join w-full">
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="Wklej link YouTube (np. https://www.youtube.com/watch?v=...)"
            className={`input input-bordered join-item flex-1 ${error ? 'input-error' : ''}`}
            disabled={isValidating}
          />
          <button 
            type="submit" 
            className="btn btn-primary join-item"
            disabled={isValidating || !url.trim()}
          >
            {isValidating ? (
              <>
                <span className="loading loading-spinner loading-sm mr-2"></span>
                Sprawdzam...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 mr-2" />
                Przeczytaj
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error message */}
      {error && (
        <div className="alert alert-error mt-4">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

    </div>
  );
}

// Export the YouTube ID extraction function for reuse
export { extractYouTubeId };