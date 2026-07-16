import "server-only";

import { proxyAccessRequest } from "@/lib/api/access-proxy";
import { env } from "@/lib/env";

function normalizedToken(token: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(token));
  } catch {
    return encodeURIComponent(token);
  }
}

function upstreamUrl(request: Request, token: string, path: string[]): URL {
  const suffix = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(
    `${env.NEXT_PUBLIC_API_URL}/guest-management/${normalizedToken(token)}${suffix ? `/${suffix}` : ""}`,
  );
  url.search = new URL(request.url).search;
  return url;
}

export async function proxyGuestManagementRequest(
  request: Request,
  token: string,
  path: string[] = [],
): Promise<Response> {
  return proxyAccessRequest(
    request,
    upstreamUrl(request, token, path),
    "Guest management service",
  );
}
