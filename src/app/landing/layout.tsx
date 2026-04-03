import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteRaw = process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro";
const site = siteRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "MachinPro — Gestión profesional de empresas de construcción",
  description:
    "Gestiona tu equipo, proyectos, horarios y logística desde cualquier lugar. Para empresas de construcción en Canadá, USA, México, Europa y UK.",
  openGraph: {
    title: "MachinPro — Gestión profesional de empresas de construcción",
    description:
      "Gestiona tu equipo, proyectos, horarios y logística desde cualquier lugar. Para empresas de construcción en Canadá, USA, México, Europa y UK.",
    url: `${site}/landing`,
    siteName: "MachinPro",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MachinPro — Gestión profesional de empresas de construcción",
    description:
      "Gestiona tu equipo, proyectos, horarios y logística desde cualquier lugar. Para empresas de construcción en Canadá, USA, México, Europa y UK.",
  },
  icons: {
    icon: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192x192.png",
  },
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return children;
}
