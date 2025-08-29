'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export default function TestAuthPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testApiAuth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-auth');
      const data = await response.json();
      setApiTestResult({
        status: response.status,
        data
      });
    } catch (error) {
      setApiTestResult({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Test API auth on mount
    testApiAuth();
  }, [isSignedIn]);

  if (!userLoaded || !authLoaded) {
    return <div className="p-8">Loading authentication...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Authentication Test Page</h1>
      
      <div className="space-y-6">
        {/* Client-side auth status */}
        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Client-Side Authentication Status</h2>
          <div className="space-y-2">
            <p><strong>Signed In:</strong> {isSignedIn ? '✅ Yes' : '❌ No'}</p>
            {user && (
              <>
                <p><strong>User ID:</strong> {user.id}</p>
                <p><strong>Email:</strong> {user.emailAddresses[0]?.emailAddress}</p>
                <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
              </>
            )}
          </div>
        </div>

        {/* API auth test */}
        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">API Authentication Test</h2>
          <button 
            onClick={testApiAuth} 
            className="btn btn-primary mb-4"
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test API Auth'}
          </button>
          {apiTestResult && (
            <div className="mockup-code">
              <pre><code>{JSON.stringify(apiTestResult, null, 2)}</code></pre>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="card bg-info/10 p-6">
          <h2 className="text-xl font-semibold mb-4">Test Instructions</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>If not signed in, the client-side status should show "No"</li>
            <li>API test should return 401 when not authenticated</li>
            <li>After signing in, both should show authenticated status</li>
            <li>This confirms Clerk is working correctly for both client and server</li>
          </ul>
        </div>
      </div>
    </div>
  );
}