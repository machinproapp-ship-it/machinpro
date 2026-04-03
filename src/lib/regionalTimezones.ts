/**
 * Grouped IANA zones for Ajustes → Regional (labels via `settings_tz_region_*` keys in locales).
 */
export const REGIONAL_TIMEZONE_GROUPS: readonly { readonly labelKey: string; readonly zones: readonly string[] }[] = [
  {
    labelKey: "settings_tz_region_na",
    zones: [
      "America/Toronto",
      "America/Vancouver",
      "America/Winnipeg",
      "America/Halifax",
      "America/St_Johns",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Mexico_City",
      "America/Cancun",
    ],
  },
  {
    labelKey: "settings_tz_region_central_am",
    zones: [
      "America/Guatemala",
      "America/El_Salvador",
      "America/Tegucigalpa",
      "America/Managua",
      "America/Costa_Rica",
      "America/Panama",
    ],
  },
  {
    labelKey: "settings_tz_region_sa",
    zones: [
      "America/Bogota",
      "America/Lima",
      "America/Guayaquil",
      "America/Santiago",
      "America/Argentina/Buenos_Aires",
      "America/Montevideo",
      "America/Sao_Paulo",
      "America/Caracas",
      "America/La_Paz",
      "America/Asuncion",
    ],
  },
  {
    labelKey: "settings_tz_region_europe",
    zones: [
      "Europe/London",
      "Europe/Dublin",
      "Europe/Madrid",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Rome",
      "Europe/Lisbon",
      "Europe/Amsterdam",
      "Europe/Brussels",
      "Europe/Zurich",
      "Europe/Warsaw",
      "Europe/Stockholm",
      "Europe/Oslo",
      "Europe/Copenhagen",
      "Europe/Helsinki",
      "Europe/Athens",
      "Europe/Bucharest",
      "Europe/Budapest",
      "Europe/Prague",
      "Europe/Vienna",
    ],
  },
  {
    labelKey: "settings_tz_region_utc",
    zones: ["UTC"],
  },
] as const;

export function allGroupedTimezones(): string[] {
  const out: string[] = [];
  for (const g of REGIONAL_TIMEZONE_GROUPS) {
    for (const z of g.zones) {
      if (!out.includes(z)) out.push(z);
    }
  }
  return out;
}

export function cityLabelFromIana(iana: string): string {
  const part = iana.includes("/") ? iana.split("/").pop() ?? iana : iana;
  return part.replace(/_/g, " ");
}
