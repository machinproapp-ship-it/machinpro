"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_TRANSLATIONS, LANGUAGES, loadLocale, isLazyLocale, type Language } from "@/lib/i18n";

const LANDING_LANG_KEY = "machinpro_landing_lang";

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
    try {
      const stored = localStorage.getItem(LANDING_LANG_KEY);
      if (stored && LANGUAGES.some((l) => l.code === stored)) {
        setLanguageState(stored as Language);
        return;
      }
    } catch {
      /* ignore */
    }
    setLanguageState(browserLanguageGuess());
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANDING_LANG_KEY, lang);
      localStorage.setItem("machinpro_language", lang);
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
