import "server-only";

import { getCloudflareAccessHeaders } from "@/lib/api/cloudflare-access";
import { env } from "@/lib/env";

const UPSTREAM_TIMEOUT_MS = 30_000;
const STAFF_COOKIE_PATTERN = /^(?:csrftoken|sessionid)=/i;
const AUTH_PATHS = new Set([
  "auth/csrf",
  "auth/login",
  "auth/login/mfa",
  "auth/logout",
  "auth/me",
  "auth/mfa/enroll",
  "auth/mfa/confirm",
  "auth/mfa/reset",
  "auth/reauth",
]);

function proxyError(message: string, status: number): Response {
  return Response.json(
    { error: { message } },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}

function allowedStaffPath(path: string[]): boolean {
  if (!path.length || path.some((segment) => !segment || segment === "." || segment === "..")) {
    return false;
  }
  const normalized = path.join("/");
  return (
    AUTH_PATHS.has(normalized) ||
    normalized === "themes" ||
    normalized === "packages" ||
    normalized.startsWith("admin/")
  );
}

function upstreamUrl(request: Request, path: string[]): URL {
  const suffix = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(`${env.NEXT_PUBLIC_API_URL}/${suffix}`);
  url.search = new URL(request.url).search;
  return url;
}

function upstreamSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  return typeof getSetCookie === "function" ? getSetCookie.call(headers) : [];
}

export async function proxyStaffRequest(
  request: Request,
  path: string[] = [],
): Promise<Response> {
  if (!allowedStaffPath(path)) {
    return proxyError("Staff API path is not allowed.", 404);
  }

  const accessHeaders = getCloudflareAccessHeaders();
  if (!accessHeaders) {
    return proxyError("Staff service is not configured.", 503);
  }

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    Origin: new URL(env.NEXT_PUBLIC_SITE_URL).origin,
    ...accessHeaders,
  });
  for (const name of ["content-type", "cookie", "x-csrftoken"]) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  let response: Response;
  try {
    response = await fetch(upstreamUrl(request, path), {
      body: body?.byteLength ? body : undefined,
      cache: "no-store",
      headers,
      method: request.method,
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return proxyError("Staff service could not be reached.", 502);
  }

  if (response.status >= 300 && response.status < 400) {
    return proxyError("Staff service authentication failed.", 502);
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["content-disposition", "content-type"]) {
    const value = response.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }
  for (const cookie of upstreamSetCookies(response.headers)) {
    if (STAFF_COOKIE_PATTERN.test(cookie.trim())) {
      responseHeaders.append("Set-Cookie", cookie);
    }
  }

  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}
