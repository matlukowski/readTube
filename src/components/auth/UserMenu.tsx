'use client';

import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, Youtube, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  // Generate avatar URL or use Google profile picture
  const avatarUrl = user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}&background=random&size=40`;

  return (
    <div className="dropdown dropdown-end">
      <div 
        tabIndex={0} 
        role="button" 
        className="btn btn-ghost btn-circle avatar"
        title={`Zalogowany jako: ${user.name || user.email}`}
      >
        <div className="w-8 rounded-full ring-2 ring-primary ring-opacity-20">
          <Image 
            src={avatarUrl}
            alt={user.name || user.email}
            width={32}
            height={32}
            className="rounded-full"
            onError={(e) => {
              // Fallback to generated avatar if Google picture fails
              const target = e.target as HTMLImageElement;
              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}&background=random&size=40`;
            }}
          />
        </div>
      </div>
      
      <ul 
        tabIndex={0} 
        className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-64"
      >
        {/* User Info Header */}
        <li className="menu-title">
          <div className="flex flex-col">
            <span className="font-semibold text-base-content">{user.name || 'Użytkownik'}</span>
            <span className="text-sm text-base-content/70">{user.email}</span>
          </div>
        </li>
        
        <div className="divider my-1"></div>
        
        {/* YouTube API status removed - authentication simplified */}
        
        {/* Navigation Links */}
        <li>
          <Link href="/analyze" className="flex items-center gap-2">
            <Youtube className="w-4 h-4" />
            Analizuj filmy
          </Link>
        </li>
        
        <li>
          <Link href="/library" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Moja biblioteka
          </Link>
        </li>
        
        <li>
          <Link href="/user-profile" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Ustawienia konta
          </Link>
        </li>
        
        <div className="divider my-1"></div>
        
        {/* Logout */}
        <li>
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-error hover:bg-error/10"
          >
            <LogOut className="w-4 h-4" />
            Wyloguj się
          </button>
        </li>
      </ul>
    </div>
  );
}