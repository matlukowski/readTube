'use client';

import { useAuth } from '@/contexts/AuthContext';
import LoginButton from './LoginButton';
import { Shield, Youtube } from 'lucide-react';
import { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  requireYouTube?: boolean; // If true, also requires YouTube scope
  fallback?: ReactNode; // Custom fallback component
  title?: string;
  description?: string;
}

export default function AuthGuard({ 
  children, 
  requireYouTube = false,
  fallback,
  title = 'Autoryzacja wymagana',
  description = 'Zaloguj się, aby uzyskać dostęp do tej funkcji.'
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, hasYouTubeScope } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <p className="text-base-content/70">Sprawdzanie autoryzacji...</p>
      </div>
    );
  }

  // User not authenticated
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-base-content">{title}</h2>
            <p className="text-base-content/70 max-w-md">{description}</p>
          </div>
        </div>
        
        <LoginButton 
          size="lg" 
          text="Zaloguj się przez Google"
          showIcon={true}
        />
        
        <div className="text-center text-sm text-base-content/50 max-w-md">
          <p>
            Logując się, otrzymasz dostęp do YouTube Data API i możliwość analizy filmów 
            z pełnymi transkrypcjami i podsumowaniami AI.
          </p>
        </div>
      </div>
    );
  }

  // User authenticated but YouTube scope required
  if (requireYouTube && !hasYouTubeScope) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-warning/10 rounded-full flex items-center justify-center">
            <Youtube className="w-8 h-8 text-warning" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-base-content">Dostęp do YouTube API wymagany</h2>
            <p className="text-base-content/70 max-w-md">
              Ta funkcja wymaga dostępu do YouTube Data API. Zaloguj się ponownie aby przyznać uprawnienia.
            </p>
          </div>
        </div>
        
        <LoginButton 
          size="lg" 
          text="Autoryzuj YouTube API"
          showIcon={true}
        />
        
        <div className="alert alert-info max-w-md">
          <Youtube className="w-5 h-5" />
          <div className="text-sm">
            <div className="font-medium">Potrzebne uprawnienia:</div>
            <div>• Odczyt metadanych filmów YouTube</div>
            <div>• Dostęp do napisów i transkrypcji</div>
          </div>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}