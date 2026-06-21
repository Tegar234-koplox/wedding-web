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

function packageFromApi(item: PublicPackage, locale: Locale): ServicePackage {
  return {
    code: item.code,
    name: item.name,
    price: new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
      style: "currency",
      currency: item.currency,
      maximumFractionDigits: 0,
    }).format(Number(item.price)),
    featured: item.is_featured,
    description: { id: item.summary, en: item.summary },
    features: {
      id: item.features
        .filter((feature) => feature.is_included)
        .map((feature) => feature.label),
      en: item.features
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
