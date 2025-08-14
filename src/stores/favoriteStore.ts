import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Favorite {
  id: string;
  videoId: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  addedAt: string;
}

interface FavoriteStore {
  favorites: Favorite[];
  loading: boolean;
  
  addFavorite: (favorite: Favorite) => void;
  removeFavorite: (videoId: string) => void;
  isFavorited: (youtubeId: string) => boolean;
  setFavorites: (favorites: Favorite[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useFavoriteStore = create<FavoriteStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      loading: false,
      
      addFavorite: (favorite) =>
        set((state) => ({
          favorites: [...state.favorites, favorite],
        })),
      
      removeFavorite: (videoId) =>
        set((state) => ({
          favorites: state.favorites.filter((f) => f.videoId !== videoId),
        })),
      
      isFavorited: (youtubeId) =>
        get().favorites.some((f) => f.youtubeId === youtubeId),
      
      setFavorites: (favorites) => set({ favorites }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'favorite-storage',
    }
  )
);