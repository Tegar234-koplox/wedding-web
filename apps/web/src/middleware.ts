import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const staffGateCookie = "niskala_staff_gate";
const clientGateCookie = "niskala_client_gate";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin") {
    const hasStaffGate = request.cookies.get(staffGateCookie)?.value === "1";
    if (!hasStaffGate) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (pathname === "/client") {
    const hasClientGate = request.cookies.get(clientGateCookie)?.value === "1";
    if (!hasClientGate) {
      return NextResponse.redirect(new URL("/client/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/client"],
};
