import { proxyCapabilitySessionRequest } from "@/lib/api/capability-session-proxy";

type GuestAccessRouteContext = {
  params: Promise<{ path?: string[] }>;
};

const allowedPaths = new Set(["redeem", "me", "logout"]);

async function handle(
  request: Request,
  context: GuestAccessRouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  const [action] = path;
  if (path.length !== 1 || !action || !allowedPaths.has(action)) {
    return Response.json(
      { error: { message: "Guest access path is not allowed." } },
      { status: 404 },
    );
  }
  return proxyCapabilitySessionRequest(request, ["access", "guest", action]);
}

export const GET = handle;
export const POST = handle;
