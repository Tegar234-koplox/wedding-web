import { proxyCapabilitySessionRequest } from "@/lib/api/capability-session-proxy";

type PreviewAccessRouteContext = {
  params: Promise<{ path?: string[] }>;
};

const allowedPaths = new Set(["redeem", "logout"]);

async function handle(
  request: Request,
  context: PreviewAccessRouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  const [action] = path;
  if (path.length !== 1 || !action || !allowedPaths.has(action)) {
    return Response.json(
      { error: { message: "Preview access path is not allowed." } },
      { status: 404 },
    );
  }
  return proxyCapabilitySessionRequest(request, ["access", "preview", action]);
}

export const POST = handle;
