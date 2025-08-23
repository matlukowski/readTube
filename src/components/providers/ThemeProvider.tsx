'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { getClerkAppearance, polishLocalization } from '@/lib/clerkAppearance';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    // Get initial theme from localStorage or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    // Listen for theme changes
    const handleThemeChange = () => {
      const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(newTheme);
    };
    
    // Create a MutationObserver to watch for data-theme attribute changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          handleThemeChange();
        }
      });
    });
    
    // Start observing the html element for attribute changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    // Cleanup observer on unmount
    return () => observer.disconnect();
  }, []);
  
  return (
    <ClerkProvider
      appearance={getClerkAppearance(theme)}
      localization={polishLocalization}
      unsafe_disableDevelopmentModeWarnings={true}
    >
      {children}
    </ClerkProvider>
  );
}