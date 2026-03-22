"use client";

import { useState, useEffect, useCallback } from "react";
import { Sliders, Lock, Pencil, Trash2, LogOut, Bell } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useToast } from "@/components/Toast";
import { registerPushSubscription, unsubscribeFromPush } from "@/lib/pushNotifications";
import { LANGUAGES, CURRENCY_META } from "@/lib/i18n";
import type { Language } from "@/types/shared";
import type { ComplianceField, ComplianceFieldType, ComplianceTarget } from "@/app/page";

const COUNTRY_DEFAULTS: Record<
  string,
  { currency: string; measurementSystem: "metric" | "imperial"; taxIdLabel: string }
> = {
  CA: { currency: "CAD", measurementSystem: "metric", taxIdLabel: "BN / GST Number" },
  US: { currency: "USD", measurementSystem: "imperial", taxIdLabel: "EIN" },
  MX: { currency: "MXN", measurementSystem: "metric", taxIdLabel: "RFC" },
  GB: { currency: "GBP", measurementSystem: "imperial", taxIdLabel: "VAT Number" },
  EU: { currency: "EUR", measurementSystem: "metric", taxIdLabel: "VAT Number" },
  ES: { currency: "EUR", measurementSystem: "metric", taxIdLabel: "CIF/NIF" },
  FR: { currency: "EUR", measurementSystem: "metric", taxIdLabel: "SIRET" },
  DE: { currency: "EUR", measurementSystem: "metric", taxIdLabel: "Steuernummer" },
  IT: { currency: "EUR", measurementSystem: "metric", taxIdLabel: "Partita IVA" },
  PT: { currency: "EUR", measurementSystem: "metric", taxIdLabel: "NIF" },
  NL: { currency: "EUR", measurementSystem: "metric", taxIdLabel: "BTW-nummer" },
  PL: { currency: "PLN", measurementSystem: "metric", taxIdLabel: "NIP" },
  SE: { currency: "SEK", measurementSystem: "metric", taxIdLabel: "Organisationsnummer" },
  NO: { currency: "NOK", measurementSystem: "metric", taxIdLabel: "Organisasjonsnummer" },
  DK: { currency: "DKK", measurementSystem: "metric", taxIdLabel: "CVR-nummer" },
  CH: { currency: "CHF", measurementSystem: "metric", taxIdLabel: "UID" },
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
];

export interface SettingsModuleProps {
  labels: Record<string, string>;
  language: Language;
  setLanguage: (lang: Language) => void;
  currency: string;
  setCurrency: (c: string) => void;
  measurementSystem: "metric" | "imperial";
  setMeasurementSystem: (v: "metric" | "imperial") => void;
  canEditSettings: boolean;
  companyCountry: string;
  onCountryChange: (country: string, defaults?: { currency: string; measurementSystem: "metric" | "imperial" }) => void;
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  logoUrl: string;
  onLogoUpload: () => void;
  complianceFields?: ComplianceField[];
  onComplianceFieldsChange?: (fields: ComplianceField[]) => void;
  session?: Session | null;
  onSignOut?: () => void;
  companyId?: string | null;
}

