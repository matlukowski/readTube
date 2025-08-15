'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Search, Download, Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { formatTranscript, searchInTranscript } from '@/lib/transcriptFormatter';

interface TranscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  videoId: string;
  transcript: string;
  isLoading?: boolean;
  error?: string;
}

export default function TranscriptionModal({
  isOpen,
  onClose,
  videoTitle,
  videoId,
  transcript,
  isLoading = false,
  error
}: TranscriptionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [formattedData, setFormattedData] = useState<ReturnType<typeof formatTranscript> | null>(null);

  // Format transcript when it changes
  useEffect(() => {
    if (transcript) {
      const formatted = formatTranscript(transcript);
      setFormattedData(formatted);
    } else {
      setFormattedData(null);
    }
  }, [transcript]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (formattedData?.cleanedText) {
      try {
        await navigator.clipboard.writeText(formattedData.cleanedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  // Handle download as text file
  const handleDownload = () => {
    if (formattedData?.cleanedText) {
      const blob = new Blob([formattedData.cleanedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Search functionality
  const searchResults = searchQuery && formattedData?.cleanedText 
    ? searchInTranscript(formattedData.cleanedText, searchQuery)
    : null;

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl w-full h-5/6 max-h-none">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg line-clamp-2">{videoTitle}</h3>
            <p className="text-sm text-base-content/60">Video Transcript</p>
          </div>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <span className="loading loading-spinner loading-lg mb-4"></span>
            <p className="text-lg font-medium">Generating transcript...</p>
            <p className="text-sm text-base-content/60">
              This may take a moment while we process the audio
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="w-16 h-16 text-error mb-4" />
            <p className="text-lg font-medium text-error">Failed to generate transcript</p>
            <p className="text-sm text-base-content/60 mb-4">{error}</p>
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {/* Transcript Content */}
        {!isLoading && !error && formattedData && (
          <>
            {/* Stats and Actions */}
            <div className="flex flex-wrap gap-4 items-center justify-between mb-4 p-4 bg-base-200 rounded-lg">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {formattedData.wordCount} words
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  ~{formattedData.readingTime} min read
                </span>
              </div>
              
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline'}`}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search in transcript..."
                className="input input-bordered w-full pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/60" />
              {searchResults && searchResults.matches > 0 && (
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-base-content/60">
                  {searchResults.matches} matches
                </span>
              )}
            </div>

            {/* Keywords */}
            {formattedData.keywords.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Key topics:</p>
                <div className="flex flex-wrap gap-2">
                  {formattedData.keywords.slice(0, 8).map((keyword, index) => (
                    <span key={index} className="badge badge-outline">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Transcript Content */}
            <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-base-100">
              {searchQuery && searchResults ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: searchResults.highlightedText.replace(/\n/g, '<br />') 
                  }}
                />
              ) : (
                <div className="prose prose-sm max-w-none">
                  {formattedData.paragraphs.map((paragraph, index) => (
                    <p key={index} className="mb-4 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!isLoading && !error && !transcript && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="w-16 h-16 text-base-content/30 mb-4" />
            <p className="text-lg font-medium">No transcript available</p>
            <p className="text-sm text-base-content/60">
              Click "Transcribe" to generate a transcript for this video
            </p>
          </div>
        )}
      </div>
      
      {/* Modal backdrop */}
      <div className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </div>
    </div>
  );
}