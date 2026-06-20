export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "id";

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
