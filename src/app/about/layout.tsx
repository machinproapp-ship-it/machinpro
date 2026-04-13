import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteRaw = process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro";
const site = siteRaw.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "MachinPro — About",
  description:
    "One platform for construction operations: central dashboard, projects, scheduling, logistics, safety and forms.",
  openGraph: {
    title: "MachinPro — About",
    url: `${site}/about`,
    siteName: "MachinPro",
    type: "website",
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
