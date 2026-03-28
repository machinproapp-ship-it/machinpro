"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { COUNTRY_CONFIG } from "@/lib/countryConfig";
import { registerTaxLabelKey } from "@/lib/registerTaxField";
import { ALL_TRANSLATIONS, loadLocale, isLazyLocale, type Language } from "@/lib/i18n";
import type { InvitationPlan } from "@/types/invitation";

const TRANSLATIONS = ALL_TRANSLATIONS;

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
      const s = localStorage.getItem("machinpro_language");
      if (s && typeof s === "string") setLanguage(s as Language);
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

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 dark:bg-slate-900/90 dark:border-slate-700 p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-20 w-20 items-center justify-center">
            <Image
              src={logoSrc}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
              priority
              onError={() => setLogoSrc("/icons/icon-192x192.png")}
            />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{l("register_title", "Create account")}</h1>
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

            {formError ? <p className="text-sm text-red-600 dark:text-red-400 text-center">{formError}</p> : null}

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
