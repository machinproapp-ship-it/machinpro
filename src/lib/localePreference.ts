import type { SupabaseClient } from "@supabase/supabase-js";
import { LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types/shared";

export const LOCALE_STORAGE_KEY = "machinpro_locale";

const CODES = new Set(LANGUAGES.map((l) => l.code));

export function isValidLanguage(code: string | null | undefined): code is Language {
  return code != null && CODES.has(code as Language);
}

/** Map navigator.language to a supported Language (e.g. es-MX → es). */
export function detectLanguageFromNavigator(): Language {
  if (typeof navigator === "undefined") return "en";
  const raw =
    navigator.language ||
    (navigator as unknown as { userLanguage?: string }).userLanguage ||
    "";
  const primary = raw.split(",")[0]?.trim().toLowerCase() || "";
  const base = primary.split("-")[0] || "en";
  if (isValidLanguage(base)) return base;
  if (primary.startsWith("pt")) return "pt";
  return "en";
}

export async function persistUserLocale(
  client: SupabaseClient,
  userId: string,
  locale: Language
): Promise<void> {
  const { error } = await client.from("user_profiles").update({ locale }).eq("id", userId);
  if (error) console.error("[locale] user_profiles update", error);
}
