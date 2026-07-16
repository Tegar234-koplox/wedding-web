import "server-only";

import { proxyAccessRequest } from "@/lib/api/access-proxy";
import { env } from "@/lib/env";

export function proxyInvitationRsvpRequest(
  request: Request,
  publicSlug: string,
): Promise<Response> {
  const upstreamUrl = new URL(
    `${env.NEXT_PUBLIC_API_URL}/invitations/${encodeURIComponent(publicSlug)}/rsvp`,
  );
  return proxyAccessRequest(request, upstreamUrl, "RSVP service");
}
