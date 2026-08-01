import "server-only";

import { getCloudflareAccessHeaders } from "@/lib/api/cloudflare-access";
import {
  filterCookieHeader,
  readBoundedRequestBody,
  validateUnsafeRequestOrigin,
} from "@/lib/api/proxy-security";
import { serverEnv } from "@/lib/server-env";

const UPSTREAM_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const IMPORT_MAX_BODY_BYTES = 2 * 1024 * 1024;
const STAFF_COOKIE_NAMES = new Set([
  "__Host-niskala_csrf",
  "__Host-niskala_staff",
  "csrftoken",
  "sessionid",
]);
const STAFF_COOKIE_PATTERN =
  /^(?:__Host-niskala_(?:csrf|staff)|csrftoken|sessionid)=/i;
const AUTH_PATHS = new Set([
  "auth/csrf",
  "auth/login",
  "auth/login/mfa",
  "auth/login/mfa/enroll",
  "auth/login/mfa/confirm",
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
  const url = new URL(`${serverEnv.API_URL}/${suffix}`);
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

  const originRejection = validateUnsafeRequestOrigin(request);
  if (originRejection) {
    return originRejection;
  }

  const accessHeaders = getCloudflareAccessHeaders();
  if (!accessHeaders) {
    return proxyError("Staff service is not configured.", 503);
  }

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    Origin: new URL(request.url).origin,
    ...accessHeaders,
  });
  for (const name of ["content-type", "x-csrftoken"]) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const cookie = filterCookieHeader(
    request.headers.get("cookie"),
    STAFF_COOKIE_NAMES,
  );
  if (cookie) {
    headers.set("cookie", cookie);
  }

  const normalizedPath = path.join("/").toLowerCase();
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const maxBodyBytes =
    normalizedPath.includes("/import") ||
    contentType.includes("multipart/form-data") ||
    contentType.includes("text/csv")
      ? IMPORT_MAX_BODY_BYTES
      : DEFAULT_MAX_BODY_BYTES;
  const bodyResult = await readBoundedRequestBody(request, maxBodyBytes);
  if (bodyResult.rejection) {
    return bodyResult.rejection;
  }

  let response: Response;
  try {
    response = await fetch(upstreamUrl(request, path), {
      body: bodyResult.body,
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
