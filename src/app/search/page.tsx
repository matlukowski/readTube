'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/search/SearchBar';
import { useSearchStore } from '@/stores/searchStore';
import { Search, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SearchPage() {
  const { searchHistory } = useSearchStore();
  const router = useRouter();
  const [suggestedTopics] = useState([
    'React tutorials',
    'Machine learning basics',
    'Web development 2024',
    'Python programming',
    'Data science',
    'JavaScript frameworks',
    'Cloud computing AWS',
    'Blockchain explained',
  ]);

  const handleTopicClick = (topic: string) => {
    router.push(`/results?q=${encodeURIComponent(topic)}`);
  };

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Search YouTube Videos</h1>
          <p className="text-lg text-base-content/70 mb-8">
            Find educational content and extract knowledge with AI
          </p>
          
          <div className="max-w-3xl mx-auto">
            <SearchBar showFilters={true} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-12">
          {/* Trending Topics */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Trending Topics
              </h2>
              <div className="flex flex-wrap gap-2 mt-4">
                {suggestedTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleTopicClick(topic)}
                    className="badge badge-lg badge-outline hover:badge-primary cursor-pointer"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Searches */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Searches
              </h2>
              {searchHistory.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {searchHistory.slice(0, 5).map((query, index) => (
                    <li key={index}>
                      <button
                        onClick={() => handleTopicClick(query)}
                        className="w-full text-left p-2 hover:bg-base-200 rounded-lg flex items-center gap-2"
                      >
                        <Search className="w-4 h-4 text-base-content/60" />
                        <span>{query}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base-content/60 mt-4">
                  No recent searches yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="card bg-gradient-to-r from-primary to-secondary text-primary-content mt-12 max-w-4xl mx-auto">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Search Tips
            </h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Use specific keywords for better results</li>
              <li>Filter by duration to find bite-sized or in-depth content</li>
              <li>Sort by upload date to get the latest information</li>
              <li>Analyze videos to get AI-generated summaries and insights</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}