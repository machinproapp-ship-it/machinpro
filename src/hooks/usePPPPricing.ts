"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { GeoTier } from "@/lib/geoTier";
import { discountPercentForPppTier, getPppTierFromCountryCode } from "@/lib/geoTier";
import { useGeo } from "@/hooks/useGeo";

/** Manual country override for pricing/geo display (landing footer). */
export const MACHINPRO_COUNTRY_OVERRIDE_KEY = "machinpro_country_override";

function readCountryOverrideSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MACHINPRO_COUNTRY_OVERRIDE_KEY)?.trim().toUpperCase();
    return raw ? raw : null;
  } catch {
    return null;
  }
}

export type PPPPricingResult = {
  /** ISO country code actually used for tier + displayed prices */
  effectiveCountryCode: string;
  tier: GeoTier;
  discount: 0 | 20 | 40;
  /** Geo fetch still in progress and no manual override — hide prices */
  loadingGeo: boolean;
  /** Ready to render tier-based prices */
  pricingReady: boolean;
  manualOverrideApplied: boolean;
  /** Persist override (`null` clears). */
  setCountryOverride: (countryCodeAlpha2: string | null) => void;
};

/**
 * PPP-aware pricing country: detects via {@link useGeo}, then applies optional
 * {@link MACHINPRO_COUNTRY_OVERRIDE_KEY} from localStorage when set.
 */
export function usePPPPricing(): PPPPricingResult {
  const geo = useGeo();
  const [overrideCc, setOverrideCcState] = useState<string | null>(() =>
    typeof window !== "undefined" ? readCountryOverrideSync() : null
  );

  useEffect(() => {
    const onExternal = () => setOverrideCcState(readCountryOverrideSync());
    window.addEventListener("storage", onExternal);
    window.addEventListener("machinpro_country_override", onExternal as EventListener);
    return () => {
      window.removeEventListener("storage", onExternal);
      window.removeEventListener("machinpro_country_override", onExternal as EventListener);
    };
  }, []);

  const setCountryOverride = useCallback((countryCodeAlpha2: string | null) => {
    try {
      if (!countryCodeAlpha2?.trim()) {
        localStorage.removeItem(MACHINPRO_COUNTRY_OVERRIDE_KEY);
        setOverrideCcState(null);
      } else {
        const cc = countryCodeAlpha2.trim().toUpperCase();
        localStorage.setItem(MACHINPRO_COUNTRY_OVERRIDE_KEY, cc);
        setOverrideCcState(cc);
      }
      window.dispatchEvent(new CustomEvent("machinpro_country_override"));
    } catch {
      /* ignore quota / privacy mode */
    }
  }, []);

  const effectiveCountryCode = useMemo(() => {
    if (overrideCc) return overrideCc;
    const g = (geo.country ?? "US").trim().toUpperCase();
    return g || "US";
  }, [overrideCc, geo.country]);

  const tier = useMemo(
    () => getPppTierFromCountryCode(effectiveCountryCode),
    [effectiveCountryCode]
  );

  const discount = useMemo(() => discountPercentForPppTier(tier), [tier]);

  const loadingGeo = geo.loading && !overrideCc;
  const pricingReady = !geo.loading || !!overrideCc;

  return {
    effectiveCountryCode,
    tier,
    discount,
    loadingGeo,
    pricingReady,
    manualOverrideApplied: !!overrideCc,
    setCountryOverride,
  };
}
