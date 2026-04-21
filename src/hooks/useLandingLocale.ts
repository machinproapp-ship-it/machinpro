"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_TRANSLATIONS, LANGUAGES, loadLocale, isLazyLocale, type Language } from "@/lib/i18n";

/** Prefer canonical `machinpro_lang`; keep legacy keys for backward compatibility. */
const STORAGE_LANG_KEYS = ["machinpro_lang", "machinpro_language", "machinpro_landing_lang"] as const;

function readStoredLanguageFromLocalStorage(): Language | null {
  if (typeof localStorage === "undefined") return null;
  try {
    for (const key of STORAGE_LANG_KEYS) {
      const raw = localStorage.getItem(key)?.trim();
      if (raw && LANGUAGES.some((l) => l.code === raw)) return raw as Language;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const STATIC = ALL_TRANSLATIONS;

function browserLanguageGuess(): Language {
  if (typeof navigator === "undefined") return "es";
  for (const pref of navigator.languages ?? [navigator.language]) {
    const base = pref?.trim().slice(0, 2).toLowerCase();
    if (base && LANGUAGES.some((l) => l.code === base)) return base as Language;
  }
  return "es";
}

export function useLandingLocale() {
  const [language, setLanguageState] = useState<Language>("es");
  const [lazyLocaleT, setLazyLocaleT] = useState<Record<string, string> | null>(null);
  const lazyLocaleCacheRef = useRef<Map<string, Record<string, string>>>(new Map());

  useEffect(() => {
    const stored = readStoredLanguageFromLocalStorage();
    if (stored) setLanguageState(stored);
    else setLanguageState(browserLanguageGuess());
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("machinpro_lang", lang);
      localStorage.setItem("machinpro_language", lang);
      localStorage.setItem("machinpro_landing_lang", lang);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isLazyLocale(language)) {
      setLazyLocaleT(null);
      return;
    }
    const cached = lazyLocaleCacheRef.current.get(language);
    if (cached) {
      setLazyLocaleT(cached);
      return;
    }
    let cancelled = false;
    setLazyLocaleT(null);
    void loadLocale(language).then((merged) => {
      if (!cancelled) {
        lazyLocaleCacheRef.current.set(language, merged);
        setLazyLocaleT(merged);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const t = useMemo(() => {
    if (!isLazyLocale(language)) {
      return (STATIC[language] ?? STATIC.en) as Record<string, string>;
    }
    return (lazyLocaleT ?? STATIC.en) as Record<string, string>;
  }, [language, lazyLocaleT]);

  const tx = useCallback((k: string, fb: string) => t[k] ?? fb, [t]);

  return { language, setLanguage, t, tx };
}

export function htmlLangForLanguage(code: Language): string {
  const map: Partial<Record<Language, string>> = {
    no: "nb",
  };
  return map[code] ?? code;
}
