'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import VideoCard from '@/components/results/VideoCard';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { Heart } from 'lucide-react';
import Loading from '@/components/ui/Loading';

export default function FavoritesPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const { favorites, loading, setFavorites, setLoading } = useFavoriteStore();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isSignedIn) {
      fetchFavorites();
    }
  }, [isSignedIn]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (videoId: string) => {
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          action: 'remove',
        }),
      });

      if (response.ok) {
        setFavorites(favorites.filter(f => f.videoId !== videoId));
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  if (!isLoaded || loading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Heart className="w-8 h-8 text-error fill-current" />
          <h1 className="text-3xl font-bold">Your Favorites</h1>
        </div>

        {favorites.length > 0 ? (
          <>
            <div className="mb-4 text-base-content/70">
              {favorites.length} saved {favorites.length === 1 ? 'video' : 'videos'}
            </div>
            
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
                  onFavorite={() => handleRemoveFavorite(favorite.videoId)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 text-base-content/20 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No favorites yet</h2>
            <p className="text-base-content/60 mb-6">
              Start exploring and save videos you want to revisit
            </p>
            <button
              onClick={() => router.push('/search')}
              className="btn btn-primary"
            >
              Start Searching
            </button>
          </div>
        )}
      </main>
    </div>
  );
}