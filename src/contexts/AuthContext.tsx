'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';

interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  googleId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google OAuth scopes for basic user authentication
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // Removed hasYouTubeScope - no longer needed since we use yt-dlp instead of YouTube OAuth

  // Check if user has valid session on app start
  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedToken = localStorage.getItem('google_access_token');
        const storedUser = localStorage.getItem('user_data');
        
        if (storedToken && storedUser) {
          // Verify token is still valid
          const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${storedToken}`);
          
          if (response.ok) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setAccessToken(storedToken);
            // No YouTube scope validation needed
          } else {
            // Token expired, clear storage
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('user_data');
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setIsLoading(true);
        console.log('🔑 Google OAuth success:', tokenResponse);
        
        // Store access token
        setAccessToken(tokenResponse.access_token);
        localStorage.setItem('google_access_token', tokenResponse.access_token);
        
        // Get user info from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });
        
        if (!userResponse.ok) {
          throw new Error('Failed to get user info');
        }
        
        const googleUser = await userResponse.json();
        console.log('👤 Google user data:', googleUser);
        
        const userData: User = {
          id: googleUser.id,
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
        };
        
        setUser(userData);
        // No YouTube scope tracking needed
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        // Create/update user in our database
        await fetch('/api/auth/google-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user: userData,
            accessToken: tokenResponse.access_token,
            refreshToken: (tokenResponse as unknown as { refresh_token?: string }).refresh_token || undefined, // Refresh token not available in implicit flow
          }),
        });
        
      } catch (error) {
        console.error('❌ Login failed:', error);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error('❌ Google login error:', error);
      setIsLoading(false);
    },
    scope: GOOGLE_OAUTH_SCOPES,
    flow: 'implicit', // Use implicit flow for faster access (good for client-side apps)
  });

  const logout = () => {
    try {
      googleLogout();
      setUser(null);
      setAccessToken(null);
      // No YouTube scope to reset
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('user_data');
      console.log('👋 User logged out');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    accessToken,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// useYouTubeAPI hook removed - no longer needed since we use yt-dlp for transcription
// YouTube Data API calls (search) now use server-side API key instead of OAuth tokens