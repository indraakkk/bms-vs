import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/session-token";

/**
 * `middleware.ts` was renamed to `proxy.ts` in Next.js 16 (same
 * functionality, defaults to the Node.js runtime now instead of Edge —
 * see node_modules/next/dist/docs/.../file-conventions/proxy.md). Guards
 * everything except `/login` and `/api/auth/*`, per the take-home's
 * added-beyond-spec PIN auth.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "UnauthorizedError", message: "Login required" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
