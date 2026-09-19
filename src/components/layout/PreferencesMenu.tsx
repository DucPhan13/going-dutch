import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePreferences } from '@/contexts/PreferencesContext';
import { LayoutPanelLeft, Monitor, Moon, Settings, Sun } from 'lucide-react';
import type { BalanceCardDensity, ThemePreference } from '@/lib/preferences';

export default function PreferencesMenu() {
  const { theme, balanceCardDensity, resolvedTheme, setTheme, setBalanceCardDensity, t } = usePreferences();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('settings')} className="shrink-0 text-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('settings')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex items-center gap-2">
              {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {t('theme')}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={value => setTheme(value as ThemePreference)}>
              <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4" />{t('light')}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" />{t('dark')}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="device"><Monitor className="mr-2 h-4 w-4" />{t('device')}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><span className="flex items-center gap-2"><LayoutPanelLeft className="h-4 w-4" />{t('balanceLayout')}</span></DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={balanceCardDensity} onValueChange={value => setBalanceCardDensity(value as BalanceCardDensity)}>
              <DropdownMenuRadioItem value="expanded">{t('expanded')}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="compact">{t('compact')}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
