import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeCodeForTokens } from '@/lib/youtube-oauth';

/**
 * Handle YouTube OAuth2 callback
 * GET /api/youtube-auth/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for authorization errors
    if (error) {
      console.error('❌ YouTube OAuth error:', error);
      
      // Redirect to frontend with error
      const frontendUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
      return NextResponse.redirect(
        `${frontendUrl}/analyze?youtube_auth=error&error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.json({ 
        error: 'Missing authorization code' 
      }, { status: 400 });
    }

    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify state parameter to prevent CSRF attacks
    if (state !== userId) {
      console.error('❌ State mismatch - possible CSRF attack');
      return NextResponse.json({ 
        error: 'Invalid state parameter' 
      }, { status: 400 });
    }

    console.log(`🔑 Processing YouTube OAuth callback for user: ${userId}`);

    // Exchange code for tokens
    await exchangeCodeForTokens(code, userId);
    
    console.log(`✅ YouTube authorization successful for user: ${userId}`);

    // Redirect to frontend with success
    const frontendUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
    return NextResponse.redirect(
      `${frontendUrl}/analyze?youtube_auth=success`
    );

  } catch (error) {
    console.error('❌ YouTube OAuth callback error:', error);
    
    const frontendUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
    const errorMessage = error instanceof Error ? error.message : 'Authorization failed';
    
    return NextResponse.redirect(
      `${frontendUrl}/analyze?youtube_auth=error&error=${encodeURIComponent(errorMessage)}`
    );
  }
}