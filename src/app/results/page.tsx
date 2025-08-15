'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/search/SearchBar';
import VideoCard from '@/components/results/VideoCard';
import SummaryModal from '@/components/ui/SummaryModal';
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
  const [summarizingVideos, setSummarizingVideos] = useState<Set<string>>(new Set());
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    videoTitle: string;
    videoId: string;
    summaryData: any;
    isLoading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    videoTitle: '',
    videoId: '',
    summaryData: null,
    isLoading: false,
    error: null
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

  const handleSummaryModal = async (youtubeId: string) => {
    console.log('🧠 handleSummaryModal started for:', youtubeId);
    
    const video = results.find(v => v.youtubeId === youtubeId);
    if (!video) {
      console.error('❌ Video not found in results for:', youtubeId);
      return;
    }

    // Start loading state
    setSummarizingVideos(prev => new Set(prev).add(youtubeId));
    
    // Open modal immediately with loading state
    setModalState({
      isOpen: true,
      videoTitle: video.title,
      videoId: youtubeId,
      summaryData: null,
      isLoading: true,
      error: null
    });

    try {
      // Step 1: Get transcript
      console.log('📝 Step 1: Getting transcript...');
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId }),
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({ error: 'Transcription failed' }));
        throw new Error(errorData.error || 'Failed to get transcript');
      }

      const transcriptData = await transcribeResponse.json();
      console.log('✅ Transcript obtained, length:', transcriptData.transcript?.length);

      // Step 2: Generate summary
      console.log('🧠 Step 2: Generating summary...');
      const summarizeResponse = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptData.transcript,
          youtubeId,
          style: 'paragraph',
          maxLength: 500,
        }),
      });

      if (!summarizeResponse.ok) {
        const errorData = await summarizeResponse.json().catch(() => ({ error: 'Summarization failed' }));
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const summaryData = await summarizeResponse.json();
      console.log('✅ Summary generated:', summaryData);

      // Update modal with results
      setModalState(prev => ({
        ...prev,
        summaryData,
        isLoading: false,
        error: null
      }));

      // Update video in results with transcript and summary
      setResults(prev => prev.map(v => 
        v.youtubeId === youtubeId 
          ? { ...v, transcript: transcriptData.transcript, summary: summaryData.summary }
          : v
      ));

    } catch (error) {
      console.error('Summary modal failed:', error);
      
      // Update modal with error
      setModalState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Wystąpił błąd podczas analizowania filmu'
      }));
    } finally {
      // Clear loading state
      setSummarizingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(youtubeId);
        return newSet;
      });
      console.log('✅ handleSummaryModal finished for:', youtubeId);
    }
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      videoTitle: '',
      videoId: '',
      summaryData: null,
      isLoading: false,
      error: null
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
                  onSummaryModal={handleSummaryModal}
                  isSummarizing={summarizingVideos.has(video.youtubeId)}
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

      {/* Summary Modal */}
      <SummaryModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        videoTitle={modalState.videoTitle}
        videoId={modalState.videoId}
        summaryData={modalState.summaryData}
        isLoading={modalState.isLoading}
        error={modalState.error}
      />
    </div>
  );
}