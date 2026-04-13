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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      </head>
      <body>
        <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="lazyOnload" />
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
