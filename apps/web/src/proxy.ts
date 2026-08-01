import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isAllowedHostForZone,
  normalizeHost,
  previewFrameAncestors,
  sensitiveRouteForRequest,
  trustZoneForPath,
  type SensitiveRoute,
} from "@/lib/security/trust-zones";

const staffGateCookie = "niskala_staff_gate";

function deploymentHeaders(response: NextResponse) {
  response.headers.set(
    "X-Niskala-Environment",
    process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "development",
  );
  response.headers.set(
    "X-Niskala-Release",
    process.env.DEPLOYMENT_RELEASE ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      "local",
  );
  return response;
}

function contentSecurityPolicy({
  nonce,
  sensitiveRoute,
}: {
  nonce?: string;
  sensitiveRoute?: SensitiveRoute;
} = {}) {
  const sentryOrigin = origin(process.env.NEXT_PUBLIC_SENTRY_DSN, "");
  const scripts = nonce
    ? [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
      ]
    : [
        "'self'",
        "'unsafe-inline'",
        ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
      ];

  const frameAncestors =
    sensitiveRoute === "preview"
      ? ["'self'", ...previewFrameAncestors()]
      : sensitiveRoute
        ? ["'none'"]
        : ["'self'"];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    ["connect-src 'self'", sentryOrigin].filter(Boolean).join(" "),
    "font-src 'self' data:",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors.join(" ")}`,
    "frame-src 'self'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "media-src 'self' https://res.cloudinary.com",
    "object-src 'none'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    ...(process.env.NODE_ENV === "production"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");
}

function origin(value: string | undefined, fallback: string) {
  try {
    return value ? new URL(value).origin : fallback;
  } catch {
    return fallback;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = normalizeHost(request.headers.get("host"));
  const zone = trustZoneForPath(pathname);
  let sensitiveRoute = sensitiveRouteForRequest(
    pathname,
    request.nextUrl.searchParams,
  );
  const isInvitation = /^\/(?:id|en)\/i\/[^/]+(?:\/|$)/.test(pathname);
  if (
    !sensitiveRoute &&
    isInvitation &&
    (request.cookies.has("__Host-niskala_guest") ||
      request.cookies.has("niskala_guest"))
  ) {
    sensitiveRoute = "guest";
  }
  if (
    !sensitiveRoute &&
    isInvitation &&
    (request.cookies.has("__Host-niskala_preview") ||
      request.cookies.has("niskala_preview"))
  ) {
    sensitiveRoute = "preview";
  }
  const nonce =
    sensitiveRoute && !pathname.startsWith("/api/")
      ? crypto.randomUUID()
      : undefined;
  const csp = contentSecurityPolicy({ nonce, sensitiveRoute });

  if (!host || !isAllowedHostForZone(host, zone)) {
    const response = new NextResponse("Not Found", { status: 404 });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Robots-Tag", "noindex, noarchive");
    return deploymentHeaders(response);
  }

  const isProtectedAdminRoute =
    pathname.startsWith("/admin") && pathname !== "/admin/login";
  const hasStaffGate = request.cookies.get(staffGateCookie)?.value === "1";
  if (isProtectedAdminRoute && !hasStaffGate) {
    const response = NextResponse.redirect(
      new URL("/admin/login", request.url),
    );
    response.headers.set("Content-Security-Policy", csp);
    applySensitiveHeaders(response, sensitiveRoute);
    return deploymentHeaders(response);
  }

  if (!nonce) {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", csp);
    applySensitiveHeaders(response, sensitiveRoute);
    return deploymentHeaders(response);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  applySensitiveHeaders(response, sensitiveRoute);
  return deploymentHeaders(response);
}

function applySensitiveHeaders(
  response: NextResponse,
  sensitiveRoute: SensitiveRoute,
) {
  response.headers.append("Vary", "Host");
  if (sensitiveRoute === "preview") {
    response.headers.delete("X-Frame-Options");
  } else {
    response.headers.set(
      "X-Frame-Options",
      sensitiveRoute ? "DENY" : "SAMEORIGIN",
    );
  }
  if (!sensitiveRoute) {
    return;
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, noarchive");
}

export const config = {
  matcher: ["/(.*)"],
};
