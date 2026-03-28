/**
 * i18n: metadatos, tipos y traducciones unificadas (src/locales/*.ts).
 * Los 6 idiomas principales van en bundle inicial; el resto se cargan con loadLocale().
 * Cualquier clave ausente en un idioma se rellena desde inglés (mergeWithEn).
 */

import type { Language } from "@/types/shared";
export type { Language };

import es from "@/locales/es";
import en from "@/locales/en";
import fr from "@/locales/fr";
import de from "@/locales/de";
import it from "@/locales/it";
import pt from "@/locales/pt";
import {
  PERMISSION_LABELS_DE,
  PERMISSION_LABELS_EN,
  PERMISSION_LABELS_ES,
  PERMISSION_LABELS_FR,
  PERMISSION_LABELS_IT,
  PERMISSION_LABELS_PT,
} from "@/locales/permAw5";

export const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "it", flag: "🇮🇹", label: "Italiano" },
  { code: "pt", flag: "🇵🇹", label: "Português" },
  { code: "nl", flag: "🇳🇱", label: "Nederlands" },
  { code: "pl", flag: "🇵🇱", label: "Polski" },
  { code: "sv", flag: "🇸🇪", label: "Svenska" },
  { code: "no", flag: "🇳🇴", label: "Norsk" },
  { code: "da", flag: "🇩🇰", label: "Dansk" },
  { code: "fi", flag: "🇫🇮", label: "Suomi" },
  { code: "cs", flag: "🇨🇿", label: "Čeština" },
  { code: "ro", flag: "🇷🇴", label: "Română" },
  { code: "hu", flag: "🇭🇺", label: "Magyar" },
  { code: "el", flag: "🇬🇷", label: "Ελληνικά" },
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "uk", flag: "🇺🇦", label: "Українська" },
  { code: "hr", flag: "🇭🇷", label: "Hrvatski" },
  { code: "sk", flag: "🇸🇰", label: "Slovenčina" },
  { code: "bg", flag: "🇧🇬", label: "Български" },
];

type LocaleModule = Record<string, string>;

const EN: LocaleModule = { ...(en as object) } as LocaleModule;

function mergeWithEn(locale: LocaleModule): LocaleModule {
  return { ...EN, ...locale };
}

/** Idiomas incluidos en el bundle inicial (ALL_TRANSLATIONS). */
export const STATIC_MAIN_LOCALES = new Set<Language>(["es", "en", "fr", "de", "it", "pt"]);

export function isLazyLocale(lang: string): boolean {
  return !STATIC_MAIN_LOCALES.has(lang as Language);
}

/** Carga dinámica de un locale (15 idiomas extendidos); fusiona con EN para claves faltantes. */
export async function loadLocale(lang: string): Promise<Record<string, string>> {
  try {
    const mod = await import(`@/locales/${lang}`);
    return mergeWithEn((mod.default ?? {}) as LocaleModule);
  } catch {
    const enMod = await import("@/locales/en");
    return mergeWithEn((enMod.default ?? {}) as LocaleModule);
  }
}

export const ALL_TRANSLATIONS: Record<string, Record<string, string>> = {
  es: mergeWithEn({ ...(es as object), ...PERMISSION_LABELS_ES } as LocaleModule),
  en: EN,
  fr: mergeWithEn({ ...(fr as object), ...PERMISSION_LABELS_FR } as LocaleModule),
  de: mergeWithEn({ ...(de as object), ...PERMISSION_LABELS_DE } as LocaleModule),
  it: mergeWithEn({ ...(it as object), ...PERMISSION_LABELS_IT } as LocaleModule),
  pt: mergeWithEn({ ...(pt as object), ...PERMISSION_LABELS_PT } as LocaleModule),
};

export type LanguageWithTranslations =
  | "es"
  | "en"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "sv"
  | "no"
  | "da"
  | "fi"
  | "cs"
  | "ro"
  | "hu"
  | "el"
  | "tr"
  | "uk"
  | "hr"
  | "sk"
  | "bg";

export const LANG_META: Record<Language, { label: string; flag: string }> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, { label: l.label, flag: l.flag }])
) as Record<Language, { label: string; flag: string }>;

export type Currency =
  | "CAD"
  | "USD"
  | "MXN"
  | "EUR"
  | "GBP"
  | "CHF"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "CZK"
  | "HUF"
  | "RON"
  | "BGN"
  | "HRK"
  | "TRY"
  | "UAH";

export const CURRENCY_META: Record<Currency, { symbol: string; label: string; region: string }> = {
  CAD: { symbol: "C$", label: "Canadian Dollar", region: "CA" },
  USD: { symbol: "$", label: "US Dollar", region: "US" },
  MXN: { symbol: "$MX", label: "Mexican Peso", region: "MX" },
  EUR: { symbol: "€", label: "Euro", region: "EU" },
  GBP: { symbol: "£", label: "British Pound", region: "GB" },
  CHF: { symbol: "CHF", label: "Swiss Franc", region: "CH" },
  SEK: { symbol: "kr", label: "Swedish Krona", region: "SE" },
  NOK: { symbol: "kr", label: "Norwegian Krone", region: "NO" },
  DKK: { symbol: "kr", label: "Danish Krone", region: "DK" },
  PLN: { symbol: "zł", label: "Polish Zloty", region: "PL" },
  CZK: { symbol: "Kč", label: "Czech Koruna", region: "CZ" },
  HUF: { symbol: "Ft", label: "Hungarian Forint", region: "HU" },
  RON: { symbol: "lei", label: "Romanian Leu", region: "RO" },
  BGN: { symbol: "лв", label: "Bulgarian Lev", region: "BG" },
  HRK: { symbol: "kn", label: "Croatian Kuna", region: "HR" },
  TRY: { symbol: "₺", label: "Turkish Lira", region: "TR" },
  UAH: { symbol: "₴", label: "Ukrainian Hryvnia", region: "UA" },
};

export const REGION_DEFAULT_CURRENCY: Record<string, Currency> = {
  CA: "CAD",
  US: "USD",
  MX: "MXN",
  GB: "GBP",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  HR: "HRK",
  TR: "TRY",
  UA: "UAH",
  EU: "EUR",
};
