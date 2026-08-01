import "server-only";

import { proxyCapabilitySessionRequest } from "@/lib/api/capability-session-proxy";

export function proxyInvitationRsvpRequest(
  request: Request,
  publicSlug: string,
): Promise<Response> {
  return proxyCapabilitySessionRequest(
    request,
    ["invitations", publicSlug, "rsvp"],
    { maxBodyBytes: 16 * 1024 },
  );
}
