import "server-only";

import { env } from "@/lib/env";

const UPSTREAM_TIMEOUT_MS = 30_000;
const RESPONSE_HEADER_ALLOWLIST = [
  "content-disposition",
  "content-type",
] as const;

function cloudflareAccessHeaders(): Record<string, string> | null {
  const clientId = process.env.CF_ACCESS_CLIENT_ID?.trim();
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();

  if (Boolean(clientId) !== Boolean(clientSecret)) {
    return null;
  }

  if (!clientId || !clientSecret) {
    return {};
  }

  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
}

function proxyError(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

export async function proxyAccessRequest(
  request: Request,
  upstreamUrl: URL,
  serviceName: string,
): Promise<Response> {
  const accessHeaders = cloudflareAccessHeaders();
  if (!accessHeaders) {
    return proxyError(`${serviceName} is not configured.`, 503);
  }

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    Origin: new URL(env.NEXT_PUBLIC_SITE_URL).origin,
    ...accessHeaders,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      headers,
      method: request.method,
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return proxyError(`${serviceName} could not be reached.`, 502);
  }

  if (response.status >= 300 && response.status < 400) {
    return proxyError(`${serviceName} authentication failed.`, 502);
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of RESPONSE_HEADER_ALLOWLIST) {
    const value = response.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }

  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}
