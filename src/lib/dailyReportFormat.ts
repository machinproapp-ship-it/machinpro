import { dateLocaleForUser, resolveUserTimezone } from "@/lib/dateUtils";

export { dateLocaleForUser };

/** Long written date for daily report header (weekday, month long). */
export function formatReportDate(
  dateYmd: string,
  language: string,
  countryCode: string,
  timeZone?: string
): string {
  const locale = dateLocaleForUser(language, countryCode);
  const tz = timeZone ?? resolveUserTimezone(null);
  const [y, m, d] = dateYmd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d || Number.isNaN(y + m + d)) return dateYmd;
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (Number.isNaN(utcNoon.getTime())) return dateYmd;
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(utcNoon);
}

export function formatReportDateTime(
  iso: string,
  language: string,
  countryCode: string,
  timeZone?: string
): string {
  const locale = dateLocaleForUser(language, countryCode);
  const tz = timeZone ?? resolveUserTimezone(null);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
