import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteRaw = process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro";
const site = siteRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "MachinPro — Gestión de obras sin caos",
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
    url: "https://machin.pro/landing",
    siteName: "MachinPro",
    locale: "es_ES",
    type: "website",
    images: [{ url: "/logo-source.png", width: 512, height: 512, alt: "MachinPro" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MachinPro — Construye sin caos",
    description:
      "Gestión de obras sin caos. Personal, proyectos, logística, seguridad y nóminas.",
    images: ["https://machin.pro/logo-source.png"],
  },
  icons: {
    icon: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192x192.png",
  },
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return children;
}
