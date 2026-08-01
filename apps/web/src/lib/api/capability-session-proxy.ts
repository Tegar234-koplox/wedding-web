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
const ACCESS_COOKIE_NAMES = new Set([
  "__Host-niskala_client",
  "__Host-niskala_csrf",
  "__Host-niskala_guest",
  "__Host-niskala_preview",
  "niskala_client",
  "niskala_guest",
  "niskala_preview",
  "csrftoken",
]);
const ACCESS_COOKIE_PATTERN =
  /^(?:__Host-niskala_(?:client|csrf|guest|preview)|niskala_(?:client|guest|preview)|csrftoken)=/i;

function proxyError(message: string, status: number): Response {
  return Response.json(
    { error: { message } },
    { headers: { "Cache-Control": "private, no-store" }, status },
  );
}

function upstreamSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function upstreamUrl(request: Request, path: string[]): URL {
  const suffix = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(`${serverEnv.API_URL}/${suffix}`);
  url.search = new URL(request.url).search;
  return url;
}

export async function proxyCapabilitySessionRequest(
  request: Request,
  path: string[],
  { maxBodyBytes }: { maxBodyBytes?: number } = {},
): Promise<Response> {
  const originRejection = validateUnsafeRequestOrigin(request);
  if (originRejection) {
    return originRejection;
  }
  const accessHeaders = getCloudflareAccessHeaders();
  if (!accessHeaders) {
    return proxyError("Secure access service is not configured.", 503);
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
    ACCESS_COOKIE_NAMES,
  );
  if (cookie) {
    headers.set("cookie", cookie);
  }

  const normalizedPath = path.join("/").toLowerCase();
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const bodyResult = await readBoundedRequestBody(
    request,
    maxBodyBytes ??
      (normalizedPath.includes("/import") ||
      contentType.includes("multipart/form-data") ||
      contentType.includes("text/csv")
        ? IMPORT_MAX_BODY_BYTES
        : DEFAULT_MAX_BODY_BYTES),
  );
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
    return proxyError("Secure access service could not be reached.", 502);
  }
  if (response.status >= 300 && response.status < 400) {
    return proxyError("Secure access service rejected the request.", 502);
  }

  const responseHeaders = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, noarchive",
  });
  for (const name of ["content-disposition", "content-type"]) {
    const value = response.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }
  for (const setCookie of upstreamSetCookies(response.headers)) {
    if (ACCESS_COOKIE_PATTERN.test(setCookie.trim())) {
      responseHeaders.append("Set-Cookie", setCookie);
    }
  }
  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}
