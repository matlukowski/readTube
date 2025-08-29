'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

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

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { user: clerkUser, isLoaded } = useUser();
  const { isSignedIn } = useClerkAuth();
  const { openSignIn, signOut } = useClerk();
  const router = useRouter();

  // Map Clerk user to our User interface
  const user: User | null = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress || '',
    name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
    picture: clerkUser.imageUrl,
    googleId: clerkUser.id, // Use Clerk ID as googleId for compatibility
  } : null;

  const login = () => {
    openSignIn();
  };

  const logout = async () => {
    try {
      await signOut();
      router.push('/');
      console.log('👋 User logged out');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading: !isLoaded,
    isAuthenticated: !!isSignedIn && !!clerkUser,
    accessToken: null, // Clerk handles tokens internally
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