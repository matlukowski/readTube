'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Youtube, Moon, Sun, Languages } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { isSignedIn } = useUser();
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('pl');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const savedLanguage = localStorage.getItem('language') || 'pl';
    setLanguage(savedLanguage);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('languageChange', { detail: newLanguage }));
  };

  return (
    <header className="navbar bg-base-100 shadow-lg">
      <div className="navbar-start">
        <Link href="/" className="btn btn-ghost normal-case text-xl">
          <Youtube className="w-6 h-6 text-red-500" />
          <span className="ml-2">YT Knowledge</span>
        </Link>
      </div>
      
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li><Link href="/analyze">Analizuj</Link></li>
          {isSignedIn && (
            <>
              <li><Link href="/library">Biblioteka</Link></li>
            </>
          )}
        </ul>
      </div>
      
      <div className="navbar-end gap-2">
        {/* Language Selector */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost" title="Change Language">
            <Languages className="w-5 h-5" />
            <span className="ml-1 text-sm font-medium uppercase">{language}</span>
          </div>
          <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 mt-1">
            <li>
              <button 
                onClick={() => handleLanguageChange('pl')} 
                className={`text-sm ${language === 'pl' ? 'active' : ''}`}
              >
                🇵🇱 Polski
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleLanguageChange('en')} 
                className={`text-sm ${language === 'en' ? 'active' : ''}`}
              >
                🇺🇸 English
              </button>
            </li>
          </ul>
        </div>
        
        {/* Theme Toggle */}
        <button onClick={toggleTheme} className="btn btn-ghost btn-circle" title="Toggle Theme">
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        
        {/* User Authentication */}
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <Link href="/sign-in" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}