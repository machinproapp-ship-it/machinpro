"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { CustomRole } from "@/types/roles";
import { pickDefaultWorkerRoleId } from "@/types/roles";
import type { Language } from "@/types/shared";
import { CURRENCY_META, type Currency } from "@/lib/i18n";

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

const TIMEZONE_OPTIONS = [
  "Europe/Madrid",
  "Europe/London",
  "America/Toronto",
  "America/New_York",
  "America/Mexico_City",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Lisbon",
  "UTC",
] as const;

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
  customRoles: CustomRole[];
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
  customRoles,
  onCompanyNameChange,
  onCountryChange,
  onCurrencyChange,
  onMeasurementSystemChange,
  onLogoUrlChange,
  onLogoUpload,
  onProjectCreated,
}: OnboardingModalProps) {
  const lx = t as Record<string, string>;
  const [phase, setPhase] = useState<Phase>("welcome");
  const [wizardStep, setWizardStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step1Name, setStep1Name] = useState(companyName);
  const [step1Country, setStep1Country] = useState(companyCountry || "ES");
  const [step1Currency, setStep1Currency] = useState<Currency>(currency);
  const [step1Tz, setStep1Tz] = useState(() => {
    if (typeof window === "undefined") return "Europe/Madrid";
    try {
      return localStorage.getItem("machinpro_tz") || "Europe/Madrid";
    } catch {
      return "Europe/Madrid";
    }
  });
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

  const roleOptions = useMemo(() => customRoles.filter((r) => r.id !== "role-admin"), [customRoles]);
  const defaultRoleId = useMemo(() => {
    const id = pickDefaultWorkerRoleId(roleOptions.length ? roleOptions : customRoles);
    return id || roleOptions[0]?.id || customRoles[0]?.id || "";
  }, [customRoles, roleOptions]);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState(defaultRoleId);

  useEffect(() => {
    setInviteRoleId(defaultRoleId);
  }, [defaultRoleId]);

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
  ]);

  const sendInviteAndNext = useCallback(async () => {
    setError(null);
    const mail = inviteEmail.trim().toLowerCase();
    const nm = inviteName.trim();
    if (!mail || !nm) {
      setError(lx.register_error_generic ?? "");
      return;
    }
    if (!companyId || !inviteRoleId) {
      setError(lx.register_error_generic ?? "");
      return;
    }
    const h = authHeader();
    if (!h) return;
    setBusy(true);
    try {
      const res = await fetch("/api/employees/create", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          companyId,
          fullName: nm,
          email: mail,
          customRoleId: inviteRoleId,
          profileStatus: "active",
          useRolePermissions: true,
        }),
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
  }, [inviteEmail, inviteName, companyId, inviteRoleId, authHeader, lx.register_error_generic]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div
        className="my-auto w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden"
        role="dialog"
        aria-modal
        aria-labelledby="onboarding-title"
      >
        {phase === "welcome" ? (
          <>
            <div className="px-6 pt-8 pb-6 text-center space-y-4">
              <div className="flex justify-center">
                <Image src="/logo-source.png" alt="" width={120} height={120} className="h-14 w-auto" priority />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl">
                {lx.onboarding_welcome_title ?? ""}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
                {lx.onboarding_welcome_subtitle ?? ""}
              </p>
              <button
                type="button"
                onClick={goWelcomeToWizard}
                className="mt-2 w-full min-h-[44px] rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
              >
                {lx.onboarding_start ?? ""}
              </button>
            </div>
          </>
        ) : phase === "wizard" ? (
          <>
            <div className="border-b border-zinc-200 dark:border-slate-700 px-4 py-3">
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
            </div>

            <div className="max-h-[min(70vh,540px)] overflow-y-auto px-5 py-5 space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{stepTitle(wizardStep)}</h3>
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {wizardStep === 1 ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.companyName ?? ""}
                    </label>
                    <input
                      value={step1Name}
                      onChange={(e) => setStep1Name(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
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
                          {c} · {CURRENCY_META[c].label}
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
                      {Array.from(new Set<string>([...TIMEZONE_OPTIONS, step1Tz])).map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.companyLogo ?? ""}{" "}
                      <span className="font-normal text-zinc-400">({lx.form_optional ?? ""})</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {step1Logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={step1Logo} alt="" className="h-12 w-12 rounded-lg object-cover border border-zinc-200 dark:border-slate-600" />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          openCloudinaryForStep1();
                        }}
                        className="min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm"
                      >
                        {lx.uploadLogo ?? ""}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{lx.onboarding_invite_message ?? ""}</p>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{lx.email ?? ""}</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{lx.name ?? ""}</label>
                    <input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {lx.employees_role ?? lx.employees_assigned_role ?? ""}
                    </label>
                    <select
                      value={inviteRoleId}
                      onChange={(e) => setInviteRoleId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      {(roleOptions.length ? roleOptions : customRoles).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
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
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
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

            <div className="flex flex-col gap-2 border-t border-zinc-200 dark:border-slate-700 px-5 py-4">
              {wizardStep === 1 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveStep1AndNext()}
                  className="w-full min-h-[44px] rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {lx.onboarding_next ?? ""}
                </button>
              ) : wizardStep === 2 ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendInviteAndNext()}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {lx.onboarding_send_invite ?? ""}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={skipToStep3}
                    className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    {lx.onboarding_skip ?? ""}
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
          </>
        ) : (
          <div className="px-6 py-10 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-8 w-8" aria-hidden />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{lx.onboarding_finish ?? ""}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{lx.onboarding_finish_subtitle ?? ""}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void finalizeOnboarding()}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {lx.onboarding_done_cta ?? lx.next ?? ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
