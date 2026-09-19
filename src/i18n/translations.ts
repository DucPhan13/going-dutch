import locales from "@/i18n/locales.json";
import type { Language } from "@/lib/preferences";

export const translations = locales;
export type TranslationKey = keyof typeof locales.en;
export type TranslationValues = Record<string, string | number>;

export function translate(language: Language, key: TranslationKey, values: TranslationValues = {}) {
  const template = locales[language][key] || locales.en[key];
  const pluralKey = typeof values.count === "number" && values.count !== 1 ? `${key}_other` as TranslationKey : key;
  const pluralTemplate = locales[language][pluralKey] || locales.en[pluralKey] || template;
  return pluralTemplate.replace(/{{(\w+)}}/g, (_, name: string) => String(values[name] ?? ""));
}
