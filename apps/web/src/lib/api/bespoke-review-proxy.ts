import "server-only";

import { proxyAccessRequest } from "@/lib/api/access-proxy";
import { env } from "@/lib/env";

const allowedPaths = new Set(["", "revisions", "otp", "approve"]);

function normalizedToken(token: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(token));
  } catch {
    return encodeURIComponent(token);
  }
}

export function proxyBespokeReviewRequest(
  request: Request,
  token: string,
  path: string[] = [],
) {
  const suffix = path.join("/");
  if (!allowedPaths.has(suffix))
    return Response.json(
      { error: { message: "Review path is not allowed." } },
      { status: 404 },
    );
  const url = new URL(
    `${env.NEXT_PUBLIC_API_URL}/bespoke-reviews/${normalizedToken(token)}${suffix ? `/${suffix}` : ""}`,
  );
  url.search = new URL(request.url).search;
  return proxyAccessRequest(request, url, "Bespoke review service");
}
