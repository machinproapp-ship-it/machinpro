import { EU_EEA, LATAM_NORTE, LATAM_SUR } from "@/lib/geoTier";

/** i18n key for the tax ID label for a company country (ISO2). */
export function registerTaxLabelKey(countryCode: string): string {
  const c = (countryCode ?? "").trim().toUpperCase();
  if (c === "MX") return "register_tax_id_mx";
  if (c === "GB" || EU_EEA.has(c)) return "register_tax_id_eu";
  if (c === "CA") return "register_tax_id_ca";
  if (c === "US") return "register_tax_id_us";
  if (LATAM_NORTE.has(c) || LATAM_SUR.has(c)) return "register_tax_id_latam";
  return "register_tax_id";
}
