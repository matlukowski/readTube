import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Debug endpoint to examine Clerk session structure
 * GET /api/debug/clerk-session
 */
export async function GET() {
  try {
    // Get auth context
    const { userId, sessionId, getToken } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get current user data
    const user = await currentUser();
    
    // Try to get any available tokens
    const availableTokens: Record<string, string> = {};
    try {
      // Test common token templates that Clerk might support
      const tokenTemplates = [
        'google',
        'google_oauth',
        'oauth_google',
        'external_google',
        'google_access_token',
        'youtube',
        'oauth'
      ];
      
      for (const template of tokenTemplates) {
        try {
          const token = await getToken({ template });
          if (token) {
            availableTokens[template] = token.substring(0, 20) + '...'; // Truncate for security
          }
        } catch {
          // Token template doesn't exist, continue
        }
      }
    } catch (error) {
      console.log('Token extraction failed:', error);
    }

    // Examine external accounts
    const externalAccounts = user?.externalAccounts?.map(account => ({
      provider: account.provider,
      externalId: account.externalId,
      emailAddress: account.emailAddress,
      username: account.username,
      // Check if there are any token-related fields (without exposing actual tokens)
      hasAccessToken: !!(account as unknown as Record<string, unknown>).accessToken,
      hasRefreshToken: !!(account as unknown as Record<string, unknown>).refreshToken,
      scopes: (account as unknown as Record<string, unknown>).scopes || 'none',
      tokenExpiry: (account as unknown as Record<string, unknown>).tokenExpiry || 'unknown',
      // Log all available fields for analysis
      availableFields: Object.keys(account).filter(key => !['accessToken', 'refreshToken'].includes(key))
    })) || [];

    // Check session claims for external auth data
    // Session claims are already available in user.publicMetadata
    
    return NextResponse.json({
      investigation: 'Clerk Session Structure Analysis',
      timestamp: new Date().toISOString(),
      
      // Basic auth info
      authInfo: {
        userId,
        sessionId,
        isAuthenticated: !!userId,
        hasUser: !!user
      },
      
      // User profile analysis
      userProfile: {
        id: user?.id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        emailAddresses: user?.emailAddresses?.map(email => ({
          address: email.emailAddress,
          verified: email.verification?.status === 'verified'
        })),
        profileImageUrl: user?.imageUrl,
        createdAt: user?.createdAt,
        lastSignInAt: user?.lastSignInAt
      },
      
      // External accounts analysis
      externalAccountsAnalysis: {
        count: externalAccounts.length,
        providers: externalAccounts.map(acc => acc.provider),
        googleAccountPresent: externalAccounts.some(acc => acc.provider === 'google'),
        accounts: externalAccounts
      },
      
      // Token availability test
      tokenAvailability: {
        templatesFound: Object.keys(availableTokens),
        tokenData: availableTokens
      },
      
      // Session metadata
      sessionMetadata: {
        publicMetadata: user?.publicMetadata,
        privateMetadata: user?.privateMetadata ? 'present' : 'none',
        unsafeMetadata: user?.unsafeMetadata ? 'present' : 'none'
      },
      
      // Research findings
      researchNotes: {
        clerkVersion: 'Next.js integration',
        externalAccountsSupported: externalAccounts.length > 0,
        googleIntegrationActive: externalAccounts.some(acc => acc.provider === 'google'),
        tokenAccessMethod: Object.keys(availableTokens).length > 0 ? 'getToken() works' : 'getToken() failed',
        nextSteps: [
          'Check if external accounts contain OAuth tokens',
          'Research Clerk custom claims for OAuth data',
          'Investigate Clerk OAuth token refresh mechanisms',
          'Test incremental authorization with Google'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Clerk session debug error:', error);
    
    return NextResponse.json({
      error: 'Failed to analyze Clerk session',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}