import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "@/styles/dark-mode.css";
import "@/styles/dark-safelist";
import { ClientRoot } from "./ClientRoot";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro"),
  title: { default: "MachinPro — Gestión de obras sin caos", template: "%s · MachinPro" },
  description:
    "Plataforma de gestión para empresas de construcción. Personal, proyectos, logística, seguridad, formularios y nóminas. Todo desde el móvil. 21 idiomas.",
  keywords: [
    "construcción",
    "gestión de obras",
    "software construcción",
    "site management",
    "construction app",
    "obra",
    "proyecto construcción",
  ],
  openGraph: {
    title: "MachinPro — Construye sin caos",
    description: "Todo lo que necesitas para gestionar tu empresa de construcción desde el móvil.",
    url: "https://machin.pro",
    siteName: "MachinPro",
    images: [{ url: "/logo-source.png", width: 512, height: 512, alt: "MachinPro" }],
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "MachinPro — Construye sin caos",
    description:
      "Gestión de obras sin caos. Personal, proyectos, logística, seguridad y nóminas.",
    images: ["https://machin.pro/logo-source.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MachinPro",
  },
  icons: {
    icon: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "MachinPro",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

const MACHINPRO_THEME_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('machinpro_dark_mode');
    var dark = stored !== null ? stored === '1' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
`.trim();

const MACHINPRO_SW_REGISTER = `
(function(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js');
    });
  }
})();
`.trim();

function gtmSnippet(id: string): string {
  const safe = /^GTM-[A-Z0-9]+$/.test(id) ? id : "";
  if (!safe) return "";
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${safe}');`;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gtmId =
    typeof process.env.NEXT_PUBLIC_GTM_ID === "string"
      ? process.env.NEXT_PUBLIC_GTM_ID.trim()
      : "";
  const enableGtm = process.env.NODE_ENV === "production" && gtmId.length > 0;
  const gtmJs = enableGtm ? gtmSnippet(gtmId) : "";

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MachinPro" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: MACHINPRO_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: MACHINPRO_SW_REGISTER }} />
        {enableGtm && gtmJs ? (
          <script dangerouslySetInnerHTML={{ __html: gtmJs }} />
        ) : null}
      </head>
      <body>
        {enableGtm && gtmId ? (
          <noscript>
            <iframe
              title="Google Tag Manager"
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
              height={0}
              width={0}
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="lazyOnload" />
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
