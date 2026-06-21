import "server-only";

import {
  publicPackageSchema,
  publicThemePageSchema,
  publicThemeSchema,
  type PublicPackage,
  type PublicTheme,
} from "@/lib/api/contracts";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/locales";

async function apiFetch(path: string): Promise<unknown> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(2_000),
  });

  if (!response.ok) {
    throw new Error(`Public API request failed with ${response.status}`);
  }

  return response.json();
}

export async function fetchPublicThemes(
  locale: Locale,
): Promise<PublicTheme[] | null> {
  try {
    const payload = publicThemePageSchema.parse(
      await apiFetch(`/themes?locale=${locale}&page_size=50`),
    );
    return payload.results;
  } catch {
    return null;
  }
}

export async function fetchPublicTheme(
  slug: string,
  locale: Locale,
): Promise<PublicTheme | null> {
  try {
    return publicThemeSchema.parse(
      await apiFetch(`/themes/${slug}?locale=${locale}`),
    );
  } catch {
    return null;
  }
}

export async function fetchPublicPackages(
  locale: Locale,
): Promise<PublicPackage[] | null> {
  try {
    return publicPackageSchema
      .array()
      .parse(await apiFetch(`/packages?locale=${locale}`));
  } catch {
    return null;
  }
}
