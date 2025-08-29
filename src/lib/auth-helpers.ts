/**
 * Authentication helpers for API routes using Clerk
 * Provides compatibility layer for existing API routes
 */

import { NextRequest } from 'next/server';
import { auth as clerkAuth } from '@clerk/nextjs/server';
import { getOrCreateCurrentUser } from './user-helpers';

export interface AuthResult {
  googleId: string; // Actually clerkId for compatibility
  userId: string; // Database user ID
  user: {
    id: string;
    googleId: string; // Actually clerkId for compatibility
    email: string;
    name?: string;
  };
}

/**
 * Authenticate API request using Clerk
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const { userId: clerkUserId } = await clerkAuth();
    
    if (!clerkUserId) {
      throw new Error('No authenticated user');
    }
    
    // Get or create user in database
    const dbUser = await getOrCreateCurrentUser(clerkUserId);
    
    return {
      googleId: clerkUserId, // Use clerkId as googleId for compatibility
      userId: dbUser.id,
      user: {
        id: dbUser.id,
        googleId: clerkUserId, // Use clerkId as googleId for compatibility
        email: dbUser.email,
        name: dbUser.name || undefined,
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
 * Auth helper for client-side - use Clerk's useAuth hook instead
 * @deprecated Use Clerk's useAuth hook on client side
 */
export async function authFromSession(): Promise<{ googleId: string; userId: string } | null> {
  console.warn('authFromSession is deprecated. Use Clerk useAuth hook instead.');
  return null;
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