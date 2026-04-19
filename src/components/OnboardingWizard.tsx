"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { TextWithBrandMarks } from "@/components/BrandWordmark";
import { useToast } from "@/components/Toast";
import { CURRENCY_META, type Currency } from "@/lib/i18n";
import {
  REGIONAL_COUNTRY_DEFAULTS,
  REGIONAL_COUNTRIES,
} from "@/lib/regionalCountries";
import type { CustomRole } from "@/types/roles";
import { ONBOARDING_INDUSTRY_OPTIONS } from "@/lib/onboardingIndustryOptions";

function deriveDisplayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "";
  const spaced = local.replace(/[._-]+/g, " ").trim();
  if (!spaced) return "Team member";
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface OnboardingWizardProps {
  session: Session | null;
  companyId: string | null;
  labels: Record<string, string>;
  companyName: string;
  companyCountry: string;
  currency: Currency;
  customRoles: CustomRole[];
  onCompanyNameChange: (v: string) => void;
  onCountryChange: (country: string, defaults?: { currency: string; measurementSystem: "metric" | "imperial" }) => void;
  onCurrencyChange: (c: Currency) => void;
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
  onComplete: () => void | Promise<void>;
}

export function OnboardingWizard({
  session,
  companyId,
  labels: t,
  companyName,
  companyCountry,
  currency,
  customRoles,
  onCompanyNameChange,
  onCountryChange,
  onCurrencyChange,
  onProjectCreated,
  onComplete,
}: OnboardingWizardProps) {
  const lx = t;
  const { showToast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [coName, setCoName] = useState(companyName);
  const [coCountry, setCoCountry] = useState(companyCountry || "CA");
  const [coCurrency, setCoCurrency] = useState<Currency>(currency);
  const [coIndustry, setCoIndustry] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [empEmail, setEmpEmail] = useState("");

  const [projName, setProjName] = useState("");
  const [projType, setProjType] = useState("residential");
  const [projLocation, setProjLocation] = useState("");

  const authHeader = useCallback(() => {
    const token = session?.access_token;
    if (!token) return null;
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, [session?.access_token]);

  const defaultWorkerRoleId = useMemo(() => {
    const w = customRoles.find((r) => r.name.toLowerCase().includes("emplead") || r.name.toLowerCase().includes("employee"));
    return w?.id ?? customRoles[0]?.id ?? "";
  }, [customRoles]);

  const currencies = useMemo(() => Object.keys(CURRENCY_META) as Currency[], []);

  const userFacingError = useCallback(
    (raw: string) => {
      const r = raw.trim();
      if (!r) return lx.error_generic ?? lx.register_error_generic ?? "Error";
      if (/^(5\d{2}|4\d{2}|40[13]|42\d{2})/.test(r) || r.includes("ECONNREFUSED") || r.includes("fetch")) {
        return lx.error_generic ?? lx.register_error_generic ?? "Error";
      }
      return r;
    },
    [lx.error_generic, lx.register_error_generic]
  );

  const patchCompany = useCallback(async () => {
    if (!companyId) return;
    const h = authHeader();
    if (!h) return;
    const payload: Record<string, unknown> = {
      companyId,
      country: coCountry,
      currency: coCurrency,
    };
    if (coName.trim()) payload.name = coName.trim();
    if (coIndustry.trim()) payload.industry = coIndustry.trim();
    if (logoUrl.trim()) payload.logo_url = logoUrl.trim();
    const res = await fetch("/api/onboarding/company", {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? lx.error_generic ?? lx.register_error_generic ?? "Error");
    }
    if (coName.trim()) onCompanyNameChange(coName.trim());
    onCountryChange(coCountry, {
      currency: coCurrency,
      measurementSystem: REGIONAL_COUNTRY_DEFAULTS[coCountry]?.measurementSystem ?? "metric",
    });
    onCurrencyChange(coCurrency);
  }, [
    authHeader,
    companyId,
    coName,
    coCountry,
    coCurrency,
    coIndustry,
    logoUrl,
    onCompanyNameChange,
    onCountryChange,
    onCurrencyChange,
    lx.error_generic,
    lx.register_error_generic,
  ]);

  const skipStep1 = useCallback(() => {
    setError(null);
    setStep(2);
  }, []);

  const goStep2 = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await patchCompany();
      setStep(2);
    } catch (e) {
      setError(userFacingError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }, [patchCompany, userFacingError]);

  const uploadCompanyLogo = useCallback(async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) {
      showToast("error", lx.register_error_generic ?? lx.error_generic ?? "");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", preset);
      fd.append("folder", "machinpro/company-logos");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { secure_url?: string };
      if (data.secure_url) {
        setLogoUrl(data.secure_url);
        showToast("success", lx.saved_successfully ?? lx.onboarding_logo_upload ?? "");
      }
    } finally {
      setBusy(false);
    }
  }, [lx.error_generic, lx.onboarding_logo_upload, lx.register_error_generic, lx.saved_successfully, showToast]);

  const skipEmployee = useCallback(() => {
    setError(null);
    setStep(3);
  }, []);

  const addEmployee = useCallback(async () => {
    setError(null);
    const email = empEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      setError(lx.error_validation ?? lx.error_generic ?? lx.register_error_generic ?? "");
      return;
    }
    if (!companyId) return;
    const h = authHeader();
    if (!h) return;
    const name = deriveDisplayNameFromEmail(email);
    setBusy(true);
    try {
      const res = await fetch("/api/employees/create", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          companyId,
          fullName: name,
          email,
          customRoleId: defaultWorkerRoleId || null,
          profileStatus: "active",
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
        setError(userFacingError(j.error ?? ""));
        return;
      }
      showToast("success", lx.onboarding_invite_success ?? "");
      setStep(3);
    } finally {
      setBusy(false);
    }
  }, [
    authHeader,
    companyId,
    empEmail,
    defaultWorkerRoleId,
    lx.error_generic,
    lx.error_validation,
    lx.onboarding_invite_success,
    lx.register_error_generic,
    showToast,
    userFacingError,
  ]);

  const skipProject = useCallback(() => {
    setError(null);
    setStep(4);
  }, []);

  const createProject = useCallback(async () => {
    setError(null);
    const name = projName.trim();
    if (!name) {
      setError(lx.error_generic ?? lx.register_error_generic ?? "");
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
          location: projLocation.trim(),
          type: projType,
          estimated_start: null,
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
        setError(userFacingError(j.error ?? ""));
        return;
      }
      showToast("success", lx.onboarding_project_saved ?? lx.saved_successfully ?? "");
      onProjectCreated({
        id: j.id,
        name,
        type: projType,
        location: projLocation.trim(),
        budgetCAD: 0,
        spentCAD: 0,
        estimatedStart: "",
        estimatedEnd: "",
        archived: false,
        assignedEmployeeIds: [],
      });
      setStep(4);
    } finally {
      setBusy(false);
    }
  }, [
    authHeader,
    companyId,
    projName,
    projLocation,
    projType,
    onProjectCreated,
    lx.onboarding_project_saved,
    lx.saved_successfully,
    showToast,
    userFacingError,
  ]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  }, [onComplete]);

  const spin = useMemo(
    () => (
      <span
        className="inline-block size-4 shrink-0 rounded-full border-2 border-white border-t-transparent animate-spin"
        aria-hidden
      />
    ),
    []
  );

  if (!companyId || !session) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-3 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4">
      <div
        className="flex max-h-[min(100dvh,100svh)] w-full max-w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[min(92dvh,720px)] sm:max-w-lg sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="onboarding-wizard-title"
      >
        <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-slate-700">
          <BrandLogoImage src="/logo-source.png" alt="" boxClassName="h-10 w-10 shrink-0" sizes="40px" />
          <div className="min-w-0">
            <p id="onboarding-wizard-title" className="text-lg font-bold text-zinc-900 dark:text-white">
              <TextWithBrandMarks
                text={lx.onboarding_welcome_title ?? lx.onboarding_wizard_title ?? "MachinPro"}
                tone="onLight"
                className="inline"
              />
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {lx.onboarding_wizard_subtitle ?? lx.onboarding_welcome_subtitle ?? ""}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{lx.onboarding_step_company ?? ""}</p>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.projectFormNameLabel ?? "Name"}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={coName}
                  onChange={(e) => setCoName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.onboarding1Country ?? "Country"}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={coCountry}
                  onChange={(e) => {
                    const c = e.target.value;
                    setCoCountry(c);
                    const d = REGIONAL_COUNTRY_DEFAULTS[c];
                    if (d?.currency) setCoCurrency(d.currency as Currency);
                  }}
                >
                  {REGIONAL_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.currency ?? "Currency"}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={coCurrency}
                  onChange={(e) => setCoCurrency(e.target.value as Currency)}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_META[c]?.label ?? c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.onboarding_sector_label ?? ""}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={coIndustry}
                  onChange={(e) => setCoIndustry(e.target.value)}
                >
                  <option value="">{lx.onboarding_sector_placeholder ?? "—"}</option>
                  {ONBOARDING_INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {lx[opt.labelKey] ?? opt.value}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-slate-800/50">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {lx.onboarding_logo_optional ?? ""}
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadCompanyLogo(f);
                  }}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg border border-zinc-200 object-cover dark:border-zinc-600"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-600">
                      —
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => logoInputRef.current?.click()}
                    className="min-h-[44px] rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-white dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-slate-700"
                  >
                    {lx.onboarding_logo_upload ?? "Upload"}
                  </button>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={skipStep1}
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-slate-800 sm:w-auto sm:min-w-[44px]"
                >
                  {lx.onboarding_skip_step2 ?? lx.onboarding_skip ?? "Skip"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void goStep2()}
                  className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
                >
                  {busy ? (
                    <>
                      {spin}
                      {lx.loading_saving ?? lx.onboarding_next ?? lx.onboarding_continue ?? "Continue"}
                    </>
                  ) : (
                    lx.onboarding_next ?? lx.onboarding_continue ?? "Continue"
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {lx.onboarding_step_team ?? lx.onboarding_step_employee ?? ""}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{lx.onboarding_invite_message ?? ""}</p>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.onboarding_invite_email_only ?? lx.employeeEmail ?? "Email"}</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder={lx.onboarding_invite_placeholder ?? ""}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                />
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={skipEmployee}
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-slate-800 sm:w-auto sm:min-w-[44px]"
                >
                  {lx.onboarding_skip_step2 ?? lx.onboarding_skip ?? "Skip"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addEmployee()}
                  className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
                >
                  {busy ? (
                    <>
                      {spin}
                      {lx.loading_saving ?? lx.onboarding_send_invite ?? ""}
                    </>
                  ) : (
                    lx.onboarding_send_invite ?? lx.employees_add ?? "Send"
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{lx.onboarding_step_project ?? ""}</p>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.projectFormNameLabel ?? "Name"}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.projectFormTypeLabel ?? "Type"}</span>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={projType}
                  onChange={(e) => setProjType(e.target.value)}
                >
                  <option value="residential">{lx.projectTypeResidential ?? "Residential"}</option>
                  <option value="commercial">{lx.projectTypeCommercial ?? "Commercial"}</option>
                  <option value="industrial">{lx.projectTypeIndustrial ?? "Industrial"}</option>
                  <option value="other">{lx.other ?? "Other"}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{lx.projectFormLocationLabel ?? "Location"}</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-slate-800 min-h-[44px]"
                  value={projLocation}
                  onChange={(e) => setProjLocation(e.target.value)}
                />
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={skipProject}
                  className="w-full min-h-[44px] rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-slate-800 sm:w-auto sm:min-w-[44px]"
                >
                  {lx.onboarding_skip_step2 ?? lx.onboarding_skip ?? "Skip"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createProject()}
                  className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 sm:w-auto sm:min-w-[44px]"
                >
                  {busy ? (
                    <>
                      {spin}
                      {lx.loading_saving ?? lx.onboarding_create_project ?? "Create"}
                    </>
                  ) : (
                    lx.onboarding_create_project ?? "Create"
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="relative space-y-4 overflow-hidden">
              <div className="flex justify-center gap-2 text-2xl" aria-hidden>
                <span className="inline-block animate-bounce">🎉</span>
                <span className="inline-block animate-bounce [animation-delay:120ms]">✨</span>
                <span className="inline-block animate-bounce [animation-delay:240ms]">✅</span>
              </div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                {lx.onboarding_company_ready_title ?? lx.onboarding_step_ready ?? ""}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {lx.onboarding_finish_subtitle ?? lx.onboarding_wizard_subtitle ?? ""}
              </p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                <li>{lx.onboarding_next_hint_invite ?? lx.onboarding_suggestion_team ?? ""}</li>
                <li>{lx.onboarding_next_hint_project ?? lx.onboarding_suggestion_catalog ?? ""}</li>
                <li>{lx.onboarding_next_hint_clock ?? lx.onboarding_suggestion_tour ?? ""}</li>
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finish()}
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    {spin}
                    {lx.loading_saving ?? lx.onboarding_go_dashboard ?? lx.onboarding_finish ?? "Dashboard"}
                  </>
                ) : (
                  lx.onboarding_go_dashboard ?? lx.onboarding_finish ?? "Dashboard"
                )}
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-200 px-5 py-3 text-center text-xs text-zinc-500 dark:border-slate-700 dark:text-zinc-500">
          {step}/4
        </div>
      </div>
    </div>
  );
}
