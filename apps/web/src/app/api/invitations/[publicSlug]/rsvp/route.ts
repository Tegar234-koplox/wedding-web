import { proxyInvitationRsvpRequest } from "@/lib/api/invitation-rsvp-proxy";

type InvitationRsvpRouteContext = {
  params: Promise<{ publicSlug: string }>;
};

export async function POST(
  request: Request,
  context: InvitationRsvpRouteContext,
): Promise<Response> {
  const { publicSlug } = await context.params;
  return proxyInvitationRsvpRequest(request, publicSlug);
}
