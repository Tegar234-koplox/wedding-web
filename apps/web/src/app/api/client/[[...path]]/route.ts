import { proxyCapabilitySessionRequest } from "@/lib/api/capability-session-proxy";

type ClientAccessRouteContext = {
  params: Promise<{ path?: string[] }>;
};

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

export function backendPath(path: string[]): string[] | null {
  if (!path.length || path.some((segment) => !SAFE_SEGMENT.test(segment))) {
    return null;
  }
  if (path[0] === "portal") {
    const normalized = path.join("/");
    const fixedPaths = new Set([
      "portal",
      "portal/wishes",
      "portal/guest-links",
      "portal/guest-links/export",
      "portal/guest-links/import-template",
      "portal/guest-links/import",
    ]);
    const guestAction =
      path.length === 4 &&
      path[1] === "guest-links" &&
      UUID_SEGMENT.test(path[2] ?? "") &&
      (path[3] === "delivery" || path[3] === "rotate");
    return fixedPaths.has(normalized) || guestAction
      ? ["client", ...path]
      : null;
  }
  if (
    path.length === 1 &&
    (path[0] === "bootstrap" ||
      path[0] === "me" ||
      path[0] === "pin" ||
      path[0] === "logout")
  ) {
    return ["access", "client", ...path];
  }
  if (path[0] === "login" && path.length === 2 && UUID_SEGMENT.test(path[1] ?? "")) {
    return ["access", "client", ...path];
  }
  return null;
}

async function handle(
  request: Request,
  context: ClientAccessRouteContext,
): Promise<Response> {
  const { path = [] } = await context.params;
  const upstreamPath = backendPath(path);
  if (!upstreamPath) {
    return Response.json(
      { error: { message: "Client access path is not allowed." } },
      { status: 404 },
    );
  }
  return proxyCapabilitySessionRequest(request, upstreamPath);
}

export const GET = handle;
export const PATCH = handle;
export const POST = handle;
