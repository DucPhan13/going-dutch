export type ThemePreference = "light" | "dark" | "device";
export type Language = "en" | "vi";
export type BalanceCardDensity = "expanded" | "compact";

export interface Preferences {
  theme: ThemePreference;
  language: Language;
  balanceCardDensity: BalanceCardDensity;
}

export const PREFERENCES_STORAGE_KEY = "going-dutch-preferences";
export const LEGACY_THEME_STORAGE_KEY = "going-dutch-theme";
export const DEFAULT_PREFERENCES: Preferences = { theme: "device", language: "en", balanceCardDensity: "expanded" };

const isTheme = (value: unknown): value is ThemePreference => value === "light" || value === "dark" || value === "device";
const isLanguage = (value: unknown): value is Language => value === "en" || value === "vi";
const isDensity = (value: unknown): value is BalanceCardDensity => value === "expanded" || value === "compact";

export function getDeviceLanguage(locale?: string): Language {
  return locale?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function normalisePreferences(value: unknown, deviceLocale?: string): Preferences {
  const candidate = typeof value === "object" && value !== null ? value as Partial<Preferences> : {};
  return {
    theme: isTheme(candidate.theme) ? candidate.theme : DEFAULT_PREFERENCES.theme,
    language: isLanguage(candidate.language) ? candidate.language : getDeviceLanguage(deviceLocale),
    balanceCardDensity: isDensity(candidate.balanceCardDensity) ? candidate.balanceCardDensity : DEFAULT_PREFERENCES.balanceCardDensity,
  };
}

export function readPreferences(storage: Storage | undefined, deviceLocale?: string): Preferences {
  if (!storage) return normalisePreferences(undefined, deviceLocale);
  try {
    const stored = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored) return normalisePreferences(JSON.parse(stored), deviceLocale);
    const legacyTheme = storage.getItem(LEGACY_THEME_STORAGE_KEY);
    return normalisePreferences(isTheme(legacyTheme) ? { theme: legacyTheme } : undefined, deviceLocale);
  } catch {
    return normalisePreferences(undefined, deviceLocale);
  }
}

export function savePreferences(storage: Storage | undefined, preferences: Preferences) {
  try { storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Private browsing can deny storage. */ }
}

export function resolveTheme(theme: ThemePreference, devicePrefersDark: boolean): "light" | "dark" {
  return theme === "device" ? (devicePrefersDark ? "dark" : "light") : theme;
}

export function formatVnd(amount: number, language: Language) {
  return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: "VND", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(amount);
}
