import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { LandingJsonLd } from "./LandingJsonLd";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

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
    canonical: `${site}/`,
    languages: {
      "x-default": `${site}/`,
      en: `${site}/`,
      es: `${site}/`,
      fr: `${site}/`,
      de: `${site}/`,
      pt: `${site}/`,
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
    url: `${site}/`,
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
      <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
      <LandingJsonLd />
      <div className={`${inter.className} min-w-0`}>{children}</div>
    </>
  );
}
