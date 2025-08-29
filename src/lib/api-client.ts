/**
 * Authenticated HTTP Client for API calls
 * Works with Clerk authentication - tokens are handled automatically by Clerk
 */

'use client';

export interface ApiClientOptions extends RequestInit {
  includeAuth?: boolean; // Default: true (but Clerk handles this automatically)
  timeout?: number; // Default: 30000ms
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * Authenticated fetch wrapper
 * Note: Clerk automatically handles authentication through middleware,
 * so we don't need to manually add authorization headers
 */
export async function authenticatedFetch(
  url: string,
  options: ApiClientOptions = {}
): Promise<Response> {
  const {
    includeAuth = true, // Kept for backward compatibility but not used
    timeout = 30000,
    headers = {},
    ...fetchOptions
  } = options;

  // Prepare headers
  const finalHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Clerk handles authentication automatically through cookies/session
  // No need to manually add Authorization headers

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: finalHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Convenience method for GET requests
 */
export async function apiGet<T = any>(
  url: string,
  options: Omit<ApiClientOptions, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'GET',
    });

    const data = await response.json();

    return {
      success: response.ok,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
      status: response.status,
    };

  } catch (error) {
    console.error(`GET ${url} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}

/**
 * Convenience method for POST requests
 */
export async function apiPost<T = any>(
  url: string,
  data?: any,
  options: Omit<ApiClientOptions, 'method'> = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });

    const responseData = await response.json();

    return {
      success: response.ok,
      data: response.ok ? responseData : undefined,
      error: response.ok ? undefined : (responseData.error || `HTTP ${response.status}`),
      status: response.status,
    };

  } catch (error) {
    console.error(`POST ${url} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}

/**
 * Convenience method for PUT requests
 */
export async function apiPut<T = any>(
  url: string,
  data?: any,
  options: Omit<ApiClientOptions, 'method'> = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });

    const responseData = await response.json();

    return {
      success: response.ok,
      data: response.ok ? responseData : undefined,
      error: response.ok ? undefined : (responseData.error || `HTTP ${response.status}`),
      status: response.status,
    };

  } catch (error) {
    console.error(`PUT ${url} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}

/**
 * Convenience method for DELETE requests
 */
export async function apiDelete<T = any>(
  url: string,
  options: Omit<ApiClientOptions, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'DELETE',
    });

    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : { success: response.ok };

    return {
      success: response.ok,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : (data.error || `HTTP ${response.status}`),
      status: response.status,
    };

  } catch (error) {
    console.error(`DELETE ${url} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}

/**
 * Check if user is authenticated
 * Note: This is deprecated - use Clerk's useAuth() hook instead
 * @deprecated Use Clerk's useAuth() hook or useUser() hook
 */
export function isAuthenticated(): boolean {
  console.warn('isAuthenticated() is deprecated. Use Clerk\'s useAuth() hook instead.');
  // This is a placeholder - actual auth check should use Clerk hooks
  return false;
}

/**
 * Get current user data
 * Note: This is deprecated - use Clerk's useUser() hook instead
 * @deprecated Use Clerk's useUser() hook
 */
export function getCurrentUser(): any | null {
  console.warn('getCurrentUser() is deprecated. Use Clerk\'s useUser() hook instead.');
  return null;
}

/**
 * Handle authentication errors
 * Note: Clerk handles authentication errors automatically
 */
export function handleAuthError(error: string, redirectToLogin = true): void {
  console.warn('Authentication error:', error);
  
  // Clerk handles session management automatically
  // No need to manually clear tokens
  
  // Redirect to login if requested
  if (redirectToLogin && typeof window !== 'undefined') {
    // Clerk will redirect to sign-in automatically for protected routes
    window.location.href = '/';
  }
}

/**
 * Hook to check authentication status and handle errors
 */
export function useApiErrorHandler() {
  return {
    handleResponse: <T>(response: ApiResponse<T>): T => {
      if (!response.success) {
        // Handle authentication errors
        if (response.status === 401) {
          handleAuthError(response.error || 'Unauthorized', true);
          throw new Error('Authentication required. Redirecting to login...');
        }
        
        // Handle other errors
        throw new Error(response.error || `Request failed with status ${response.status}`);
      }
      
      return response.data as T;
    },
    
    isAuthError: (error: Error): boolean => {
      return error.message.includes('Unauthorized') || 
             error.message.includes('Authentication required');
    }
  };
}