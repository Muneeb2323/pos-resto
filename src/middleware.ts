import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSecretKey, SESSION_COOKIE_NAME } from "@/lib/auth/secret";

/**
 * Edge gate for the whole POS.
 *
 * Two jobs, and only two: prove the caller holds a valid session, and keep a role out
 * of the pages it has no business loading. Fine-grained authority over data lives in
 * the route handlers themselves (see `@/lib/auth/guard`), because middleware cannot
 * see what a request is actually about.
 */

/** Paths reachable with no session at all. */
const PUBLIC_PATHS = new Set<string>(["/login", "/api/auth/login", "/api/status"]);

/** Page prefixes each role may load. Anything unlisted is allowed to any signed-in user. */
const PAGE_ACCESS: Record<string, readonly string[]> = {
  "/dashboard": ["ADMIN", "MANAGER"],
  "/reports": ["ADMIN", "MANAGER"],
  "/settings": ["ADMIN", "MANAGER"],
  "/menu": ["ADMIN", "MANAGER"],
  "/pos": ["ADMIN", "MANAGER", "CASHIER"],
  "/orders": ["ADMIN", "MANAGER", "CASHIER"],
  "/tables": ["ADMIN", "MANAGER", "CASHIER"],
};

/** Where to send a signed-in user who lacks access to the page they asked for. */
function landingPageFor(role: string): string {
  if (role === "KITCHEN") return "/orders";
  if (role === "CASHIER") return "/pos";
  return "/dashboard";
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return reject(request, isApi, "Sign in to continue");
  }

  let role: string;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    role = typeof payload.role === "string" ? payload.role : "";
  } catch {
    // Covers expired, tampered and unsigned tokens, and a missing JWT_SECRET.
    return reject(request, isApi, "Your session has expired. Please sign in again.");
  }

  if (!role) {
    return reject(request, isApi, "Your session is no longer valid. Please sign in again.");
  }

  // Page-level role gate. API authority is enforced per route, not here.
  if (!isApi) {
    const match = Object.keys(PAGE_ACCESS).find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (match && !PAGE_ACCESS[match].includes(role)) {
      return NextResponse.redirect(new URL(landingPageFor(role), request.url));
    }
  }

  return NextResponse.next();
}

function reject(request: NextRequest, isApi: boolean, message: string) {
  if (isApi) {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  const response = NextResponse.redirect(loginUrl);
  // Clear the stale cookie so the browser stops replaying a token we just rejected.
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own build output and public asset files.
     *
     * Note this list is matched against the *whole* path, so - unlike a bare
     * `pathname.includes(".")` test - an API route cannot slip past the session
     * check merely by having a dot somewhere in its URL.
     */
    "/((?!_next/static|_next/image|favicon\.ico|logo\.(?:PNG|png|ico)|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)",
  ],
};
