"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import type { Language } from "@/types/shared";

export default function MaintenancePage() {
  const [lang, setLang] = useState<Language>("es");

  useEffect(() => {
    try {
      const s = localStorage.getItem("machinpro_language");
      if (s && s in ALL_TRANSLATIONS) setLang(s as Language);
      else {
        const n = navigator.language?.slice(0, 2)?.toLowerCase();
        if (n && n in ALL_TRANSLATIONS) setLang(n as Language);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const t = useMemo(
    () => (ALL_TRANSLATIONS[lang] ?? ALL_TRANSLATIONS.es) as Record<string, string>,
    [lang]
  );
  const tx = (k: string, fb: string) => t[k] ?? fb;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Image src="/logo-source.png" alt="" width={96} height={96} className="h-24 w-24 rounded-2xl" priority />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a4f5e] dark:text-teal-400">{tx("maintenance_title", "MachinPro")}</h1>
        <p className="mt-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          {tx("maintenance_body", "Estamos mejorando MachinPro. Volvemos pronto.")}
        </p>
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          {tx("maintenance_contact_label", "¿Necesitas ayuda?")}{" "}
          <a
            href="mailto:support@machin.pro"
            className="inline-flex min-h-[44px] items-center justify-center font-semibold text-amber-600 underline underline-offset-4 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            support@machin.pro
          </a>
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1a4f5e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#134e5e] dark:bg-teal-700 dark:hover:bg-teal-600"
        >
          {tx("maintenance_home", "Ir al inicio")}
        </Link>
      </div>
    </div>
  );
}
