import React from 'react';
import { NavLink } from 'react-router-dom';
import Header from './Header';
import { CircleDollarSign, House, Users } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  backTo?: string;
  headerActions?: React.ReactNode;
}

export default function Layout({ children, title, showBack, backTo, headerActions }: LayoutProps) {
  const { t } = usePreferences();
  const navItems = [
    { to: '/', label: t('home'), icon: House },
    { to: '/friends', label: t('friends'), icon: Users },
    { to: '/activity', label: t('activity'), icon: CircleDollarSign },
  ];
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title={title} showBack={showBack} backTo={backTo} headerActions={headerActions} />
      <main className="dashboard-ledger flex-1 relative z-0 px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-10 page-enter">
        <div className="app-content-rail">{children}</div>
      </main>
      <nav className="mobile-nav-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-2 backdrop-blur md:hidden" aria-label="Primary navigation">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex min-w-14 flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium tracking-[0.01em] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <Icon className="h-5 w-5" />{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
