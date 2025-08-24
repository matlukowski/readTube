/**
 * YouTube OAuth2 Service for managing YouTube Data API authentication
 * Handles token management, refresh, and storage for YouTube API access
 */

import { prisma } from '@/lib/prisma';

export interface YouTubeTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at: number; // Calculated expiration timestamp
}

export interface YouTubeAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * YouTube OAuth2 configuration
 */
export function getYouTubeOAuthConfig(): YouTubeAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
  
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured');
  }
  
  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/api/youtube-auth/callback`,
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
    ]
  };
}

/**
 * Generate authorization URL for YouTube OAuth2 flow
 */
export function generateAuthUrl(userId: string, state?: string): string {
  const config = getYouTubeOAuthConfig();
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline', // To get refresh token
    prompt: 'consent', // Force consent to ensure refresh token
    state: state || userId, // Use userId as state to prevent CSRF
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string, 
  userId: string
): Promise<YouTubeTokens> {
  const config = getYouTubeOAuthConfig();
  
  console.log(`🔑 Exchanging authorization code for tokens (user: ${userId})`);
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorData}`);
    }
    
    const tokenData = await response.json();
    
    // Calculate expiration timestamp
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    const tokens: YouTubeTokens = {
      ...tokenData,
      expires_at: expiresAt,
    };
    
    // Store tokens in database
    await storeTokensForUser(userId, tokens);
    
    console.log('✅ YouTube tokens stored successfully');
    return tokens;
    
  } catch (error) {
    console.error('❌ Token exchange failed:', error);
    throw error;
  }
}

/**
 * Refresh expired access token using refresh token
 */
export async function refreshAccessToken(userId: string): Promise<YouTubeTokens> {
  console.log(`🔄 Refreshing access token for user: ${userId}`);
  
  const existingTokens = await getStoredTokensForUser(userId);
  
  if (!existingTokens?.refresh_token) {
    throw new Error('No refresh token available. User needs to re-authorize.');
  }
  
  const config = getYouTubeOAuthConfig();
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: existingTokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorData}`);
    }
    
    const tokenData = await response.json();
    
    // Calculate expiration timestamp
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    const newTokens: YouTubeTokens = {
      ...tokenData,
      refresh_token: tokenData.refresh_token || existingTokens.refresh_token, // Keep existing if not provided
      expires_at: expiresAt,
    };
    
    // Update tokens in database
    await storeTokensForUser(userId, newTokens);
    
    console.log('✅ Access token refreshed successfully');
    return newTokens;
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    throw error;
  }
}

/**
 * Get valid access token for user (refresh if needed)
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await getStoredTokensForUser(userId);
  
  if (!tokens) {
    throw new Error('No YouTube authorization found. User needs to authorize YouTube access.');
  }
  
  // Check if token is expired (with 5-minute buffer)
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  const isExpired = Date.now() >= (tokens.expires_at - bufferTime);
  
  if (isExpired) {
    console.log('🔄 Access token expired, refreshing...');
    const refreshedTokens = await refreshAccessToken(userId);
    return refreshedTokens.access_token;
  }
  
  return tokens.access_token;
}

/**
 * Store YouTube tokens for a user in database
 */
async function storeTokensForUser(userId: string, tokens: YouTubeTokens): Promise<void> {
  try {
    await prisma.youTubeAuth.upsert({
      where: { userId },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at),
        scope: tokens.scope,
        updatedAt: new Date(),
      },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at),
        scope: tokens.scope,
      },
    });
    
    console.log('💾 YouTube tokens stored in database');
  } catch (error) {
    console.error('❌ Failed to store tokens:', error);
    throw new Error('Failed to store YouTube authorization');
  }
}

/**
 * Get stored YouTube tokens for a user
 */
async function getStoredTokensForUser(userId: string): Promise<YouTubeTokens | null> {
  try {
    const authRecord = await prisma.youTubeAuth.findUnique({
      where: { userId },
    });
    
    if (!authRecord) {
      return null;
    }
    
    return {
      access_token: authRecord.accessToken,
      refresh_token: authRecord.refreshToken || undefined,
      expires_in: 3600, // Default
      expires_at: authRecord.expiresAt.getTime(),
      scope: authRecord.scope,
      token_type: 'Bearer',
    };
  } catch (error) {
    console.error('❌ Failed to get stored tokens:', error);
    return null;
  }
}

/**
 * Check if user has valid YouTube authorization
 */
export async function hasValidYouTubeAuth(userId: string): Promise<boolean> {
  try {
    await getValidAccessToken(userId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke YouTube authorization for a user
 */
export async function revokeYouTubeAuth(userId: string): Promise<void> {
  console.log(`🗑️ Revoking YouTube authorization for user: ${userId}`);
  
  try {
    const tokens = await getStoredTokensForUser(userId);
    
    if (tokens?.access_token) {
      // Revoke tokens with Google
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, {
        method: 'POST',
      });
    }
    
    // Delete from database
    await prisma.youTubeAuth.deleteMany({
      where: { userId },
    });
    
    console.log('✅ YouTube authorization revoked');
  } catch (error) {
    console.error('❌ Failed to revoke authorization:', error);
    throw error;
  }
}