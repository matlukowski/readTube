'use client';

import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Loader } from 'lucide-react';

interface LoginButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
  showIcon?: boolean;
  text?: string;
}

export default function LoginButton({ 
  size = 'sm', 
  variant = 'primary', 
  fullWidth = false,
  showIcon = true,
  text = 'Zaloguj się przez Google'
}: LoginButtonProps) {
  const { login, isLoading } = useAuth();

  const sizeClass = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg'
  }[size];

  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost'
  }[variant];

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      onClick={login}
      disabled={isLoading}
      className={`btn ${sizeClass} ${variantClass} ${widthClass} gap-2`}
      title="Zaloguj się używając Google OAuth z dostępem do YouTube API"
    >
      {isLoading ? (
        <Loader className="w-4 h-4 animate-spin" />
      ) : (
        showIcon && <LogIn className="w-4 h-4" />
      )}
      {isLoading ? 'Logowanie...' : text}
    </button>
  );
}