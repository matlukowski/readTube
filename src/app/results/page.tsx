'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/search/SearchBar';
import VideoCard from '@/components/results/VideoCard';
import { useSearchStore } from '@/stores/searchStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { Loader2 } from 'lucide-react';

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const { setQuery, setResults, setLoading, loading, results } = useSearchStore();
  const { isFavorited } = useFavoriteStore();
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    if (query) {
      setQuery(query);
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery: string, pageToken?: string) => {
    setLoading(true);
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
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async (youtubeId: string) => {
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update the video in results with transcript
        setResults(
          results.map(video =>
            video.youtubeId === youtubeId
              ? { ...video, transcript: data.transcript }
              : video
          )
        );
      }
    } catch (error) {
      console.error('Transcription failed:', error);
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

        {loading && results.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((video) => (
                <VideoCard
                  key={video.youtubeId}
                  video={video}
                  isFavorited={isFavorited(video.youtubeId)}
                  onFavorite={handleFavorite}
                  onTranscribe={handleTranscribe}
                  onSummarize={handleSummarize}
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
        ) : query ? (
          <div className="alert alert-info">
            <span>No results found for "{query}". Try different keywords!</span>
          </div>
        ) : (
          <div className="alert">
            <span>Enter a search query to find YouTube videos</span>
          </div>
        )}
      </main>
    </div>
  );
}