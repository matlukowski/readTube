'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  onSearch?: (query: string, filters: SearchFilters) => void;
  showFilters?: boolean;
}

export interface SearchFilters {
  duration?: 'short' | 'medium' | 'long';
  uploadDate?: 'today' | 'week' | 'month' | 'year';
  sortBy?: 'relevance' | 'date' | 'viewCount';
}

export default function SearchBar({ onSearch, showFilters = true }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (onSearch) {
        onSearch(query, filters);
      } else {
        const params = new URLSearchParams({ q: query, ...filters });
        router.push(`/results?${params.toString()}`);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <div className="join w-full">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube videos for knowledge..."
            className="input input-bordered join-item flex-1"
          />
          {showFilters && (
            <button
              type="button"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="btn btn-outline join-item"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
          <button type="submit" className="btn btn-primary join-item">
            <Search className="w-4 h-4 mr-2" />
            Search
          </button>
        </div>
      </form>

      {showFilterPanel && (
        <div className="card bg-base-200 mt-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">
                <span className="label-text">Duration</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={filters.duration || ''}
                onChange={(e) => setFilters({ ...filters, duration: e.target.value as SearchFilters['duration'] })}
              >
                <option value="">Any duration</option>
                <option value="short">Short (&lt; 4 min)</option>
                <option value="medium">Medium (4-20 min)</option>
                <option value="long">Long (&gt; 20 min)</option>
              </select>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Upload Date</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={filters.uploadDate || ''}
                onChange={(e) => setFilters({ ...filters, uploadDate: e.target.value as SearchFilters['uploadDate'] })}
              >
                <option value="">Any time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Sort By</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={filters.sortBy || 'relevance'}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as SearchFilters['sortBy'] })}
              >
                <option value="relevance">Relevance</option>
                <option value="date">Upload date</option>
                <option value="viewCount">View count</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}