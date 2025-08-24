/**
 * YouTube Authorization Component
 * Handles YouTube OAuth2 authorization flow for accessing official captions
 */

'use client';

import React from 'react';
import { useYouTubeAuth } from '@/hooks/useYouTubeAuth';

interface YouTubeAuthProps {
  className?: string;
  variant?: 'button' | 'banner' | 'inline';
}

export function YouTubeAuth({ className = '', variant = 'button' }: YouTubeAuthProps) {
  const {
    isAuthorized,
    isLoading,
    isAuthorizing,
    error,
    startAuthorization,
    revokeAuthorization,
  } = useYouTubeAuth();

  if (variant === 'banner' && isAuthorized) {
    return null; // Don't show banner if already authorized
  }

  const handleAuthorize = () => {
    startAuthorization();
  };

  const handleRevoke = () => {
    if (window.confirm('Czy na pewno chcesz odwołać autoryzację YouTube? Będziesz musiał autoryzować ponownie, aby uzyskać dostęp do napisów.')) {
      revokeAuthorization();
    }
  };

  if (variant === 'banner') {
    return (
      <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-blue-900">
              Popraw jakość transkrypcji
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              Autoryzuj dostęp do YouTube, aby uzyskać najlepsze napisy i transkrypcje bezpośrednio z Google.
              To zapewni większą niezawodność i lepszą jakość tekstu.
            </p>
            <div className="mt-3">
              <button
                onClick={handleAuthorize}
                disabled={isLoading || isAuthorizing}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isAuthorizing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Przekierowywanie...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Autoryzuj YouTube
                  </>
                )}
              </button>
            </div>
            {error && (
              <div className="mt-2 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`text-sm ${className}`}>
        {isAuthorized ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center text-green-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              YouTube autoryzowany
            </div>
            <button
              onClick={handleRevoke}
              disabled={isLoading}
              className="text-gray-500 hover:text-red-600 text-xs"
            >
              {isLoading ? 'Odwoływanie...' : 'Odwołaj'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-gray-600">
              YouTube nie autoryzowany
            </div>
            <button
              onClick={handleAuthorize}
              disabled={isLoading || isAuthorizing}
              className="text-blue-600 hover:text-blue-700 text-xs font-medium"
            >
              {isAuthorizing ? 'Przekierowywanie...' : 'Autoryzuj'}
            </button>
          </div>
        )}
        {error && (
          <div className="mt-1 text-xs text-red-600">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Default button variant
  return (
    <div className={className}>
      {isAuthorized ? (
        <div className="flex items-center space-x-3">
          <div className="flex items-center text-green-600">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            YouTube autoryzowany
          </div>
          <button
            onClick={handleRevoke}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Odwoływanie...' : 'Odwołaj autoryzację'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleAuthorize}
          disabled={isLoading || isAuthorizing}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
        >
          {isAuthorizing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Przekierowywanie do Google...
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              Autoryzuj YouTube
            </>
          )}
        </button>
      )}
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}