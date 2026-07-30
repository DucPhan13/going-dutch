import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export default function Header({ title, showBack = false, backTo = '/' }: HeaderProps) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('going-dutch-theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <Link to={backTo}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Go back"
                >
                  <ArrowLeft size={18} />
                </Button>
              </Link>
            )}
            <Link to="/" className="text-base font-semibold tracking-tight text-foreground">{title}</Link>
          </div>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary navigation">
            <NavLink to="/" end className={({isActive}) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Groups</NavLink>
            <NavLink to="/friends" className={({isActive}) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Friends</NavLink>
            <NavLink to="/activity" className={({isActive}) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Activity</NavLink>
          </nav>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="ml-2 text-muted-foreground hover:text-foreground">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
