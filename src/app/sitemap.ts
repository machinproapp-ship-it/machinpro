import type { MetadataRoute } from "next";
import { SOLUTIONS } from "@/content/solutions";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const weekly = "weekly" as const;
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: weekly, priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: weekly, priority: 0.9 },
    { url: `${base}/about`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/help`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/beta`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    ...SOLUTIONS.flatMap((s) => {
      const other = (s.defaultLang ?? "en") === "es" ? "en" : "es";
      return [
        { url: `${base}/solutions/${s.slug}`, lastModified: now, changeFrequency: weekly, priority: 0.8 },
        { url: `${base}/solutions/${s.slug}?lang=${other}`, lastModified: now, changeFrequency: weekly, priority: 0.6 },
      ];
    }),
  ];
}
