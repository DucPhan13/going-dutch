import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type BalanceCardDensity, type Language, type Preferences, type ThemePreference, formatVnd, readPreferences, resolveTheme, savePreferences } from "@/lib/preferences";
import { translate, type TranslationKey, type TranslationValues } from "@/i18n/translations";

interface PreferencesContextValue extends Preferences {
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setBalanceCardDensity: (density: BalanceCardDensity) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  formatVnd: (amount: number) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const devicePrefersDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences(typeof window === "undefined" ? undefined : window.localStorage, typeof navigator === "undefined" ? undefined : navigator.language));
  const [isDeviceDark, setIsDeviceDark] = useState(devicePrefersDark);
  const resolvedTheme = resolveTheme(preferences.theme, isDeviceDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setIsDeviceDark(event.matches);
    setIsDeviceDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", resolvedTheme === "dark"); document.documentElement.style.colorScheme = resolvedTheme; document.documentElement.lang = preferences.language; }, [preferences.language, resolvedTheme]);
  useEffect(() => { savePreferences(window.localStorage, preferences); }, [preferences]);

  const value = useMemo<PreferencesContextValue>(() => ({
    ...preferences, resolvedTheme,
    setTheme: theme => setPreferences(current => ({ ...current, theme })),
    setLanguage: language => setPreferences(current => ({ ...current, language })),
    setBalanceCardDensity: balanceCardDensity => setPreferences(current => ({ ...current, balanceCardDensity })),
    t: (key, values) => translate(preferences.language, key, values),
    formatVnd: amount => formatVnd(amount, preferences.language),
  }), [preferences, resolvedTheme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error("usePreferences must be used within PreferencesProvider");
  return preferences;
}
