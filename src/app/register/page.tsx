"use client";

import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppLocale } from "@/hooks/useAppLocale";
import { supabase, type AuthGetSessionResult } from "@/lib/supabase";
import { LANGUAGES } from "@/lib/i18n";
import { REGIONAL_COUNTRIES } from "@/lib/regionalCountries";
import type { Language } from "@/types/shared";

export default function RegisterPublicPage() {
  const { language, setLanguage, tx } = useAppLocale();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [signupCountry, setSignupCountry] = useState("US");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successCheckEmail, setSuccessCheckEmail] = useState(false);

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const title = tx("register_free_title", "Create your account");
    document.title = `${title} · MachinPro`;
  }, [tx]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then((result: AuthGetSessionResult) => {
      if (cancelled) return;
      if (result.data.session) router.replace("/");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

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

  const termsUrl =
    (typeof window !== "undefined" ? window.location.origin : "https://machin.pro") + "/legal/terms";

  const submit = async () => {
    setFormError(null);
    if (!supabase) return;
    if (password.length < 8) {
      setFormError(tx("register_free_error_password_short", "Password must be at least 8 characters."));
      return;
    }
    if (password !== confirmPassword) {
      setFormError(tx("register_free_error_password_match", "Passwords do not match."));
      return;
    }
    if (!termsAccepted) return;

    setSubmitting(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: origin ? `${origin}/` : undefined,
        data: {
          full_name: fullName.trim(),
          company_name: companyName.trim(),
          registration_source: "free",
          signup_country: signupCountry.trim() || "US",
        },
      },
    });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    if (data.session) {
      router.replace("/");
      return;
    }
    setSuccessCheckEmail(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-[#0f3a45] via-[#134e5e] to-[#1a4f5e] dark:from-[#071a20] dark:via-[#0c2f38] dark:to-[#0f3a45]">
      <div className="absolute top-4 right-4 flex flex-wrap items-center justify-end gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="min-h-[44px] max-w-[11rem] rounded-xl border border-white/20 bg-white/10 px-2 text-sm font-medium text-white sm:max-w-[14rem]"
          aria-label={tx("register_free_lang", "Language")}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="text-zinc-900">
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleDark}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20"
          aria-label={tx("landing_theme_toggle", "Theme")}
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 dark:bg-slate-900/90 dark:border-slate-700 p-8 shadow-2xl backdrop-blur-sm space-y-6">
        <div className="flex justify-center">
          <BrandLogoImage
            src="/logo-source.png"
            alt=""
            boxClassName="h-[88px] w-[88px]"
            sizes="88px"
          />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            <TextWithBrandMarks text={tx("register_free_title", "Create your account")} tone="onLight" className="contents" />
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {tx("register_free_subtitle", "14-day trial · Confirm your email to get started")}
          </p>
        </div>

        {successCheckEmail ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {tx("register_free_success_title", "Check your email")}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {tx("register_free_success_body", "We sent you a confirmation link. After confirming, you can sign in and your trial starts automatically.")}
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              {tx("register_free_go_login", "Go to sign in")}
            </Link>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {tx("register_free_name", "Full name")} <span className="text-amber-600">*</span>
              </label>
              <input
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {tx("register_free_email", "Email")} <span className="text-amber-600">*</span>
              </label>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {tx("register_free_company", "Company name")} <span className="text-amber-600">*</span>
              </label>
              <input
                required
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {tx("register_free_country", "Country / region")}
              </label>
              <select
                value={signupCountry}
                onChange={(e) => setSignupCountry(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 min-h-[44px]"
                aria-label={tx("register_free_country", "Country / region")}
              >
                {REGIONAL_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {tx("register_free_password", "Password")} <span className="text-amber-600">*</span>
              </label>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {tx("register_free_password_confirm", "Confirm password")} <span className="text-amber-600">*</span>
              </label>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 min-h-[44px]"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-3">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {tx("register_free_terms_prefix", "I accept the")}{" "}
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-amber-700 dark:text-amber-400 underline"
                >
                  {tx("register_free_terms_link", "terms of service")}
                </a>
                {tx("register_free_terms_suffix", "")}
                <span className="text-amber-600"> *</span>
              </span>
            </label>

            {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] rounded-xl bg-[#f97316] px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? tx("register_free_submitting", "Creating account…") : tx("register_free_submit", "Create account")}
            </button>
          </form>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-600 pt-4">
          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            {tx("register_free_invite_hint", "Were you invited? Open the link in your invitation email.")}
          </p>
          <Link
            href="/beta"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-500/50 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            {tx("register_free_beta_cta", "Apply for Beta Founder benefits")}
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {tx("register_public_login", "Log in")}
          </Link>
          <Link
            href="/landing"
            className="inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {tx("register_public_cta_landing", "Homepage")}
          </Link>
        </div>
      </div>
      <p className="mt-8 text-sm font-medium text-white/80 dark:text-teal-200/80">
        {tx("login_brand_footer", "machin.pro")}
      </p>
    </div>
  );
}
