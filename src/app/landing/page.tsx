"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Apple, ClipboardList, Clock, PlayCircle, ShieldCheck, Star, UserPlus } from "lucide-react";
import { useAppLocale } from "@/hooks/useAppLocale";
import {
  applyAnnualDiscount,
  detectGeo,
  formatLandingPrice,
  getLandingPlanPrices,
  type GeoDetect,
  type LandingPlanPrices,
} from "@/lib/geoTier";

function useFadeIn() {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setOn(true);
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, on };
}

function FadeSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, on } = useFadeIn();
  return (
    <section
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
    >
      {children}
    </section>
  );
}

function HeroDashboardMockup({ tx }: { tx: (k: string, fb: string) => string }) {
  const kpis = [
    { key: "landing_mock_kpi_projects", fb: "Projects", n: 2, emoji: "🏗️" },
    { key: "landing_mock_kpi_employees", fb: "Employees", n: 4, emoji: "👷" },
    { key: "landing_mock_kpi_visitors", fb: "Visitors", n: 0, emoji: "👤" },
    { key: "landing_mock_kpi_risks", fb: "Risks", n: 0, emoji: "⚠️" },
  ] as const;
  const acts = [
    { Icon: ClipboardList, textKey: "landing_mock_act1", timeKey: "landing_mock_rel1", fb: "", tfb: "" },
    { Icon: UserPlus, textKey: "landing_mock_act2", timeKey: "landing_mock_rel2", fb: "", tfb: "" },
    { Icon: ShieldCheck, textKey: "landing_mock_act3", timeKey: "landing_mock_rel3", fb: "", tfb: "" },
  ] as const;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/25 bg-slate-100 text-left shadow-xl dark:border-slate-600 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-[#0f3a45] px-3 py-2.5 dark:border-slate-700 dark:bg-[#0a3038]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-bold text-white">
            <span className="text-[#f97316]">Machin</span>Pro
          </span>
          <span className="hidden truncate text-xs font-medium text-teal-100/90 sm:inline">
            {tx("landing_mock_dashboard", "Dashboard")}
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400/90" aria-hidden />
          <span className="h-2 w-2 rounded-full bg-amber-400/90" aria-hidden />
          <span className="h-2 w-2 rounded-full bg-emerald-400/90" aria-hidden />
        </div>
      </div>
      <div className="space-y-3 bg-slate-50 p-3 dark:bg-slate-950/80 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.key}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {tx(k.key, k.fb)}
              </p>
              <p className="mt-1 flex items-baseline gap-1 text-lg font-bold text-[#1a4f5e] dark:text-teal-400">
                <span>{k.n}</span>
                <span className="text-base" aria-hidden>
                  {k.emoji}
                </span>
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <span className="truncate">{tx("landing_mock_progress", "Centro site — 24% complete")}</span>
            <span className="shrink-0 text-[#f97316]">24%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-[24%] rounded-full bg-gradient-to-r from-[#f97316] to-orange-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {tx("landing_mock_activity", "Recent activity")}
          </p>
          {acts.map(({ Icon, textKey, timeKey }) => (
            <div
              key={textKey}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a4f5e]/10 text-[#1a4f5e] dark:bg-teal-900/40 dark:text-teal-300">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{tx(textKey, "…")}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{tx(timeKey, "…")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type FeatureRow = { kind: "emoji" | "clock"; titleKey: string; descKey: string };

export default function LandingPage() {
  const { language, setLanguage, tx } = useAppLocale();

  const [annual, setAnnual] = useState(false);
  const [dark, setDark] = useState(false);
  const [navSolid, setNavSolid] = useState(false);
  const [geoDetect, setGeoDetect] = useState<GeoDetect | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectGeo().then((g) => {
      if (!cancelled) setGeoDetect(g);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const planPrices: LandingPlanPrices | null = useMemo(() => {
    if (!geoDetect) return null;
    const base = getLandingPlanPrices(geoDetect.countryCode, geoDetect.tier);
    return annual ? applyAnnualDiscount(base) : base;
  }, [geoDetect, annual]);

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const features = useMemo(
    (): FeatureRow[] => [
      { kind: "emoji", titleKey: "landing_feat_projects_title", descKey: "landing_feat_projects_desc" },
      { kind: "emoji", titleKey: "landing_feat_risks_title", descKey: "landing_feat_risks_desc" },
      { kind: "emoji", titleKey: "landing_feat_visitors_title", descKey: "landing_feat_visitors_desc" },
      { kind: "emoji", titleKey: "landing_feat_blueprints_title", descKey: "landing_feat_blueprints_desc" },
      { kind: "emoji", titleKey: "landing_feat_dashboard_title", descKey: "landing_feat_dashboard_desc" },
      { kind: "emoji", titleKey: "landing_feat_billing_title", descKey: "landing_feat_billing_desc" },
      { kind: "clock", titleKey: "landing_feature_hours_title", descKey: "landing_feature_hours_desc" },
    ],
    []
  );

  const pioneerCards = useMemo(
    () =>
      [
        { emoji: "🎯", titleKey: "landing_pioneer_price", descKey: "landing_pioneer_price_desc" },
        { emoji: "🛠️", titleKey: "landing_pioneer_feedback", descKey: "landing_pioneer_feedback_desc" },
        { emoji: "🏆", titleKey: "landing_pioneer_support", descKey: "landing_pioneer_support_desc" },
      ] as const,
    []
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          navSolid
            ? "border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 shadow-sm"
            : "border-b border-white/10 bg-[#134e5e]/90 dark:bg-[#0c2f38]/90"
        } backdrop-blur-md`}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/landing" className="flex items-center gap-2 min-h-[44px]">
            <Image src="/logo-source.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            <span
              className={`text-lg font-bold tracking-tight ${navSolid ? "text-slate-900 dark:text-white" : "text-white"}`}
            >
              <span className="text-[#f97316]">Machin</span>
              <span className={navSolid ? "text-slate-900 dark:text-white" : "text-white"}>Pro</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollToId("features")}
              className={`min-h-[44px] px-3 text-sm font-medium rounded-lg transition-colors ${
                navSolid
                  ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              {tx("landing_nav_features", "Features")}
            </button>
            <button
              type="button"
              onClick={() => scrollToId("pricing")}
              className={`min-h-[44px] px-3 text-sm font-medium rounded-lg transition-colors ${
                navSolid
                  ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              {tx("landing_nav_pricing", "Pricing")}
            </button>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/20 dark:border-slate-600 overflow-hidden">
              <button
                type="button"
                onClick={() => setLanguage("es")}
                className={`min-h-[44px] min-w-[44px] px-2 text-sm font-semibold ${
                  language === "es"
                    ? "bg-[#f97316] text-white"
                    : navSolid
                      ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      : "bg-white/10 text-white"
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`min-h-[44px] min-w-[44px] px-2 text-sm font-semibold ${
                  language === "en"
                    ? "bg-[#f97316] text-white"
                    : navSolid
                      ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      : "bg-white/10 text-white"
                }`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={toggleDark}
              className={`min-h-[44px] min-w-[44px] rounded-lg border text-sm font-medium ${
                navSolid
                  ? "border-slate-300 text-slate-800 dark:border-slate-600 dark:text-slate-200"
                  : "border-white/30 text-white"
              }`}
              aria-label="Theme"
            >
              {dark ? "☀" : "☾"}
            </button>
            <Link
              href="/login"
              className={`min-h-[44px] inline-flex items-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
                navSolid
                  ? "border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                  : "border-white/40 text-white hover:bg-white/10"
              }`}
            >
              {tx("landing_nav_login", "Log in")}
            </Link>
            <Link
              href="/register"
              className="min-h-[44px] inline-flex items-center rounded-xl bg-[#f97316] px-4 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              {tx("landing_nav_start", "Start free")}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f3a45] via-[#1a4f5e] to-[#134e5e] dark:from-[#051a1f] dark:via-[#0c2f38] dark:to-[#0f3a45] px-4 pb-16 pt-10 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
                <Image
                  src="/logo-source.png"
                  alt=""
                  width={128}
                  height={128}
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </div>
              <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
                {tx("landing_hero_title", "Professional construction management")}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-teal-100/95 sm:text-xl">
                {tx("landing_hero_sub", "Everything you need in one place")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Link
                  href="/register"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-900/20 hover:bg-orange-600 transition-colors"
                >
                  {tx("landing_cta_start", "Start free 14 days")}
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToId("features")}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-[#b8860b] bg-transparent px-6 py-3 text-base font-semibold text-[#f6e27a] hover:bg-[#b8860b]/10 transition-colors"
                >
                  {tx("landing_cta_demo", "View demo")}
                </button>
              </div>
              <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-teal-50">
                <Apple className="h-4 w-4 shrink-0" aria-hidden />
                <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
                <span>{tx("landing_badge_mobile", "Available on iOS and Android")}</span>
              </div>
            </div>
          </FadeSection>
          <FadeSection className="mt-12">
            <div className="relative mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/40 p-2 shadow-2xl backdrop-blur">
              <HeroDashboardMockup tx={tx} />
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 bg-white dark:bg-slate-950 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_features_title", "Features")}
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.titleKey}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="mb-2 flex items-start gap-2">
                    {f.kind === "clock" ? (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a4f5e]/15 text-[#1a4f5e] dark:bg-teal-900/40 dark:text-teal-300">
                        <Clock className="h-5 w-5" aria-hidden />
                      </span>
                    ) : null}
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {tx(f.titleKey, f.titleKey)}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {tx(f.descKey, "")}
                  </p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 bg-slate-100 dark:bg-slate-900/80 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_pricing_title", "Pricing")}
            </h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {tx("landing_pricing_monthly", "Monthly")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={annual}
                onClick={() => setAnnual((a) => !a)}
                className={`relative h-9 w-16 rounded-full transition-colors ${annual ? "bg-[#1a4f5e]" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span
                  className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-7" : ""}`}
                />
              </button>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {tx("landing_pricing_annual", "Annual")}{" "}
                <span className="text-[#b8860b]">({tx("landing_pricing_save", "save 20%")})</span>
              </span>
            </div>
            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              {(
                [
                  { key: "starter" as const, popular: false },
                  { key: "pro" as const, popular: true },
                  { key: "enterprise" as const, popular: false },
                ] as const
              ).map(({ key, popular }) => (
                <div
                  key={key}
                  className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm dark:bg-slate-950 ${
                    popular
                      ? "border-[#f97316] ring-2 ring-[#f97316]/30 scale-[1.02] z-10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {popular ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold text-white">
                      <Star className="h-3.5 w-3.5 fill-white" aria-hidden />
                      {tx("landing_pricing_popular", "Most popular")}
                    </div>
                  ) : null}
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {tx(`landing_plan_${key}_name`, key)}
                  </h3>
                  <p className="mt-4 flex min-h-[3.5rem] flex-wrap items-baseline gap-1">
                    {!planPrices ? (
                      <span className="inline-block h-10 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                          {formatLandingPrice(planPrices[key], planPrices.currency, language)}
                        </span>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {planPrices.currency}
                        </span>
                        <span className="w-full text-slate-500 dark:text-slate-400 sm:w-auto sm:pl-1">
                          {tx("landing_price_suffix", "/mo")}
                        </span>
                      </>
                    )}
                  </p>
                  <Link
                    href="/register"
                    className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1a4f5e] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#134e5e] dark:bg-teal-800 dark:hover:bg-teal-700"
                  >
                    {tx("landing_cta_start", "Start free")}
                  </Link>
                </div>
              ))}
            </div>
            {planPrices ? (
              <p className="mt-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                {tx("landing_price_region_badge", "Price adjusted for your region")}
              </p>
            ) : (
              <div className="mx-auto mt-6 h-4 w-64 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            )}
          </FadeSection>
        </div>
      </section>

      <section
        id="pioneers"
        className="scroll-mt-24 border-y border-teal-100/80 bg-teal-50/90 px-4 py-16 dark:border-teal-900/40 dark:bg-teal-950/25 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-[#1a4f5e] dark:text-teal-300 sm:text-3xl">
              {tx("landing_pioneers_title", "Be among the first")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {tx("landing_pioneers_sub", "")}
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pioneerCards.map((c) => (
                <div
                  key={c.titleKey}
                  className="rounded-2xl border border-teal-200/60 bg-white/90 p-6 shadow-sm dark:border-teal-800/50 dark:bg-slate-900/70"
                >
                  <p className="text-2xl" aria-hidden>
                    {c.emoji}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{tx(c.titleKey, "")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{tx(c.descKey, "")}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Link
                href="/register"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#f97316] px-8 py-3 text-base font-semibold text-white shadow-md hover:bg-orange-600"
              >
                {tx("landing_pioneer_cta", "Join now — free 14 days")}
              </Link>
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 border-t border-slate-200 bg-slate-50 px-4 py-12 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-slate-600 dark:text-slate-400">{tx("landing_footer_contact", "Contact")}</p>
          <a
            href="mailto:machinpro.app@gmail.com"
            className="mt-2 inline-flex min-h-[44px] items-center text-lg font-semibold text-[#1a4f5e] dark:text-teal-400 hover:underline"
          >
            machinpro.app@gmail.com
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2">
                <Image src="/logo-source.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
                <span className="text-lg font-bold">
                  <span className="text-[#f97316]">Machin</span>
                  <span className="text-slate-900 dark:text-white">Pro</span>
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                {tx("landing_footer_desc", "Construction SaaS")}
              </p>
            </div>
            <div className="flex flex-wrap gap-10 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-slate-900 dark:text-white">{tx("landing_footer_nav", "Navigate")}</p>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_home", "Home")}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId("features")}
                  className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_features", "Features")}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId("pricing")}
                  className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_pricing", "Pricing")}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToId("contact")}
                  className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_contact_link", "Contact")}
                </button>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-slate-900 dark:text-white">{tx("landing_footer_legal", "Legal")}</p>
                <Link
                  href="/legal/terms"
                  className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_terms", "Terms")}
                </Link>
                <Link
                  href="/legal/privacy"
                  className="block min-h-[44px] py-2 text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_privacy", "Privacy")}
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 dark:border-slate-800 sm:flex-row">
            <p className="text-center text-xs text-slate-500 dark:text-slate-500">
              {tx("landing_footer_copyright", "© 2026 MachinPro · machin.pro")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                {tx("landing_social_x", "X")}
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                {tx("landing_social_li", "in")}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
