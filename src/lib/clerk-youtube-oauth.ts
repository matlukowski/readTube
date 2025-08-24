/**
 * Clerk Custom OAuth Provider Integration for YouTube API
 * Uses Clerk's custom provider system with Google OAuth + YouTube scopes
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { useAuth, useUser } from '@clerk/nextjs';

// Server-side integration
export async function getClerkYouTubeToken(): Promise<string | null> {
  try {
    const { getToken } = await auth();
    if (!getToken) return null;

    // Try to get token from custom YouTube provider
    const token = await getToken({ template: 'google-youtube' });
    
    if (token) {
      console.log('✅ Got YouTube token from Clerk custom provider');
      return token;
    }

    // Fallback: try other token templates
    const fallbackTemplates = [
      'google_youtube',
      'youtube',
      'google-oauth',
      'custom'
    ];

    for (const template of fallbackTemplates) {
      try {
        const fallbackToken = await getToken({ template });
        if (fallbackToken) {
          console.log(`✅ Got token from template: ${template}`);
          return fallbackToken;
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Failed to get Clerk YouTube token:', error);
    return null;
  }
}

/**
 * Check if user has YouTube authorization through Clerk
 */
export async function hasClerkYouTubeAuth(): Promise<boolean> {
  try {
    const token = await getClerkYouTubeToken();
    return !!token;
  } catch {
    return false;
  }
}

/**
 * Get user's YouTube-enabled external accounts
 */
export async function getYouTubeExternalAccount(): Promise<unknown> {
  try {
    const user = await currentUser();
    if (!user?.externalAccounts) return null;

    // Look for custom YouTube provider account
    const youtubeAccount = user.externalAccounts.find(
      account => 
        account.provider === 'google-youtube' || 
        account.provider === 'google_youtube' ||
        (account.provider === 'google' && (account as unknown as { scopes?: string[] }).scopes?.includes('youtube'))
    );

    return youtubeAccount || null;
  } catch (error) {
    console.error('❌ Failed to get YouTube external account:', error);
    return null;
  }
}

// Client-side hooks
export function useClerkYouTubeAuth() {
  const { getToken } = useAuth();
  const { user } = useUser();

  const getYouTubeToken = async (): Promise<string | null> => {
    if (!getToken) return null;

    try {
      // Try custom provider template first
      const token = await getToken({ template: 'google-youtube' });
      return token;
    } catch {
      return null;
    }
  };

  const hasYouTubeAuth = (): boolean => {
    if (!user?.externalAccounts) return false;

    return user.externalAccounts.some(account => 
      (account.provider as string) === 'google-youtube' ||
      (account.provider as string) === 'google_youtube'
    );
  };

  return {
    getYouTubeToken,
    hasYouTubeAuth,
    isLoaded: !!user
  };
}

/**
 * YouTube API client using Clerk OAuth tokens
 */
export class ClerkYouTubeClient {
  private token: string | null = null;

  async initialize(): Promise<boolean> {
    this.token = await getClerkYouTubeToken();
    return !!this.token;
  }

  async getVideoMetadata(videoId: string): Promise<unknown> {
    if (!this.token) {
      throw new Error('Not authorized - no YouTube token');
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${this.token}`);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    return await response.json();
  }

  async getCaptions(videoId: string): Promise<unknown> {
    if (!this.token) {
      throw new Error('Not authorized - no YouTube token');
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&part=snippet`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`YouTube Captions API error: ${response.status}`);
    }

    return await response.json();
  }

  async downloadCaption(captionId: string, format: 'srt' | 'vtt' | 'sbv' = 'srt'): Promise<string> {
    if (!this.token) {
      throw new Error('Not authorized - no YouTube token');
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/captions/${captionId}?tfmt=${format}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'text/plain',
      }
    });

    if (!response.ok) {
      throw new Error(`Caption download error: ${response.status}`);
    }

    return await response.text();
  }
}

/**
 * Enhanced debug info for Clerk YouTube integration
 */
export async function getClerkYouTubeDebugInfo(): Promise<{
  hasAuth: boolean;
  tokenAvailable: boolean;
  externalAccount: unknown;
  providerType: string;
}> {
  try {
    const hasAuth = await hasClerkYouTubeAuth();
    const token = await getClerkYouTubeToken();
    const externalAccount = await getYouTubeExternalAccount();

    return {
      hasAuth,
      tokenAvailable: !!token,
      externalAccount,
      providerType: (externalAccount as { provider?: string })?.provider || 'none'
    };
  } catch {
    return {
      hasAuth: false,
      tokenAvailable: false,
      externalAccount: null,
      providerType: 'error'
    };
  }
}