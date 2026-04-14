"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { ALL_TRANSLATIONS, LANGUAGES } from "@/lib/i18n";
import { supabase, type AuthGetSessionResult } from "@/lib/supabase";
import type { Language } from "@/types/shared";

const MAIN_LANGS = new Set<Language>(["es", "en", "fr", "de", "it", "pt"]);

function HelpPageInner() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("lang") ?? "es";
  const lang: Language = MAIN_LANGS.has(raw as Language) ? (raw as Language) : "es";
  const t = ALL_TRANSLATIONS[lang] as Record<string, string>;
  const L = (k: string, fb: string) => t[k] ?? fb;

  const [loggedIn, setLoggedIn] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then((result: AuthGetSessionResult) => {
      setLoggedIn(Boolean(result.data?.session));
    });
  }, []);
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

  const langOptions = useMemo(() => LANGUAGES.filter((l) => MAIN_LANGS.has(l.code as Language)), []);

  const sections = useMemo(
    () => [
      { title: L("help_getting_started", ""), body: L("help_desc_getting_started", ""), id: "start" },
      { title: L("help_central", ""), body: L("help_desc_central", ""), id: "central" },
      { title: L("help_operations", ""), body: L("help_desc_operations", ""), id: "operations" },
      { title: L("help_schedule", ""), body: L("help_desc_schedule", ""), id: "schedule" },
      { title: L("help_logistics", ""), body: L("help_desc_logistics", ""), id: "logistics" },
      { title: L("help_security", ""), body: L("help_desc_security", ""), id: "security" },
      { title: L("help_forms", ""), body: L("help_desc_forms", ""), id: "forms" },
      { title: L("help_settings", ""), body: L("help_desc_settings", ""), id: "settings" },
    ],
    [lang, t]
  );

  const faqItems = useMemo(
    () =>
      [
        { q: "help_faq_invite", a: "help_faq_invite_answer" },
        { q: "help_faq_project", a: "help_faq_project_answer" },
        { q: "help_faq_daily", a: "help_faq_daily_answer" },
        { q: "help_faq_language", a: "help_faq_language_answer" },
        { q: "help_faq_support", a: "help_faq_support_answer" },
      ] as const,
    []
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-gradient-to-b dark:from-[#0f3a45] dark:via-[#1a4f5e] dark:to-[#134e5e] dark:text-white">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-md dark:border-white/10 dark:bg-transparent">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/landing" className="flex min-h-[44px] items-center gap-2">
            <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-10 w-10" sizes="40px" />
            <span className="dark:hidden">
              <BrandWordmark tone="onLight" className="text-lg font-bold" />
            </span>
            <span className="hidden dark:inline">
              <BrandWordmark tone="onDark" className="text-lg font-bold" />
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="help-lang">
              {L("landing_lang_select", "Language")}
            </label>
            <select
              id="help-lang"
              value={lang}
              onChange={(e) => {
                const next = e.target.value as Language;
                const u = new URL(window.location.href);
                u.searchParams.set("lang", next);
                window.location.href = u.toString();
              }}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 dark:border-white/30 dark:bg-white/10 dark:text-white"
            >
              {langOptions.map((l) => (
                <option key={l.code} value={l.code} className="text-zinc-900">
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleDark}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/30 dark:text-white dark:hover:bg-white/10"
              aria-label={L("landing_theme_toggle", "Theme")}
            >
              {dark ? "☀" : "☾"}
            </button>
            {loggedIn ? (
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-[#f97316] px-4 text-sm font-semibold text-white hover:bg-orange-600"
              >
                {L("help_nav_dashboard", "Ir al dashboard")}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/40 dark:text-white dark:hover:bg-white/10"
              >
                {L("landing_nav_login", "Log in")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-bold sm:text-3xl">{L("help_title", "Centro de ayuda")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base dark:text-teal-100/90">
          {L("help_contact_support", "Contact")}:{" "}
          <a
            href={`mailto:${L("help_support_email_value", "support@machin.pro")}`}
            className="font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-900 dark:text-teal-200 dark:hover:text-white"
          >
            {L("help_support_email_value", "support@machin.pro")}
          </a>
        </p>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/10 dark:shadow-none sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{L("help_faq_title", "")}</h2>
          <ul className="mt-6 space-y-5">
            {faqItems.map((item) => (
              <li key={item.q}>
                <p className="font-medium text-slate-900 dark:text-teal-50">{L(item.q, "")}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-teal-50/95">{L(item.a, "")}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {sections.map((s) => (
            <article
              key={s.id}
              id={s.id}
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-md dark:border-white/15 dark:bg-white/10 dark:shadow-lg dark:backdrop-blur-sm"
            >
              <div
                className="mb-4 flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500 dark:border-white/30 dark:bg-black/20 dark:text-teal-100/80"
                aria-hidden
              >
                {L("help_placeholder_caption", "Captura próximamente")}
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-teal-50/95">{s.body}</p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-slate-600 dark:text-teal-100/90">
          <a
            href={`mailto:${L("help_support_email_value", "support@machin.pro")}`}
            className="font-medium text-teal-700 underline hover:text-teal-900 dark:text-teal-100 dark:hover:text-white"
          >
            {L("help_support_email_value", "support@machin.pro")}
          </a>
        </p>
      </main>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0f3a45] text-white text-sm">
          …
        </div>
      }
    >
      <HelpPageInner />
    </Suspense>
  );
}
