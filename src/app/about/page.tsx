"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  HardHat,
  CalendarClock,
  Package,
  Shield,
  ClipboardList,
} from "lucide-react";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useLandingLocale, htmlLangForLanguage } from "@/hooks/useLandingLocale";
import { LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types/shared";

export default function AboutPage() {
  const { language, setLanguage, tx } = useLandingLocale();
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

  const mod = [
    {
      icon: LayoutDashboard,
      title: tx("about_mod_central_title", "Central"),
      desc: tx("about_mod_central_desc", ""),
    },
    {
      icon: HardHat,
      title: tx("about_mod_ops_title", "Operations"),
      desc: tx("about_mod_ops_desc", ""),
    },
    {
      icon: CalendarClock,
      title: tx("about_mod_schedule_title", "Schedule"),
      desc: tx("about_mod_schedule_desc", ""),
    },
    {
      icon: Package,
      title: tx("about_mod_logistics_title", "Logistics"),
      desc: tx("about_mod_logistics_desc", ""),
    },
    {
      icon: Shield,
      title: tx("about_mod_security_title", "Safety"),
      desc: tx("about_mod_security_desc", ""),
    },
    {
      icon: ClipboardList,
      title: tx("about_mod_forms_title", "Forms"),
      desc: tx("about_mod_forms_desc", ""),
    },
  ] as const;

  return (
    <div
      lang={htmlLangForLanguage(language)}
      className="min-h-screen bg-slate-50 text-slate-900 selection:bg-teal-500/20 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-teal-500/30"
    >
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/landing" className="flex min-h-[44px] items-center gap-2">
            <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-9 w-9" sizes="36px" />
            <span className="dark:hidden">
              <BrandWordmark tone="onLight" className="text-lg font-bold" />
            </span>
            <span className="hidden dark:inline">
              <BrandWordmark tone="onDark" className="text-lg font-bold" />
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="about-lang">
              {tx("landing_lang_select", "Language")}
            </label>
            <select
              id="about-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 dark:border-white/20 dark:bg-slate-900 dark:text-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleDark}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
              aria-label={tx("landing_theme_toggle", "Theme")}
            >
              {dark ? "☀" : "☾"}
            </button>
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-teal-800 hover:bg-slate-100 dark:border-white/20 dark:text-teal-200 dark:hover:bg-white/5"
            >
              {tx("about_cta_plans", "View plans")}
            </Link>
            <Link
              href="/beta"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-sm font-semibold text-slate-950 hover:opacity-95"
            >
              {tx("about_cta_beta", "Start free")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <section className="text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
            {tx("about_title", "")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-slate-600 dark:text-slate-300">
            {tx("about_subtitle", "")}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-teal-500/50 px-6 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:text-teal-200 dark:hover:bg-teal-950/40"
            >
              {tx("about_cta_plans", "View plans")}
            </Link>
            <Link
              href="/beta"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:opacity-95"
            >
              {tx("about_cta_beta", "Start free")}
            </Link>
          </div>
        </section>

        <section className="mt-14 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/50 sm:p-8 sm:text-left">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{tx("about_company_heading", "")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{tx("about_company_intro", "")}</p>
          <p className="mt-4 text-sm font-medium text-slate-800 dark:text-slate-200">
            {tx("about_contact_general", "")}{" "}
            <a
              href={`mailto:${tx("contact_email", "info@machin.pro")}`}
              className="text-teal-700 underline underline-offset-2 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
            >
              {tx("contact_email", "info@machin.pro")}
            </a>
          </p>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-xl font-semibold text-slate-900 sm:text-2xl dark:text-white">
            {tx("about_modules_heading", "Modules")}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mod.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/20"
              >
                <c.icon className="h-8 w-8 text-amber-500 dark:text-amber-400" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-slate-200 bg-slate-100/80 p-6 sm:p-10 dark:border-white/10 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl dark:text-white">{tx("about_for_who", "")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-semibold text-teal-700 dark:text-teal-300">{tx("about_contractor", "")}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tx("about_contractor_desc", "")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-teal-700 dark:text-teal-300">{tx("about_sitemanager", "")}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tx("about_sitemanager_desc", "")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-teal-700 dark:text-teal-300">{tx("about_owner", "")}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tx("about_owner_desc", "")}</p>
            </div>
          </div>
        </section>

        <section className="mt-16 text-center">
          <p className="text-lg font-medium text-slate-900 dark:text-white">{tx("about_languages", "")}</p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{tx("about_countries", "")}</p>
          <p className="mt-4 text-3xl" aria-hidden>
            🇨🇦 🇺🇸 🇲🇽 🇪🇸 🇬🇧 🇪🇺 🇦🇺 🇳🇿
          </p>
        </section>

        <section className="mt-16 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-50 to-slate-100 p-8 text-center dark:border-amber-500/30 dark:from-amber-950/40 dark:to-slate-900">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">{tx("about_final_title", "")}</h2>
          <Link
            href="/beta"
            className="mt-6 inline-flex min-h-[44px] min-w-[200px] items-center justify-center rounded-xl bg-amber-500 px-6 text-sm font-bold text-slate-950 hover:bg-amber-400"
          >
            {tx("about_final_cta", "Request access")}
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-500">
        <Link href="/landing" className="min-h-[44px] text-teal-600 hover:underline dark:text-teal-400">
          machin.pro
        </Link>
      </footer>
    </div>
  );
}
