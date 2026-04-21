"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  LayoutDashboard,
  HardHat,
  CalendarClock,
  Boxes,
  Shield,
  ClipboardList,
  Play,
} from "lucide-react";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { LandingLanguageSelect } from "@/components/LandingLanguageSelect";
import { useLandingLocale, htmlLangForLanguage } from "@/hooks/useLandingLocale";

type Tx = (key: string, fb: string) => string;

function FadeSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`${className}`}>{children}</section>;
}

function ModuleBlock({
  tx,
  icon: Icon,
  titleKey,
  headlineKey,
  bullets,
  imageRight,
}: {
  tx: Tx;
  icon: typeof LayoutDashboard;
  titleKey: string;
  headlineKey: string;
  bullets: string[];
  imageRight: boolean;
}) {
  const graphic = (
    <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
      <Icon className="h-20 w-20 text-[#f97316] opacity-90 sm:h-24 sm:w-24" aria-hidden />
    </div>
  );
  const copy = (
    <div className="flex min-w-0 flex-1 flex-col justify-center space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1a4f5e] dark:text-teal-400">{tx(titleKey, "")}</p>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{tx(headlineKey, "")}</h3>
      <ul className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {bullets.map((key) => (
          <li key={key} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
            <span>{tx(key, "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div
      className={`flex flex-col gap-8 lg:flex-row lg:items-stretch ${imageRight ? "" : "lg:flex-row-reverse"}`}
    >
      {graphic}
      {copy}
    </div>
  );
}

export default function DemoPage() {
  const { language, setLanguage, tx } = useLandingLocale();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = htmlLangForLanguage(language);
    document.title = tx("demo_meta_title", "MachinPro · Demo");
  }, [language, tx]);

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
  };

  const dark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/landing" className="flex items-center gap-2 min-h-[44px]">
            <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-9 w-9" sizes="36px" />
            <BrandWordmark tone="onLight" className="text-lg font-bold" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <LandingLanguageSelect
              value={language}
              onChange={setLanguage}
              navSolid={false}
              ariaLabel={tx("landing_nav_language", "Language")}
            />
            <button
              type="button"
              onClick={toggleDark}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-600"
            >
              {dark ? "☀" : "☾"}
            </button>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
            >
              {tx("landing_nav_login", "Log in")}
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-gradient-to-b from-[#0f3a45] via-[#1a4f5e] to-[#134e5e] px-4 py-14 dark:border-slate-800 dark:from-[#051a1f] dark:via-[#0c2f38] sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
            {tx("demo_hero_title", "See MachinPro in action")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-teal-100/95 sm:text-xl">
            {tx("demo_hero_subtitle", "Everything your construction company needs, from your phone.")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/beta"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#f97316] px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-orange-600"
            >
              {tx("demo_cta_trial", "Start free 14-day trial")}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-[#b8860b] px-8 py-3 text-base font-semibold text-[#f6e27a] hover:bg-[#b8860b]/10"
            >
              {tx("demo_cta_pricing", "View pricing")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-teal-200/85">{tx("demo_no_card_note", "No credit card required")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:py-20">
        <ModuleBlock
          tx={tx}
          icon={LayoutDashboard}
          titleKey="demo_module_central_title"
          headlineKey="demo_module_central_headline"
          bullets={[
            "demo_module_central_b1",
            "demo_module_central_b2",
            "demo_module_central_b3",
            "demo_module_central_b4",
          ]}
          imageRight={false}
        />
        <ModuleBlock
          tx={tx}
          icon={HardHat}
          titleKey="demo_module_operations_title"
          headlineKey="demo_module_operations_headline"
          bullets={[
            "demo_module_operations_b1",
            "demo_module_operations_b2",
            "demo_module_operations_b3",
            "demo_module_operations_b4",
          ]}
          imageRight
        />
        <ModuleBlock
          tx={tx}
          icon={CalendarClock}
          titleKey="demo_module_schedule_title"
          headlineKey="demo_module_schedule_headline"
          bullets={[
            "demo_module_schedule_b1",
            "demo_module_schedule_b2",
            "demo_module_schedule_b3",
            "demo_module_schedule_b4",
          ]}
          imageRight={false}
        />
        <ModuleBlock
          tx={tx}
          icon={Boxes}
          titleKey="demo_module_logistics_title"
          headlineKey="demo_module_logistics_headline"
          bullets={[
            "demo_module_logistics_b1",
            "demo_module_logistics_b2",
            "demo_module_logistics_b3",
            "demo_module_logistics_b4",
          ]}
          imageRight
        />
        <ModuleBlock
          tx={tx}
          icon={Shield}
          titleKey="demo_module_security_title"
          headlineKey="demo_module_security_headline"
          bullets={[
            "demo_module_security_b1",
            "demo_module_security_b2",
            "demo_module_security_b3",
            "demo_module_security_b4",
          ]}
          imageRight={false}
        />
        <ModuleBlock
          tx={tx}
          icon={ClipboardList}
          titleKey="demo_module_forms_title"
          headlineKey="demo_module_forms_headline"
          bullets={[
            "demo_module_forms_b1",
            "demo_module_forms_b2",
            "demo_module_forms_b3",
            "demo_module_forms_b4",
          ]}
          imageRight
        />
      </section>

      <FadeSection className="mx-auto max-w-4xl px-4 pb-14">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-10 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <Play className="mx-auto h-16 w-16 text-orange-400" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-white">{tx("demo_video_title", "Demo video coming soon")}</p>
          <p className="mt-2 text-sm text-slate-400">{tx("demo_video_subtitle", "Full walkthrough of MachinPro in action")}</p>
        </div>
      </FadeSection>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            {tx("demo_final_title", "Ready to build without chaos?")}
          </h2>
          <Link
            href="/beta"
            className="mt-8 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#f97316] px-8 py-3 text-base font-semibold text-white hover:bg-orange-600"
          >
            {tx("demo_cta_trial", "Start free 14-day trial")}
          </Link>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            {tx("demo_final_note", "No credit card · 21 languages · Cancel anytime")}
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        <Link href="/landing" className="text-[#1a4f5e] underline hover:text-orange-600 dark:text-teal-400">
          {tx("demo_back_landing", "Back to home")}
        </Link>
      </footer>
    </div>
  );
}
