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
  onViewTranscript?: (videoId: string, transcript: string) => void;
  onSummarize?: (videoId: string) => void;
  isTranscribing?: boolean;
}

export default function VideoCard({
  video,
  onFavorite,
  isFavorited = false,
  onTranscribe,
  onViewTranscript,
  onSummarize,
  isTranscribing = false,
}: VideoCardProps) {
  console.log('🎥 VideoCard render for:', video.youtubeId);
  console.log('📝 Has transcript:', !!video.transcript, video.transcript?.length || 0);
  console.log('⏳ Is transcribing:', isTranscribing);
  
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTranscribe = async () => {
    console.log('🔥 handleTranscribe clicked for:', video.youtubeId);
    if (onTranscribe) {
      await onTranscribe(video.youtubeId);
    }
  };

  const handleViewTranscript = () => {
    console.log('👁️ handleViewTranscript clicked for:', video.youtubeId);
    console.log('📄 Video transcript exists:', !!video.transcript);
    if (onViewTranscript && video.transcript) {
      onViewTranscript(video.youtubeId, video.transcript);
    } else {
      console.warn('⚠️ Cannot view transcript - missing callback or transcript');
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
            {!video.transcript ? (
              <button
                className="btn btn-sm btn-primary"
                onClick={handleTranscribe}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <>
                    <span className="loading loading-spinner loading-xs mr-1"></span>
                    Transcribing...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 mr-1" />
                    Transcribe
                  </>
                )}
              </button>
            ) : (
              <button
                className="btn btn-sm btn-success"
                onClick={handleViewTranscript}
              >
                <BookOpen className="w-4 h-4 mr-1" />
                View Transcript
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