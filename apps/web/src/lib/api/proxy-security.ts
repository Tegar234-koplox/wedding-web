import "server-only";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type BoundedBodyResult =
  | { body: ArrayBuffer | undefined; rejection?: never }
  | { body?: never; rejection: Response };

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: { message } },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}

export function validateUnsafeRequestOrigin(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const origin = request.headers.get("origin");
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return errorResponse("Request origin is invalid.", 403);
  }

  if (!origin) {
    return errorResponse("Request origin is required.", 403);
  }

  try {
    if (new URL(origin).origin !== expectedOrigin) {
      return errorResponse("Cross-origin request was rejected.", 403);
    }
  } catch {
    return errorResponse("Request origin is invalid.", 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    return errorResponse("Cross-site request was rejected.", 403);
  }

  return null;
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyResult> {
  if (SAFE_METHODS.has(request.method.toUpperCase()) || !request.body) {
    return { body: undefined };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > maxBytes
    ) {
      return {
        rejection: errorResponse("Request body is too large.", 413),
      };
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return {
        rejection: errorResponse("Request body is too large.", 413),
      };
    }
    chunks.push(value);
  }

  if (!totalBytes) {
    return { body: undefined };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: combined.buffer };
}

export function filterCookieHeader(
  value: string | null,
  allowedNames: ReadonlySet<string>,
): string | null {
  if (!value) {
    return null;
  }

  const normalizedAllowedNames = new Set(
    [...allowedNames].map((name) => name.toLowerCase()),
  );
  const seen = new Set<string>();
  const cookies: string[] = [];
  for (const part of value.split(";")) {
    const cookie = part.trim();
    const separator = cookie.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const name = cookie.slice(0, separator).trim().toLowerCase();
    if (!normalizedAllowedNames.has(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    cookies.push(cookie);
  }

  return cookies.length ? cookies.join("; ") : null;
}
