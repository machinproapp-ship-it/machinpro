"use client";

import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useAuth } from "@/lib/AuthContext";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import type { Language } from "@/types/shared";

const STATIC = ALL_TRANSLATIONS;

export default function NotFoundPage() {
  const { session } = useAuth();
  const [lang, setLang] = useState<Language>("es");

  useEffect(() => {
    try {
      const s = localStorage.getItem("machinpro_language");
      if (s && (s === "es" || s === "en" || s === "fr" || s === "de" || s === "it" || s === "pt")) {
        setLang(s as Language);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const t = useMemo(() => (STATIC[lang] ?? STATIC.es) as Record<string, string>, [lang]);
  const title = t.not_found_title ?? "Esta página no existe";
  const back = t.not_found_back ?? "Volver al inicio";
  const dash = t.not_found_dashboard ?? "Ir al dashboard";

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-gradient-to-b from-teal-50 via-white to-teal-100 px-4 py-12 dark:from-[#0f3a45] dark:via-[#1a4f5e] dark:to-[#134e5e]">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-8 flex justify-center">
          <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-20 w-20 sm:h-24 sm:w-24" sizes="96px" />
        </div>
        <span className="dark:hidden">
          <BrandWordmark tone="onLight" className="text-xl font-bold tracking-tight sm:text-2xl" />
        </span>
        <span className="hidden dark:inline">
          <BrandWordmark tone="onDark" className="text-xl font-bold tracking-tight sm:text-2xl" />
        </span>
        <p
          className="mt-10 text-7xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400 sm:text-8xl"
          aria-hidden
        >
          404
        </p>
        <p
          lang={lang === "en" ? "en" : "es"}
          className="mt-4 max-w-sm text-base text-zinc-700 dark:text-teal-100/95 sm:text-lg"
        >
          {title}
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border-2 border-[#b8860b] bg-white/80 px-6 py-3 text-base font-semibold text-[#92400e] hover:bg-amber-50 dark:border-[#b8860b] dark:bg-transparent dark:text-[#f6e27a] dark:hover:bg-[#b8860b]/10 sm:w-auto sm:min-w-[44px]"
          >
            {back}
          </Link>
          {session ? (
            <Link
              href="/app"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-900/20 hover:bg-orange-600 sm:w-auto sm:min-w-[44px]"
            >
              {dash}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
