import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LandingJsonLd } from "./LandingJsonLd";

const siteRaw = process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro";
const site = siteRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "MachinPro — Build Without Chaos | Construction Management Software",
  description:
    "Manage your construction company from your phone. Projects, team, schedules, logistics and safety. All in one place. Available in 21 languages.",
  keywords: [
    "construction management software",
    "obra management",
    "gestión de obras",
    "construction app",
    "field management",
  ],
  alternates: {
    canonical: `${site}/landing`,
    languages: {
      "x-default": `${site}/landing`,
      en: `${site}/landing`,
      es: `${site}/landing`,
      fr: `${site}/landing`,
      de: `${site}/landing`,
      pt: `${site}/landing`,
    },
  },
  appleWebApp: {
    capable: true,
    title: "MachinPro",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "MachinPro — Build Without Chaos | Construction Management Software",
    description:
      "Manage your construction company from your phone. Projects, team, schedules, logistics and safety. All in one place.",
    url: `${site}/landing`,
    siteName: "MachinPro",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-machinpro.webp",
        width: 1200,
        height: 630,
        alt: "MachinPro — construction management software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MachinPro — Build Without Chaos | Construction Management Software",
    description:
      "Manage your construction company from your phone. Projects, team, schedules, logistics and safety.",
    images: [`${site}/og-machinpro.webp`],
  },
  icons: {
    icon: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192x192.png",
  },
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LandingJsonLd />
      {children}
    </>
  );
}
