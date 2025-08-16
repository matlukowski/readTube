'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Clock, Eye, BookOpen, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { formatDistanceToNow } from 'date-fns';

interface LibraryVideo {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  description?: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

interface LibraryResponse {
  videos: LibraryVideo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function LibraryPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<LibraryResponse['pagination'] | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<LibraryVideo | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<string>('');

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isSignedIn) {
      router.push('/sign-in');
    }
  }, [isSignedIn, router]);

  // Load library videos
  const loadVideos = async (page: number = 1, search: string = '') => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...(search && { search })
      });

      const response = await fetch(`/api/library?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load library');
      }

      const data: LibraryResponse = await response.json();
      setVideos(data.videos);
      setPagination(data.pagination);
      setCurrentPage(page);

      console.log(`📚 Loaded ${data.videos.length} videos from library`);

    } catch (err) {
      console.error('Error loading library:', err);
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  // Load videos on mount and when search changes
  useEffect(() => {
    if (isSignedIn) {
      loadVideos(1, searchQuery);
    }
  }, [isSignedIn, searchQuery]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadVideos(1, searchQuery);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    loadVideos(newPage, searchQuery);
  };

  // Handle video deletion
  const handleDeleteVideo = async (youtubeId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten film z biblioteki?')) {
      return;
    }

    setDeletingVideo(youtubeId);
    
    try {
      const response = await fetch(`/api/library?youtubeId=${youtubeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete video');
      }

      // Remove video from local state
      setVideos(prev => prev.filter(video => video.youtubeId !== youtubeId));
      
      // Close modal if this video was selected
      if (selectedVideo?.youtubeId === youtubeId) {
        setSelectedVideo(null);
      }

      console.log(`🗑️ Video deleted from library: ${youtubeId}`);

    } catch (err) {
      console.error('Error deleting video:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setDeletingVideo('');
    }
  };

  if (!isSignedIn) {
    return null; // Will redirect to sign-in
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Moja Biblioteka</h1>
          <p className="text-xl text-base-content/70">
            Przejrzyj swoje zapisane analizy filmów YouTube
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj w bibliotece..."
                className="input input-bordered w-full pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/60" />
            </div>
            <button type="submit" className="btn btn-primary">
              Szukaj
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-error mb-8">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* Empty State */}
        {!loading && videos.length === 0 && !error && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Biblioteka jest pusta</h3>
            <p className="text-base-content/60 mb-6">
              {searchQuery 
                ? 'Nie znaleziono filmów pasujących do wyszukiwania'
                : 'Przeanalizuj pierwszy film YouTube, aby rozpocząć budowanie biblioteki'
              }
            </p>
            <button
              onClick={() => router.push('/analyze')}
              className="btn btn-primary"
            >
              Analizuj film
            </button>
          </div>
        )}

        {/* Videos Grid */}
        {!loading && videos.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {videos.map((video) => (
                <div key={video.id} className="card bg-base-100 shadow-xl">
                  <figure className="relative">
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      width={320}
                      height={180}
                      className="w-full h-48 object-cover"
                    />
                    {video.duration && (
                      <span className="absolute bottom-2 right-2 badge badge-neutral">
                        <Clock className="w-3 h-3 mr-1" />
                        {video.duration}
                      </span>
                    )}
                  </figure>
                  
                  <div className="card-body">
                    <h2 className="card-title line-clamp-2 text-sm">{video.title}</h2>
                    <p className="text-xs text-base-content/70">{video.channelName}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-base-content/60 mt-2">
                      {video.viewCount && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {video.viewCount}
                        </span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(video.updatedAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="card-actions justify-between mt-4">
                      <div className="flex gap-1">
                        <a
                          href={`https://youtube.com/watch?v=${video.youtubeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-xs btn-outline"
                          title="Otwórz na YouTube"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        
                        <button
                          onClick={() => handleDeleteVideo(video.youtubeId)}
                          disabled={deletingVideo === video.youtubeId}
                          className="btn btn-xs btn-outline btn-error"
                          title="Usuń z biblioteki"
                        >
                          {deletingVideo === video.youtubeId ? (
                            <span className="loading loading-spinner loading-xs"></span>
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <button
                        onClick={() => setSelectedVideo(video)}
                        className="btn btn-xs btn-primary"
                      >
                        <BookOpen className="w-3 h-3 mr-1" />
                        Czytaj
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center">
                <div className="join">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="join-item btn"
                  >
                    « Poprzednia
                  </button>
                  
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(page => 
                      page === 1 || 
                      page === pagination.totalPages || 
                      Math.abs(page - currentPage) <= 2
                    )
                    .map((page, index, array) => (
                      <React.Fragment key={page}>
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <button className="join-item btn btn-disabled">...</button>
                        )}
                        <button
                          onClick={() => handlePageChange(page)}
                          className={`join-item btn ${currentPage === page ? 'btn-active' : ''}`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= pagination.totalPages}
                    className="join-item btn"
                  >
                    Następna »
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Video Detail Modal */}
        {selectedVideo && (
          <div className="modal modal-open">
            <div className="modal-box max-w-4xl w-full h-5/6 max-h-none">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <h3 className="font-bold text-lg line-clamp-2">{selectedVideo.title}</h3>
                  <p className="text-sm text-base-content/60">{selectedVideo.channelName}</p>
                </div>
                <button
                  className="btn btn-sm btn-circle btn-ghost"
                  onClick={() => setSelectedVideo(null)}
                >
                  ✕
                </button>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Video Info */}
                <div className="lg:col-span-1">
                  <figure className="relative mb-4">
                    <Image
                      src={selectedVideo.thumbnail}
                      alt={selectedVideo.title}
                      width={320}
                      height={180}
                      className="w-full h-32 object-cover rounded"
                    />
                    {selectedVideo.duration && (
                      <span className="absolute bottom-2 right-2 badge badge-neutral">
                        <Clock className="w-3 h-3 mr-1" />
                        {selectedVideo.duration}
                      </span>
                    )}
                  </figure>

                  <div className="space-y-2 text-sm">
                    {selectedVideo.viewCount && (
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span>{selectedVideo.viewCount}</span>
                      </div>
                    )}
                    <div>
                      <strong>Dodano:</strong> {formatDistanceToNow(new Date(selectedVideo.createdAt), { addSuffix: true })}
                    </div>
                    <a
                      href={`https://youtube.com/watch?v=${selectedVideo.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Zobacz na YouTube
                    </a>
                  </div>
                </div>

                {/* Summary */}
                <div className="lg:col-span-2">
                  <h4 className="font-semibold mb-4 flex items-center">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Podsumowanie AI
                  </h4>
                  <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-base-100">
                    <div className="prose prose-sm max-w-none">
                      {selectedVideo.summary.split('\n').map((paragraph, index) => (
                        <p key={index} className="mb-4 leading-relaxed">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-backdrop" onClick={() => setSelectedVideo(null)}>
              <button>close</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}