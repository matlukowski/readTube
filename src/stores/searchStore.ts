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

export type ErrorType = 'unauthorized' | 'network' | 'general' | null;

interface CachedSearch {
  query: string;
  results: SearchResult[];
  timestamp: number;
  nextPageToken?: string;
  totalResults: number;
}

interface SearchStore {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  errorType: ErrorType;
  filters: {
    duration?: 'short' | 'medium' | 'long';
    uploadDate?: 'today' | 'week' | 'month' | 'year';
    sortBy?: 'relevance' | 'date' | 'viewCount';
  };
  searchHistory: string[];
  searchCache: Map<string, CachedSearch>;
  
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null, errorType?: ErrorType) => void;
  setFilters: (filters: SearchStore['filters']) => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  clearError: () => void;
  getCachedSearch: (query: string) => CachedSearch | null;
  setCachedSearch: (query: string, data: Omit<CachedSearch, 'query' | 'timestamp'>) => void;
  clearExpiredCache: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export const useSearchStore = create<SearchStore>()(
  persist(
    (set, get) => ({
      query: '',
      results: [],
      loading: false,
      error: null,
      errorType: null,
      filters: {},
      searchHistory: [],
      searchCache: new Map<string, CachedSearch>(),
      
      setQuery: (query) => set({ query }),
      setResults: (results) => {
        // Ensure results is always an array
        const safeResults = Array.isArray(results) ? results : [];
        if (!Array.isArray(results)) {
          console.error('⚠️ Invalid results provided to setResults:', typeof results, results);
        }
        set({ results: safeResults });
      },
      setLoading: (loading) => set({ loading }),
      setError: (error, errorType = 'general') => set({ error, errorType }),
      setFilters: (filters) => set({ filters }),
      
      addToHistory: (query) =>
        set((state) => ({
          searchHistory: [
            query,
            ...state.searchHistory.filter((q) => q !== query).slice(0, 9),
          ],
        })),
      
      clearHistory: () => set({ searchHistory: [] }),
      clearError: () => set({ error: null, errorType: null }),
      
      getCachedSearch: (query: string) => {
        const state = get();
        const cached = state.searchCache.get(query.toLowerCase());
        
        if (!cached) return null;
        
        // Check if cache is expired (5 minutes TTL)
        const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
        if (isExpired) {
          // Remove expired cache
          const newCache = new Map(state.searchCache);
          newCache.delete(query.toLowerCase());
          set({ searchCache: newCache });
          return null;
        }
        
        return cached;
      },
      
      setCachedSearch: (query: string, data) => {
        const state = get();
        const newCache = new Map(state.searchCache);
        newCache.set(query.toLowerCase(), {
          query,
          timestamp: Date.now(),
          ...data
        });
        set({ searchCache: newCache });
      },
      
      clearExpiredCache: () => {
        const state = get();
        const newCache = new Map<string, CachedSearch>();
        const now = Date.now();
        
        state.searchCache.forEach((cached, key) => {
          if (now - cached.timestamp <= CACHE_TTL) {
            newCache.set(key, cached);
          }
        });
        
        set({ searchCache: newCache });
      }
    }),
    {
      name: 'search-storage',
      partialize: (state) => ({ 
        searchHistory: state.searchHistory 
        // Exclude results from persistence to prevent hydration issues
        // Results should be fetched fresh on each session
      }),
      // Add hydration safety checks
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure results is always an array after rehydration
          if (!Array.isArray(state.results)) {
            console.warn('🔄 Fixed invalid results state during rehydration:', state.results);
            state.results = [];
          }
        }
      },
    }
  )
);