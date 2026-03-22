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
 * Detecta tier geográfico vía ipapi.co (fallback tier 1 si falla red/CORS).
 */
export async function detectGeoTier(): Promise<GeoTier> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return 1;
    const data = (await res.json()) as { country_code?: string; error?: boolean };
    if (data.error) return 1;
    return countryCodeToTier(data.country_code);
  } catch {
    return 1;
  }
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
