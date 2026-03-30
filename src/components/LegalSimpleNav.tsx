"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { useAppLocale } from "@/hooks/useAppLocale";

export function LegalSimpleNav() {
  const { tx, language, setLanguage } = useAppLocale();
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

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/landing" className="flex items-center gap-2 min-h-[44px]">
          <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-9 w-9" sizes="36px" />
          <span className="text-lg font-bold">
            <span className="text-[#f97316]">Machin</span>
            <span className="text-slate-900 dark:text-white">Pro</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setLanguage("es")}
              className={`min-h-[44px] min-w-[44px] px-2 text-sm font-semibold ${
                language === "es" ? "bg-[#f97316] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              }`}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`min-h-[44px] min-w-[44px] px-2 text-sm font-semibold ${
                language === "en" ? "bg-[#f97316] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              }`}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-300 text-sm dark:border-slate-600"
            aria-label="Theme"
          >
            {dark ? "☀" : "☾"}
          </button>
          <Link
            href="/landing"
            className="min-h-[44px] inline-flex items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {tx("legal_back_home", "Back")}
          </Link>
          <Link
            href="/login"
            className="min-h-[44px] inline-flex items-center rounded-xl bg-[#1a4f5e] px-4 text-sm font-semibold text-white hover:bg-[#134e5e]"
          >
            {tx("landing_nav_login", "Log in")}
          </Link>
        </div>
      </div>
    </header>
  );
}
