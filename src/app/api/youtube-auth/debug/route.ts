import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Debug endpoint for YouTube OAuth2 configuration
 * GET /api/youtube-auth/debug
 */
export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔧 OAuth2 debug check for user: ${userId}`);

    // Check environment variables
    const envCheck = {
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
    };

    // Calculate redirect URI
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
    const redirectUri = baseUrl ? `${baseUrl}/api/youtube-auth/callback` : 'NOT_CONFIGURED';

    // Check OAuth2 config
    let configError = null;
    try {
      const { getYouTubeOAuthConfig } = await import('@/lib/youtube-oauth');
      const config = getYouTubeOAuthConfig();
      console.log('✅ OAuth2 config loaded successfully');
    } catch (error) {
      configError = error instanceof Error ? error.message : 'Unknown config error';
      console.error('❌ OAuth2 config error:', configError);
    }

    return NextResponse.json({
      userId,
      environment: process.env.NODE_ENV,
      envVariables: envCheck,
      calculatedRedirectUri: redirectUri,
      configError,
      requiredGoogleCloudSettings: {
        redirectUris: [
          'https://readtube.pl/api/youtube-auth/callback',
          'http://localhost:3000/api/youtube-auth/callback'
        ],
        requiredScopes: [
          'https://www.googleapis.com/auth/youtube.readonly'
        ],
        apis: [
          'YouTube Data API v3'
        ]
      },
      troubleshooting: {
        steps: [
          '1. Check if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in .env',
          '2. Verify redirect URIs in Google Cloud Console match calculatedRedirectUri',
          '3. Ensure YouTube Data API v3 is enabled',
          '4. Check if OAuth2 client has correct scopes'
        ]
      }
    });

  } catch (error) {
    console.error('❌ OAuth2 debug error:', error);
    
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}