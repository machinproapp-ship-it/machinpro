"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { SuperadminModule } from "@/components/SuperadminModule";
import { ALL_TRANSLATIONS, loadLocale, isLazyLocale, type Language } from "@/lib/i18n";

const TRANSLATIONS = ALL_TRANSLATIONS;

export default function SuperadminPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
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

  useEffect(() => {
    if (loading) return;
    if (!profile?.isSuperadmin) {
      router.replace("/");
    }
  }, [loading, profile?.isSuperadmin, router]);

  if (loading || !profile?.isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
        <p>{t.superadmin_loading ?? "…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <SuperadminModule t={t} />
    </div>
  );
}
