'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import VideoCard from '@/components/results/VideoCard';
import { useSearchStore } from '@/stores/searchStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { Clock, Search, Heart, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const { searchHistory } = useSearchStore();
  const { favorites, setFavorites, setLoading: setFavoritesLoading } = useFavoriteStore();
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSearches: 0,
    totalFavorites: 0,
    totalTranscripts: 0,
    totalSummaries: 0,
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isSignedIn) {
      fetchDashboardData();
    }
  }, [isSignedIn]);

  const fetchDashboardData = async () => {
    try {
      // Fetch user's recent searches
      const searchResponse = await fetch('/api/user/searches');
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        setRecentSearches(searchData.searches || []);
        setStats(prev => ({ ...prev, totalSearches: searchData.total || 0 }));
      }

      // Fetch favorites
      setFavoritesLoading(true);
      const favResponse = await fetch('/api/favorites');
      if (favResponse.ok) {
        const favData = await favResponse.json();
        setFavorites(favData.favorites || []);
        setStats(prev => ({ ...prev, totalFavorites: favData.favorites?.length || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setFavoritesLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="stat bg-base-100 rounded-box">
            <div className="stat-figure text-primary">
              <Search className="w-8 h-8" />
            </div>
            <div className="stat-title">Total Searches</div>
            <div className="stat-value text-primary">{stats.totalSearches}</div>
          </div>

          <div className="stat bg-base-100 rounded-box">
            <div className="stat-figure text-secondary">
              <Heart className="w-8 h-8" />
            </div>
            <div className="stat-title">Favorites</div>
            <div className="stat-value text-secondary">{stats.totalFavorites}</div>
          </div>

          <div className="stat bg-base-100 rounded-box">
            <div className="stat-figure text-accent">
              <Clock className="w-8 h-8" />
            </div>
            <div className="stat-title">Transcripts</div>
            <div className="stat-value text-accent">{stats.totalTranscripts}</div>
          </div>

          <div className="stat bg-base-100 rounded-box">
            <div className="stat-figure text-info">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="stat-title">Summaries</div>
            <div className="stat-value text-info">{stats.totalSummaries}</div>
          </div>
        </div>

        {/* Recent Searches */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Recent Searches</h2>
          {searchHistory.length > 0 ? (
            <div className="bg-base-100 rounded-box p-4">
              <div className="space-y-2">
                {searchHistory.slice(0, 5).map((query, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-base-200 rounded">
                    <span className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-base-content/60" />
                      {query}
                    </span>
                    <button
                      onClick={() => router.push(`/results?q=${encodeURIComponent(query)}`)}
                      className="btn btn-ghost btn-sm"
                    >
                      Search Again
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="alert">
              <span>No recent searches yet. Start exploring YouTube content!</span>
            </div>
          )}
        </div>

        {/* Favorite Videos */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Your Favorites</h2>
          {favorites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((favorite) => (
                <VideoCard
                  key={favorite.id}
                  video={{
                    id: favorite.videoId,
                    youtubeId: favorite.youtubeId,
                    title: favorite.title,
                    channelName: favorite.channelName,
                    thumbnail: favorite.thumbnail,
                  }}
                  isFavorited={true}
                />
              ))}
            </div>
          ) : (
            <div className="alert">
              <span>No favorites yet. Save videos you want to revisit!</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}