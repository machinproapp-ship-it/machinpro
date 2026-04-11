import type { NextConfig } from "next";

function supabaseUrlPattern(): RegExp {
  const fallbackHost = "qtoqfzfccvkqcuavxqpg\\.supabase\\.co";
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return new RegExp(`^https:\\/\\/${fallbackHost}\\/.*`, "i");
  try {
    const host = new URL(raw).host.replace(/\./g, "\\.");
    return new RegExp(`^https:\\/\\/${host}\\/.*`, "i");
  } catch {
    return new RegExp(`^https:\\/\\/${fallbackHost}\\/.*`, "i");
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: supabaseUrlPattern(),
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/api\.stripe\.com\/.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/api\.cloudinary\.com\/.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "cloudinary-images",
        expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /^https:\/\/ipapi\.co\/.*/i,
      handler: "NetworkOnly",
    },
  ],
});

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default withPWA(nextConfig);
