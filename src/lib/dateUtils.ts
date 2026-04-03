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

/** Values written by Settings → General (`machinpro_date_format`). */
export type UserDateOrder = "dmy" | "mdy" | "ymd";
/** Values written by Settings → General (`machinpro_time_format`). */
export type UserTimePreference = "12" | "24";

export function readUserDateFormatPreference(): UserDateOrder {
  if (typeof window === "undefined") return "dmy";
  try {
    const v = localStorage.getItem("machinpro_date_format");
    if (v === "mdy" || v === "ymd" || v === "dmy") return v;
  } catch {
    /* ignore */
  }
  return "dmy";
}

export function readUserTimeFormatPreference(): UserTimePreference {
  if (typeof window === "undefined") return "24";
  try {
    const v = localStorage.getItem("machinpro_time_format");
    if (v === "12" || v === "24") return v;
  } catch {
    /* ignore */
  }
  return "24";
}

export type FormatPreferenceOpts = {
  /** Override `machinpro_date_format` for this call only. */
  dateFormat?: UserDateOrder;
  /** Override `machinpro_time_format` for this call only. */
  timeFormat?: UserTimePreference;
};

function ymdInTimeZone(d: Date, timeZone: string): { y: number; m: number; day: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = +(p.find((x) => x.type === "year")?.value ?? "0");
  const m = +(p.find((x) => x.type === "month")?.value ?? "0");
  const day = +(p.find((x) => x.type === "day")?.value ?? "0");
  return { y, m, day };
}

function hmInTimeZone(d: Date, timeZone: string): { h: number; min: number } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = +(p.find((x) => x.type === "hour")?.value ?? "0");
  const min = +(p.find((x) => x.type === "minute")?.value ?? "0");
  return { h, min };
}

function formatYmdWithOrder(y: number, m: number, day: number, order: UserDateOrder): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const yy = String(y);
  if (order === "ymd") return `${yy}-${mm}-${dd}`;
  if (order === "mdy") return `${mm}/${dd}/${yy}`;
  return `${dd}/${mm}/${yy}`;
}

/**
 * Date only — uses `machinpro_date_format` (fallback DD/MM/YYYY).
 * `locale` is kept for API compatibility; ordering follows user preference.
 */
export function formatDate(
  date: Date | string | number,
  locale: string,
  timeZone: string,
  opts?: FormatPreferenceOpts
): string {
  void locale;
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  const order = opts?.dateFormat ?? readUserDateFormatPreference();
  const { y, m, day } = ymdInTimeZone(d, timeZone);
  if (!y || !m || !day) return "—";
  return formatYmdWithOrder(y, m, day, order);
}

/**
 * Time only — uses `machinpro_time_format` (fallback 24h).
 */
export function formatTime(
  date: Date | string | number,
  locale: string,
  timeZone: string,
  opts?: FormatPreferenceOpts
): string {
  void locale;
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  const pref = opts?.timeFormat ?? readUserTimeFormatPreference();
  if (pref === "24") {
    const { h, min } = hmInTimeZone(d, timeZone);
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Wall-clock `HH:mm` / `H:mm` (fichaje, planificación) usando preferencia 12h/24h.
 * Ancla en UTC para no desplazar el reloj por zona.
 */
export function formatTimeHm(
  hm: string,
  locale: string,
  timeZone: string,
  opts?: FormatPreferenceOpts
): string {
  void timeZone;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm).trim());
  if (!m) return hm;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const iso = `1970-01-01T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`;
  return formatTime(iso, locale, "UTC", opts);
}

/** Date + time using the same storage prefs as `formatDate` / `formatTime`. */
export function formatDateTime(
  date: Date | string | number,
  locale: string,
  timeZone: string,
  opts?: FormatPreferenceOpts
): string {
  const da = formatDate(date, locale, timeZone, opts);
  const ti = formatTime(date, locale, timeZone, opts);
  if (da === "—" && ti === "—") return "—";
  if (da === "—") return ti;
  if (ti === "—") return da;
  return `${da} ${ti}`;
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

export type VisitorPeriodFilter = "today" | "week" | "month";

function ymdPartsInTz(iso: Date, timeZone: string): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(iso);
  const y = +(p.find((x) => x.type === "year")?.value ?? "0");
  const m = +(p.find((x) => x.type === "month")?.value ?? "0");
  const d = +(p.find((x) => x.type === "day")?.value ?? "0");
  return { y, m, d };
}

function weekdaySun0InTz(iso: Date, timeZone: string): number {
  const s = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(iso);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const key = s.slice(0, 3) as keyof typeof map;
  return map[key] ?? 0;
}

function addCalendarDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function lastDayOfMonthUtc(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Límites check_in para filtros visitantes (hoy / semana lunes-domingo / mes natural en `timeZone`). */
export function visitorPeriodToCheckInBounds(
  period: VisitorPeriodFilter,
  timeZone: string
): { start: string; end: string } {
  const now = new Date();
  const { y, m, d } = ymdPartsInTz(now, timeZone);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  if (period === "today") {
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return { start: `${ymd}T00:00:00.000`, end: `${ymd}T23:59:59.999` };
  }

  if (period === "month") {
    const startD = `${y}-${String(m).padStart(2, "0")}-01T00:00:00.000`;
    const ld = lastDayOfMonthUtc(y, m);
    const endD = `${y}-${String(m).padStart(2, "0")}-${String(ld).padStart(2, "0")}T23:59:59.999`;
    return { start: startD, end: endD };
  }

  const wd = weekdaySun0InTz(anchor, timeZone);
  const daysFromMonday = wd === 0 ? 6 : wd - 1;
  const monday = addCalendarDays(y, m, d, -daysFromMonday);
  const sunday = addCalendarDays(monday.y, monday.m, monday.d, 6);
  return {
    start: `${monday.y}-${String(monday.m).padStart(2, "0")}-${String(monday.d).padStart(2, "0")}T00:00:00.000`,
    end: `${sunday.y}-${String(sunday.m).padStart(2, "0")}-${String(sunday.d).padStart(2, "0")}T23:59:59.999`,
  };
}
