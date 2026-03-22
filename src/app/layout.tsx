import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "@/styles/dark-mode.css";
import "@/styles/dark-safelist";
import { ClientRoot } from "./ClientRoot";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MachinPro",
  },
  icons: {
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
