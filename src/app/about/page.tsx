"use client";

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
      className="min-h-screen bg-slate-950 text-slate-100 selection:bg-teal-500/30"
    >
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/landing" className="flex min-h-[44px] items-center gap-2">
            <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-9 w-9" sizes="36px" />
            <BrandWordmark tone="onDark" className="text-lg font-bold" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="about-lang">
              Language
            </label>
            <select
              id="about-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="min-h-[44px] rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-white/20 px-3 text-sm font-medium text-teal-200 hover:bg-white/5"
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
          <h1 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            {tx("about_title", "")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-slate-300">
            {tx("about_subtitle", "")}
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-teal-400/40 px-6 py-3 text-sm font-semibold text-teal-200 hover:bg-teal-950/40"
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

        <section className="mt-20">
          <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">
            {tx("about_modules_heading", "Modules")}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mod.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-lg shadow-black/20"
              >
                <c.icon className="h-8 w-8 text-amber-400" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-10">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">{tx("about_for_who", "")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-semibold text-teal-300">{tx("about_contractor", "")}</h3>
              <p className="mt-2 text-sm text-slate-400">{tx("about_contractor_desc", "")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-teal-300">{tx("about_sitemanager", "")}</h3>
              <p className="mt-2 text-sm text-slate-400">{tx("about_sitemanager_desc", "")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-teal-300">{tx("about_owner", "")}</h3>
              <p className="mt-2 text-sm text-slate-400">{tx("about_owner_desc", "")}</p>
            </div>
          </div>
        </section>

        <section className="mt-16 text-center">
          <p className="text-lg font-medium text-white">{tx("about_languages", "")}</p>
          <p className="mt-2 text-slate-400">{tx("about_countries", "")}</p>
          <p className="mt-4 text-3xl" aria-hidden>
            🇨🇦 🇺🇸 🇲🇽 🇪🇸 🇬🇧 🇪🇺 🇦🇺 🇳🇿
          </p>
        </section>

        <section className="mt-16 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-slate-900 p-8 text-center">
          <h2 className="text-xl font-bold text-white sm:text-2xl">{tx("about_final_title", "")}</h2>
          <Link
            href="/beta"
            className="mt-6 inline-flex min-h-[44px] min-w-[200px] items-center justify-center rounded-xl bg-amber-500 px-6 text-sm font-bold text-slate-950 hover:bg-amber-400"
          >
            {tx("about_final_cta", "Request access")}
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        <Link href="/landing" className="min-h-[44px] text-teal-400 hover:underline">
          machin.pro
        </Link>
      </footer>
    </div>
  );
}
