"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useLandingLocale, htmlLangForLanguage } from "@/hooks/useLandingLocale";
import { COUNTRY_CONFIG } from "@/lib/countryConfig";
import { LANGUAGES } from "@/lib/i18n";
import type { Language } from "@/types/shared";

const COMPANY_TYPE_VALUES = ["construction", "engineering", "architecture", "other"] as const;
type CompanyTypeValue = (typeof COMPANY_TYPE_VALUES)[number];

function companyTypeTxKey(v: CompanyTypeValue): string {
  const m: Record<CompanyTypeValue, string> = {
    construction: "beta_company_construction",
    engineering: "beta_company_engineering",
    architecture: "beta_company_architecture",
    other: "beta_company_other",
  };
  return m[v];
}

export default function BetaFounderRequestPage() {
  const { language, setLanguage, tx } = useLandingLocale();
  const [dark, setDark] = useState(false);
  const [navSolid, setNavSolid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [companyType, setCompanyType] = useState<CompanyTypeValue | "">("");
  const [message, setMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const countries = useMemo(
    () => Object.values(COUNTRY_CONFIG).sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  useEffect(() => {
    document.documentElement.lang = htmlLangForLanguage(language);
  }, [language]);

  useEffect(() => {
    const t = tx("beta_title", "Apply for Beta Founder access");
    document.title = `${t} · MachinPro`;
  }, [tx]);

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
          <Link href="/landing" className="flex min-h-[44px] items-center gap-2">
            <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-10 w-10" sizes="40px" />
            <BrandWordmark tone={navSolid ? "onLight" : "onDark"} className="text-lg font-bold tracking-tight" />
          </Link>
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
              aria-label={tx("landing_theme_toggle", "Theme")}
            >
              {dark ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </header>

      <main className="bg-gradient-to-b from-[#0f3a45] via-[#1a4f5e] to-[#134e5e] px-4 py-10 dark:from-[#051a1f] dark:via-[#0c2f38] dark:to-[#0f3a45] sm:py-16 min-[1280px]:py-20">
        <div className="mx-auto w-full max-w-lg min-[768px]:max-w-xl min-[1280px]:max-w-xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex justify-center overflow-hidden rounded-2xl">
              <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-20 w-20 sm:h-24 sm:w-24" sizes="96px" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl min-[1280px]:text-4xl">
              {tx("beta_title", "Apply for Beta Founder access")}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-teal-100/95 sm:text-base">
              {tx("beta_subtitle", "Only 20 spots available · Full free access during beta")}
            </p>
            <Link
              href="/landing#beta-founders"
              className="mt-4 text-sm font-medium text-amber-200/95 underline decoration-amber-200/50 underline-offset-2 hover:text-amber-100"
            >
              {tx("beta_back", "Back to MachinPro")}
            </Link>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-900/45 p-5 shadow-2xl backdrop-blur-sm sm:p-8 dark:bg-slate-950/55">
            {success ? (
              <div className="py-6 text-center sm:py-8">
                <p className="text-lg font-semibold text-emerald-300 sm:text-xl">{tx("beta_success", "")}</p>
                <Link
                  href="/landing"
                  className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  {tx("beta_back", "Back to MachinPro")}
                </Link>
              </div>
            ) : (
              <form
                className="space-y-4 sm:space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!privacyAccepted || !companyType) return;
                  setSubmitting(true);
                  setError(false);
                  void fetch("/api/beta-request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: name.trim(),
                      email: email.trim().toLowerCase(),
                      country: country.trim(),
                      companyType,
                      message: message.trim() || null,
                      privacyAccepted: true,
                      locale: language,
                    }),
                  })
                    .then(async (res) => {
                      if (!res.ok) throw new Error();
                      setSuccess(true);
                    })
                    .catch(() => setError(true))
                    .finally(() => setSubmitting(false));
                }}
              >
                <div>
                  <label className="block text-xs font-medium text-teal-100/90 sm:text-sm">
                    {tx("beta_form_name", "Full name")} <span className="text-amber-200">*</span>
                  </label>
                  <input
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full min-h-[44px] rounded-lg border border-white/20 bg-white/95 px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-teal-100/90 sm:text-sm">
                    {tx("beta_form_email", "Email")} <span className="text-amber-200">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full min-h-[44px] rounded-lg border border-white/20 bg-white/95 px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-teal-100/90 sm:text-sm">
                    {tx("beta_form_country", "Country")} <span className="text-amber-200">*</span>
                  </label>
                  <select
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1.5 w-full min-h-[44px] rounded-lg border border-white/20 bg-white/95 px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">{tx("beta_form_country_ph", "Select a country")}</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-teal-100/90 sm:text-sm">
                    {tx("beta_form_company_type", "Company type")} <span className="text-amber-200">*</span>
                  </label>
                  <select
                    required
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value as CompanyTypeValue)}
                    className="mt-1.5 w-full min-h-[44px] rounded-lg border border-white/20 bg-white/95 px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">{tx("beta_form_company_type_ph", "Select")}</option>
                    {COMPANY_TYPE_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {tx(companyTypeTxKey(v), v)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-teal-100/90 sm:text-sm">
                    {tx("beta_form_message", "Message (optional)")}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="mt-1.5 w-full resize-y rounded-lg border border-white/20 bg-white/95 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    placeholder={tx("beta_form_message_ph", "")}
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    required
                    className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 text-[#f97316] focus:ring-[#f97316]"
                  />
                  <span className="text-sm leading-relaxed text-teal-50">
                    {tx("beta_form_privacy_before", "I have read and accept the ")}{" "}
                    <Link
                      href="/legal/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-amber-200 underline decoration-amber-200/40 underline-offset-2 hover:text-amber-100"
                    >
                      {tx("beta_form_privacy_link", "privacy policy")}
                    </Link>
                    {tx("beta_form_privacy_after", "")}
                    <span className="text-amber-200"> *</span>
                  </span>
                </label>

                {error ? (
                  <p className="text-sm font-medium text-red-300">{tx("beta_form_error", "Could not submit. Please try again.")}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] rounded-xl bg-[#f97316] px-6 text-base font-semibold text-white shadow-lg shadow-orange-900/25 hover:bg-orange-600 disabled:opacity-50 sm:min-h-[52px]"
                >
                  {submitting ? tx("beta_form_submitting", "Sending…") : tx("beta_form_submit", "Submit request")}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
