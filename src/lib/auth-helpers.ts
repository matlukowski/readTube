/**
 * Authentication helpers for API routes using Google OAuth
 * Replaces Clerk auth() function with Google OAuth token validation
 */

import { NextRequest } from 'next/server';
import { getUserByGoogleId, getGoogleUserIdFromToken } from './google-oauth-helper';

export interface AuthResult {
  googleId: string;
  userId: string; // Database user ID
  user: {
    id: string;
    googleId: string;
    email: string;
    name?: string;
  };
}

/**
 * Authenticate API request using Google OAuth token
 * Can handle both Authorization header and body token
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    let accessToken: string | null = null;
    
    // Method 1: Try Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
    
    // Method 2: Try body token (for requests with token in body)
    if (!accessToken) {
      try {
        const body = await request.clone().json();
        accessToken = body.accessToken;
      } catch {
        // Body might not be JSON or might not have token
      }
    }
    
    // Method 3: Try query parameter
    if (!accessToken) {
      const url = new URL(request.url);
      accessToken = url.searchParams.get('access_token');
    }
    
    if (!accessToken) {
      throw new Error('No access token provided');
    }
    
    // Get Google user ID from token
    const googleId = await getGoogleUserIdFromToken(accessToken);
    
    // Get user from database
    const user = await getUserByGoogleId(googleId);
    
    if (!user) {
      throw new Error('User not found in database');
    }
    
    return {
      googleId,
      userId: user.id,
      user: {
        id: user.id,
        googleId: user.googleId!,
        email: user.email,
        name: user.name || undefined,
      }
    };
    
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    throw new Error('Authentication failed');
  }
}

/**
 * Simplified auth for API routes - returns just the essential info
 */
export async function auth(request: NextRequest): Promise<{ googleId: string; userId: string }> {
  const result = await authenticateRequest(request);
  return {
    googleId: result.googleId,
    userId: result.userId
  };
}

/**
 * Auth helper that works with session storage (for client-side calls)
 */
export async function authFromSession(): Promise<{ googleId: string; userId: string } | null> {
  if (typeof window === 'undefined') {
    return null; // Server-side
  }
  
  try {
    const accessToken = localStorage.getItem('google_access_token');
    const userData = localStorage.getItem('user_data');
    
    if (!accessToken || !userData) {
      return null;
    }
    
    const user = JSON.parse(userData);
    
    return {
      googleId: user.googleId,
      userId: user.id // This should be set when user logs in
    };
  } catch {
    return null;
  }
}

/**
 * Middleware for protecting API routes
 */
export function withAuth<T extends unknown[]>(
  handler: (req: NextRequest, auth: AuthResult, ...args: T) => Promise<Response>
) {
  return async (req: NextRequest, ...args: T): Promise<Response> => {
    try {
      const authResult = await authenticateRequest(req);
      return handler(req, authResult, ...args);
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  };
}