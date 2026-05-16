import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/login",
          "/register",
          "/_next/",
        ],
      },
    ],
    sitemap: "https://machin.pro/sitemap.xml",
  };
}
