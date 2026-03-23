"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Apple, PlayCircle, Star } from "lucide-react";
import { useAppLocale } from "@/hooks/useAppLocale";

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

export default function LandingPage() {
  const { language, setLanguage, tx } = useAppLocale();

  const [annual, setAnnual] = useState(false);
  const [dark, setDark] = useState(false);
  const [navSolid, setNavSolid] = useState(false);

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

  const prices = useMemo(() => {
    const m = { starter: 49, pro: 129, enterprise: 299 };
    if (!annual) return m;
    return {
      starter: Math.round(m.starter * 0.8),
      pro: Math.round(m.pro * 0.8),
      enterprise: Math.round(m.enterprise * 0.8),
    };
  }, [annual]);

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const features = useMemo(
    () =>
      [
        {
          titleKey: "landing_feat_projects_title",
          descKey: "landing_feat_projects_desc",
        },
        {
          titleKey: "landing_feat_risks_title",
          descKey: "landing_feat_risks_desc",
        },
        {
          titleKey: "landing_feat_visitors_title",
          descKey: "landing_feat_visitors_desc",
        },
        {
          titleKey: "landing_feat_blueprints_title",
          descKey: "landing_feat_blueprints_desc",
        },
        {
          titleKey: "landing_feat_dashboard_title",
          descKey: "landing_feat_dashboard_desc",
        },
        {
          titleKey: "landing_feat_billing_title",
          descKey: "landing_feat_billing_desc",
        },
      ] as const,
    []
  );

  const testimonials = [1, 2, 3] as const;

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
              <div className="overflow-hidden rounded-xl border border-white/10">
                <Image
                  src="/screenshots/dashboard.png"
                  alt=""
                  width={1200}
                  height={750}
                  className="h-auto w-full object-cover object-top"
                />
              </div>
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
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {tx(f.titleKey, f.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
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
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                      ${prices[key]}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {tx("landing_price_suffix", "/mo")}
                    </span>
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
          </FadeSection>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-950 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <FadeSection>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {tx("landing_testimonials_title", "Testimonials")}
            </h2>
            <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
              {tx("landing_testimonials_coming", "Coming soon")}
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((n) => (
                <div
                  key={n}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1a4f5e] text-sm font-bold text-white"
                      aria-hidden
                    >
                      {tx(`landing_testimonial_${n}_initial`, "?")}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {tx(`landing_testimonial_${n}_name`, "Name")}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tx(`landing_testimonial_${n}_company`, "Company")}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {tx(`landing_testimonial_${n}_text`, "…")}
                  </p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 border-t border-slate-200 bg-slate-50 px-4 py-12 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-slate-600 dark:text-slate-400">{tx("landing_footer_contact", "Contact")}</p>
          <a
            href="mailto:support@machin.pro"
            className="mt-2 inline-flex min-h-[44px] items-center text-lg font-semibold text-[#1a4f5e] dark:text-teal-400 hover:underline"
          >
            support@machin.pro
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
