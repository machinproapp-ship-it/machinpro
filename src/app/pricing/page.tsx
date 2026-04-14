"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { PricingModule } from "@/components/PricingModule";
import { ALL_TRANSLATIONS, loadLocale, isLazyLocale, type Language } from "@/lib/i18n";
const TRANSLATIONS = ALL_TRANSLATIONS;

export default function PricingPage() {
  const { profile, loading: authLoading } = useAuth();
  const [language, setLanguage] = useState<Language>("es");
  const [lazyLocaleT, setLazyLocaleT] = useState<Record<string, string> | null>(null);
  const lazyLocaleCacheRef = useRef<Map<string, Record<string, string>>>(new Map());
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDark = () => {
    const next = !document.documentElement.classList.contains("dark");
    if (next) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("machinpro_dark_mode", "1");
      } catch {
        /* ignore */
      }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("machinpro_dark_mode", "0");
      } catch {
        /* ignore */
      }
    }
    setDark(next);
  };

  useEffect(() => {
    try {
      const a = localStorage.getItem("machinpro_lang");
      const b = localStorage.getItem("machinpro_language");
      const s = (typeof a === "string" && a.trim() ? a : b) ?? "";
      if (s && typeof s === "string") setLanguage(s as Language);
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
      return (TRANSLATIONS[language] ?? TRANSLATIONS["en"]) as Record<string, string>;
    }
    return (lazyLocaleT ?? TRANSLATIONS["en"]) as Record<string, string>;
  }, [language, lazyLocaleT]);

  const companyId = profile?.companyId ?? null;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
        <p>{t.billing_loading ?? "Loading…"}</p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-gray-50 dark:bg-gray-950">
        <button
          type="button"
          onClick={toggleDark}
          className="absolute right-4 top-4 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
          aria-label={t.landing_theme_toggle ?? "Theme"}
        >
          {dark ? "☀" : "☾"}
        </button>
        <p className="text-gray-700 dark:text-gray-300 text-center max-w-md">
          {t.pricing_login_required ?? t.billing_no_company ?? ""}
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t.landing_nav_login ?? "Log in"}
        </Link>
        <Link
          href="/landing#pricing"
          className="text-sm text-amber-700 dark:text-amber-400 underline min-h-[44px] inline-flex items-center"
        >
          {t.pricing_public_link ?? t.landing_nav_features ?? "Home"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t.office ?? "Home"}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {t.billing_title ?? "Plans & pricing"}
          </span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="pricing-page-lang">
              {t.select_language ?? "Language"}
            </label>
            <select
              id="pricing-page-lang"
              value={language}
              onChange={(e) => {
                const v = e.target.value as Language;
                setLanguage(v);
                try {
                  localStorage.setItem("machinpro_language", v);
                  localStorage.setItem("machinpro_lang", v);
                } catch {
                  /* ignore */
                }
              }}
              className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm"
            >
              {(["es", "en", "fr", "de", "it", "pt"] as const).map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleDark}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label={t.landing_theme_toggle ?? "Theme"}
            >
              {dark ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </header>
      <main className="pb-12">
        <PricingModule
          t={t}
          companyId={companyId}
          companyName={profile?.companyName}
          email={profile?.email ?? undefined}
        />
      </main>
    </div>
  );
}
