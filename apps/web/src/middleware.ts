import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const staffGateCookie = "niskala_staff_gate";
const clientGateCookie = "niskala_client_gate";
const staffGateValue = "staff:v2";
const clientGateValue = "client:v2";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const hasStaffGate = request.cookies.get(staffGateCookie)?.value === staffGateValue;
    if (!hasStaffGate) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (pathname.startsWith("/client") && pathname !== "/client/login") {
    const hasClientGate = request.cookies.get(clientGateCookie)?.value === clientGateValue;
    if (!hasClientGate) {
      return NextResponse.redirect(new URL("/client/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client/:path*"],
};
