"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { Check, ChevronLeft } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { Language } from "@/types/shared";
import { CURRENCY_META, type Currency } from "@/lib/i18n";
import { IANA_TIMEZONE_OPTIONS, resolveUserTimezone } from "@/lib/dateUtils";
import { supabase } from "@/lib/supabase";

export type TranslationEntry = Record<string, string>;

const COUNTRY_DEFAULTS: Record<string, { currency: string; measurementSystem: "metric" | "imperial" }> = {
  CA: { currency: "CAD", measurementSystem: "metric" },
  US: { currency: "USD", measurementSystem: "imperial" },
  MX: { currency: "MXN", measurementSystem: "metric" },
  GB: { currency: "GBP", measurementSystem: "imperial" },
  ES: { currency: "EUR", measurementSystem: "metric" },
  FR: { currency: "EUR", measurementSystem: "metric" },
  DE: { currency: "EUR", measurementSystem: "metric" },
  IT: { currency: "EUR", measurementSystem: "metric" },
  PT: { currency: "EUR", measurementSystem: "metric" },
  NL: { currency: "EUR", measurementSystem: "metric" },
  PL: { currency: "PLN", measurementSystem: "metric" },
  SE: { currency: "SEK", measurementSystem: "metric" },
  NO: { currency: "NOK", measurementSystem: "metric" },
  DK: { currency: "DKK", measurementSystem: "metric" },
  CH: { currency: "CHF", measurementSystem: "metric" },
  BE: { currency: "EUR", measurementSystem: "metric" },
  AT: { currency: "EUR", measurementSystem: "metric" },
  IE: { currency: "EUR", measurementSystem: "metric" },
  CZ: { currency: "CZK", measurementSystem: "metric" },
  HU: { currency: "HUF", measurementSystem: "metric" },
  RO: { currency: "RON", measurementSystem: "metric" },
  BG: { currency: "BGN", measurementSystem: "metric" },
  HR: { currency: "HRK", measurementSystem: "metric" },
  GR: { currency: "EUR", measurementSystem: "metric" },
  TR: { currency: "TRY", measurementSystem: "metric" },
  EU: { currency: "EUR", measurementSystem: "metric" },
};

const COUNTRIES = [
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "MX", flag: "🇲🇽", name: "México" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "ES", flag: "🇪🇸", name: "España" },
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "DE", flag: "🇩🇪", name: "Deutschland" },
  { code: "IT", flag: "🇮🇹", name: "Italia" },
  { code: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "NL", flag: "🇳🇱", name: "Nederland" },
  { code: "PL", flag: "🇵🇱", name: "Polska" },
  { code: "SE", flag: "🇸🇪", name: "Sverige" },
  { code: "NO", flag: "🇳🇴", name: "Norge" },
  { code: "DK", flag: "🇩🇰", name: "Danmark" },
  { code: "CH", flag: "🇨🇭", name: "Schweiz" },
  { code: "BE", flag: "🇧🇪", name: "Belgium" },
  { code: "AT", flag: "🇦🇹", name: "Österreich" },
  { code: "IE", flag: "🇮🇪", name: "Ireland" },
  { code: "CZ", flag: "🇨🇿", name: "Česká republika" },
  { code: "HU", flag: "🇭🇺", name: "Magyarország" },
  { code: "RO", flag: "🇷🇴", name: "România" },
  { code: "BG", flag: "🇧🇬", name: "България" },
  { code: "HR", flag: "🇭🇷", name: "Hrvatska" },
  { code: "GR", flag: "🇬🇷", name: "Ελλάδα" },
  { code: "TR", flag: "🇹🇷", name: "Türkiye" },
] as const;

const ONBOARDING_INDUSTRY_OPTIONS = [
  { value: "construction", labelKey: "onboarding_industry_construction" },
  { value: "installation", labelKey: "onboarding_industry_installation" },
  { value: "services", labelKey: "onboarding_industry_services" },
  { value: "manufacturing", labelKey: "onboarding_industry_manufacturing" },
  { value: "other", labelKey: "onboarding_industry_other" },
] as const;

const ONBOARDING_SIZE_OPTIONS = [
  { value: "1-10", labelKey: "onboarding_size_1_10" },
  { value: "11-50", labelKey: "onboarding_size_11_50" },
  { value: "51-200", labelKey: "onboarding_size_51_200" },
  { value: "201+", labelKey: "onboarding_size_201_plus" },
] as const;

