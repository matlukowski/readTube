'use client';

import { useState } from 'react';
import { Clock, Eye, Heart, BookOpen, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface VideoCardProps {
  video: {
    id: string;
    youtubeId: string;
    title: string;
    channelName: string;
    thumbnail: string;
    duration?: string;
    viewCount?: string;
    publishedAt?: string;
    description?: string;
    summary?: string;
    transcript?: string;
  };
  onFavorite?: (videoId: string) => void;
  isFavorited?: boolean;
  onTranscribe?: (videoId: string) => void;
  onSummarize?: (videoId: string) => void;
}

export default function VideoCard({
  video,
  onFavorite,
  isFavorited = false,
  onTranscribe,
  onSummarize,
}: VideoCardProps) {
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTranscribe = async () => {
    if (onTranscribe) {
      setLoading(true);
      await onTranscribe(video.youtubeId);
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (onSummarize) {
      setLoading(true);
      await onSummarize(video.youtubeId);
      setLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
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
        <h2 className="card-title line-clamp-2">{video.title}</h2>
        <p className="text-sm text-base-content/70">{video.channelName}</p>
        
        <div className="flex items-center gap-4 text-sm text-base-content/60 mt-2">
          {video.viewCount && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {video.viewCount}
            </span>
          )}
          {video.publishedAt && (
            <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
          )}
        </div>

        {video.description && (
          <p className="text-sm mt-2 line-clamp-2">{video.description}</p>
        )}

        {video.summary && (
          <div className="collapse collapse-arrow bg-base-200 mt-3">
            <input
              type="checkbox"
              checked={showSummary}
              onChange={() => setShowSummary(!showSummary)}
            />
            <div className="collapse-title font-medium">
              AI Summary
            </div>
            <div className="collapse-content">
              <p className="text-sm">{video.summary}</p>
            </div>
          </div>
        )}

        <div className="card-actions justify-between mt-4">
          <div className="flex gap-2">
            <button
              className={`btn btn-sm ${isFavorited ? 'btn-error' : 'btn-outline'}`}
              onClick={() => onFavorite?.(video.youtubeId)}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
            
            <a
              href={`https://youtube.com/watch?v=${video.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="flex gap-2">
            {!video.transcript && (
              <button
                className="btn btn-sm btn-primary"
                onClick={handleTranscribe}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <BookOpen className="w-4 h-4 mr-1" />
                )}
                Transcribe
              </button>
            )}
            
            {video.transcript && !video.summary && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleSummarize}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  'Summarize'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}