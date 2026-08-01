export type TrustZone = "client" | "public" | "shared" | "staff";
export type SensitiveRoute = "client" | "guest" | "preview" | "staff" | null;

const HOST_ENV: Record<Exclude<TrustZone, "shared">, string> = {
  public: "NISKALA_PUBLIC_HOSTS",
  client: "NISKALA_CLIENT_HOSTS",
  staff: "NISKALA_STAFF_HOSTS",
};

export function isProductionDeployment(): boolean {
  return (
    process.env.DEPLOYMENT_ENVIRONMENT === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function normalizeHost(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || /[\s/\\@?#,]/.test(raw)) {
    return null;
  }

  try {
    return new URL(`http://${raw}`)
      .hostname.toLowerCase()
      .replace(/\.$/, "")
      .replace(/^\[(.*)\]$/, "$1");
  } catch {
    return null;
  }
}

function hostFromSiteUrl(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export function configuredHosts(
  zone: Exclude<TrustZone, "shared">,
): ReadonlySet<string> {
  const rawConfiguredHosts = process.env[HOST_ENV[zone]];
  const configured = rawConfiguredHosts
    ?.split(",")
    .map((host) => normalizeHost(host))
    .filter((host): host is string => Boolean(host));
  if (rawConfiguredHosts !== undefined) {
    return new Set(configured ?? []);
  }

  if (isProductionDeployment()) {
    return new Set();
  }

  const fallback = [
    "localhost",
    "127.0.0.1",
    "::1",
    hostFromSiteUrl(),
  ].filter((host): host is string => Boolean(host));
  return new Set(fallback);
}

export function trustZoneForPath(pathname: string): TrustZone {
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png"
  ) {
    return "shared";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "staff";
  }
  if (pathname === "/api/staff" || pathname.startsWith("/api/staff/")) {
    return "staff";
  }
  if (
    pathname === "/client" ||
    pathname.startsWith("/client/") ||
    pathname === "/guest-delivery" ||
    pathname.startsWith("/guest-delivery/")
  ) {
    return "client";
  }
  if (
    pathname === "/api/guest-management" ||
    pathname.startsWith("/api/guest-management/") ||
    pathname === "/api/client" ||
    pathname.startsWith("/api/client/")
  ) {
    return "client";
  }
  return "public";
}

export function sensitiveRouteForRequest(
  pathname: string,
  searchParams: URLSearchParams,
): SensitiveRoute {
  const zone = trustZoneForPath(pathname);
  if (zone === "staff") {
    return "staff";
  }
  if (zone === "client") {
    return "client";
  }
  if (pathname === "/api/guest" || pathname.startsWith("/api/guest/")) {
    return "guest";
  }
  if (pathname === "/g" || pathname.startsWith("/g/")) {
    return "guest";
  }
  if (
    pathname === "/preview/access" ||
    pathname.startsWith("/preview/access/") ||
    pathname === "/api/preview" ||
    pathname.startsWith("/api/preview/")
  ) {
    return "preview";
  }

  const isInvitation = /^\/(?:id|en)\/i\/[^/]+(?:\/|$)/.test(pathname);
  if (isInvitation && searchParams.has("access")) {
    return "client";
  }
  if (isInvitation && searchParams.has("preview")) {
    return "preview";
  }
  if (isInvitation && searchParams.has("guest")) {
    return "guest";
  }
  if (/^\/(?:id|en)\/preview\/[^/]+(?:\/|$)/.test(pathname)) {
    return "preview";
  }
  return null;
}

export function isAllowedHostForZone(
  host: string,
  zone: TrustZone,
): boolean {
  if (isProductionDeployment() && host.endsWith(".vercel.app")) {
    return false;
  }

  if (zone === "shared") {
    return (["public", "client", "staff"] as const).some((candidate) =>
      configuredHosts(candidate).has(host),
    );
  }
  if (
    isProductionDeployment() &&
    (["public", "client", "staff"] as const).some(
      (candidate) => candidate !== zone && configuredHosts(candidate).has(host),
    )
  ) {
    return false;
  }
  return configuredHosts(zone).has(host);
}

export function previewFrameAncestors(): string[] {
  return (["client", "staff"] as const).flatMap((zone) =>
    [...configuredHosts(zone)]
      .filter((host) => !["localhost", "127.0.0.1", "::1"].includes(host))
      .map((host) => `https://${host}`),
  );
}
