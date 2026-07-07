import type { PublicPackage, PublicTheme } from "@/lib/api/contracts";
import { fetchPublicPackages, fetchPublicThemes } from "@/lib/api/public";
import type { Locale } from "@/lib/locales";

import {
  packages as fallbackPackages,
  themes as fallbackThemes,
  type ServicePackage,
  type Theme,
} from "./site";

function themeFromApi(theme: PublicTheme): Theme {
  const fallback = fallbackThemes.find((item) => item.slug === theme.slug);
  return {
    slug: theme.slug,
    name: { id: theme.name, en: theme.name },
    category: { id: theme.category, en: theme.category },
    description: { id: theme.description, en: theme.description },
    image: theme.cover?.secure_url || fallback?.image || "",
    accent: fallback?.accent || "#d5ad55",
    tone: fallback?.tone || "dark",
  };
}

function compactPackagePrice(value: string, currency: string, locale: Locale): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }
  const prefix = currency === "IDR" ? "Rp" : currency;
  if (amount >= 1_000 && amount % 1_000 === 0) {
    return `${prefix} ${amount / 1_000}k`;
  }
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function packageFromApi(item: PublicPackage, locale: Locale): ServicePackage {
  const fallback = fallbackPackages.find((pack) => pack.code === item.code);
  return {
    code: item.code,
    name: item.name,
    price: fallback?.price ?? compactPackagePrice(item.price, item.currency, locale),
    featured: item.is_featured,
    description: fallback?.description ?? { id: item.summary, en: item.summary },
    features: {
      id:
        fallback?.features.id ??
        item.features
          .filter((feature) => feature.is_included)
          .map((feature) => feature.label),
      en:
        fallback?.features.en ??
        item.features
          .filter((feature) => feature.is_included)
          .map((feature) => feature.label),
    },
  };
}

export async function getPublicThemes(locale: Locale): Promise<Theme[]> {
  const apiThemes = await fetchPublicThemes(locale);
  return apiThemes?.length ? apiThemes.map(themeFromApi) : fallbackThemes;
}

export async function getPublicPackages(
  locale: Locale,
): Promise<ServicePackage[]> {
  const apiPackages = await fetchPublicPackages(locale);
  return apiPackages?.length
    ? apiPackages.map((item) => packageFromApi(item, locale))
    : fallbackPackages;
}
