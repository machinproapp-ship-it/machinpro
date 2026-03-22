"use client";

import { useEffect, useMemo, useState } from "react";
import { ALL_TRANSLATIONS, loadLocale } from "@/lib/i18n";
import type { Language } from "@/types/shared";

const STATIC_MAIN: Language[] = ["es", "en", "fr", "de", "it", "pt"];

function normalizeBrowserLang(raw: string | undefined): Language {
  const base = (raw ?? "es").split("-")[0]?.toLowerCase() ?? "es";
  if (STATIC_MAIN.includes(base as Language)) return base as Language;
  return "es";
}

/** Traducciones para páginas /visit/* según idioma del navegador (6 estáticos + lazy). */
export function useVisitorPublicT(): Record<string, string> {
  const [lang, setLang] = useState<Language>("es");
  const [lazyT, setLazyT] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const navLang = typeof navigator !== "undefined" ? navigator.language : "es";
    const l = normalizeBrowserLang(navLang);
    setLang(l);
    if (STATIC_MAIN.includes(l)) {
      setLazyT(null);
      return;
    }
    let cancelled = false;
    void loadLocale(l).then((merged) => {
      if (!cancelled) setLazyT(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const base = ALL_TRANSLATIONS[lang] ?? ALL_TRANSLATIONS.es;
    const en = ALL_TRANSLATIONS.en;
    return { ...en, ...base, ...(lazyT ?? {}) } as Record<string, string>;
  }, [lang, lazyT]);
}
