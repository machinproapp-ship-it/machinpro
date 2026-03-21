import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ClientRoot } from "./ClientRoot";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MachinPro",
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3a4a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="lazyOnload" />
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
