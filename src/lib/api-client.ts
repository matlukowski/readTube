/**
 * Authenticated HTTP Client for API calls
 * Automatically includes Google OAuth tokens in Authorization headers
 */

'use client';

export interface ApiClientOptions extends RequestInit {
  includeAuth?: boolean; // Default: true
  timeout?: number; // Default: 30000ms
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * Get access token from localStorage (client-side only)
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null; // Server-side
  }
  
  return localStorage.getItem('google_access_token');
}

/**
 * Authenticated fetch wrapper that automatically includes Authorization headers
 */
export async function authenticatedFetch(
  url: string,
  options: ApiClientOptions = {}
): Promise<Response> {
  const {
    includeAuth = true,
    timeout = 30000,
    headers = {},
    ...fetchOptions
  } = options;

  // Prepare headers
  const finalHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add Authorization header if requested and token available
  if (includeAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      finalHeaders['Authorization'] = `Bearer ${accessToken}`;
    } else {
      console.warn('⚠️ No access token available for authenticated request');
    }
  }

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
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken();
  return !!token;
}

/**
 * Get current user data from localStorage
 */
export function getCurrentUser(): any | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
}

/**
 * Handle authentication errors by clearing tokens and redirecting
 */
export function handleAuthError(error: string, redirectToLogin = true): void {
  console.warn('Authentication error:', error);
  
  // Clear tokens
  if (typeof window !== 'undefined') {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('user_data');
  }
  
  // Redirect to login if requested
  if (redirectToLogin && typeof window !== 'undefined') {
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