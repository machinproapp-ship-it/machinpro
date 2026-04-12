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
  useEffect(() => {
    void supabase.auth.getSession().then((result: AuthGetSessionResult) => {
      setLoggedIn(Boolean(result.data?.session));
    });
  }, []);

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
    [lang]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f3a45] via-[#1a4f5e] to-[#134e5e] text-white">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/landing" className="flex items-center gap-2 min-h-[44px]">
            <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-10 w-10" sizes="40px" />
            <BrandWordmark tone="onDark" className="text-lg font-bold" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="help-lang">
              Language
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
              className="min-h-[44px] rounded-lg border border-white/30 bg-white/10 px-2 text-sm font-medium text-white"
            >
              {langOptions.map((l) => (
                <option key={l.code} value={l.code} className="text-zinc-900">
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
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
                className="inline-flex min-h-[44px] items-center rounded-xl border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/10"
              >
                {L("landing_nav_login", "Log in")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-bold sm:text-3xl">{L("help_title", "Centro de ayuda")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-teal-100/90 sm:text-base">{L("help_contact", "")}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {sections.map((s) => (
            <article
              key={s.id}
              id={s.id}
              className="scroll-mt-24 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-lg backdrop-blur-sm"
            >
              <div
                className="mb-4 flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-white/30 bg-black/20 text-sm text-teal-100/80"
                aria-hidden
              >
                {L("help_placeholder_caption", "Captura próximamente")}
              </div>
              <h2 className="text-lg font-semibold text-white">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-teal-50/95">{s.body}</p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-teal-100/90">
          <a href="mailto:support@machin.pro" className="font-medium underline hover:text-white">
            support@machin.pro
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
