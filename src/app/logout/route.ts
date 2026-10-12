import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cierre de sesión a prueba de todo: lo hace el servidor, no el teléfono.
 * 1) Revoca la sesión en Supabase (si responde a tiempo).
 * 2) Borra las cookies de sesión (y pide al navegador que borre todas las cookies del sitio).
 * 3) Borra la copia local de la sesión y vuelve al inicio.
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sbCookies = request.cookies.getAll().filter((c) => c.name.startsWith("sb-"));

  if (url && anon && sbCookies.length > 0) {
    try {
      const supabase = createServerClient(url, anon, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {
            /* las borramos abajo */
          },
        },
      });
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      /* salir igualmente */
    }
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MachinPro</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif}</style></head>
<body><p>MachinPro…</p><script>
try{Object.keys(localStorage).forEach(function(k){if(k.indexOf("sb-")===0)localStorage.removeItem(k)})}catch(e){}
try{Object.keys(sessionStorage).forEach(function(k){sessionStorage.removeItem(k)})}catch(e){}
try{var h=location.hostname.replace(/^www\./,"");document.cookie.split(";").forEach(function(c){var n=c.split("=")[0].trim();if(n.indexOf("sb-")===0){document.cookie=n+"=; Max-Age=0; path=/";document.cookie=n+"=; Max-Age=0; path=/; domain=."+h;document.cookie=n+"=; Max-Age=0; path=/; domain="+location.hostname;}})}catch(e){}
location.replace("/login?out=1");
</script></body></html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Clear-Site-Data": '"cookies"',
    },
  });
  const host = request.nextUrl.hostname;
  const bare = host.replace(/^www\./, "");
  for (const c of sbCookies) {
    res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    if (bare.includes(".")) {
      res.headers.append("Set-Cookie", `${c.name}=; Path=/; Max-Age=0; Domain=.${bare}`);
    }
  }
  return res;
}