const TZ_BY_COUNTRY: Record<string, string> = {
  CA: "America/Toronto",
  US: "America/New_York",
  MX: "America/Mexico_City",
  GB: "Europe/London",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  IT: "Europe/Rome",
  PT: "Europe/Lisbon",
  NL: "Europe/Amsterdam",
  PL: "Europe/Warsaw",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  CH: "Europe/Zurich",
  BE: "Europe/Brussels",
  AT: "Europe/Vienna",
  IE: "Europe/Dublin",
  CZ: "Europe/Prague",
  HU: "Europe/Budapest",
  RO: "Europe/Bucharest",
  BG: "Europe/Sofia",
  HR: "Europe/Zagreb",
  GR: "Europe/Athens",
  TR: "Europe/Istanbul",
};

export interface OnboardingModalProps {
  onComplete: () => void | Promise<void>;
  labels: TranslationEntry;
  session: Session | null;
  companyId: string | null;
  language: Language;
  companyName: string;
  companyCountry: string;
  currency: Currency;
  measurementSystem: "metric" | "imperial";
  logoUrl: string;
  onCompanyNameChange: (v: string) => void;
  onCountryChange: (country: string, defaults?: { currency: string; measurementSystem: "metric" | "imperial" }) => void;
  onCurrencyChange: (c: Currency) => void;
  onMeasurementSystemChange: (v: "metric" | "imperial") => void;
  onLogoUrlChange: (url: string) => void;
  onLogoUpload: () => void;
  /** After creating a project via API, append to app state */
  onProjectCreated: (row: {
    id: string;
    name: string;
    type: string;
    location: string;
    budgetCAD: number;
    spentCAD: number;
    estimatedStart: string;
    estimatedEnd: string;
    archived: boolean;
    assignedEmployeeIds: string[];
  }) => void;
  /** Saved `user_profiles.timezone` when present (onboarding TZ picker default). */
  profileTimeZone?: string | null;
  /** After persisting timezone to user_profiles (step 1). */
  onUserTimezoneSaved?: () => void | Promise<void>;
}

type Phase = "welcome" | "wizard" | "finished";

