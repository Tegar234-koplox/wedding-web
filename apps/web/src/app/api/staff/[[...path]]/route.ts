import { proxyStaffRequest } from "@/lib/api/staff-proxy";

type StaffRouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function handle(request: Request, context: StaffRouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyStaffRequest(request, path);
}

export const runtime = "nodejs";
export const DELETE = handle;
export const GET = handle;
export const PATCH = handle;
export const POST = handle;
export const PUT = handle;
