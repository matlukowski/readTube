'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Search, Youtube, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { isSignedIn } = useUser();
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
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
          <li><Link href="/search">Search</Link></li>
          {isSignedIn && (
            <>
              <li><Link href="/dashboard">Dashboard</Link></li>
              <li><Link href="/favorites">Favorites</Link></li>
            </>
          )}
        </ul>
      </div>
      
      <div className="navbar-end">
        <button onClick={toggleTheme} className="btn btn-ghost btn-circle">
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        
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