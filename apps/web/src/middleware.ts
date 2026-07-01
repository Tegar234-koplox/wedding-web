import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const staffGateCookie = "niskala_staff_gate";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname === "/admin/") {
    const hasStaffGate = request.cookies.get(staffGateCookie)?.value === "1";
    if (!hasStaffGate) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
