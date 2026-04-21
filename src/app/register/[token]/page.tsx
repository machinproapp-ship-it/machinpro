"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { COUNTRY_CONFIG } from "@/lib/countryConfig";
import { registerTaxLabelKey } from "@/lib/registerTaxField";
import {
  ALL_TRANSLATIONS,
  loadLocale,
  isLazyLocale,
  LANGUAGES,
  STATIC_MAIN_LOCALES,
  type Language,
} from "@/lib/i18n";
import type { InvitationPlan } from "@/types/invitation";

const TRANSLATIONS = ALL_TRANSLATIONS;

const BASE_LANG_OPTIONS = LANGUAGES.filter((x) => STATIC_MAIN_LOCALES.has(x.code as Language));

type VerifyOk = {
  valid: true;
  invitation: {
    email: string;
    company_name: string;
    plan: InvitationPlan;
    message: string | null;
    expires_at: string;
  };
};

export default function RegisterInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";

  const [language, setLanguage] = useState<Language>("es");
  const [lazyLocaleT, setLazyLocaleT] = useState<Record<string, string> | null>(null);
  const lazyLocaleCacheRef = useRef<Map<string, Record<string, string>>>(new Map());

  useEffect(() => {
    try {
      const a = localStorage.getItem("machinpro_lang");
      const b = localStorage.getItem("machinpro_language");
      const s = (typeof a === "string" && a.trim() ? a : b) ?? "";
      if (s && typeof s === "string" && STATIC_MAIN_LOCALES.has(s as Language)) {
        setLanguage(s as Language);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistLanguage = useCallback((code: Language) => {
    if (!STATIC_MAIN_LOCALES.has(code)) return;
    setLanguage(code);
    try {
      localStorage.setItem("machinpro_language", code);
      localStorage.setItem("machinpro_lang", code);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isLazyLocale(language)) {
      setLazyLocaleT(null);
      return;
    }
    const cached = lazyLocaleCacheRef.current.get(language);
    if (cached) {
      setLazyLocaleT(cached);
      return;
    }
    let cancelled = false;
    setLazyLocaleT(null);
    void loadLocale(language).then((merged) => {
      if (!cancelled) {
        lazyLocaleCacheRef.current.set(language, merged);
        setLazyLocaleT(merged);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const t = useMemo(() => {
    if (!isLazyLocale(language)) {
      return (TRANSLATIONS[language] ?? TRANSLATIONS["en"]) as Record<string, string>;
    }
    return (lazyLocaleT ?? TRANSLATIONS["en"]) as Record<string, string>;
  }, [language, lazyLocaleT]);

  const l = useCallback((k: string, fb: string) => t[k] ?? fb, [t]);

  const [dark, setDark] = useState(false);
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

  const [verifyLoading, setVerifyLoading] = useState(true);
  const [verifyOk, setVerifyOk] = useState<VerifyOk | null>(null);
  const [verifyReason, setVerifyReason] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("CA");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const countries = useMemo(
    () => Object.values(COUNTRY_CONFIG).sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const termsBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
      : "https://machin.pro") + "/legal/terms";

  useEffect(() => {
    if (!token) {
      setVerifyLoading(false);
      setVerifyReason("missing_token");
      return;
    }
    let cancelled = false;
    setVerifyLoading(true);
    void fetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j: unknown) => {
        if (cancelled) return;
        const o = j as { valid?: boolean; reason?: string; invitation?: VerifyOk["invitation"] };
        if (o.valid && o.invitation) {
          setVerifyOk({ valid: true, invitation: o.invitation });
          setCompanyName(o.invitation.company_name);
          setEmail(o.invitation.email);
        } else {
          setVerifyReason(o.reason ?? "not_found");
        }
      })
      .catch(() => {
        if (!cancelled) setVerifyReason("server_error");
      })
      .finally(() => {
        if (!cancelled) setVerifyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async () => {
    setFormError(null);
    if (!verifyOk) return;
    if (password !== confirmPassword) {
      setFormError(l("register_password_mismatch", "Passwords do not match"));
      return;
    }
    if (password.length < 8) {
      setFormError(l("register_error_password_short", "Password too short"));
      return;
    }
    if (!terms) {
      setFormError(l("register_terms_required", "Accept the terms to continue"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invitations/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          password,
          companyName,
          fullName,
          country,
          phone,
          taxId: taxId.trim() || null,
          termsAccepted: terms,
          locale:
            typeof navigator !== "undefined"
              ? navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage
              : undefined,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(j.error ?? l("register_error_generic", "Something went wrong"));
        return;
      }
      if (!supabase) {
        setFormError(l("register_error_generic", "Something went wrong"));
        return;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) {
        setFormError(signErr.message);
        return;
      }
      router.replace("/");
    } catch {
      setFormError(l("register_error_generic", "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  };

  const invalidMessage =
    verifyReason === "expired"
      ? l("register_expired_token", "This invitation has expired.")
      : verifyReason === "accepted"
        ? l("register_invalid_token", "This invitation is no longer valid.")
        : l("register_invalid_token", "This invitation is no longer valid.");

  const [logoSrc, setLogoSrc] = useState("/logo-source.png");

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 bg-gradient-to-b from-[#0f3a45] via-[#134e5e] to-[#1a4f5e] dark:from-[#071a20] dark:via-[#0c2f38] dark:to-[#0f3a45]">
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleDark}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
          aria-label={dark ? "Light mode" : "Dark mode"}
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 dark:bg-slate-900/90 dark:border-slate-700 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="mb-5 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {l("select_language", "Select your language")}
            </p>
            <div
              className="flex flex-wrap gap-2 sm:justify-end"
              role="group"
              aria-label={l("select_language", "Select your language")}
            >
              {BASE_LANG_OPTIONS.map((opt) => {
                const active = language === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    title={opt.label}
                    onClick={() => persistLanguage(opt.code as Language)}
                    className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border px-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/50 dark:text-amber-100"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span aria-hidden>{opt.flag}</span>
                    <span className="uppercase">{opt.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex justify-center">
            <BrandLogoImage
              src={logoSrc}
              alt=""
              boxClassName="h-20 w-20"
              sizes="80px"
              priority
              onError={() => setLogoSrc("/icons/icon-192x192.png")}
            />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            <TextWithBrandMarks
              text={
                verifyOk
                  ? l("accept_invitation_title", "Accept your invitation")
                  : l("register_title", "Create account")
              }
              tone="onLight"
              className="contents"
            />
          </h1>
          {verifyOk ? (
            <p className="mt-2 max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
              {l("accept_invitation_subtitle", "Set up your account to join {company}").replace(
                /\{company\}/g,
                verifyOk.invitation.company_name
              )}
            </p>
          ) : null}
        </div>

        {verifyLoading ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">{l("toast_loading", "…")}</p>
        ) : !verifyOk ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{invalidMessage}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <a
                href={`mailto:${l("contact_email", "info@machin.pro")}`}
                className="font-medium text-amber-700 dark:text-amber-400 underline"
              >
                {l("register_contact_support", "Contact support")}
              </a>
            </p>
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 w-full"
            >
              {l("register_go_home", "Home")}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {verifyOk.invitation.message ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 rounded-lg border border-zinc-200 dark:border-zinc-600 p-3">
                {verifyOk.invitation.message}
              </p>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("register_company", "Company")}
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("register_admin_name", "Full name")}
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("invite_email", "Email")}
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-slate-900 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("register_password", "Password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("register_confirm_password", "Confirm password")}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("register_country", "Country")}
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l("register_phone", "Phone")}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {l(registerTaxLabelKey(country), l("register_tax_id", "Tax ID (optional)"))}
              </label>
              <input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-zinc-400 accent-amber-600 shrink-0"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {l("register_terms", "I accept the terms and conditions")}{" "}
                <a
                  href={termsBase}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 dark:text-amber-400 underline font-medium"
                >
                  {l("register_terms_link", "Terms")}
                </a>
              </span>
            </label>

            {formError ? (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{String(formError)}</p>
            ) : null}

            <button
              type="button"
              disabled={
                submitting ||
                !companyName.trim() ||
                !fullName.trim() ||
                !password ||
                !confirmPassword ||
                !terms
              }
              onClick={() => void onSubmit()}
              className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm min-h-[44px]"
            >
              {submitting ? l("toast_loading", "…") : l("register_submit", "Create account")}
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 text-sm font-medium tracking-wide text-white/80 dark:text-teal-200/80">
        {l("login_brand_footer", "machin.pro")}
      </p>
    </div>
  );
}
