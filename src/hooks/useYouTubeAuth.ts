/**
 * React hook for managing YouTube OAuth2 authorization
 */

import { useState, useCallback, useEffect } from 'react';

interface YouTubeAuthStatus {
  authorized: boolean;
  userId?: string;
}

interface UseYouTubeAuthResult {
  isAuthorized: boolean;
  isLoading: boolean;
  isAuthorizing: boolean;
  error: string | null;
  checkAuthStatus: () => Promise<void>;
  startAuthorization: () => Promise<void>;
  revokeAuthorization: () => Promise<void>;
}

export function useYouTubeAuth(): UseYouTubeAuthResult {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check current authorization status
   */
  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Checking YouTube authorization status...');

      const response = await fetch('/api/youtube-auth/status');

      if (!response.ok) {
        if (response.status === 401) {
          // User not logged in - this is expected, not an error
          setIsAuthorized(false);
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check authorization status');
      }

      const data: YouTubeAuthStatus = await response.json();
      setIsAuthorized(data.authorized);
      
      console.log(`✅ YouTube auth status: ${data.authorized ? 'authorized' : 'not authorized'}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check authorization';
      console.error('❌ YouTube auth status check failed:', err);
      setError(errorMessage);
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Start YouTube OAuth2 authorization flow
   */
  const startAuthorization = useCallback(async () => {
    setIsAuthorizing(true);
    setError(null);

    try {
      console.log('🔑 Starting YouTube authorization...');

      const response = await fetch('/api/youtube-auth/authorize');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Enhanced error messages based on status
        let enhancedError = errorData.error || 'Failed to start authorization';
        
        if (response.status === 500) {
          enhancedError = 'Konfiguracja OAuth2 jest niepoprawna. Sprawdź zmienne środowiskowe GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET.';
        } else if (response.status === 401) {
          enhancedError = 'Nie jesteś zalogowany. Zaloguj się najpierw do aplikacji.';
        }
        
        console.error('❌ OAuth2 config error:', errorData.details || enhancedError);
        throw new Error(enhancedError);
      }

      const data = await response.json();
      
      if (!data.authUrl) {
        throw new Error('No authorization URL received from server');
      }

      console.log('🚀 Redirecting to YouTube authorization...');
      
      // Redirect to Google OAuth2 authorization page
      window.location.href = data.authUrl;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start authorization';
      console.error('❌ YouTube authorization failed:', err);
      setError(errorMessage);
      setIsAuthorizing(false);
      
      // Log additional debug info in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Debug OAuth2 config at: /api/youtube-auth/debug');
      }
    }
  }, []);

  /**
   * Revoke YouTube authorization
   */
  const revokeAuthorization = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🗑️ Revoking YouTube authorization...');

      const response = await fetch('/api/youtube-auth/status', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke authorization');
      }

      setIsAuthorized(false);
      console.log('✅ YouTube authorization revoked');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke authorization';
      console.error('❌ YouTube authorization revoke failed:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check auth status on mount and handle callback results
   */
  useEffect(() => {
    // Check authorization status on mount
    checkAuthStatus();

    // Handle OAuth callback results from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('youtube_auth');
    const authError = urlParams.get('error');

    if (authResult === 'success') {
      console.log('✅ YouTube authorization successful!');
      setIsAuthorized(true);
      setIsAuthorizing(false);
      
      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('youtube_auth');
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, document.title, newUrl.toString());
      
    } else if (authResult === 'error') {
      console.error('❌ YouTube authorization failed:', authError);
      setError(authError || 'Authorization failed');
      setIsAuthorized(false);
      setIsAuthorizing(false);
      
      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('youtube_auth');
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, document.title, newUrl.toString());
    }
  }, [checkAuthStatus]);

  return {
    isAuthorized,
    isLoading,
    isAuthorizing,
    error,
    checkAuthStatus,
    startAuthorization,
    revokeAuthorization,
  };
}