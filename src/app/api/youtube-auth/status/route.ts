import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasValidYouTubeAuth, revokeYouTubeAuth } from '@/lib/youtube-oauth';

/**
 * Check YouTube authorization status
 * GET /api/youtube-auth/status
 */
export async function GET() {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Checking YouTube auth status for user: ${userId}`);

    const isAuthorized = await hasValidYouTubeAuth(userId);

    return NextResponse.json({ 
      authorized: isAuthorized,
      userId: userId
    });

  } catch (error) {
    console.error('❌ YouTube auth status check error:', error);
    
    return NextResponse.json({
      error: 'Failed to check authorization status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Revoke YouTube authorization
 * DELETE /api/youtube-auth/status
 */
export async function DELETE() {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🗑️ Revoking YouTube auth for user: ${userId}`);

    await revokeYouTubeAuth(userId);

    return NextResponse.json({ 
      message: 'YouTube authorization revoked successfully',
      authorized: false
    });

  } catch (error) {
    console.error('❌ YouTube auth revoke error:', error);
    
    return NextResponse.json({
      error: 'Failed to revoke authorization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}