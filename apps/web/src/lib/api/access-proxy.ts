import "server-only";

import { getCloudflareAccessHeaders } from "@/lib/api/cloudflare-access";
import {
  readBoundedRequestBody,
  validateUnsafeRequestOrigin,
} from "@/lib/api/proxy-security";

const UPSTREAM_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BODY_BYTES = 16 * 1024;
const RESPONSE_HEADER_ALLOWLIST = [
  "content-disposition",
  "content-type",
] as const;

function proxyError(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

export async function proxyAccessRequest(
  request: Request,
  upstreamUrl: URL,
  serviceName: string,
  { maxBodyBytes = DEFAULT_MAX_BODY_BYTES }: { maxBodyBytes?: number } = {},
): Promise<Response> {
  const originRejection = validateUnsafeRequestOrigin(request);
  if (originRejection) {
    return originRejection;
  }

  const accessHeaders = getCloudflareAccessHeaders();
  if (!accessHeaders) {
    return proxyError(`${serviceName} is not configured.`, 503);
  }

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    Origin: new URL(request.url).origin,
    ...accessHeaders,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const bodyResult = await readBoundedRequestBody(request, maxBodyBytes);
  if (bodyResult.rejection) {
    return bodyResult.rejection;
  }

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      body: bodyResult.body,
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
