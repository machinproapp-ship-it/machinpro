"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function Ga4Inner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gaId =
    typeof process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID === "string"
      ? process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID.trim()
      : "";

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !gaId) return;
    const qs = searchParams?.toString();
    const path = `${pathname ?? "/"}${qs ? `?${qs}` : ""}`;
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({
      event: "page_view",
      page_path: path,
      page_location: typeof window !== "undefined" ? window.location.href : "",
      ga4_measurement_id: gaId,
    });
  }, [pathname, searchParams, gaId]);

  return null;
}

/** Virtual pageviews for GA4/GTM when the SPA navigates client-side (GTM History Change may also fire). */
export function Ga4RouteAnalytics() {
  return (
    <Suspense fallback={null}>
      <Ga4Inner />
    </Suspense>
  );
}
