export type GeoTier = 1 | 2 | 3;

/** Tier 1 — 100% PPP */
export const TIER1_COUNTRIES = new Set([
  "CA",
  "US",
  "GB",
  "DE",
  "FR",
  "NL",
  "SE",
  "NO",
  "DK",
  "FI",
  "AT",
  "BE",
  "CH",
  "IE",
  "LU",
]);

/** Tier 2 — 80% PPP */
export const TIER2_COUNTRIES = new Set([
  "ES",
  "IT",
  "PT",
  "GR",
  "CZ",
  "PL",
  "HU",
  "RO",
  "HR",
  "SK",
  "BG",
  "AR",
  "CL",
  "CO",
  "PE",
  "UY",
]);

export function countryCodeToTier(code: string | undefined | null): GeoTier {
  const c = (code ?? "").toUpperCase();
  if (!c) return 1;
  if (TIER1_COUNTRIES.has(c)) return 1;
  if (TIER2_COUNTRIES.has(c)) return 2;
  if (c === "MX") return 3;
  return 3;
}

/**
 * Moneda de referencia para precios en UI (CA/ US/ GB/ MX explícitos; resto por tier).
 */
export function getCurrencyForCountry(
  countryCode: string | null | undefined,
  fallbackTier: GeoTier = 1
): "CAD" | "USD" | "GBP" | "MXN" {
  const c = (countryCode ?? "").trim().toUpperCase();
  if (!c) {
    if (fallbackTier === 2) return "USD";
    if (fallbackTier === 3) return "MXN";
    return "CAD";
  }
  if (c === "CA") return "CAD";
  if (c === "US") return "USD";
  if (c === "GB") return "GBP";
  if (c === "MX") return "MXN";
  const tier = countryCodeToTier(c);
  if (tier === 2) return "USD";
  if (tier === 3) return "MXN";
  return "CAD";
}

export type GeoDetect = { tier: GeoTier; countryCode: string | null };

export type LandingPriceCurrency = "CAD" | "USD" | "GBP";

export type LandingPlanPrices = {
  currency: LandingPriceCurrency;
  starter: number;
  pro: number;
  enterprise: number;
};

/**
 * Landing page PPP: monthly base amounts; apply 20% annual discount via applyAnnualDiscount().
 */
export function getLandingPlanPrices(countryCode: string | null, tier: GeoTier): LandingPlanPrices {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (cc === "GB") {
    return { currency: "GBP", starter: 38, pro: 100, enterprise: 233 };
  }
  if (tier === 1) {
    return { currency: "CAD", starter: 49, pro: 129, enterprise: 299 };
  }
  if (tier === 2) {
    return { currency: "USD", starter: 39, pro: 103, enterprise: 239 };
  }
  return { currency: "USD", starter: 29, pro: 77, enterprise: 179 };
}

export function applyAnnualDiscount(prices: LandingPlanPrices): LandingPlanPrices {
  return {
    currency: prices.currency,
    starter: Math.round(prices.starter * 0.8),
    pro: Math.round(prices.pro * 0.8),
    enterprise: Math.round(prices.enterprise * 0.8),
  };
}

export function formatLandingPrice(amount: number, currency: LandingPriceCurrency, language: string): string {
  const tag =
    language === "es"
      ? "es-419"
      : language === "pt"
        ? "pt"
        : language === "fr"
          ? "fr"
          : language === "de"
            ? "de"
            : language === "it"
              ? "it"
              : "en";
  try {
    return new Intl.NumberFormat(tag, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  }
}

/**
 * Tier + código ISO del país vía ipapi.co (fallback tier 1 si falla red/CORS).
 */
export async function detectGeo(): Promise<GeoDetect> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return { tier: 1, countryCode: null };
    const data = (await res.json()) as { country_code?: string; error?: boolean };
    if (data.error) return { tier: 1, countryCode: null };
    const cc = (data.country_code ?? "").trim().toUpperCase() || null;
    return { tier: countryCodeToTier(cc), countryCode: cc };
  } catch {
    return { tier: 1, countryCode: null };
  }
}

/**
 * Detecta tier geográfico vía ipapi.co (fallback tier 1 si falla red/CORS).
 */
export async function detectGeoTier(): Promise<GeoTier> {
  const { tier } = await detectGeo();
  return tier;
}

/** Etiquetas en español (fallback si no hay i18n). */
export function getTierLabel(tier: GeoTier): string {
  switch (tier) {
    case 1:
      return "Región estándar (Tier 1)";
    case 2:
      return "Región ajustada (Tier 2)";
    case 3:
      return "Región ajustada (Tier 3)";
    default:
      return "Región estándar (Tier 1)";
  }
}
