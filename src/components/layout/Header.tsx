import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import PreferencesMenu from './PreferencesMenu';
import { usePreferences } from '@/contexts/PreferencesContext';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export default function Header({ title, showBack = false, backTo = '/' }: HeaderProps) {
  const { language, setLanguage, t } = usePreferences();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {showBack && (
              <Link to={backTo}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t('goBack')}
                >
                  <ArrowLeft size={18} />
                </Button>
              </Link>
            )}
            <Link to="/" className="truncate text-base font-semibold tracking-tight text-foreground">{title}</Link>
          </div>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary navigation">
            <NavLink to="/" end className={({isActive}) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('groups')}</NavLink>
            <NavLink to="/friends" className={({isActive}) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('friends')}</NavLink>
            <NavLink to="/activity" className={({isActive}) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('activity')}</NavLink>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <div
              aria-label={t('language')}
              className="language-switch inline-flex items-center p-0.5 text-xs font-semibold"
              role="group"
            >
              <button
                aria-pressed={language === 'en'}
                className="language-switch-button h-11 min-w-11 px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setLanguage('en')}
                type="button"
              >
                EN
              </button>
              <span aria-hidden="true" className="select-none text-muted-foreground/50">|</span>
              <button
                aria-pressed={language === 'vi'}
                className="language-switch-button h-11 min-w-11 px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setLanguage('vi')}
                type="button"
              >
                VI
              </button>
            </div>
            <PreferencesMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
