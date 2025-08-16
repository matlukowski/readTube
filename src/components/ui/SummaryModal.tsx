'use client';

import { useState } from 'react';
import { X, Copy, Download, Clock, FileText, CheckCircle, AlertCircle, Brain } from 'lucide-react';

interface SummaryData {
  summary: string;
  generatedAt: string;
  cached?: boolean;
}

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  summaryData: SummaryData | null;
  isLoading?: boolean;
  error?: string;
}

export default function SummaryModal({
  isOpen,
  onClose,
  videoTitle,
  summaryData,
  isLoading = false,
  error
}: SummaryModalProps) {
  const [copied, setCopied] = useState(false);
  // Removed activeTab state - only showing summary now

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (summaryData?.summary) {
      try {
        const content = `${videoTitle}\n\n${summaryData.summary}`;
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  // Handle download as text file
  const handleDownload = () => {
    if (summaryData) {
      const content = `${videoTitle}\n${'='.repeat(videoTitle.length)}\n\nPodsumowanie:\n${summaryData.summary}\n\nWygenerowano: ${new Date(summaryData.generatedAt).toLocaleString('pl-PL')}`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_podsumowanie.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl w-full h-5/6 max-h-none">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg line-clamp-2">{videoTitle}</h3>
            <p className="text-sm text-base-content/60">AI Podsumowanie</p>
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
            <p className="text-lg font-medium">Analizuję film...</p>
            <p className="text-sm text-base-content/60">
              Pobieram napisy i generuję podsumowanie
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="w-16 h-16 text-error mb-4" />
            <p className="text-lg font-medium text-error">Nie udało się wygenerować podsumowania</p>
            <p className="text-sm text-base-content/60 mb-4">{error}</p>
            <button className="btn btn-primary" onClick={onClose}>
              Zamknij
            </button>
          </div>
        )}

        {/* Summary Content */}
        {!isLoading && !error && summaryData && (
          <>
            {/* Actions Bar */}
            <div className="flex flex-wrap gap-4 items-center justify-between mb-4 p-4 bg-base-200 rounded-lg">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Brain className="w-4 h-4" />
                  AI Generated
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(summaryData.generatedAt).toLocaleString('pl-PL')}
                </span>
                {summaryData.cached && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Z cache
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline'}`}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Skopiowane!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Kopiuj
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Pobierz
                </button>
              </div>
            </div>

            {/* Header for Summary Section */}
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h4 className="text-lg font-semibold">Podsumowanie</h4>
            </div>

            {/* Summary Content */}
            <div className="h-96 overflow-y-auto border rounded-lg p-6 bg-base-100">
              <div className="prose prose-sm max-w-none">
                <div className="leading-relaxed whitespace-pre-wrap text-sm">
                  {summaryData.summary}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!isLoading && !error && !summaryData && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Brain className="w-16 h-16 text-base-content/30 mb-4" />
            <p className="text-lg font-medium">Brak podsumowania</p>
            <p className="text-sm text-base-content/60">
              Kliknij &quot;O czym on mówi?&quot; żeby wygenerować podsumowanie
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