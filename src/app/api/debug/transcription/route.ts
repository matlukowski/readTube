import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasValidYouTubeAuth } from '@/lib/youtube-oauth';

/**
 * Debug endpoint for transcription system status
 * GET /api/debug/transcription
 */
export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔧 Transcription system debug for user: ${userId}`);

    // Check all environment variables
    const envCheck = {
      // OAuth2 Configuration
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      
      // YouTube API
      YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
      
      // Transcription Services
      GLADIA_API_KEY: !!process.env.GLADIA_API_KEY,
      
      // Database
      DATABASE_URL: !!process.env.DATABASE_URL,
      DIRECT_URL: !!process.env.DIRECT_URL,
    };

    // Check user authorization status
    const userAuthStatus = {
      clerkAuth: !!userId,
      youtubeOAuth2: await hasValidYouTubeAuth(userId).catch(() => false)
    };

    // Strategy availability
    const strategies = {
      strategy1_YouTubeOAuth2: {
        available: userAuthStatus.youtubeOAuth2 && envCheck.GOOGLE_CLIENT_ID && envCheck.GOOGLE_CLIENT_SECRET,
        description: 'YouTube OAuth2 Data API (highest quality, official captions)',
        requirements: ['User YouTube authorization', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        status: userAuthStatus.youtubeOAuth2 ? 'USER_AUTHORIZED' : 'USER_NOT_AUTHORIZED'
      },
      strategy2_YouTubeAPIKey: {
        available: envCheck.YOUTUBE_API_KEY,
        description: 'YouTube Data API with API key (good quality, limited access)',
        requirements: ['YOUTUBE_API_KEY'],
        status: envCheck.YOUTUBE_API_KEY ? 'CONFIGURED' : 'MISSING_API_KEY'
      },
      strategy3_UnofficialCaptions: {
        available: true,
        description: 'Unofficial YouTube captions (medium quality, scraping)',
        requirements: ['None - always available'],
        status: 'ALWAYS_AVAILABLE'
      },
      strategy4_AudioExtraction: {
        available: envCheck.GLADIA_API_KEY,
        description: 'Audio extraction + Gladia transcription (fallback)',
        requirements: ['GLADIA_API_KEY'],
        status: envCheck.GLADIA_API_KEY ? 'CONFIGURED' : 'MISSING_API_KEY',
        note: 'Often blocked by YouTube bot detection'
      }
    };

    // System recommendations
    const recommendations = [];
    
    if (!userAuthStatus.youtubeOAuth2) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Authorize YouTube OAuth2',
        reason: 'Strategy 1 (best quality) unavailable without authorization',
        impact: 'Significantly improves transcription success rate and quality'
      });
    }
    
    if (!envCheck.GOOGLE_CLIENT_ID || !envCheck.GOOGLE_CLIENT_SECRET) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Configure Google OAuth2 credentials',
        reason: 'YouTube OAuth2 cannot work without proper credentials',
        impact: 'Blocks highest quality transcription method'
      });
    }
    
    if (!envCheck.YOUTUBE_API_KEY) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Add YOUTUBE_API_KEY',
        reason: 'Strategy 2 unavailable, reduces fallback options',
        impact: 'Limits video metadata access and alternative caption sources'
      });
    }
    
    if (!envCheck.GLADIA_API_KEY) {
      recommendations.push({
        priority: 'LOW',
        action: 'Add GLADIA_API_KEY',
        reason: 'Strategy 4 unavailable, no audio transcription fallback',
        impact: 'Removes last resort transcription option (often blocked anyway)'
      });
    }

    return NextResponse.json({
      userId,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      
      // Configuration Status
      environmentVariables: envCheck,
      userAuthStatus,
      
      // Strategy Analysis
      transcriptionStrategies: strategies,
      
      // System Health
      systemHealth: {
        configurationScore: Object.values(envCheck).filter(Boolean).length / Object.keys(envCheck).length,
        recommendedStrategy: userAuthStatus.youtubeOAuth2 ? 'OAuth2 (optimal)' : 'API Key + Captions (suboptimal)',
        expectedSuccessRate: userAuthStatus.youtubeOAuth2 ? 'High (85-95%)' : 'Medium (40-60%)'
      },
      
      // Recommendations
      recommendations,
      
      // Troubleshooting
      troubleshooting: {
        commonIssues: [
          'YouTube OAuth2 not authorized - click banner on /analyze page',
          'Missing environment variables - check .env file',
          'Google Cloud Console misconfiguration - verify redirect URIs',
          'YouTube blocking requests - use OAuth2 for reliability'
        ],
        testEndpoints: [
          '/api/youtube-auth/debug',
          '/api/debug/transcription',
        ],
        documentation: 'See YOUTUBE_OAUTH_SETUP.md for configuration guide'
      }
    });

  } catch (error) {
    console.error('❌ Transcription debug error:', error);
    
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}