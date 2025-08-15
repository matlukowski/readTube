'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/search/SearchBar';
import VideoCard from '@/components/results/VideoCard';
import TranscriptionModal from '@/components/ui/TranscriptionModal';
import { useSearchStore } from '@/stores/searchStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { Loader2, AlertCircle, LogIn, RefreshCw } from 'lucide-react';

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const router = useRouter();
  const { setQuery, setResults, setLoading, setError, clearError, loading, results, error, errorType } = useSearchStore();
  const { isFavorited } = useFavoriteStore();
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [transcribingVideos, setTranscribingVideos] = useState<Set<string>>(new Set());
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    videoTitle: string;
    videoId: string;
    transcript: string;
  }>({
    isOpen: false,
    videoTitle: '',
    videoId: '',
    transcript: ''
  });

  useEffect(() => {
    if (query) {
      setQuery(query);
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery: string, pageToken?: string) => {
    setLoading(true);
    setError(null); // Clear previous errors
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          pageToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (pageToken) {
          setResults([...results, ...data.results]);
        } else {
          setResults(data.results);
        }
        setNextPageToken(data.nextPageToken);
        setTotalResults(data.totalResults);
      } else {
        // Handle different error types
        if (response.status === 401) {
          setError('You need to sign in to search for videos', 'unauthorized');
        } else if (response.status === 404) {
          setError('Search service is temporarily unavailable', 'network');
        } else if (response.status === 500) {
          setError('Server error occurred. Please try again later', 'general');
        } else {
          setError(`Search failed with status ${response.status}`, 'general');
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setError('Unable to connect to search service. Please check your internet connection', 'network');
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async (youtubeId: string) => {
    console.log('🚀 handleTranscribe started for:', youtubeId);
    
    // Start loading state
    setTranscribingVideos(prev => new Set(prev).add(youtubeId));
    
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId }),
      });

      console.log('📡 Response status:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('📥 Response data:', data);
        console.log('📥 Full response JSON:', JSON.stringify(data, null, 2));
        console.log('📝 Transcript exists:', 'transcript' in data);
        console.log('📝 Transcript type:', typeof data.transcript);
        console.log('📝 Transcript value:', data.transcript);
        console.log('📝 Transcript length:', data.transcript?.length || 'NO TRANSCRIPT');
        
        // Update the video in results with transcript
        const updatedResults = results.map(video => {
          if (video.youtubeId === youtubeId) {
            console.log('🔄 Updating video:', video.youtubeId, 'with transcript');
            return { ...video, transcript: data.transcript };
          }
          return video;
        });
        
        console.log('💾 Setting updated results:', updatedResults);
        setResults(updatedResults);
      } else {
        // Handle API errors
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Transcription API error:', errorData);
        
        // You could show a toast notification here
        alert(`Transcription failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      alert('Failed to connect to transcription service. Please try again.');
    } finally {
      // Clear loading state
      setTranscribingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(youtubeId);
        return newSet;
      });
      console.log('✅ handleTranscribe finished for:', youtubeId);
    }
  };

  const handleSummarize = async (youtubeId: string) => {
    const video = results.find(v => v.youtubeId === youtubeId);
    if (!video?.transcript) return;

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: video.transcript,
          youtubeId,
          style: 'paragraph',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update the video in results with summary
        setResults(
          results.map(v =>
            v.youtubeId === youtubeId
              ? { ...v, summary: data.summary }
              : v
          )
        );
      }
    } catch (error) {
      console.error('Summarization failed:', error);
    }
  };

  const handleViewTranscript = (videoId: string, transcript: string) => {
    console.log('👁️ handleViewTranscript called for:', videoId);
    console.log('📄 Transcript length:', transcript?.length || 'NO TRANSCRIPT');
    
    const video = results.find(v => v.youtubeId === videoId);
    if (!video) {
      console.error('❌ Video not found in results for:', videoId);
      return;
    }

    console.log('🎬 Found video:', video.title);
    console.log('🔓 Opening modal...');

    setModalState({
      isOpen: true,
      videoTitle: video.title,
      videoId,
      transcript
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      videoTitle: '',
      videoId: '',
      transcript: ''
    });
  };

  const handleFavorite = async (youtubeId: string) => {
    const video = results.find(v => v.youtubeId === youtubeId);
    if (!video) return;

    const action = isFavorited(youtubeId) ? 'remove' : 'add';
    
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          action,
        }),
      });

      if (response.ok) {
        // Update favorite store will be handled by the component
      }
    } catch (error) {
      console.error('Favorite action failed:', error);
    }
  };

  const loadMore = () => {
    if (nextPageToken && !loading) {
      performSearch(query, nextPageToken);
    }
  };

  const handleSignIn = () => {
    // Redirect to sign-in with return URL
    const returnUrl = encodeURIComponent(`/results?q=${encodeURIComponent(query)}`);
    router.push(`/sign-in?redirect_url=${returnUrl}`);
  };

  const handleRetry = () => {
    clearError();
    if (query) {
      performSearch(query);
    }
  };

  const renderErrorMessage = () => {
    if (!error) return null;

    switch (errorType) {
      case 'unauthorized':
        return (
          <div className="alert alert-warning">
            <AlertCircle className="w-5 h-5" />
            <div>
              <div className="font-semibold">Sign in required</div>
              <div className="text-sm">{error}</div>
            </div>
            <button onClick={handleSignIn} className="btn btn-primary btn-sm">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </button>
          </div>
        );

      case 'network':
        return (
          <div className="alert alert-error">
            <AlertCircle className="w-5 h-5" />
            <div>
              <div className="font-semibold">Connection Error</div>
              <div className="text-sm">{error}</div>
            </div>
            <button onClick={handleRetry} className="btn btn-outline btn-sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        );

      default:
        return (
          <div className="alert alert-error">
            <AlertCircle className="w-5 h-5" />
            <div>
              <div className="font-semibold">Search Error</div>
              <div className="text-sm">{error}</div>
            </div>
            <button onClick={handleRetry} className="btn btn-outline btn-sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <SearchBar />
        </div>

        {query && (
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">
              Results for "{query}"
              {totalResults > 0 && (
                <span className="text-base-content/60 text-lg ml-2">
                  ({totalResults} videos)
                </span>
              )}
            </h2>
          </div>
        )}

        {/* Error Messages */}
        {renderErrorMessage()}

        {/* Loading State */}
        {loading && results.length === 0 && !error && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((video) => (
                <VideoCard
                  key={video.youtubeId}
                  video={video}
                  isFavorited={isFavorited(video.youtubeId)}
                  onFavorite={handleFavorite}
                  onTranscribe={handleTranscribe}
                  onViewTranscript={handleViewTranscript}
                  onSummarize={handleSummarize}
                  isTranscribing={transcribingVideos.has(video.youtubeId)}
                />
              ))}
            </div>

            {nextPageToken && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More Results'
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* No Results (only when no error) */}
        {!error && !loading && results.length === 0 && query && (
          <div className="alert alert-info">
            <span>No results found for "{query}". Try different keywords!</span>
          </div>
        )}

        {/* Initial State */}
        {!query && (
          <div className="alert">
            <span>Enter a search query to find YouTube videos</span>
          </div>
        )}
      </main>

      {/* Transcription Modal */}
      <TranscriptionModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        videoTitle={modalState.videoTitle}
        videoId={modalState.videoId}
        transcript={modalState.transcript}
      />
    </div>
  );
}