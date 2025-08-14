import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SearchResult {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  description?: string;
  transcript?: string;
  summary?: string;
}

interface SearchStore {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  filters: {
    duration?: 'short' | 'medium' | 'long';
    uploadDate?: 'today' | 'week' | 'month' | 'year';
    sortBy?: 'relevance' | 'date' | 'viewCount';
  };
  searchHistory: string[];
  
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: SearchStore['filters']) => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
}

export const useSearchStore = create<SearchStore>()(
  persist(
    (set) => ({
      query: '',
      results: [],
      loading: false,
      error: null,
      filters: {},
      searchHistory: [],
      
      setQuery: (query) => set({ query }),
      setResults: (results) => set({ results }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setFilters: (filters) => set({ filters }),
      
      addToHistory: (query) =>
        set((state) => ({
          searchHistory: [
            query,
            ...state.searchHistory.filter((q) => q !== query).slice(0, 9),
          ],
        })),
      
      clearHistory: () => set({ searchHistory: [] }),
    }),
    {
      name: 'search-storage',
      partialize: (state) => ({ searchHistory: state.searchHistory }),
    }
  )
);