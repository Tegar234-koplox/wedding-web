import { proxyGuestManagementRequest } from "@/lib/api/guest-management-proxy";

type GuestManagementRouteContext = {
  params: Promise<{ token: string; path?: string[] }>;
};

async function handle(request: Request, context: GuestManagementRouteContext): Promise<Response> {
  const { token, path } = await context.params;
  return proxyGuestManagementRequest(request, token, path);
}

export const GET = handle;
export const PATCH = handle;
export const POST = handle;
