"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { Apple, PlayCircle, Star } from "lucide-react";
import { useLandingLocale, htmlLangForLanguage } from "@/hooks/useLandingLocale";
import { LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types/shared";
import { detectGeo, getCurrencyForCountry, type GeoDetect } from "@/lib/geoTier";
import {
  PAID_PLAN_ORDER,
  PLANS,
  getPriceForTier,
  type BillingPeriod,
  type PaidPlanKey,
} from "@/lib/stripe";

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

function HeroDashboardMockup() {
  const kpis = [
    { n: 12, emoji: "🏗️", label: "Projects" },
    { n: 48, emoji: "👷", label: "Employees" },
    { n: 3, emoji: "👤", label: "Visitors" },
    { n: 2, emoji: "⚠️", label: "Risks" },
  ] as const;
  const acts = [
    { emoji: "📋", line: "Daily Report · 12 min ago" },
    { emoji: "👤", line: "Visitor Check-in · 1h ago" },
    { emoji: "✅", line: "Risk Resolved · Yesterday" },
  ] as const;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/25 bg-slate-100 text-left shadow-xl dark:border-slate-600 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-[#0f3a45] px-3 py-2.5 dark:border-slate-700 dark:bg-[#0a3038]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-bold text-white">
            <span className="text-[#f97316]">Machin</span>Pro <span className="font-semibold text-teal-100/90">Dashboard</span>
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
              key={k.label}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="sr-only">{k.label}</span>
              <p className="flex items-baseline gap-1 text-lg font-bold text-[#1a4f5e] dark:text-teal-400">
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
            <span className="truncate">Project Alpha — 67%</span>
            <span className="shrink-0 text-[#f97316]">67%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-[67%] rounded-full bg-gradient-to-r from-[#f97316] to-orange-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Recent activity
          </p>
          {acts.map((a) => (
            <div
              key={a.line}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a4f5e]/10 text-lg text-[#1a4f5e] dark:bg-teal-900/40 dark:text-teal-300" aria-hidden>
                {a.emoji}
              </span>
              <p className="min-w-0 flex-1 text-xs font-medium text-slate-800 dark:text-slate-100">{a.line}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type FeatureRow = { titleKey: string; descKey: string };

function formatMoney(amount: number, currency: string): string {
  const locale =
    currency === "CAD"
      ? "en-CA"
      : currency === "GBP"
        ? "en-GB"
        : currency === "MXN"
          ? "es-MX"
          : currency === "BRL"
            ? "pt-BR"
            : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: amount >= 100 && amount % 1 !== 0 ? 2 : 0,
  }).format(amount);
}

function landingFeatureKeys(plan: PaidPlanKey): string[] {
  const prefix =
    plan === "foundation"
      ? "landing_feat_foundation_"
      : plan === "obras"
        ? "landing_feat_obras_"
        : plan === "horarios"
          ? "landing_feat_horarios_"
          : plan === "logistica"
            ? "landing_feat_logistica_"
            : "landing_feat_todo_";
  return [`${prefix}1`, `${prefix}2`, `${prefix}3`, `${prefix}4`];
}

export default function LandingPage() {
  const { language, setLanguage, tx } = useLandingLocale();

  const [period, setPeriod] = useState<BillingPeriod>("monthly");
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
    if (typeof document === "undefined") return;
    const region = geoDetect?.region ?? "other";
    const extra = tx(`landing_seo_extra_${region}`, "");
    const title = tx("landing_meta_title", "");
    const baseDesc = tx("landing_meta_description", "");
    const desc = [baseDesc, extra].filter(Boolean).join(" ");
    document.title = title;
    document.documentElement.lang = htmlLangForLanguage(language);

    const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    upsertMeta("name", "description", desc);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:type", "website");
    const origin = typeof window !== "undefined" ? window.location.origin : "https://machin.pro";
    upsertMeta("property", "og:url", `${origin}/landing`);
  }, [language, geoDetect, tx]);

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

  const tierReady = geoDetect !== null;
  const displayCurrency = tierReady
    ? getCurrencyForCountry(geoDetect.countryCode, geoDetect.tier)
    : "USD";
  const showRegionNote = tierReady && geoDetect.tier !== 1;

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const features = useMemo(
    (): FeatureRow[] => [
      { titleKey: "landing_feat_projects_title", descKey: "landing_feat_projects_desc" },
      { titleKey: "landing_feature_logistics", descKey: "landing_feature_logistics_desc" },
      { titleKey: "landing_feat_risks_title", descKey: "landing_feat_risks_desc" },
      { titleKey: "landing_feat_visitors_title", descKey: "landing_feat_visitors_desc" },
      { titleKey: "landing_feat_blueprints_title", descKey: "landing_feat_blueprints_desc" },
      { titleKey: "landing_feature_hours_title", descKey: "landing_feature_hours_desc" },
      { titleKey: "landing_feat_dashboard_title", descKey: "landing_feat_dashboard_desc" },
      { titleKey: "landing_feature_forms", descKey: "landing_feature_forms_desc" },
      { titleKey: "landing_feature_audit", descKey: "landing_feature_audit_desc" },
      { titleKey: "landing_feature_watchdog", descKey: "landing_feature_watchdog_desc" },
      { titleKey: "landing_feature_rfi", descKey: "landing_feature_rfi_desc" },
      { titleKey: "landing_feat_billing_title", descKey: "landing_feat_billing_desc" },
    ],
    []
  );

  const comingSoonCards = useMemo(
    () =>
      [
        { emoji: "📱", titleKey: "landing_coming_soon_app", descKey: "landing_coming_soon_app_desc" },
        {
          emoji: "🔗",
          titleKey: "landing_coming_soon_integrations",
          descKey: "landing_coming_soon_integrations_desc",
        },
        { emoji: "🌍", titleKey: "landing_coming_soon_certs", descKey: "landing_coming_soon_certs_desc" },
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
            <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-10 w-10" sizes="40px" />
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
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className={`min-h-[44px] max-w-[11.5rem] rounded-lg border px-2 text-sm font-semibold sm:max-w-[14rem] ${
                navSolid
                  ? "border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  : "border-white/30 bg-white/10 text-white"
              }`}
              aria-label={tx("landing_lang_select", "Language")}
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
              <div className="mb-6 flex justify-center">
                <BrandLogoImage
                  src="/logo-source.png"
                  alt=""
                  boxClassName="h-16 w-16"
                  sizes="64px"
                  priority
                  imageClassName="drop-shadow-lg"
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
              <HeroDashboardMockup />
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
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{tx(f.titleKey, "")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{tx(f.descKey, "")}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <section
        id="coming-soon"
        className="scroll-mt-24 border-t border-slate-200 bg-slate-50/90 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/40 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_coming_soon_title", "Coming soon to MachinPro")}
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {comingSoonCards.map((c) => (
                <div
                  key={c.titleKey}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                >
                  <p className="text-2xl" aria-hidden>
                    {c.emoji}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{tx(c.titleKey, "")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{tx(c.descKey, "")}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 bg-slate-100 dark:bg-slate-900/80 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_pricing_title", "Pricing")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              {tx("landing_pricing_subtitle", "")}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
              <div className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 sm:w-auto sm:justify-center">
                <button
                  type="button"
                  onClick={() => setPeriod("monthly")}
                  className={`min-h-[44px] flex-1 rounded-lg px-5 text-sm font-semibold transition-colors sm:flex-none ${
                    period === "monthly"
                      ? "bg-[#f97316] text-white shadow"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {tx("landing_pricing_monthly", "Monthly")}
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("annual")}
                  className={`min-h-[44px] flex-1 rounded-lg px-5 text-sm font-semibold transition-colors sm:flex-none ${
                    period === "annual"
                      ? "bg-[#f97316] text-white shadow"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {tx("landing_pricing_annual", "Annual")}{" "}
                  <span className="opacity-90">({tx("landing_pricing_save", "save 20%")})</span>
                </button>
              </div>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
              {PAID_PLAN_ORDER.map((key) => {
                const plan = PLANS[key];
                const title = tx(plan.labelKey, key);
                const popular = key === "todo_incluido";
                const price = tierReady
                  ? getPriceForTier(key, period, geoDetect.tier, geoDetect.countryCode)
                  : null;
                return (
                  <div
                    key={key}
                    className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 ${
                      popular
                        ? "border-[#f97316] ring-2 ring-[#f97316]/35 z-[1]"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {popular ? (
                      <div className="absolute -top-3 left-1/2 max-w-[90%] -translate-x-1/2">
                        <div className="inline-flex items-center gap-1 rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold text-white shadow">
                          <Star className="h-3.5 w-3.5 fill-white" aria-hidden />
                          {tx("landing_pricing_popular", "Most popular")}
                        </div>
                      </div>
                    ) : null}
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                    <p className="mt-4 flex min-h-[3rem] flex-wrap items-baseline gap-x-1 gap-y-0">
                      {!tierReady || price === null ? (
                        <span className="inline-block h-10 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">
                            {formatMoney(price, displayCurrency)}
                          </span>
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {period === "monthly"
                              ? tx("landing_price_suffix", "/mo")
                              : tx("landing_price_suffix_annual", "/yr")}
                          </span>
                        </>
                      )}
                    </p>
                    <ul className="mt-5 flex-1 space-y-2 text-left text-sm text-slate-600 dark:text-slate-400">
                      <li className="flex gap-2 leading-snug">
                        <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                          ✓
                        </span>
                        <span>
                          {plan.seats} {tx("pricing_users_included", tx("billing_limit_users", "users"))}
                        </span>
                      </li>
                      <li className="flex gap-2 leading-snug">
                        <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                          ✓
                        </span>
                        <span>
                          {plan.storageGb} GB {tx("pricing_storage", "storage")}
                        </span>
                      </li>
                      {landingFeatureKeys(key).map((fk) => (
                        <li key={fk} className="flex gap-2 leading-snug">
                          <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                            ✓
                          </span>
                          <span>{tx(fk, "")}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/register"
                      className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#f97316] px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                    >
                      {tx("landing_pricing_plan_cta", "Start free — 14 days")}
                    </Link>
                  </div>
                );
              })}
            </div>
            {showRegionNote ? (
              <div
                role="status"
                className="mx-auto mt-8 flex max-w-2xl min-h-[44px] items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950 dark:border-amber-600 dark:bg-amber-950/35 dark:text-amber-100"
              >
                {tx("pricing_ppp_applied", "")}
              </div>
            ) : null}
            <p className="mt-8 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
              {tx("landing_pricing_extra_users", "")}
            </p>
            <div className="mt-4 space-y-2 text-center text-xs font-medium text-slate-500 dark:text-slate-500">
              <p>{tx("landing_pricing_usd_note", "")}</p>
              {showRegionNote ? <p>{tx("pricing_ppp_notice", tx("landing_pricing_region_note", ""))}</p> : null}
            </div>
          </FadeSection>
        </div>
      </section>

      <section
        id="cta-landing"
        className="scroll-mt-24 border-y border-slate-200 bg-slate-50 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/50 sm:py-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <FadeSection>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_cta_title", "")}
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              {tx("landing_cta_subtitle", "")}
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/register"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#f97316] px-8 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-orange-600"
              >
                {tx("landing_cta_primary", "Start free")}
              </Link>
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 border-t border-slate-200 bg-slate-50 px-4 py-12 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-slate-600 dark:text-slate-400">{tx("landing_footer_contact", "Contact")}</p>
          <a
            href={`mailto:${tx("contact_email", "info@machin.pro")}`}
            className="mt-2 inline-flex min-h-[44px] items-center text-lg font-semibold text-[#1a4f5e] dark:text-teal-400 hover:underline"
          >
            {tx("contact_email", "info@machin.pro")}
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2">
                <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-9 w-9" sizes="36px" />
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
