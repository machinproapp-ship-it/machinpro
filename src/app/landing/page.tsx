"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";

const LandingPwaInstallBar = dynamic(
  () => import("@/components/LandingPwaInstallBar").then((m) => m.LandingPwaInstallBar),
  { ssr: false }
);
import { BrandWordmark, TextWithBrandMarks } from "@/components/BrandWordmark";
import { LandingLanguageSelect } from "@/components/LandingLanguageSelect";
import {
  ArrowLeftRight,
  BarChart2,
  Bell,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  GraduationCap,
  HardHat,
  History,
  LayoutDashboard,
  Package,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useLandingLocale, htmlLangForLanguage } from "@/hooks/useLandingLocale";
import { resolveRegionTier, type GeoDetect } from "@/lib/geoTier";
import type { BillingPeriod } from "@/lib/stripe";
import { usePPPPricing } from "@/hooks/usePPPPricing";
import { PricingPlansPublicSection } from "@/components/PricingPlansPublic";
import { PppLandingFooterBar } from "@/components/PppLandingFooter";

type TxFn = (key: string, fallback: string) => string;

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

function HeroDashboardMockup({ tx }: { tx: TxFn }) {
  const kpis = [
    { n: 12, emoji: "🏗️", labelKey: "landing_mock_kpi_projects" },
    { n: 48, emoji: "👷", labelKey: "landing_mock_kpi_employees" },
    { n: 3, emoji: "👤", labelKey: "landing_mock_kpi_visitors" },
    { n: 2, emoji: "⚠️", labelKey: "landing_mock_kpi_risks" },
  ] as const;
  const acts = [
    { emoji: "📋", lineKey: "landing_mock_act1" },
    { emoji: "👤", lineKey: "landing_mock_act2" },
    { emoji: "✅", lineKey: "landing_mock_act3" },
  ] as const;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/25 bg-slate-100 text-left shadow-xl dark:border-slate-600 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-[#0f3a45] px-3 py-2.5 dark:border-slate-700 dark:bg-[#0a3038]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-bold text-white">
            <BrandWordmark tone="onDark" className="inline" />{" "}
            <span className="font-semibold text-teal-100/90">{tx("landing_mock_dashboard", "Dashboard")}</span>
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
              key={k.labelKey}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="sr-only">{tx(k.labelKey, "")}</span>
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
            <span className="truncate">{tx("landing_mock_progress", "")}</span>
            <span className="shrink-0 text-[#f97316]">67%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-[67%] rounded-full bg-gradient-to-r from-[#f97316] to-orange-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {tx("landing_mock_activity", "Recent activity")}
          </p>
          {acts.map((a) => (
            <div
              key={a.lineKey}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a4f5e]/10 text-lg text-[#1a4f5e] dark:bg-teal-900/40 dark:text-teal-300" aria-hidden>
                {a.emoji}
              </span>
              <p className="min-w-0 flex-1 text-xs font-medium text-slate-800 dark:text-slate-100">{tx(a.lineKey, "")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type FeatureRow = { Icon: LucideIcon; titleKey: string; descKey: string };

const LANDING_ICON_BADGE =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f97316]/15 text-[#f97316] dark:bg-orange-500/20 dark:text-orange-400";

const MODULE_ICONS: Record<"central" | "operations" | "schedule" | "logistics" | "security" | "forms", LucideIcon> =
  {
    central: LayoutDashboard,
    operations: Building2,
    schedule: Calendar,
    logistics: Package,
    security: ShieldAlert,
    forms: FileText,
  };

const PERSONALIZE_TITLE_FB: Record<string, string> = {
  feature_payroll_production: "Payroll & production pay",
  feature_work_orders: "Work orders",
  feature_inventory_qr: "QR inventory",
  feature_training_hub: "Training hub",
  feature_safety_passport: "Safety passport",
  feature_timesheets_approval: "Timesheets with approval",
  feature_offline_mode: "Offline mode",
  feature_push_notifications: "Push notifications",
  feature_inventory_transfers: "Inventory transfers",
  feature_benefit_report: "Benefit report",
};

const PERSONALIZE_DESC_FB: Record<string, string> = {
  feature_payroll_production_desc:
    "Calculate payroll by hours or production units. Export for your accountant.",
  feature_work_orders_desc:
    "Create work orders with unit price catalog. Adjust prices per job site.",
  feature_inventory_qr_desc:
    "Scan materials and tools with QR. Transfer between job sites and warehouse.",
  feature_training_hub_desc: "Manage team training with expiry dates and certificates.",
  feature_safety_passport_desc:
    "Consolidated view of all safety documentation per employee.",
  feature_timesheets_approval_desc: "Supervisor approves hours before payroll.",
  feature_offline_mode_desc: "Fill forms without internet. They sync when back online.",
  feature_push_notifications_desc:
    "Automatic alerts for compliance, low stock and pending forms.",
  feature_inventory_transfers_desc:
    "From warehouse to job site and back. Permanent movement history.",
  feature_benefit_report_desc: "Income vs costs per job site. Real-time margin. Export PDF.",
};

export default function LandingPage() {
  const { language, setLanguage, tx } = useLandingLocale();
  const ppp = usePPPPricing();

  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [dark, setDark] = useState(false);
  const [navSolid, setNavSolid] = useState(false);
  const betaHeadline = useMemo(
    () =>
      `${tx("landing_beta_open", "Beta privada abierta")} — ${tx(
        "landing_beta_spots",
        "Plazas limitadas disponibles"
      )}`,
    [tx]
  );

  const geoDetect = useMemo((): GeoDetect | null => {
    if (!ppp.pricingReady) return null;
    const cc = ppp.effectiveCountryCode;
    const { region } = resolveRegionTier(cc);
    return {
      tier: ppp.tier,
      country: cc,
      countryCode: cc,
      region,
      usState: null,
    };
  }, [ppp.pricingReady, ppp.effectiveCountryCode, ppp.tier]);

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
    upsertMeta("property", "og:url", "https://machin.pro/landing");
    upsertMeta("property", "og:image", `${origin}/logo-source.png`);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", `${origin}/logo-source.png`);
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

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const faqRows = useMemo(
    () =>
      [
        [
          "landing_faq_q1",
          "landing_faq_a1",
          "Is there a free trial?",
          "Yes, 14 days. No credit card required.",
        ],
        [
          "landing_faq_q2",
          "landing_faq_a2",
          "How many users can I add?",
          "Essential: 15 users · Operations/Logistics: 30 users · All Inclusive: unlimited.",
        ],
        [
          "landing_faq_q3",
          "landing_faq_a3",
          "Does it work offline?",
          "Yes. Forms and key features work offline and sync automatically when back online.",
        ],
        [
          "landing_faq_q4",
          "landing_faq_a4",
          "Is my data secure?",
          "Hosted on Supabase with row-level security. GDPR and PIPEDA compliant.",
        ],
        [
          "landing_faq_q5",
          "landing_faq_a5",
          "Can I cancel anytime?",
          "Yes. No contracts, no cancellation fees.",
        ],
        [
          "landing_faq_q6",
          "landing_faq_a6",
          "What languages are supported?",
          "21 languages including English, Spanish, French, German, Italian, Portuguese and more.",
        ],
      ] as const,
    []
  );

  const features = useMemo(
    (): FeatureRow[] => [
      { Icon: DollarSign, titleKey: "feature_payroll_production", descKey: "feature_payroll_production_desc" },
      { Icon: ClipboardList, titleKey: "feature_work_orders", descKey: "feature_work_orders_desc" },
      { Icon: QrCode, titleKey: "feature_inventory_qr", descKey: "feature_inventory_qr_desc" },
      { Icon: GraduationCap, titleKey: "feature_training_hub", descKey: "feature_training_hub_desc" },
      { Icon: ShieldCheck, titleKey: "feature_safety_passport", descKey: "feature_safety_passport_desc" },
      { Icon: Clock, titleKey: "feature_timesheets_approval", descKey: "feature_timesheets_approval_desc" },
      { Icon: WifiOff, titleKey: "feature_offline_mode", descKey: "feature_offline_mode_desc" },
      { Icon: Bell, titleKey: "feature_push_notifications", descKey: "feature_push_notifications_desc" },
      { Icon: ArrowLeftRight, titleKey: "feature_inventory_transfers", descKey: "feature_inventory_transfers_desc" },
      { Icon: TrendingUp, titleKey: "feature_benefit_report", descKey: "feature_benefit_report_desc" },
    ],
    []
  );

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
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
            <BrandWordmark tone={navSolid ? "onLight" : "onDark"} className="text-lg font-bold tracking-tight" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollToId("caracteristicas")}
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
            <button
              type="button"
              onClick={() => scrollToId("beta-founders")}
              className={`min-h-[44px] px-3 text-sm font-medium rounded-lg transition-colors ${
                navSolid
                  ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              {tx("beta_founders_nav", "Beta Founders")}
            </button>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <LandingLanguageSelect
              value={language}
              onChange={setLanguage}
              navSolid={navSolid}
              ariaLabel={tx("landing_lang_select", "Language")}
            />
            <button
              type="button"
              onClick={toggleDark}
              className={`min-h-[44px] min-w-[44px] rounded-lg border text-sm font-medium ${
                navSolid
                  ? "border-slate-300 text-slate-800 dark:border-slate-600 dark:text-slate-200"
                  : "border-white/30 text-white"
              }`}
              aria-label={tx("landing_theme_toggle", "Theme")}
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
              {tx("landing_nav_start", tx("landing_cta_start", "Start free 14 days"))}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f3a45] via-[#1a4f5e] to-[#134e5e] dark:from-[#051a1f] dark:via-[#0c2f38] dark:to-[#0f3a45] px-4 pb-16 pt-10 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex justify-center overflow-hidden rounded-2xl">
                <BrandLogoImage
                  src="/logo-source.png"
                  alt=""
                  boxClassName="h-24 w-24"
                  sizes="96px"
                  priority
                />
              </div>
              <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
                {tx("landing_hero_title", "Professional management for construction companies.")}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-teal-100/95 sm:text-xl">
                {tx(
                  "landing_hero_subtitle_full",
                  "People, projects, schedule, logistics, safety, forms and payroll. All from your phone."
                )}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Link
                  href="/register"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-900/20 hover:bg-orange-600 transition-colors"
                >
                  {tx("landing_cta_start", "Start free 14 days")}
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-[#b8860b] bg-transparent px-6 py-3 text-base font-semibold text-[#f6e27a] hover:bg-[#b8860b]/10 transition-colors"
                >
                  {tx("landing_cta_demo", "View demo")}
                </Link>
              </div>
              <p className="mt-4 max-w-2xl text-center text-xs text-teal-200/85 dark:text-teal-200/70 sm:text-sm">
                {tx("landing_availability", tx("landing_countries_languages", ""))}
              </p>
              <p className="mt-2 max-w-2xl text-center text-[11px] text-teal-200/75 dark:text-teal-200/60 sm:text-xs">
                {tx("landing_currencies_badge", "CAD · USD · MXN · EUR · GBP · AUD · NZD")}
              </p>
            </div>
          </FadeSection>
          <FadeSection className="mt-12">
            <div className="relative mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/40 p-2 shadow-2xl backdrop-blur">
              <HeroDashboardMockup tx={tx} />
            </div>
          </FadeSection>
        </div>
      </section>

      <section
        id="beta-founders"
        className="scroll-mt-24 border-t border-white/10 bg-gradient-to-b from-[#0f3a45] to-[#134e5e] px-4 py-16 dark:from-[#051a1f] dark:to-[#0c2f38] sm:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl space-y-4 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  {tx("beta_founders_title", "Beta Founders Program")}
                </h2>
                <p className="text-lg font-semibold text-amber-200/95">{betaHeadline}</p>
                <p className="text-base font-semibold text-white/95">{tx("landing_beta_social_proof", "")}</p>
                <p className="text-sm text-teal-100/85">{tx("landing_beta_regions", tx("landing_beta_countries", ""))}</p>
                <p className="text-sm leading-relaxed text-teal-100/90 sm:text-base">
                  {tx("beta_founders_benefit", "")}
                </p>
                <Link
                  href="/beta"
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#f97316] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-orange-900/25 hover:bg-orange-600 transition-colors sm:w-auto"
                >
                  {tx("beta_founders_cta", "Request beta access")}
                </Link>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-left text-teal-50 shadow-xl backdrop-blur-sm lg:max-w-md">
                <p className="text-sm font-medium">{betaHeadline}</p>
                <p className="mt-2 text-xs leading-relaxed text-teal-100/85">
                  {tx("beta_founders_card_details", "")}
                </p>
              </div>
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="caracteristicas" className="scroll-mt-24 bg-white dark:bg-slate-950 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              <TextWithBrandMarks
                text={tx("landing_features_title", "Make MachinPro yours.")}
                tone={dark ? "onDark" : "onLight"}
                className="contents"
              />
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.titleKey}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <span className={LANDING_ICON_BADGE} aria-hidden>
                    <f.Icon className="h-7 w-7" strokeWidth={2} />
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
                    {tx(f.titleKey, PERSONALIZE_TITLE_FB[f.titleKey] ?? "")}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {tx(f.descKey, PERSONALIZE_DESC_FB[f.descKey] ?? "")}
                  </p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <section
        id="casos-uso"
        className="scroll-mt-24 border-y border-slate-200/80 bg-[#e8f1f3] px-4 py-16 dark:border-slate-800 dark:bg-slate-950/90 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_usecase_title", "")}
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 min-w-0 md:grid-cols-3">
              {(
                [
                  { Icon: HardHat, titleKey: "landing_usecase_contractor_title", descKey: "landing_usecase_contractor_desc", featKey: "landing_usecase_contractor_features" },
                  {
                    Icon: ClipboardCheck,
                    titleKey: "landing_usecase_sitemanager_title",
                    descKey: "landing_usecase_sitemanager_desc",
                    featKey: "landing_usecase_sitemanager_features",
                  },
                  { Icon: BarChart2, titleKey: "landing_usecase_owner_title", descKey: "landing_usecase_owner_desc", featKey: "landing_usecase_owner_features" },
                ] as const
              ).map((c) => (
                <div
                  key={c.titleKey}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90"
                >
                  <span className={LANDING_ICON_BADGE} aria-hidden>
                    <c.Icon className="h-7 w-7" strokeWidth={2} />
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{tx(c.titleKey, "")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{tx(c.descKey, "")}</p>
                  <p className="mt-4 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-500">
                    {tx(c.featKey, "")}
                  </p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <section
        id="logistica-landing"
        className="scroll-mt-24 bg-white dark:bg-slate-950 px-4 py-16 sm:py-24 border-y border-slate-200 dark:border-slate-800"
      >
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_logistics_section_title", "")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              {tx("landing_logistics_section_subtitle", "")}
            </p>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {(
                [
                  { k: "landing_logistics_qr", Icon: QrCode },
                  { k: "landing_logistics_transfer", Icon: ArrowLeftRight },
                  { k: "landing_logistics_history", Icon: History },
                ] as const
              ).map((item) => (
                <div
                  key={item.k}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <span className={LANDING_ICON_BADGE} aria-hidden>
                    <item.Icon className="h-7 w-7" strokeWidth={2} />
                  </span>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
                    {tx(item.k, "")}
                  </p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 bg-slate-100 dark:bg-slate-900/80 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <FadeSection>
            <PricingPlansPublicSection
              tx={tx}
              period={period}
              onPeriodChange={setPeriod}
              ppp={ppp}
              variant="landing"
            />
          </FadeSection>
        </div>
      </section>

      <section
        id="landing-features-all"
        className="scroll-mt-24 bg-slate-100 dark:bg-slate-900/70 px-4 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_features_heading", "")}
            </h2>
            <div className="mt-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {(["central", "operations", "schedule", "logistics", "security", "forms"] as const).map((id) => {
                const ModIcon = MODULE_ICONS[id];
                return (
                <div
                  key={id}
                  className="flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <span className={LANDING_ICON_BADGE} aria-hidden>
                      <ModIcon className="h-7 w-7" strokeWidth={2} />
                    </span>
                    <h3 className="text-base font-semibold leading-snug text-[#1a4f5e] dark:text-teal-300">
                    {tx(`landing_features_module_${id}`, "")}
                  </h3>
                  </div>
                  <ul className="mt-3 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {(tx(`landing_features_lines_${id}`, "") || "")
                      .split("\n")
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={`${id}-${i}`} className="flex gap-2 leading-snug">
                          <span className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden>
                            ·
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              );
              })}
            </div>
          </FadeSection>
        </div>
      </section>

      <section
        id="landing-countries"
        className="scroll-mt-24 border-y border-slate-200 bg-white px-4 py-12 dark:border-slate-800 dark:bg-slate-950 sm:py-14"
      >
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
              {tx("landing_countries_strip_title", "Available for teams in")}
            </h2>
            <div className="mt-4 flex max-w-full gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] sm:justify-center">
              <p className="whitespace-nowrap px-2 text-center text-sm text-slate-600 dark:text-slate-400 sm:whitespace-normal">
                {tx(
                  "landing_countries_strip_line",
                  "🇨🇦 Canada · 🇺🇸 USA · 🇪🇸 Spain · 🇲🇽 Mexico · 🇬🇧 UK · 🇩🇪 Germany · 🇦🇺 Australia · 🇳🇿 New Zealand"
                )}
              </p>
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="landing-faq" className="scroll-mt-24 border-t border-slate-200 bg-white px-4 py-14 dark:border-slate-800 dark:bg-slate-950 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_faq_title", "FAQ")}
            </h2>
            <div className="mt-8 space-y-3">
              {faqRows.map(([qk, ak, qFb, aFb]) => (
                <details
                  key={qk}
                  className="group rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60 open:ring-1 open:ring-orange-200/80 dark:open:ring-orange-900/40"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1 pr-2 text-left">{tx(qk, qFb)}</span>
                    <span className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <p className="border-t border-slate-200 px-4 pb-4 pt-2 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    {tx(ak, aFb)}
                  </p>
                </details>
              ))}
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
          <PppLandingFooterBar tx={tx} ppp={ppp} />
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2">
                <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-9 w-9" sizes="36px" />
                <BrandWordmark tone="onLight" className="text-lg font-bold tracking-tight" />
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
                  onClick={() => scrollToId("caracteristicas")}
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
                <Link
                  href="/help"
                  className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_help", "Help center")}
                </Link>
                <Link
                  href="/about"
                  className="block min-h-[44px] py-2 text-left text-slate-600 hover:text-[#1a4f5e] dark:text-slate-400 dark:hover:text-teal-400"
                >
                  {tx("landing_footer_about", "About MachinPro")}
                </Link>
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
              <TextWithBrandMarks
                text={tx("landing_footer_copyright", "© 2026 MachinPro · machin.pro")}
                tone="inherit"
                className="inline"
              />
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

      <LandingPwaInstallBar tx={tx} dark={dark} />
    </div>
  );
}
