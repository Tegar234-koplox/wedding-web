import { proxyBespokeReviewRequest } from "@/lib/api/bespoke-review-proxy";

type Context = { params: Promise<{ token: string; path?: string[] }> };

async function handle(request: Request, context: Context) {
  const { token, path } = await context.params;
  return proxyBespokeReviewRequest(request, token, path);
}

export const runtime = "nodejs";
export const GET = handle;
export const POST = handle;
