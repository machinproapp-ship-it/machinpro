import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseResponse = NextResponse.next({ request });

  if (!url || !anon) {
    return supabaseResponse;
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

  const path = request.nextUrl.pathname;

  if (path.startsWith("/api")) {
    return supabaseResponse;
  }

  const isPublicPath =
    path.startsWith("/landing") ||
    path.startsWith("/legal") ||
    path.startsWith("/visit") ||
    path.startsWith("/register") ||
    path.startsWith("/sign") ||
    path.startsWith("/login") ||
    path === "/billing" ||
    path.startsWith("/billing/");

  if (isPublicPath) {
    if (path === "/landing" || path.startsWith("/landing/")) {
      if (user) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    if (path === "/login" || path.startsWith("/login/")) {
      if (user) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return supabaseResponse;
  }

  if (path === "/" && !user) {
    return NextResponse.redirect(new URL("/landing", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json)$).*)",
  ],
};
