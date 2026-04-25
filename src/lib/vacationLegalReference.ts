/**
 * Informative minimum annual leave references by company country (AH-43B).
 * Not legal advice — UI hint only.
 */
export function vacationLegalMinimumDays(countryCode: string): number | null {
  const c = (countryCode || "").trim().toUpperCase();
  if (c === "US") return null;
  if (c === "CA") return 10;
  if (c === "GB") return 28;
  if (c === "ES") return 30;
  if (c === "MX") return 12;
  if (c === "FR") return 25;
  if (c === "DE") return 20;
  return 20;
}
