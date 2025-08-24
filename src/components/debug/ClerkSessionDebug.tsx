/**
 * Clerk Session Debug Component - Development Only
 * Shows comprehensive Clerk OAuth data analysis
 */

'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

interface TokenTestResult {
  template: string;
  hasToken: boolean;
  tokenPreview?: string;
  error?: string;
}

export function ClerkSessionDebug() {
  const { userId, sessionId, getToken } = useAuth();
  const { user } = useUser();
  const [tokenResults, setTokenResults] = useState<TokenTestResult[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId || !getToken) return;

    const testTokens = async () => {
      setIsLoading(true);
      const tokenTemplates = [
        'google',
        'google_oauth',
        'oauth_google', 
        'external_google',
        'google_access_token',
        'youtube',
        'oauth',
        'default'
      ];

      const results: TokenTestResult[] = [];
      
      for (const template of tokenTemplates) {
        try {
          const token = await getToken({ template });
          results.push({
            template,
            hasToken: !!token,
            tokenPreview: token ? `${token.substring(0, 20)}...` : undefined
          });
        } catch (error) {
          results.push({
            template,
            hasToken: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      setTokenResults(results);
      setIsLoading(false);
    };

    testTokens();
  }, [userId, getToken]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!userId) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
        <strong>Debug:</strong> Not authenticated - please log in to see Clerk session data
      </div>
    );
  }

  const externalAccounts = user?.externalAccounts?.map(account => ({
    provider: account.provider,
    externalId: account.externalId?.substring(0, 8) + '...',
    emailAddress: account.emailAddress,
    username: account.username,
    // Check for token-related fields
    hasAccessToken: !!(account as any).accessToken,
    hasRefreshToken: !!(account as any).refreshToken, 
    scopes: (account as any).scopes || 'none',
    tokenExpiry: (account as any).tokenExpiry || 'unknown',
    allFields: Object.keys(account)
  })) || [];

  const googleAccount = externalAccounts.find(acc => acc.provider === 'google');

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-blue-900">
          🔧 Clerk OAuth Debug (Dev Only)
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {isExpanded ? 'Collapse' : 'Expand'} Debug Info
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-3 rounded border">
          <h4 className="font-medium text-gray-900 mb-2">Basic Auth</h4>
          <div className="text-sm space-y-1">
            <div><strong>User ID:</strong> {userId?.substring(0, 12)}...</div>
            <div><strong>Session ID:</strong> {sessionId?.substring(0, 12)}...</div>
            <div><strong>Has User:</strong> {user ? '✅' : '❌'}</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded border">
          <h4 className="font-medium text-gray-900 mb-2">Google Account</h4>
          <div className="text-sm space-y-1">
            {googleAccount ? (
              <>
                <div><strong>Provider:</strong> {googleAccount.provider}</div>
                <div><strong>Email:</strong> {googleAccount.emailAddress}</div>
                <div><strong>Access Token:</strong> {googleAccount.hasAccessToken ? '✅' : '❌'}</div>
                <div><strong>Refresh Token:</strong> {googleAccount.hasRefreshToken ? '✅' : '❌'}</div>
                <div><strong>Scopes:</strong> {googleAccount.scopes}</div>
              </>
            ) : (
              <div className="text-red-600">No Google account found</div>
            )}
          </div>
        </div>

        <div className="bg-white p-3 rounded border">
          <h4 className="font-medium text-gray-900 mb-2">Token Test</h4>
          <div className="text-sm space-y-1">
            {isLoading ? (
              <div>Testing tokens...</div>
            ) : (
              <>
                <div><strong>Templates Tested:</strong> {tokenResults.length}</div>
                <div><strong>Tokens Found:</strong> {tokenResults.filter(r => r.hasToken).length}</div>
                {tokenResults.filter(r => r.hasToken).map(result => (
                  <div key={result.template} className="text-green-600">
                    ✅ {result.template}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-gray-900 mb-3">🔍 Token Template Test Results</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {tokenResults.map((result, index) => (
                <div 
                  key={index} 
                  className={`p-2 rounded ${result.hasToken ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  <div><strong>{result.template}:</strong></div>
                  {result.hasToken ? (
                    <div>✅ Token: {result.tokenPreview}</div>
                  ) : (
                    <div>❌ {result.error || 'No token'}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-gray-900 mb-3">👤 External Accounts Details</h4>
            {externalAccounts.length > 0 ? (
              <div className="space-y-3">
                {externalAccounts.map((account, index) => (
                  <div key={index} className="border p-3 rounded">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><strong>Provider:</strong> {account.provider}</div>
                      <div><strong>Email:</strong> {account.emailAddress}</div>
                      <div><strong>External ID:</strong> {account.externalId}</div>
                      <div><strong>Username:</strong> {account.username || 'none'}</div>
                      <div><strong>Access Token:</strong> {account.hasAccessToken ? '✅ Present' : '❌ Missing'}</div>
                      <div><strong>Refresh Token:</strong> {account.hasRefreshToken ? '✅ Present' : '❌ Missing'}</div>
                      <div><strong>Scopes:</strong> {account.scopes}</div>
                      <div><strong>Token Expiry:</strong> {account.tokenExpiry}</div>
                    </div>
                    <div className="mt-2">
                      <strong>Available Fields:</strong> {account.allFields.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-600">No external accounts found</div>
            )}
          </div>

          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-gray-900 mb-3">📋 Research Conclusions</h4>
            <div className="text-sm space-y-2">
              {googleAccount ? (
                <>
                  <div className={`p-2 rounded ${googleAccount.hasAccessToken ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <strong>Google OAuth Integration:</strong> {googleAccount.hasAccessToken ? '✅ Active with tokens' : '❌ No OAuth tokens'}
                  </div>
                  <div className={`p-2 rounded ${tokenResults.some(r => r.hasToken) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    <strong>Token Access via getToken():</strong> {tokenResults.some(r => r.hasToken) ? '✅ Possible' : '⚠️ Limited or blocked'}
                  </div>
                  <div className="p-2 rounded bg-blue-100 text-blue-800">
                    <strong>Next Steps:</strong> {googleAccount.hasAccessToken 
                      ? 'Try to extract real tokens and test YouTube API calls'
                      : 'Need to investigate Clerk Google provider scope configuration'}
                  </div>
                </>
              ) : (
                <div className="p-2 rounded bg-red-100 text-red-800">
                  <strong>Issue:</strong> No Google account found in Clerk session. User needs to sign in with Google.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}