export function SettingsModule({
  labels: t,
  language,
  setLanguage,
  currency,
  setCurrency,
  measurementSystem,
  setMeasurementSystem,
  canEditSettings,
  companyCountry,
  onCountryChange,
  companyName,
  onCompanyNameChange,
  logoUrl,
  onLogoUpload,
  complianceFields = [],
  onComplianceFieldsChange,
  session = null,
  onSignOut,
  companyId = null,
}: SettingsModuleProps) {
  const { showToast } = useToast();
  const [autoSetupMessage, setAutoSetupMessage] = useState<string | null>(null);
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [editingComplianceField, setEditingComplianceField] = useState<ComplianceField | null>(null);
  const [complianceDraft, setComplianceDraft] = useState<Partial<ComplianceField>>({});
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [prefHazard, setPrefHazard] = useState(true);
  const [prefAction, setPrefAction] = useState(true);
  const [prefVisitor, setPrefVisitor] = useState(true);

  const persistPushPref = useCallback((key: "hazard" | "action" | "visitor", on: boolean) => {
    const map = { hazard: "machinpro_push_hazard", action: "machinpro_push_action", visitor: "machinpro_push_visitor" };
    try {
      localStorage.setItem(map[key], on ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (key === "hazard") setPrefHazard(on);
    if (key === "action") setPrefAction(on);
    if (key === "visitor") setPrefVisitor(on);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPrefHazard(localStorage.getItem("machinpro_push_hazard") !== "0");
    setPrefAction(localStorage.getItem("machinpro_push_action") !== "0");
    setPrefVisitor(localStorage.getItem("machinpro_push_visitor") !== "0");
  }, []);

  useEffect(() => {
    if (!session?.access_token || !companyId || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setPushSubscribed(false);
      return;
    }
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setPushSubscribed(!!sub);
      })
      .catch(() => {
        if (!cancelled) setPushSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, companyId]);

  useEffect(() => {
    if (!autoSetupMessage) return;
    const id = window.setTimeout(() => setAutoSetupMessage(null), 4000);
    return () => window.clearTimeout(id);
  }, [autoSetupMessage]);

  const handleCountryChange = (country: string) => {
    const defaults = COUNTRY_DEFAULTS[country];
    onCountryChange(country, defaults);
    if (defaults) setAutoSetupMessage(t.autoSetupConfirm ?? "País actualizado — moneda y medidas configuradas");
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <Sliders className="h-5 w-5" />
        {t.settings}
      </h2>

      {session && onSignOut && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px]"
          >
            <LogOut className="h-4 w-4" />
            {t.settings_sign_out ?? "Sign out"}
          </button>
        </div>
      )}

      {autoSetupMessage && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {autoSetupMessage}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{t.tabGeneral ?? "General"}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.language}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.measurementSystem}</label>
            <select
              value={measurementSystem}
              onChange={(e) => setMeasurementSystem(e.target.value as "metric" | "imperial")}
              className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
            >
              <option value="metric">{t.settingsMetric ?? "Métrico"}</option>
              <option value="imperial">{t.settingsImperial ?? "Imperial"}</option>
            </select>
          </div>

          {session?.access_token && companyId && (
            <section className="pt-4 border-t border-zinc-200 dark:border-slate-700 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
                {(t as Record<string, string>).push_section_title ?? "Push notifications"}
              </h3>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3 min-h-[44px]">
                <span className="text-sm text-zinc-800 dark:text-zinc-200">
                  {(t as Record<string, string>).push_enable ?? "Enable push"}
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-zinc-400 accent-amber-600"
                  checked={pushSubscribed}
                  disabled={pushBusy}
                  onChange={async (e) => {
                    const on = e.target.checked;
                    if (!session?.access_token || !companyId) return;
                    setPushBusy(true);
                    if (on) {
                      const r = await registerPushSubscription({
                        accessToken: session.access_token,
                        companyId,
                      });
                      if (r.ok) {
                        setPushSubscribed(true);
                        showToast("success", (t as Record<string, string>).push_saved ?? "Saved");
                      } else if (r.reason === "denied") {
                        showToast("warning", (t as Record<string, string>).push_permission_denied ?? "");
                        setPushSubscribed(false);
                      } else {
                        showToast("error", (t as Record<string, string>).toast_error ?? "Error");
                        setPushSubscribed(false);
                      }
                    } else {
                      try {
                        const reg = await navigator.serviceWorker.ready;
                        const sub = await reg.pushManager.getSubscription();
                        if (sub) {
                          await unsubscribeFromPush({
                            accessToken: session.access_token,
                            endpoint: sub.endpoint,
                          });
                          await sub.unsubscribe();
                        }
                        setPushSubscribed(false);
                        showToast("success", (t as Record<string, string>).push_saved ?? "Saved");
                      } catch {
                        showToast("error", (t as Record<string, string>).toast_error ?? "Error");
                        setPushSubscribed(true);
                      }
                    }
                    setPushBusy(false);
                  }}
                />
              </label>
              <div className="space-y-2">
                {(
                  [
                    ["hazard", prefHazard, "push_type_hazard"] as const,
                    ["action", prefAction, "push_type_action"] as const,
                    ["visitor", prefVisitor, "push_type_visitor"] as const,
                  ] as const
                ).map(([key, checked, labelKey]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3 min-h-[44px]"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {(t as Record<string, string>)[labelKey] ?? labelKey}
                    </span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-zinc-400 accent-amber-600"
                      checked={checked}
                      onChange={(ev) => persistPushPref(key, ev.target.checked)}
                    />
                  </label>
                ))}
              </div>
            </section>
          )}

          {canEditSettings && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.countryRegion ?? "País / Región"}</label>
                <select
                  value={companyCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.currency}</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                >
                  {Object.entries(CURRENCY_META).map(([code, meta]) => (
                    <option key={code} value={code}>
                      {meta.symbol} — {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <section className="pt-4 border-t border-zinc-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{t.companyIdentity ?? "Identidad de empresa"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.companyName ?? "Nombre de empresa"}</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => onCompanyNameChange(e.target.value)}
                      placeholder="Canariense Inc"
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.companyLogo ?? "Logo de empresa"}</label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                      {t.logoHint ?? "El logo aparecerá en los reportes y formularios PDF"}
                    </p>
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="h-16 w-auto object-contain mb-3 rounded-lg border border-zinc-200 dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
                      />
                    )}
                    <button
                      type="button"
                      onClick={onLogoUpload}
                      className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-500 dark:hover:border-amber-500 dark:hover:text-amber-400 transition-colors min-h-[44px] w-full"
                    >
                      {t.uploadLogo ?? "Subir logo"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="pt-4 border-t border-zinc-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{t.complianceFields ?? "Campos de Compliance"}</h3>
                <div className="space-y-2">
                  {complianceFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-slate-700 p-3 gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.name}</span>
                          {field.isDefault && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full px-2 py-0.5">
                              {t.defaultField ?? "Por defecto"}
                            </span>
                          )}
                          {field.isRequired && (
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5">
                              {t.required ?? "Obligatorio"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {field.target.map((targetKey) => (
                            <span key={targetKey} className="text-xs text-zinc-500 dark:text-zinc-400">
                              {targetKey === "employee"
                                ? (t.employees ?? "Empleados")
                                : targetKey === "subcontractor"
                                ? (t.subcontractors ?? "Subcontratistas")
                                : (t.vehicles ?? "Vehículos")}
                            </span>
                          ))}
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">
                            · {t.alertBefore ?? "Alerta"}: {field.alertDaysBefore}d
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {field.isDefault ? (
                          <Lock className="h-4 w-4 text-zinc-400" aria-hidden />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingComplianceField(field);
                                setComplianceDraft({ ...field });
                                setComplianceModalOpen(true);
                              }}
                              className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onComplianceFieldsChange?.(complianceFields.filter((f) => f.id !== field.id))}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingComplianceField(null);
                    setComplianceDraft({
                      name: "",
                      description: "",
                      fieldType: "date",
                      target: [],
                      isRequired: false,
                      alertDaysBefore: 30,
                      isDefault: false,
                      createdAt: new Date().toISOString(),
                    });
                    setComplianceModalOpen(true);
                  }}
                  className="mt-3 w-full rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 py-3 text-sm text-zinc-400 dark:text-zinc-500 hover:border-amber-400 hover:text-amber-500 dark:hover:border-amber-500 dark:hover:text-amber-400 transition-colors min-h-[44px]"
                >
                  + {t.addComplianceField ?? "Añadir campo de compliance"}
                </button>
              </section>
            </>
          )}
        </div>
      </div>

      {complianceModalOpen && canEditSettings && onComplianceFieldsChange && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={() => { setComplianceModalOpen(false); setEditingComplianceField(null); }} />
          <div role="dialog" aria-modal className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              {editingComplianceField ? (t.edit ?? "Editar") : (t.addComplianceField ?? "Añadir campo de compliance")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.name ?? "Nombre"} *</label>
                <input
                  type="text"
                  value={complianceDraft.name ?? ""}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.description ?? "Descripción"}</label>
                <textarea
                  value={complianceDraft.description ?? ""}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[80px] resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t.category ?? "Tipo"}</label>
                <select
                  value={complianceDraft.fieldType ?? "date"}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, fieldType: e.target.value as ComplianceFieldType }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                >
                  <option value="date">{t.fieldTypeDate ?? "Fecha vencimiento"}</option>
                  <option value="document">{t.document ?? "Documento URL"}</option>
                  <option value="text">{t.text ?? "Texto"}</option>
                  <option value="checkbox">{t.checkbox ?? "Sí/No"}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t.appliesTo ?? "Aplica a"}</label>
                <div className="flex flex-wrap gap-3">
                  {(["employee", "subcontractor", "vehicle"] as ComplianceTarget[]).map((targetKey) => (
                    <label key={targetKey} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(complianceDraft.target ?? []).includes(targetKey)}
                        onChange={(e) => {
                          const prev = complianceDraft.target ?? [];
                          setComplianceDraft((d) => ({
                            ...d,
                            target: e.target.checked ? [...prev, targetKey] : prev.filter((t) => t !== targetKey),
                          }));
                        }}
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {targetKey === "employee" ? (t.employees ?? "Empleados") : targetKey === "subcontractor" ? (t.subcontractors ?? "Subcontratistas") : (t.vehicles ?? "Vehículos")}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={complianceDraft.isRequired ?? false}
                    onChange={(e) => setComplianceDraft((d) => ({ ...d, isRequired: e.target.checked }))}
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.required ?? "Obligatorio"}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.alertBefore ?? "Alerta"} (días antes)</label>
                <input
                  type="number"
                  min={0}
                  value={complianceDraft.alertDaysBefore ?? 30}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, alertDaysBefore: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setComplianceModalOpen(false); setEditingComplianceField(null); }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]"
              >
                {t.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!(complianceDraft.name ?? "").trim()) return;
                  const newField: ComplianceField = {
                    id: editingComplianceField?.id ?? "cf-" + Date.now(),
                    name: (complianceDraft.name ?? "").trim(),
                    description: complianceDraft.description?.trim() || undefined,
                    fieldType: complianceDraft.fieldType ?? "date",
                    target: (complianceDraft.target ?? []).length ? (complianceDraft.target as ComplianceTarget[]) : ["employee"],
                    isRequired: complianceDraft.isRequired ?? false,
                    alertDaysBefore: complianceDraft.alertDaysBefore ?? 30,
                    isDefault: false,
                    createdAt: editingComplianceField?.createdAt ?? new Date().toISOString(),
                  };
                  if (editingComplianceField) {
                    onComplianceFieldsChange(complianceFields.map((f) => (f.id === newField.id ? newField : f)));
                  } else {
                    onComplianceFieldsChange([...complianceFields, newField]);
                  }
                  setComplianceModalOpen(false);
                  setEditingComplianceField(null);
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
              >
                {t.save ?? "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
