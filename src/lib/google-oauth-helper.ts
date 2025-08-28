/**
 * Google OAuth Helper for @react-oauth/google integration
 * Simplified for basic Google authentication (no YouTube OAuth)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// getServerYouTubeToken removed - no longer needed since we use yt-dlp instead of YouTube OAuth

/**
 * Get user by Google ID (for API endpoints)
 */
export async function getUserByGoogleId(googleId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { googleId }
    });

    return user;
  } catch (error) {
    console.error('❌ Failed to get user by Google ID:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// hasValidGoogleYouTubeAuth removed - no longer needed

// storeGoogleYouTubeTokens removed - YouTube OAuth no longer needed

// validateClientYouTubeToken removed - no longer needed for simplified auth

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