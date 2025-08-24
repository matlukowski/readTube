/**
 * Google OAuth Helper for @react-oauth/google integration
 * Manages YouTube API access tokens from the new Google OAuth system
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get valid access token for server-side YouTube API calls
 * This function should be called from API routes
 */
export async function getServerYouTubeToken(googleId: string): Promise<string> {
  try {
    // Get user by googleId
    const user = await prisma.user.findUnique({
      where: { googleId },
      include: { youtubeAuth: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.youtubeAuth) {
      throw new Error('No YouTube authorization found for this user');
    }

    // Check if token is still valid (with 5-minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const expiresAt = user.youtubeAuth.expiresAt;
    
    if (now.getTime() >= (expiresAt.getTime() - bufferTime)) {
      // Token expired - user needs to re-authenticate
      throw new Error('YouTube access token expired. User needs to re-authenticate.');
    }

    return user.youtubeAuth.accessToken;

  } catch (error) {
    console.error('❌ Failed to get server YouTube token:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Get user by Google ID (for API endpoints migration)
 */
export async function getUserByGoogleId(googleId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { googleId },
      include: { youtubeAuth: true }
    });

    return user;
  } catch (error) {
    console.error('❌ Failed to get user by Google ID:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Check if user has valid YouTube authentication
 */
export async function hasValidGoogleYouTubeAuth(googleId: string): Promise<boolean> {
  try {
    await getServerYouTubeToken(googleId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Store YouTube tokens from Google OAuth (called from /api/auth/google-callback)
 * This is already handled in the callback route, but kept for reference
 */
export async function storeGoogleYouTubeTokens(
  googleId: string, 
  accessToken: string, 
  refreshToken?: string
): Promise<void> {
  try {
    // Get user by googleId
    const user = await prisma.user.findUnique({
      where: { googleId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Store tokens (expires in 1 hour as per Google OAuth implicit flow)
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    
    await prisma.youTubeAuth.upsert({
      where: { userId: user.id },
      update: {
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt,
        scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt,
        scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      }
    });

    console.log(`✅ YouTube tokens stored for Google user: ${googleId}`);

  } catch (error) {
    console.error('❌ Failed to store Google YouTube tokens:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Client-side token validation helper
 * This should be used in components that need to check token validity
 */
export function validateClientYouTubeToken(accessToken: string | null): {
  isValid: boolean;
  needsRefresh: boolean;
} {
  if (!accessToken) {
    return { isValid: false, needsRefresh: true };
  }

  try {
    // For implicit flow tokens from Google OAuth, we can't easily check expiration
    // We'll assume they're valid until API calls fail
    return { isValid: true, needsRefresh: false };
  } catch {
    return { isValid: false, needsRefresh: true };
  }
}

/**
 * Extract Google user ID from token (if needed)
 */
export async function getGoogleUserIdFromToken(accessToken: string): Promise<string> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
    
    if (!response.ok) {
      throw new Error('Invalid token');
    }

    const tokenInfo = await response.json();
    return tokenInfo.user_id;
  } catch (error) {
    console.error('❌ Failed to get Google user ID from token:', error);
    throw new Error('Invalid or expired token');
  }
}