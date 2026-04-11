import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteRaw = process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro";
const site = siteRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "MachinPro — Gestión de obras sin caos",
  description:
    "Gestiona tu empresa de construcción desde cualquier lugar. Personal, proyectos, logística y cumplimiento en una sola app.",
  openGraph: {
    title: "MachinPro — Gestión de obras sin caos",
    description:
      "Gestiona tu empresa de construcción desde cualquier lugar. Personal, proyectos, logística y cumplimiento en una sola app.",
    url: `${site}/landing`,
    siteName: "MachinPro",
    locale: "es_ES",
    type: "website",
    images: [{ url: "/logo-source.png", width: 512, height: 512, alt: "MachinPro" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MachinPro — Gestión de obras sin caos",
    description:
      "Gestiona tu empresa de construcción desde cualquier lugar. Personal, proyectos, logística y cumplimiento en una sola app.",
    images: [`${site}/logo-source.png`],
  },
  icons: {
    icon: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192x192.png",
  },
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return children;
}
