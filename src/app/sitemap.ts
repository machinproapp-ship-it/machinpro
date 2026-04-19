import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://machin.pro").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const weekly = "weekly" as const;
  return [
    { url: `${base}/landing`, lastModified: now, changeFrequency: weekly, priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: weekly, priority: 0.9 },
    { url: `${base}/about`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/help`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/beta`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: weekly, priority: 0.7 },
  ];
}
