import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Marketing + entry auth pages — security headers (not API, not dashboard app shell). */
function isPublicMarketingPath(pathname: string): boolean {
  if (pathname.startsWith("/api")) return false;
  const prefixes = [
    "/landing",
    "/pricing",
    "/about",
    "/help",
    "/beta",
    "/legal",
    "/login",
    "/register",
    "/visit",
    "/sign",
    "/billing",
    "/forgot-password",
    "/reset-password",
    "/maintenance",
    "/privacy",
    "/terms",
  ];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function applySecurityHeaders(res: NextResponse): void {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  res.headers.set("X-XSS-Protection", "1; mode=block");
}

function finalizeResponse(res: NextResponse, pathname: string): NextResponse {
  if (!pathname.startsWith("/api") && isPublicMarketingPath(pathname)) {
    applySecurityHeaders(res);
  }
  return res;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;

  if (!url || !anon) {
    return finalizeResponse(supabaseResponse, path);
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (path.startsWith("/api")) {
    return finalizeResponse(supabaseResponse, path);
  }

  const isPublicPath =
    path.startsWith("/landing") ||
    path.startsWith("/pricing") ||
    path.startsWith("/about") ||
    path.startsWith("/help") ||
    path.startsWith("/beta") ||
    path.startsWith("/legal") ||
    path.startsWith("/visit") ||
    path.startsWith("/register") ||
    path.startsWith("/sign") ||
    path.startsWith("/login") ||
    path === "/billing" ||
    path.startsWith("/billing/") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/maintenance") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms");

  if (isPublicPath) {
    if (path === "/landing" || path.startsWith("/landing/")) {
      if (user) {
        return finalizeResponse(NextResponse.redirect(new URL("/", request.url)), path);
      }
    }
    if (path === "/login" || path.startsWith("/login/")) {
      if (user) {
        return finalizeResponse(NextResponse.redirect(new URL("/", request.url)), path);
      }
    }
    return finalizeResponse(supabaseResponse, path);
  }

  if (path === "/" && !user) {
    return finalizeResponse(NextResponse.redirect(new URL("/landing", request.url)), path);
  }

  return finalizeResponse(supabaseResponse, path);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json)$).*)",
  ],
};
