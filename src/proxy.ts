import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "vp_session";
const PROTECTED = ["/dashboard", "/reports", "/datasets", "/settings"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/**
 * Fast, cookie-based redirects. Real authorization happens in the API routes
 * (Firebase ID token verification); this only keeps signed-out visitors away
 * from app pages and signed-in users away from the auth pages.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = req.cookies.get(SESSION_COOKIE)?.value === "1";

  if (!signedIn && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)).*)"],
};
