/**
 * Regional dates/times (Intl) + IANA timezones for MachinPro.
 * Display uses user_profiles.timezone → browser-detected TZ → America/Toronto.
 */

export const DEFAULT_IANA_TIMEZONE = "America/Toronto";

/** Common zones for CA / US / MX / UK / EU onboarding & settings. */
export const IANA_TIMEZONE_OPTIONS: readonly string[] = [
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
  "UTC",
] as const;

export function isValidIanaTimeZone(id: string): boolean {
  const z = id.trim();
  if (!z) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveUserTimezone(storedProfileTz?: string | null): string {
  const t = typeof storedProfileTz === "string" ? storedProfileTz.trim() : "";
  if (t && isValidIanaTimeZone(t)) return t;
  try {
    const det = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (det && isValidIanaTimeZone(det)) return det;
  } catch {
    /* ignore */
  }
  return DEFAULT_IANA_TIMEZONE;
}

/**
 * Default IANA zone hints from BCP 47 locale (when profile timezone is unset).
 */
export function getTimezoneFromLocale(locale: string): string {
  const l = locale.trim().toLowerCase();
  if (l.startsWith("en-gb")) return "Europe/London";
  if (l.startsWith("es-mx")) return "America/Mexico_City";
  if (l.startsWith("es")) return "Europe/Madrid";
  if (l.startsWith("fr-ca")) return "America/Toronto";
  if (l.startsWith("fr")) return "Europe/Paris";
  if (l.startsWith("de")) return "Europe/Berlin";
  if (l.startsWith("it")) return "Europe/Rome";
  if (l.startsWith("pt")) return "Europe/Lisbon";
  if (l.startsWith("nl")) return "Europe/Amsterdam";
  if (l.startsWith("pl")) return "Europe/Warsaw";
  if (l.startsWith("en")) return "America/New_York";
  return DEFAULT_IANA_TIMEZONE;
}

/**
 * Locale BCP 47 for date/number formatting: MM/DD en US/CA inglés; día primero en ES/UK/EU y fr-CA.
 */
export function dateLocaleForUser(language: string, countryCode: string): string {
  const cc = (countryCode || "CA").toUpperCase();
  if (cc === "US" || cc === "CA") {
    if (language === "en") return "en-US";
    if (language === "es") return "es-MX";
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

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

export function formatDate(date: Date | string | number, locale: string, timeZone: string): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatTime(date: Date | string | number, locale: string, timeZone: string): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDateTime(date: Date | string | number, locale: string, timeZone: string): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Long calendar line e.g. weekday — used in dashboard greeting. */
export function formatDateLong(date: Date | string | number, locale: string, timeZone: string): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Medium date (e.g. project list) with short month. */
export function formatDateMedium(date: Date | string | number, locale: string, timeZone: string): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Calendar YYYY-MM-DD anchored at noon UTC → displayed in `timeZone`. */
export function formatCalendarYmd(ymd: string, locale: string, timeZone: string): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d || Number.isNaN(y + m + d)) return ymd;
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return formatDate(utcNoon, locale, timeZone);
}

export function getClockHourInTimeZone(iso: Date | string | number, timeZone: string): number {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return 12;
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hourPart = h.find((p) => p.type === "hour");
  const n = hourPart ? parseInt(hourPart.value, 10) : 12;
  return Number.isFinite(n) ? n : 12;
}

/**
 * Relative time using Intl (no extra locale keys). Past times only (notifications / activity).
 */
export function formatRelative(iso: Date | string | number, locale: string): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffSec < 0) return rtf.format(Math.floor(-diffSec / 60) || -1, "minute");
  if (diffSec < 45) return rtf.format(-Math.max(diffSec, 1), "second");
  const min = Math.floor(diffSec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const h = Math.floor(min / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const days = Math.floor(h / 24);
  if (days < 7) return rtf.format(-days, "day");
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return rtf.format(-weeks, "week");
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.floor(days / 365), "year");
}

export function formatDecimal(amount: number, locale: string, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(amount);
}

export function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
