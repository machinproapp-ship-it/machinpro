import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteRaw = process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro";
const site = siteRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "MachinPro — Centro de ayuda",
  description: "Guías y tutoriales para usar MachinPro.",
  openGraph: {
    title: "MachinPro — Centro de ayuda",
    description: "Guías y tutoriales para usar MachinPro.",
    url: `${site}/help`,
    siteName: "MachinPro",
    type: "website",
  },
};

export default function HelpLayout({ children }: { children: ReactNode }) {
  return children;
}
