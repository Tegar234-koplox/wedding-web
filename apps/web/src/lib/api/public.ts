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

const PUBLIC_API_RETRY_DELAY_MS = 250;
const PUBLIC_INVITATION_TIMEOUT_MS = 8_000;

class PublicApiResponseError extends Error {
  constructor(readonly status: number) {
    super(`Public API request failed with ${status}`);
    this.name = "PublicApiResponseError";
  }
}

function isTransientPublicApiError(error: unknown): boolean {
  if (error instanceof PublicApiResponseError) {
    return error.status >= 500;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function waitBeforeRetry(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, PUBLIC_API_RETRY_DELAY_MS);
  });
}

async function apiFetch(
  path: string,
  options: { noStore?: boolean; timeoutMs?: number } = {},
): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
        ...(options.noStore
          ? { cache: "no-store" as const }
          : { next: { revalidate: 300 } }),
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 2_000),
      });

      if (!response.ok) {
        throw new PublicApiResponseError(response.status);
      }

      return response.json();
    } catch (error) {
      const shouldRetry = attempt === 0 && isTransientPublicApiError(error);
      if (!shouldRetry) {
        throw error;
      }
      await waitBeforeRetry();
    }
  }

  throw new Error("Public API retry loop ended unexpectedly");
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
      await apiFetch(path, {
        noStore: Boolean(previewToken || guestToken),
        timeoutMs: PUBLIC_INVITATION_TIMEOUT_MS,
      }),
    );
  } catch (error) {
    if (error instanceof PublicApiResponseError && error.status === 404) {
      return null;
    }
    throw error;
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
  previewToken?: string,
): Promise<InvitationWeather | null> {
  try {
    const query = new URLSearchParams();
    if (previewToken) {
      query.set("token", previewToken);
    }
    const suffix = query.size ? `?${query.toString()}` : "";
    return invitationWeatherSchema.parse(
      await apiFetch(`/invitations/${publicSlug}/weather${suffix}`, {
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
