import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateAuthUrl } from '@/lib/youtube-oauth';

/**
 * Start YouTube OAuth2 authorization flow
 * GET /api/youtube-auth/authorize
 */
export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔑 Starting YouTube OAuth2 flow for user: ${userId}`);

    // Generate authorization URL
    const authUrl = generateAuthUrl(userId);
    
    console.log(`✅ Generated auth URL for user: ${userId}`);

    return NextResponse.json({ 
      authUrl,
      message: 'Redirect to this URL to authorize YouTube access'
    });

  } catch (error) {
    console.error('❌ YouTube authorization error:', error);
    
    return NextResponse.json({
      error: 'Failed to start YouTube authorization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}