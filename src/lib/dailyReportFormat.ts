/**
 * Locale BCP 47 para fechas: MM/DD en US/CA, día primero en Europa y Latinoamérica.
 */
export function dateLocaleForUser(language: string, countryCode: string): string {
  const cc = (countryCode || "CA").toUpperCase();
  if (cc === "US" || cc === "CA") {
    if (language === "en") return "en-US";
    if (language === "es") return "es-US";
    if (language === "fr") return "fr-CA";
    return "en-US";
  }
  const m: Record<string, string> = {
    es: "es-ES",
    en: "en-GB",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
    nl: "nl-NL",
    pl: "pl-PL",
    sv: "sv-SE",
    no: "nb-NO",
    da: "da-DK",
    fi: "fi-FI",
    cs: "cs-CZ",
    ro: "ro-RO",
    hu: "hu-HU",
    el: "el-GR",
    tr: "tr-TR",
    uk: "uk-UA",
    hr: "hr-HR",
    sk: "sk-SK",
    bg: "bg-BG",
  };
  return m[language] ?? "en-GB";
}

export function formatReportDate(dateYmd: string, language: string, countryCode: string): string {
  const locale = dateLocaleForUser(language, countryCode);
  const d = new Date(`${dateYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateYmd;
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatReportDateTime(iso: string, language: string, countryCode: string): string {
  const locale = dateLocaleForUser(language, countryCode);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
