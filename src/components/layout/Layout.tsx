import React from 'react';
import { NavLink } from 'react-router-dom';
import Header from './Header';
import { CircleDollarSign, House, Users } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export default function Layout({ children, title, showBack, backTo }: LayoutProps) {
  const navItems = [
    { to: '/', label: 'Home', icon: House },
    { to: '/friends', label: 'Friends', icon: Users },
    { to: '/activity', label: 'Activity', icon: CircleDollarSign },
  ];
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title={title} showBack={showBack} backTo={backTo} />
      <main className="flex-1 relative z-0 px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-10 container mx-auto max-w-4xl page-enter">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-2 backdrop-blur sm:hidden" aria-label="Primary navigation">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex min-w-14 flex-col items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <Icon className="h-5 w-5" />{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
