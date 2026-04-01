"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "machinpro_geo";

export type GeoApiResponse = {
  country: string;
  tier: 1 | 2 | 3;
  discount: 0 | 20 | 40;
};

function parseCached(raw: string): GeoApiResponse | null {
  try {
    const j = JSON.parse(raw) as Partial<GeoApiResponse>;
    if (
      typeof j.country === "string" &&
      (j.tier === 1 || j.tier === 2 || j.tier === 3) &&
      (j.discount === 0 || j.discount === 20 || j.discount === 40)
    ) {
      return { country: j.country, tier: j.tier, discount: j.discount };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * País / tier PPP (headers Vercel/CF vía `/api/geo`). Cache en sessionStorage.
 */
export function useGeo(): GeoApiResponse & { loading: boolean } {
  const [data, setData] = useState<GeoApiResponse>({
    country: "US",
    tier: 1,
    discount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    try {
      const hit = parseCached(sessionStorage.getItem(STORAGE_KEY) ?? "");
      if (hit) {
        setData(hit);
        setLoading(false);
        return () => {
          cancelled = true;
        };
      }
    } catch {
      /* ignore */
    }

    void (async () => {
      try {
        const res = await fetch("/api/geo", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as Partial<GeoApiResponse>;
        const tier: 1 | 2 | 3 = j.tier === 2 || j.tier === 3 ? j.tier : 1;
        const discount: 0 | 20 | 40 =
          j.discount === 20 || j.discount === 40
            ? j.discount
            : tier === 3
              ? 40
              : tier === 2
                ? 20
                : 0;
        const next: GeoApiResponse = {
          country: typeof j.country === "string" ? j.country : "US",
          tier,
          discount,
        };
        if (!cancelled) {
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          setData(next);
        }
      } catch {
        if (!cancelled) {
          const fallback: GeoApiResponse = { country: "US", tier: 1, discount: 0 };
          setData(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading };
}
