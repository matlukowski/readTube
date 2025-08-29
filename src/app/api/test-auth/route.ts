import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Test endpoint to verify Clerk authentication is working
 * GET /api/test-auth
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionId } = await auth();
    
    if (!userId) {
      return NextResponse.json({
        authenticated: false,
        message: 'No authenticated user'
      }, { status: 401 });
    }
    
    return NextResponse.json({
      authenticated: true,
      userId,
      sessionId,
      message: 'Authentication working correctly with Clerk'
    });
  } catch (error) {
    console.error('Auth test error:', error);
    return NextResponse.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}