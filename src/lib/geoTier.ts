export type GeoTier = 1 | 2 | 3;

export type GeoRegion = "uk" | "eu" | "latam_norte" | "latam_sur" | "northam" | "other";

/** Tier 1 — higher PPP reference */
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

/** Tier 2 — mid PPP (incl. much of southern EU + South America) */
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
  "BR",
  "EC",
  "BO",
  "PY",
  "VE",
]);

const LATAM_NORTE = new Set(["MX", "GT", "HN", "SV", "NI", "CR", "PA"]);
const LATAM_SUR = new Set(["CO", "CL", "AR", "PE", "UY", "BR", "EC", "BO", "PY", "VE"]);

/** EU member states + EEA (IS, LI, NO) */
const EU_EEA = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
]);

export function resolveRegionTier(countryCode: string | null | undefined): { region: GeoRegion; tier: GeoTier } {
  const c = (countryCode ?? "").trim().toUpperCase();
  if (!c) return { region: "other", tier: 3 };
  if (c === "GB") return { region: "uk", tier: 1 };
  if (c === "CA" || c === "US") return { region: "northam", tier: 1 };
  if (LATAM_NORTE.has(c)) return { region: "latam_norte", tier: 3 };
  if (LATAM_SUR.has(c)) return { region: "latam_sur", tier: 2 };
  if (c === "CH" || EU_EEA.has(c)) {
    const tier: GeoTier = TIER1_COUNTRIES.has(c) ? 1 : TIER2_COUNTRIES.has(c) ? 2 : 2;
    return { region: "eu", tier };
  }
  return { region: "other", tier: 3 };
}

export function countryCodeToTier(code: string | undefined | null): GeoTier {
  return resolveRegionTier(code).tier;
}

/**
 * Reference currency for pricing UI.
 */
export function getCurrencyForCountry(
  countryCode: string | null | undefined,
  fallbackTier: GeoTier = 1
): "CAD" | "USD" | "GBP" | "MXN" | "BRL" {
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
  if (c === "BR") return "BRL";
  const tier = countryCodeToTier(c);
  if (tier === 2) return "USD";
  if (tier === 3) return "MXN";
  return "CAD";
}

export type GeoDetect = {
  tier: GeoTier;
  /** ISO 3166-1 alpha-2, uppercase, or "" if unknown */
  country: string;
  /** Alias for compatibility */
  countryCode: string | null;
  region: GeoRegion;
  /** US subdivision (e.g. CA for California) when country is US */
  usState: string | null;
};

export type LandingPriceCurrency = "CAD" | "USD" | "GBP" | "BRL";

export type LandingPlanPrices = {
  currency: LandingPriceCurrency;
  starter: number;
  pro: number;
  enterprise: number;
  /** Shown as “≈ … USD” when currency is BRL */
  usdEquivalent?: { starter: number; pro: number; enterprise: number };
};

/**
 * Landing PPP: monthly base; apply 20% annual discount via applyAnnualDiscount().
 */
export function getLandingPlanPrices(countryCode: string | null, tier: GeoTier): LandingPlanPrices {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (cc === "GB") {
    return { currency: "GBP", starter: 38, pro: 100, enterprise: 233 };
  }
  if (cc === "BR") {
    return {
      currency: "BRL",
      starter: 199,
      pro: 549,
      enterprise: 1299,
      usdEquivalent: { starter: 39, pro: 103, enterprise: 239 },
    };
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
  const next: LandingPlanPrices = {
    currency: prices.currency,
    starter: Math.round(prices.starter * 0.8),
    pro: Math.round(prices.pro * 0.8),
    enterprise: Math.round(prices.enterprise * 0.8),
  };
  if (prices.usdEquivalent) {
    next.usdEquivalent = {
      starter: Math.round(prices.usdEquivalent.starter * 0.8),
      pro: Math.round(prices.usdEquivalent.pro * 0.8),
      enterprise: Math.round(prices.usdEquivalent.enterprise * 0.8),
    };
  }
  return next;
}

export function formatLandingPrice(amount: number, currency: LandingPriceCurrency, language: string): string {
  const tag =
    language === "es"
      ? "es-419"
      : language === "pt"
        ? "pt-BR"
        : language === "fr"
          ? "fr"
          : language === "de"
            ? "de"
            : language === "it"
              ? "it"
              : "en";
  try {
    return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : tag, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  }
}

function emptyGeo(): GeoDetect {
  return { tier: 1, country: "", countryCode: null, region: "other", usState: null };
}

/**
 * Geo: tier, country, region (UK / EU / LATAM / North America), optional US state for CCPA messaging.
 */
export async function detectGeo(): Promise<GeoDetect> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return emptyGeo();
    const data = (await res.json()) as {
      country_code?: string;
      region_code?: string;
      error?: boolean;
    };
    if (data.error) return emptyGeo();
    const cc = (data.country_code ?? "").trim().toUpperCase() || "";
    if (!cc) return emptyGeo();
    const { region, tier } = resolveRegionTier(cc);
    const usState =
      cc === "US" && typeof data.region_code === "string" ? data.region_code.trim().toUpperCase() || null : null;
    return {
      tier,
      country: cc,
      countryCode: cc,
      region,
      usState,
    };
  } catch {
    return emptyGeo();
  }
}

export async function detectGeoTier(): Promise<GeoTier> {
  const { tier } = await detectGeo();
  return tier;
}

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

export { LATAM_NORTE, LATAM_SUR, EU_EEA };