export function OnboardingModal({
  onComplete,
  labels: t,
  session,
  companyId,
  language,
  companyName,
  companyCountry,
  currency,
  measurementSystem,
  logoUrl,
  onCompanyNameChange,
  onCountryChange,
  onCurrencyChange,
  onMeasurementSystemChange,
  onLogoUrlChange,
  onLogoUpload,
  onProjectCreated,
  profileTimeZone = null,
  onUserTimezoneSaved,
}: OnboardingModalProps) {
  const lx = t as Record<string, string>;
  const [phase, setPhase] = useState<Phase>("welcome");
  const [wizardStep, setWizardStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step1Name, setStep1Name] = useState(companyName);
  const [step1Country, setStep1Country] = useState(companyCountry || "ES");
  const [step1Currency, setStep1Currency] = useState<Currency>(currency);
  const [step1Tz, setStep1Tz] = useState(() => resolveUserTimezone(profileTimeZone));
  const [step1Logo, setStep1Logo] = useState(logoUrl);

  useEffect(() => {
    setStep1Name(companyName);
  }, [companyName]);
  useEffect(() => {
    setStep1Country(companyCountry || "ES");
  }, [companyCountry]);
  useEffect(() => {
    setStep1Currency(currency);
  }, [currency]);
  useEffect(() => {
    setStep1Logo(logoUrl);
  }, [logoUrl]);
  useEffect(() => {
    setStep1Tz(resolveUserTimezone(profileTimeZone));
  }, [profileTimeZone]);

  const [step2Industry, setStep2Industry] = useState("construction");
  const [step2Size, setStep2Size] = useState("");

  const [projName, setProjName] = useState("");
  const [projLocation, setProjLocation] = useState("");
  const [projStart, setProjStart] = useState("");

  const persistTimezone = useCallback((tz: string) => {
    setStep1Tz(tz);
    try {
      localStorage.setItem("machinpro_tz", tz);
    } catch {
      /* ignore */
    }
  }, []);

  const onCountryPick = useCallback(
    (code: string) => {
      setStep1Country(code);
      const d = COUNTRY_DEFAULTS[code];
      if (d) {
        setStep1Currency(d.currency as Currency);
        const tz = TZ_BY_COUNTRY[code];
        if (tz) persistTimezone(tz);
      }
    },
    [persistTimezone]
  );

  const authHeader = useCallback(() => {
    const token = session?.access_token;
    if (!token) return null;
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, [session?.access_token]);

  const goWelcomeToWizard = useCallback(() => {
    setError(null);
    setPhase("wizard");
    setWizardStep(1);
  }, []);

  const skipEntireOnboarding = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  }, [onComplete]);

  const saveStep1AndNext = useCallback(async () => {
    setError(null);
    const name = step1Name.trim();
    if (!name) {
      setError(lx.register_error_generic ?? "Required");
      return;
    }
    if (!companyId) {
      setError(lx.register_error_generic ?? "");
      return;
    }
    const h = authHeader();
    if (!h) return;
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        companyId,
        name,
        country: step1Country,
        currency: step1Currency,
        language,
      };
      if (step1Logo.trim()) patch.logo_url = step1Logo.trim();

      const res = await fetch("/api/onboarding/company", {
        method: "PATCH",
        headers: h,
        body: JSON.stringify(patch),
      });
      const raw = await res.text();
      let j: { error?: string } = {};
      try {
        j = raw ? (JSON.parse(raw) as typeof j) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        setError(j.error ?? lx.register_error_generic ?? "");
        return;
      }

      onCompanyNameChange(name);
      const d = COUNTRY_DEFAULTS[step1Country];
      onCountryChange(step1Country, d);
      if (d) onMeasurementSystemChange(d.measurementSystem);
      onCurrencyChange(step1Currency);
      onLogoUrlChange(step1Logo.trim());
      persistTimezone(step1Tz);
      const uid = session?.user?.id;
      if (uid) {
        try {
          const { error: tzErr } = await supabase
            .from("user_profiles")
            .update({ timezone: step1Tz })
            .eq("id", uid);
          if (tzErr) console.error("[OnboardingModal] user_profiles timezone", tzErr);
          else await onUserTimezoneSaved?.();
        } catch (e) {
          console.error("[OnboardingModal] user_profiles timezone", e);
        }
      }
      setWizardStep(2);
    } finally {
      setBusy(false);
    }
  }, [
    step1Name,
    companyId,
    authHeader,
    step1Country,
    step1Currency,
    language,
    step1Logo,
    lx.register_error_generic,
    onCompanyNameChange,
    onCountryChange,
    onCurrencyChange,
    onMeasurementSystemChange,
    onLogoUrlChange,
    persistTimezone,
    step1Tz,
    session?.user?.id,
    onUserTimezoneSaved,
  ]);

  const saveStep2AndNext = useCallback(async () => {
    setError(null);
    if (!companyId) {
      setError(lx.register_error_generic ?? "");
      return;
    }
    const h = authHeader();
    if (!h) return;
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        companyId,
        industry: step2Industry.trim() || null,
        company_size: step2Size.trim() || null,
      };
      const res = await fetch("/api/onboarding/company", {
        method: "PATCH",
        headers: h,
        body: JSON.stringify(patch),
      });
      const raw = await res.text();
      let j: { error?: string } = {};
      try {
        j = raw ? (JSON.parse(raw) as typeof j) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        setError(j.error ?? lx.register_error_generic ?? "");
        return;
      }
      setWizardStep(3);
    } finally {
      setBusy(false);
    }
  }, [companyId, authHeader, step2Industry, step2Size, lx.register_error_generic]);

  const skipToStep3 = useCallback(() => {
    setError(null);
    setWizardStep(3);
  }, []);

  const createProjectFlow = useCallback(async () => {
    setError(null);
    const name = projName.trim();
    if (!name) {
      setError(lx.register_error_generic ?? "");
      return;
    }
    if (!companyId) return;
    const h = authHeader();
    if (!h) return;
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/project", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          companyId,
          name,
          location: projLocation.trim() || "",
          estimated_start: projStart.trim() || null,
        }),
      });
      const raw = await res.text();
      let j: { error?: string; id?: string } = {};
      try {
        j = raw ? (JSON.parse(raw) as typeof j) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok || !j.id) {
        setError(j.error ?? lx.register_error_generic ?? "");
        return;
      }
      const id = j.id;
      onProjectCreated({
        id,
        name,
        type: "residential",
        location: projLocation.trim(),
        budgetCAD: 0,
        spentCAD: 0,
        estimatedStart: projStart.trim() || "",
        estimatedEnd: "",
        archived: false,
        assignedEmployeeIds: [],
      });
      setPhase("finished");
    } finally {
      setBusy(false);
    }
  }, [projName, companyId, authHeader, projLocation, projStart, lx.register_error_generic, onProjectCreated]);

  const finishSkipProject = useCallback(() => {
    setError(null);
    setPhase("finished");
  }, []);

  const finalizeOnboarding = useCallback(async () => {
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  }, [onComplete]);

  const openCloudinaryForStep1 = useCallback(() => {
    onLogoUpload();
  }, [onLogoUpload]);

  const stepTitle = (n: number) =>
    n === 1
      ? (lx.onboarding_step1_title ?? "")
      : n === 2
        ? (lx.onboarding_step2_title ?? "")
        : (lx.onboarding_step3_title ?? "");

  const currencies = useMemo(() => Object.keys(CURRENCY_META) as Currency[], []);

  const benefitLines = useMemo(
    () => [lx.onboarding_benefit_1, lx.onboarding_benefit_2, lx.onboarding_benefit_3],
    [lx.onboarding_benefit_1, lx.onboarding_benefit_2, lx.onboarding_benefit_3]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4 sm:py-6">
      <div
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:my-auto sm:max-h-[min(92dvh,720px)] sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="onboarding-title"
      >
        {phase === "welcome" ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 pt-8 pb-8 text-center sm:px-6 space-y-5">
              <div className="flex justify-center">
                <BrandLogoImage
                  src="/logo-source.png"
                  alt=""
                  boxClassName="h-16 w-16 sm:h-[72px] sm:w-[72px]"
                  sizes="72px"
                  priority
                  scale={1.2}
                />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl">
                <TextWithBrandMarks
                  text={lx.onboarding_welcome ?? lx.onboarding_welcome_title ?? ""}
                  tone="onLight"
                  className="contents"
                />
              </h2>
              {companyName.trim() ? (
                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200 max-w-sm mx-auto">
                  {companyName.trim()}
                </p>
              ) : null}
              <p className="text-base leading-snug text-zinc-700 dark:text-zinc-300 max-w-md mx-auto px-1">
                {lx.onboarding_welcome_subtitle ?? ""}
              </p>
              <ul className="mx-auto max-w-sm space-y-3 pt-1 text-left">
                {benefitLines.map((text, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <Check
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    <span>{text ?? ""}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={goWelcomeToWizard}
                className="mt-2 w-full min-h-[48px] rounded-xl bg-amber-600 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-amber-900/25 ring-2 ring-amber-400/45 transition-all hover:bg-amber-500 hover:ring-amber-300/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:shadow-amber-950/40 dark:ring-amber-500/35 dark:focus-visible:ring-offset-slate-900"
              >
                {lx.onboarding_start ?? ""}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void skipEntireOnboarding()}
                className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {lx.onboarding_skip_all ?? lx.onboarding_skip ?? ""}
              </button>
            </div>
          </div>
        ) : phase === "wizard" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-zinc-200 dark:border-slate-700 px-4 py-3">
              <p className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {lx.onboarding_step ?? ""} {wizardStep} {lx.onboarding_of ?? ""} 3
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                {[1, 2, 3].map((n) => {
                  const done = wizardStep > n;
                  const active = wizardStep === n;
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <div
                        className={`flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-sm font-semibold ${
                          active
                            ? "bg-amber-600 text-white ring-2 ring-amber-400/60"
                            : done
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-200 text-zinc-600 dark:bg-slate-700 dark:text-zinc-300"
                        }`}
                      >
                        {done ? <Check className="h-5 w-5" aria-hidden /> : n}
                      </div>
                      {n < 3 ? (
                        <div
                          className={`h-0.5 w-6 rounded ${wizardStep > n ? "bg-emerald-600" : "bg-zinc-200 dark:bg-slate-700"}`}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void skipEntireOnboarding()}
                  className="text-xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400 disabled:opacity-50"
                >
                  {lx.onboarding_skip_all ?? ""}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{stepTitle(wizardStep)}</h3>
                {wizardStep === 2 ? (
                  <span className="inline-flex min-h-[28px] items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-slate-700 dark:text-zinc-300">
                    {lx.onboarding_step2_optional ?? ""}
                  </span>
                ) : null}
              </div>
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {wizardStep === 1 ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.companyLogo ?? ""}{" "}
                      <span className="font-normal text-zinc-400">({lx.form_optional ?? ""})</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      {step1Logo ? (
                        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-slate-600">
                          <BrandLogoImage
                            src={step1Logo}
                            alt=""
                            boxClassName="h-16 w-16 sm:h-20 sm:w-20"
                            sizes="80px"
                            scale={1.18}
                          />
                        </div>
                      ) : (
                        <div
                          className="h-16 w-16 shrink-0 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-slate-600 dark:bg-slate-800 sm:h-20 sm:w-20"
                          aria-hidden
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          openCloudinaryForStep1();
                        }}
                        className="min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200"
                      >
                        {lx.uploadLogo ?? ""}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.companyName ?? ""}
                    </label>
                    <input
                      value={step1Name}
                      onChange={(e) => setStep1Name(e.target.value)}
                      placeholder={lx.onboarding_company_name_placeholder || undefined}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.countryRegion ?? ""}
                    </label>
                    <select
                      value={step1Country}
                      onChange={(e) => onCountryPick(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.currency ?? ""}
                    </label>
                    <select
                      value={step1Currency}
                      onChange={(e) => setStep1Currency(e.target.value as Currency)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                          {"\u00a0\u00b7 "}
                          {CURRENCY_META[c].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.settingsTimezone ?? ""}
                    </label>
                    <select
                      value={step1Tz}
                      onChange={(e) => persistTimezone(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      {Array.from(new Set<string>([...IANA_TIMEZONE_OPTIONS, step1Tz])).map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{lx.onboarding_step2_intro ?? ""}</p>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.onboarding_sector_label ?? ""}
                    </label>
                    <select
                      value={step2Industry}
                      onChange={(e) => setStep2Industry(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      {ONBOARDING_INDUSTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {lx[opt.labelKey] ?? opt.value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.onboarding_company_size_label ?? ""}
                    </label>
                    <select
                      value={step2Size}
                      onChange={(e) => setStep2Size(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      <option value="">{lx.onboarding_size_placeholder ?? ""}</option>
                      {ONBOARDING_SIZE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {lx[opt.labelKey] ?? opt.value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {wizardStep === 3 ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{lx.onboarding_project_message ?? ""}</p>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.projectFormNameLabel ?? ""}
                    </label>
                    <input
                      value={projName}
                      onChange={(e) => setProjName(e.target.value)}
                      placeholder={lx.onboarding_step3_name_placeholder || undefined}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.projectFormLocationLabel ?? ""}{" "}
                      <span className="font-normal">({lx.form_optional ?? ""})</span>
                    </label>
                    <input
                      value={projLocation}
                      onChange={(e) => setProjLocation(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.projectFormDateStart ?? ""}{" "}
                      <span className="font-normal">({lx.optional_field ?? lx.common_optional ?? ""})</span>
                    </label>
                    <input
                      type="date"
                      value={projStart}
                      onChange={(e) => setProjStart(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 flex flex-col gap-2 border-t border-zinc-200 dark:border-slate-700 bg-white px-5 py-4 dark:bg-slate-900">
              {wizardStep === 1 ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveStep1AndNext()}
                    className="w-full min-h-[44px] rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {lx.onboarding_next ?? ""}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void skipEntireOnboarding()}
                    className="w-full min-h-[44px] rounded-xl border border-zinc-300 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200 disabled:opacity-50"
                  >
                    {lx.onboarding_skip_all ?? ""}
                  </button>
                </>
              ) : wizardStep === 2 ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveStep2AndNext()}
                    className="w-full min-h-[44px] rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {lx.onboarding_next ?? ""}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={skipToStep3}
                    className="w-full min-h-[44px] rounded-xl border-2 border-amber-600/70 bg-amber-50 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
                  >
                    {lx.onboarding_skip_step2 ?? lx.onboarding_skip ?? ""}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void createProjectFlow()}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {lx.onboarding_create_project ?? ""}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={finishSkipProject}
                    className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    {lx.onboarding_skip ?? ""}
                  </button>
                </div>
              )}

              {wizardStep === 3 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void skipEntireOnboarding()}
                  className="w-full min-h-[44px] rounded-xl py-2.5 text-xs font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300 disabled:opacity-50"
                >
                  {lx.onboarding_skip_all ?? ""}
                </button>
              ) : null}

              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setWizardStep((s) => Math.max(1, s - 1));
                  }}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  {lx.back ?? ""}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 py-10 text-center sm:px-6 space-y-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/25">
                <Check className="h-10 w-10" aria-hidden />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {lx.onboarding_finished_title ?? lx.onboarding_finish_headline ?? ""}
              </h3>
              {companyName.trim() ? (
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{companyName.trim()}</p>
              ) : null}
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                {lx.onboarding_finished_subtitle ?? lx.onboarding_finish_subtitle ?? ""}
              </p>
              {(lx.onboarding_beta_founder_note ?? "").trim() ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100 max-w-md mx-auto">
                  {lx.onboarding_beta_founder_note}
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void finalizeOnboarding()}
                className="w-full min-h-[48px] rounded-xl bg-amber-600 py-3.5 text-base font-bold text-white shadow-md hover:bg-amber-500 disabled:opacity-50"
              >
                {lx.onboarding_go_dashboard ?? lx.onboarding_finish ?? lx.onboarding_done_cta ?? lx.next ?? ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
