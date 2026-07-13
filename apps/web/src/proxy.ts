import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const staffGateCookie = "niskala_staff_gate";

function contentSecurityPolicy({ nonce }: { nonce?: string } = {}) {
  const apiOrigin = origin(
    process.env.NEXT_PUBLIC_API_URL,
    "http://localhost:8000",
  );
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

  return [
    "default-src 'self'",
    "base-uri 'self'",
    ["connect-src 'self'", apiOrigin, sentryOrigin].filter(Boolean).join(" "),
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'self'",
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
  const isAdminRoute = pathname.startsWith("/admin");
  const nonce = isAdminRoute ? btoa(crypto.randomUUID()) : undefined;
  const csp = contentSecurityPolicy({ nonce });
  const isProtectedAdminRoute =
    pathname.startsWith("/admin") && pathname !== "/admin/login";
  const hasStaffGate = request.cookies.get(staffGateCookie)?.value === "1";
  if (isProtectedAdminRoute && !hasStaffGate) {
    const response = NextResponse.redirect(
      new URL("/admin/login", request.url),
    );
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  if (!nonce) {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
