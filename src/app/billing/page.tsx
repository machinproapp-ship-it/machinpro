"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { BillingModule } from "@/components/BillingModule";
import { ALL_TRANSLATIONS, loadLocale, isLazyLocale, type Language } from "@/lib/i18n";
import type { UserRole } from "@/types/shared";

const TRANSLATIONS = ALL_TRANSLATIONS;

export default function BillingPage() {
  const { profile, loading: authLoading } = useAuth();
  const [language, setLanguage] = useState<Language>("es");
  const [lazyLocaleT, setLazyLocaleT] = useState<Record<string, string> | null>(null);
  const lazyLocaleCacheRef = useRef<Map<string, Record<string, string>>>(new Map());

  useEffect(() => {
    try {
      const s = localStorage.getItem("machinpro_language");
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-700 dark:text-gray-300 text-center">{t.billing_no_company ?? "No company"}</p>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.office ?? "Home"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t.office ?? "Home"}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {t.billing_title ?? "Billing"}
          </span>
        </div>
      </header>
      <BillingModule
        t={t}
        companyId={companyId}
        companyName={profile?.companyName}
        email={profile?.email ?? undefined}
        employeesCount={0}
        projectsCount={0}
        storageUsedGb={0}
        userRole={(profile?.role as UserRole) ?? "admin"}
      />
    </div>
  );
}
