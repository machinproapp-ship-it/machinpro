import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteRaw = process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro";
const site = siteRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "MachinPro — ¿Qué es MachinPro?",
  description:
    "Todo lo que hace MachinPro — módulos, casos de uso y países disponibles.",
  openGraph: {
    title: "MachinPro — ¿Qué es MachinPro?",
    description:
      "Todo lo que hace MachinPro — módulos, casos de uso y países disponibles.",
    url: `${site}/about`,
    siteName: "MachinPro",
    type: "website",
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
