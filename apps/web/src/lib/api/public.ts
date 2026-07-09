import "server-only";

import {
  invitationWeatherSchema,
  publicInvitationSchema,
  publicInvitationWishesSchema,
  publicPackageSchema,
  publicThemePageSchema,
  publicThemeSchema,
  type PublicPackage,
  type PublicInvitation,
  type PublicTheme,
  type InvitationWeather,
  type PublicInvitationWishes,
} from "@/lib/api/contracts";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/locales";

async function apiFetch(
  path: string,
  options: { timeoutMs?: number } = {},
): Promise<unknown> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(options.timeoutMs ?? 2_000),
  });

  if (!response.ok) {
    throw new Error(`Public API request failed with ${response.status}`);
  }

  return response.json();
}

export async function fetchPublicInvitation(
  publicSlug: string,
  previewToken?: string,
  guestToken?: string,
): Promise<PublicInvitation | null> {
  try {
    const query = new URLSearchParams();
    if (previewToken) {
      query.set("token", previewToken);
    }
    if (guestToken) {
      query.set("guest", guestToken);
    }
    const suffix = query.size ? `?${query.toString()}` : "";
    const path = previewToken
      ? `/invitations/${publicSlug}/preview${suffix}`
      : `/invitations/${publicSlug}${suffix}`;
    return publicInvitationSchema.parse(
      await apiFetch(path),
    );
  } catch {
    return null;
  }
}

export async function fetchInvitationWishes(
  publicSlug: string,
  accessToken?: string,
): Promise<PublicInvitationWishes | null> {
  if (!accessToken) {
    return null;
  }
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_API_URL}/invitations/${publicSlug}/wishes?access=${encodeURIComponent(
        accessToken,
      )}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2_000),
      },
    );
    if (!response.ok) {
      return null;
    }
    return publicInvitationWishesSchema.parse(await response.json());
  } catch {
    return null;
  }
}

export async function fetchInvitationWeather(
  publicSlug: string,
): Promise<InvitationWeather | null> {
  try {
    return invitationWeatherSchema.parse(
      await apiFetch(`/invitations/${publicSlug}/weather`, {
        timeoutMs: 8_000,
      }),
    );
  } catch {
    return null;
  }
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
