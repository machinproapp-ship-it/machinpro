"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  Sliders,
  Lock,
  Pencil,
  Trash2,
  LogOut,
  Bell,
  ChevronLeft,
  HelpCircle,
  Settings,
  User,
  Users,
  Building2,
  Globe,
  Shield,
  CreditCard,
  HardHat,
  Truck,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useToast } from "@/components/Toast";
import { registerPushSubscription, unsubscribeFromPush } from "@/lib/pushNotifications";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { LANGUAGES, CURRENCY_META, ALL_TRANSLATIONS } from "@/lib/i18n";
import type { Language } from "@/types/shared";
import {
  DEFAULT_IANA_TIMEZONE,
  isValidIanaTimeZone,
  resolveUserTimezone,
} from "@/lib/dateUtils";
import { REGIONAL_TIMEZONE_GROUPS, allGroupedTimezones, cityLabelFromIana } from "@/lib/regionalTimezones";
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

function complianceFieldDisplayName(field: ComplianceField, t: Record<string, string>): string {
  const m: Record<string, string> = {
    "cf-liability": "compliance_field_liability_insurance",
    "cf-compliance": "compliance_field_provincial_compliance",
    "cf-vehicle-inspection": "compliance_field_safety_inspection",
    "cf-vehicle-insurance": "compliance_field_vehicle_insurance",
  };
  const key = m[field.id];
  return key ? (t[key] ?? field.name) : field.name;
}

export interface SettingsModuleProps {
  labels: Record<string, string>;
  language: Language;
  setLanguage: (lang: Language) => void;
  currency: string;
  setCurrency: (c: string) => void;
  measurementSystem: "metric" | "imperial";
  setMeasurementSystem: (v: "metric" | "imperial") => void;
  canEditCompanyProfile: boolean;
  canManageCompliance: boolean;
  canManageProjectVisitors: boolean;
  canManageRegionalConfig: boolean;
  companyCountry: string;
  onCountryChange: (country: string, defaults?: { currency: string; measurementSystem: "metric" | "imperial" }) => void;
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  logoUrl: string;
  onLogoUpload: () => void;
  companyAddress?: string;
  onCompanyAddressChange?: (v: string) => void;
  companyPhone?: string;
  onCompanyPhoneChange?: (v: string) => void;
  companyEmail?: string;
  onCompanyEmailChange?: (v: string) => void;
  companyWebsite?: string;
  onCompanyWebsiteChange?: (v: string) => void;
  onSaveCompanyProfile?: () => void | Promise<void>;
  companyProfileSaveBusy?: boolean;
  complianceFields?: ComplianceField[];
  onComplianceFieldsChange?: (fields: ComplianceField[]) => void;
  session?: Session | null;
  onSignOut?: () => void;
  companyId?: string | null;
  /** Plan y facturación (Stripe) — solo si canViewBilling */
  billingSection?: ReactNode;
  showBillingSection?: boolean;
  profileFullName?: string;
  setProfileFullName?: (v: string) => void;
  profileEmail?: string;
  profilePhone?: string;
  setProfilePhone?: (v: string) => void;
  profileAvatarUrl?: string;
  onProfileAvatarUpload?: () => void;
  onSaveProfile?: () => void | Promise<void>;
  profileSaveBusy?: boolean;
  onRequestPasswordReset?: () => void | Promise<void>;
  passwordResetBusy?: boolean;
  /** Admin: volver a mostrar el asistente de configuración inicial */
  onReopenOnboarding?: () => void;
  /** Perfil: zona IANA guardada en `user_profiles.timezone`. */
  savedProfileTimeZone?: string | null;
  onPersistUserTimeZone?: (tz: string) => void | Promise<void>;
  /** Increment to open the Help & tutorials section (e.g. from module help on mobile). */
  focusHelpSectionSignal?: number;
  /** Theme control (moved from app header). */
  darkMode?: boolean;
  onDarkModeChange?: (dark: boolean) => void;
}

export function SettingsModule({
  labels: t,
  language,
  setLanguage,
  currency,
  setCurrency,
  measurementSystem,
  setMeasurementSystem,
  canEditCompanyProfile,
  canManageCompliance,
  canManageProjectVisitors,
  canManageRegionalConfig,
  companyCountry,
  onCountryChange,
  companyName,
  onCompanyNameChange,
  logoUrl,
  onLogoUpload,
  companyAddress = "",
  onCompanyAddressChange,
  companyPhone = "",
  onCompanyPhoneChange,
  companyEmail = "",
  onCompanyEmailChange,
  companyWebsite = "",
  onCompanyWebsiteChange,
  onSaveCompanyProfile,
  companyProfileSaveBusy = false,
  complianceFields = [],
  onComplianceFieldsChange,
  session = null,
  onSignOut,
  companyId = null,
  billingSection = null,
  showBillingSection = false,
  profileFullName = "",
  setProfileFullName,
  profileEmail = "",
  profilePhone = "",
  setProfilePhone,
  profileAvatarUrl = "",
  onProfileAvatarUpload,
  onSaveProfile,
  profileSaveBusy = false,
  onRequestPasswordReset,
  passwordResetBusy = false,
  onReopenOnboarding,
  savedProfileTimeZone = null,
  onPersistUserTimeZone,
  focusHelpSectionSignal = 0,
  darkMode = false,
  onDarkModeChange,
}: SettingsModuleProps) {
  const tl = t as Record<string, string>;
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
  const [prefNewEmployees, setPrefNewEmployees] = useState(true);
  const [prefVacationReq, setPrefVacationReq] = useState(true);
  const [prefDailyReports, setPrefDailyReports] = useState(true);
  const [prefNewVisitors, setPrefNewVisitors] = useState(true);
  const [prefUserLimit, setPrefUserLimit] = useState(true);
  const [dateFormat, setDateFormat] = useState<string>("dmy");
  const [timeFormat, setTimeFormat] = useState<string>("24");
  const [weekStart, setWeekStart] = useState<string>("monday");
  const [numberFormat, setNumberFormat] = useState<string>("comma_decimal");

  type SettingsSectionId =
    | "general"
    | "profile"
    | "company"
    | "notifications"
    | "regional"
    | "compliance"
    | "billing"
    | "help";

  const sectionNavIcons: Record<SettingsSectionId, typeof Settings> = {
    general: Settings,
    profile: User,
    company: Building2,
    notifications: Bell,
    regional: Globe,
    compliance: Shield,
    billing: CreditCard,
    help: HelpCircle,
  };

  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("general");
  /** Compliance (config obligatorios) solo en nav de escritorio; en móvil se gestiona desde Empleados / Logística. */
  const [settingsWideNav, setSettingsWideNav] = useState(false);
  const [settingsMobileMenu, setSettingsMobileMenu] = useState(true);
  const [regionalTimezone, setRegionalTimezone] = useState(DEFAULT_IANA_TIMEZONE);

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
    setPrefNewEmployees(localStorage.getItem("machinpro_push_new_employees") !== "0");
    setPrefVacationReq(localStorage.getItem("machinpro_push_vacation_requests") !== "0");
    setPrefDailyReports(localStorage.getItem("machinpro_push_daily_reports") !== "0");
    setPrefNewVisitors(localStorage.getItem("machinpro_push_new_visitors") !== "0");
    setPrefUserLimit(localStorage.getItem("machinpro_push_user_limit") !== "0");
    setDateFormat(localStorage.getItem("machinpro_date_format") || "dmy");
    setTimeFormat(localStorage.getItem("machinpro_time_format") || "24");
    setWeekStart(localStorage.getItem("machinpro_week_start") || "monday");
    setNumberFormat(localStorage.getItem("machinpro_number_format") || "comma_decimal");
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setSettingsWideNav(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (settingsWideNav) return;
    if (activeSettingsSection === "compliance") setActiveSettingsSection("general");
  }, [settingsWideNav, activeSettingsSection]);

  useEffect(() => {
    if (!focusHelpSectionSignal) return;
    setActiveSettingsSection("help");
    setSettingsMobileMenu(false);
  }, [focusHelpSectionSignal]);

  useEffect(() => {
    const resolved = resolveUserTimezone(savedProfileTimeZone);
    setRegionalTimezone(resolved);
  }, [savedProfileTimeZone]);

  const handleRegionalTimezoneChange = useCallback(
    (tz: string) => {
      setRegionalTimezone(tz);
      try {
        localStorage.setItem("machinpro_tz", tz);
      } catch {
        /* ignore */
      }
      void onPersistUserTimeZone?.(tz);
    },
    [onPersistUserTimeZone]
  );

  const groupedZoneList = useMemo(() => allGroupedTimezones(), []);

  /** Un campo puede listarse en varios grupos si su `target` incluye varios valores. */
  const complianceByTarget = useMemo(() => {
    const employee = complianceFields.filter((f) => f.target.includes("employee"));
    const subcontractor = complianceFields.filter((f) => f.target.includes("subcontractor"));
    const vehicle = complianceFields.filter((f) => f.target.includes("vehicle"));
    return { employee, subcontractor, vehicle };
  }, [complianceFields]);

  const persistLocalePref = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined" && (key === "machinpro_date_format" || key === "machinpro_time_format")) {
      window.dispatchEvent(new Event("machinpro-display-prefs"));
    }
  }, []);

  const handleCountryChange = (country: string) => {
    const defaults = COUNTRY_DEFAULTS[country];
    onCountryChange(country, defaults);
    if (defaults) setAutoSetupMessage(t.autoSetupConfirm ?? "Country updated — currency and units configured");
  };

  const renderComplianceFieldRow = (field: ComplianceField, groupKey: string) => (
    <div
      key={`${groupKey}-${field.id}`}
      className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-slate-700 p-3 gap-2"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {complianceFieldDisplayName(field, tl)}
          </span>
          {field.isDefault && (
            <span className="text-xs rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-slate-800/60 text-zinc-600 dark:text-zinc-400 px-2 py-0.5">
              {t.defaultField ?? "Default"}
            </span>
          )}
          {field.isRequired && (
            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5">
              {t.required ?? "Required"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {field.target.map((targetKey) => (
            <span key={targetKey} className="text-xs text-zinc-500 dark:text-zinc-400">
              {targetKey === "employee"
                ? (t.employees ?? "Employees")
                : targetKey === "subcontractor"
                  ? (t.subcontractors ?? "Subcontractors")
                  : (t.vehicles ?? "Vehicles")}
            </span>
          ))}
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {"\u00b7 "}
            {t.alertBefore ?? "Alert"}: {field.alertDaysBefore}d
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
  );

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <Sliders className="h-5 w-5" />
        {t.settings}
      </h2>

      <div className="flex min-h-0 flex-col overflow-x-hidden md:flex-row md:items-start md:gap-0">
        <nav
          className={`flex w-full shrink-0 flex-col gap-2 md:w-[200px] md:min-w-[200px] md:max-w-[200px] md:flex-shrink-0 md:gap-1 md:border-r md:border-zinc-200 md:pr-3 dark:md:border-slate-700 ${
            settingsMobileMenu ? "flex" : "max-md:hidden"
          } md:flex`}
          aria-label={t.settings || ALL_TRANSLATIONS.en.settings}
        >
          {(
            [
              ["general", tl.settings_general_title ?? tl.settingsGeneral ?? t.tabGeneral ?? ""] as const,
              ["profile", tl.settingsProfile ?? ""] as const,
              ["company", tl.settingsCompany ?? ""] as const,
              ["notifications", tl.settingsNotifications ?? ""] as const,
              ["regional", tl.settings_regional_title ?? tl.settingsRegional ?? ""] as const,
              ["compliance", tl.settingsCompliance ?? ""] as const,
              ["billing", tl.settingsBilling ?? ""] as const,
              ["help", tl.helpAndTutorials ?? ""] as const,
            ] as const
          )
            .filter(([id]) => {
              if (id === "company") return canEditCompanyProfile;
              if (id === "notifications") return !!(session?.access_token && companyId);
              if (id === "regional") return canManageRegionalConfig || canEditCompanyProfile;
              if (id === "compliance") return canManageCompliance && settingsWideNav;
              if (id === "billing") return showBillingSection && !!billingSection;
              return true;
            })
            .map(([id, label]) => {
              const NavIcon = sectionNavIcons[id];
              const active = activeSettingsSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveSettingsSection(id);
                    setSettingsMobileMenu(false);
                  }}
                  className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors md:px-3 md:py-2.5 max-md:border max-md:border-zinc-200 max-md:bg-zinc-50/90 max-md:shadow-sm dark:max-md:border-slate-600 dark:max-md:bg-slate-800/50 ${
                    active
                      ? "border-amber-300 bg-amber-100 text-amber-950 ring-1 ring-amber-400/50 dark:border-amber-700/50 dark:bg-amber-900/35 dark:text-amber-100 dark:ring-amber-500/30 md:border-transparent md:ring-0"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-slate-800 md:hover:bg-zinc-100 dark:md:hover:bg-slate-800"
                  }`}
                >
                  <NavIcon
                    className={`h-5 w-5 shrink-0 ${active ? "text-amber-700 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
                </button>
              );
            })}
        </nav>

        <div
          className={`min-w-0 flex-1 space-y-6 md:min-w-0 md:flex-1 md:pl-6 ${
            settingsMobileMenu ? "max-md:hidden" : ""
          } max-md:fixed max-md:inset-0 max-md:z-40 max-md:overflow-y-auto max-md:bg-white max-md:p-4 dark:max-md:bg-slate-900 md:static md:z-auto md:overflow-visible md:bg-transparent md:p-0`}
        >
          <div className="max-md:sticky max-md:top-0 max-md:z-10 max-md:-mx-4 max-md:mb-4 max-md:border-b max-md:border-zinc-200 max-md:bg-white max-md:px-4 max-md:py-3 dark:max-md:border-slate-700 dark:max-md:bg-slate-900 md:hidden">
            <button
              type="button"
              onClick={() => setSettingsMobileMenu(true)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-start gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
              {t.nav_back ?? "Back"}
            </button>
          </div>

          {activeSettingsSection === "general" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {tl.settings_general_title ?? tl.settingsGeneral ?? t.tabGeneral ?? ""}
              </h3>
              {autoSetupMessage && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  {autoSetupMessage}
                </div>
              )}

          {onDarkModeChange ? (
            <div>
              <span className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                {tl.settings_theme_label ?? "Theme"}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onDarkModeChange(true)}
                  className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium ${
                    darkMode
                      ? "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {(t as Record<string, string>).darkMode ?? "Dark"}
                </button>
                <button
                  type="button"
                  onClick={() => onDarkModeChange(false)}
                  className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium ${
                    !darkMode
                      ? "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                      : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {(t as Record<string, string>).lightMode ?? "Light"}
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              {tl.settings_measurement ?? t.measurementSystem}
            </label>
            <select
              value={measurementSystem}
              onChange={(e) => setMeasurementSystem(e.target.value as "metric" | "imperial")}
              className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
            >
              <option value="metric">{tl.settings_metric ?? t.settingsMetric ?? "Metric"}</option>
              <option value="imperial">{tl.settings_imperial ?? t.settingsImperial ?? "Imperial"}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              {tl.settings_date_format ?? "Date format"}
            </label>
            <select
              value={dateFormat}
              onChange={(e) => {
                const v = e.target.value;
                setDateFormat(v);
                persistLocalePref("machinpro_date_format", v);
              }}
              className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
            >
              <option value="dmy">DD/MM/YYYY</option>
              <option value="mdy">MM/DD/YYYY</option>
              <option value="ymd">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              {tl.settings_time_format ?? "Time format"}
            </label>
            <select
              value={timeFormat}
              onChange={(e) => {
                const v = e.target.value;
                setTimeFormat(v);
                persistLocalePref("machinpro_time_format", v);
              }}
              className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
            >
              <option value="24">{tl.settings_time_24 ?? "24h"}</option>
              <option value="12">{tl.settings_time_12 ?? "12h"}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              {tl.settings_week_start ?? "First day of week"}
            </label>
            <select
              value={weekStart}
              onChange={(e) => {
                const v = e.target.value;
                setWeekStart(v);
                persistLocalePref("machinpro_week_start", v);
              }}
              className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
            >
              <option value="monday">{tl.settings_monday ?? "Monday"}</option>
              <option value="sunday">{tl.settings_sunday ?? "Sunday"}</option>
            </select>
          </div>

          {onReopenOnboarding ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onReopenOnboarding}
                className="w-full max-w-md min-h-[44px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-900/40 sm:w-auto"
              >
                {tl.onboarding_reopen ?? ""}
              </button>
            </div>
          ) : null}

          {session && onSignOut && (
            <div className="pt-4 border-t border-zinc-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:w-auto"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                {t.settings_sign_out ?? "Sign out"}
              </button>
            </div>
          )}
            </div>
          )}

          {activeSettingsSection === "profile" && setProfileFullName && setProfilePhone && onSaveProfile && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {tl.settingsProfile ?? tl.myProfile ?? ""}
              </h3>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.name ?? ""}</label>
                <input
                  type="text"
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                  className="w-full max-w-md rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.email ?? "Email"}</label>
                <input
                  type="email"
                  value={profileEmail}
                  readOnly
                  className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-slate-600 bg-zinc-100 dark:bg-slate-800/50 px-4 py-3 text-sm text-zinc-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {tl.phone ?? "Phone"}
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full max-w-md rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.language}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {tl.profilePhoto ??
                    tl.avatar ??
                    tl.companyLogo ??
                    ""}
                </label>
                {profileAvatarUrl ? (
                  <img
                    src={profileAvatarUrl}
                    alt=""
                    className="mb-3 h-20 w-20 rounded-full object-cover border border-zinc-200 dark:border-slate-700"
                  />
                ) : null}
                {onProfileAvatarUpload ? (
                  <button
                    type="button"
                    onClick={onProfileAvatarUpload}
                    className="w-full max-w-md min-h-[44px] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 px-4 py-3 text-sm"
                  >
                    {tl.profilePhoto ?? "Profile photo"}
                  </button>
                ) : null}
              </div>
              {onRequestPasswordReset ? (
                <button
                  type="button"
                  onClick={() => void onRequestPasswordReset()}
                  disabled={passwordResetBusy}
                  className="w-full max-w-md min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {tl.changePassword ?? ""}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onSaveProfile()}
                disabled={profileSaveBusy}
                className="w-full max-w-md min-h-[44px] rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {t.save ?? ""}
              </button>
            </div>
          )}

          {activeSettingsSection === "notifications" && session?.access_token && companyId && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
                {tl.settingsNotifications ??
                  tl.push_section_title ??
                  ""}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-lg">
                {tl.settings_notifications_empty ??
                  "Enable push to receive alerts on this device."}
              </p>
              <section className="space-y-4">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3 min-h-[44px]">
                <span className="text-sm text-zinc-800 dark:text-zinc-200">
                  {tl.push_enable ?? "Enable push"}
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
                        showToast("success", tl.push_saved ?? "Saved");
                      } else if (r.reason === "denied") {
                        showToast("warning", tl.push_permission_denied ?? "");
                        setPushSubscribed(false);
                      } else {
                        showToast("error", tl.toast_error ?? "Error");
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
                        showToast("success", tl.push_saved ?? "Saved");
                      } catch {
                        showToast("error", tl.toast_error ?? "Error");
                        setPushSubscribed(true);
                      }
                    }
                    setPushBusy(false);
                  }}
                />
              </label>
              <div className="space-y-2">
                {canManageCompliance
                  ? (
                    [
                      ["hazard", prefHazard, "push_type_hazard"] as const,
                      ["action", prefAction, "push_type_action"] as const,
                    ] as const
                  ).map(([key, checked, labelKey]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3 min-h-[44px] cursor-pointer"
                    >
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {tl[labelKey] ?? labelKey}
                      </span>
                      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(ev) => persistPushPref(key, ev.target.checked)}
                        />
                        <span
                          className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                          aria-hidden
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : ""}`}
                          />
                        </span>
                      </span>
                    </label>
                  ))
                  : null}
                {canManageProjectVisitors ? (
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3 min-h-[44px] cursor-pointer">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {tl.push_type_visitor ?? "Visitor alerts"}
                    </span>
                    <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={prefVisitor}
                        onChange={(ev) => persistPushPref("visitor", ev.target.checked)}
                      />
                      <span
                        className={`relative h-7 w-12 rounded-full transition-colors ${prefVisitor ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                        aria-hidden
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${prefVisitor ? "translate-x-[22px]" : ""}`}
                        />
                      </span>
                    </span>
                  </label>
                ) : null}
                {(
                  [
                    [prefNewEmployees, setPrefNewEmployees, "machinpro_push_new_employees", "notif_new_employees"] as const,
                    [prefVacationReq, setPrefVacationReq, "machinpro_push_vacation_requests", "notif_vacation_requests"] as const,
                    [prefDailyReports, setPrefDailyReports, "machinpro_push_daily_reports", "notif_daily_reports"] as const,
                    [prefNewVisitors, setPrefNewVisitors, "machinpro_push_new_visitors", "notif_new_visitors"] as const,
                    [prefUserLimit, setPrefUserLimit, "machinpro_push_user_limit", "notif_user_limit"] as const,
                  ] as const
                ).map(([checked, setSt, storageKey, labelKey]) => (
                  <label
                    key={storageKey}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-slate-700 px-4 py-3 min-h-[44px] cursor-pointer"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{tl[labelKey] ?? labelKey}</span>
                    <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(ev) => {
                          const on = ev.target.checked;
                          try {
                            localStorage.setItem(storageKey, on ? "1" : "0");
                          } catch {
                            /* ignore */
                          }
                          setSt(on);
                        }}
                      />
                      <span
                        className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                        aria-hidden
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : ""}`}
                        />
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
            </div>
          )}

          {activeSettingsSection === "company" && canEditCompanyProfile ? (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {tl.settingsCompany ?? ""}
              </h3>

              <section className="pt-0">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">{t.companyIdentity ?? "Company identity"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.companyName ?? "Company name"}</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => onCompanyNameChange(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t.companyLogo ?? "Company logo"}</label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                      {t.logoHint ?? "Logo will appear in reports and PDF forms"}
                    </p>
                    {logoUrl ? (
                      <div className="mb-3 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                        <BrandLogoImage
                          src={logoUrl}
                          alt={t.companyLogo ?? "Logo"}
                          boxClassName="h-16 w-full max-w-[280px]"
                          sizes="280px"
                          scale={1.15}
                        />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={onLogoUpload}
                      className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-500 dark:hover:border-amber-500 dark:hover:text-amber-400 transition-colors min-h-[44px] w-full"
                    >
                      {t.uploadLogo ?? "Upload logo"}
                    </button>
                  </div>
                  {onCompanyAddressChange ? (
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {tl.company_address ?? "Address"}
                      </label>
                      <textarea
                        value={companyAddress}
                        onChange={(e) => onCompanyAddressChange(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  ) : null}
                  {onCompanyPhoneChange ? (
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {tl.company_phone ?? "Phone"}
                      </label>
                      <input
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => onCompanyPhoneChange(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  ) : null}
                  {onCompanyEmailChange ? (
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {tl.company_email ?? "Contact email"}
                      </label>
                      <input
                        type="email"
                        value={companyEmail}
                        onChange={(e) => onCompanyEmailChange(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  ) : null}
                  {onCompanyWebsiteChange ? (
                    <div>
                      <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {tl.company_website ?? "Website"}
                      </label>
                      <input
                        type="url"
                        value={companyWebsite}
                        onChange={(e) => onCompanyWebsiteChange(e.target.value)}
                        placeholder={tl.settings_website_placeholder ?? "https://"}
                        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  ) : null}
                  {onSaveCompanyProfile ? (
                    <button
                      type="button"
                      onClick={() => void onSaveCompanyProfile()}
                      disabled={companyProfileSaveBusy}
                      className="w-full max-w-md min-h-[44px] rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 sm:w-auto"
                    >
                      {companyProfileSaveBusy ? (tl.company_profile_saving ?? "Saving…") : (t.save ?? "Save")}
                    </button>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {activeSettingsSection === "regional" && (canManageRegionalConfig || canEditCompanyProfile) ? (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {tl.settings_regional_title ?? tl.settingsRegional ?? ""}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tl.settings_regional_advanced_hint ?? ""}
              </p>

              {canEditCompanyProfile ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {t.countryRegion ?? "Country / Region"}
                    </label>
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
                          {meta.symbol} — {code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {tl.settings_number_format ?? "Number format"}
                    </label>
                    <select
                      value={numberFormat}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNumberFormat(v);
                        persistLocalePref("machinpro_number_format", v);
                      }}
                      className="w-full max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                    >
                      <option value="comma_decimal">1.000,00</option>
                      <option value="comma_thousands">1,000.00</option>
                    </select>
                  </div>
                </>
              ) : null}

              {canManageRegionalConfig ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {tl.settingsTimezone ?? "Time zone"}
                  </label>
                  <select
                    value={regionalTimezone}
                    onChange={(e) => handleRegionalTimezoneChange(e.target.value)}
                    className="w-full max-w-md rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
                  >
                    {regionalTimezone &&
                    isValidIanaTimeZone(regionalTimezone) &&
                    !groupedZoneList.includes(regionalTimezone) ? (
                      <option value={regionalTimezone}>
                        {cityLabelFromIana(regionalTimezone)} ({tl.settings_tz_custom ?? "Custom"})
                      </option>
                    ) : null}
                    {REGIONAL_TIMEZONE_GROUPS.map((g) => (
                      <optgroup key={g.labelKey} label={tl[g.labelKey] ?? g.labelKey}>
                        {g.zones.map((z) => (
                          <option key={z} value={z}>
                            {cityLabelFromIana(z)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeSettingsSection === "compliance" && canManageCompliance ? (
              <section className="space-y-4">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                  {tl.settingsCompliance ?? t.complianceFields ?? ""}
                </h3>
                {complianceFields.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 dark:border-slate-600 bg-zinc-50/50 dark:bg-slate-800/40 px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400 text-center">
                    {tl.compliance_fields_empty ?? "No compliance fields yet. Add one below."}
                  </p>
                ) : null}
                <div className="space-y-6">
                  {complianceByTarget.employee.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users
                          className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-hidden
                        />
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {t.employees ?? "Employees"}
                        </h4>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                          ({complianceByTarget.employee.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {complianceByTarget.employee.map((field) => renderComplianceFieldRow(field, "emp"))}
                      </div>
                    </div>
                  ) : null}
                  {complianceByTarget.subcontractor.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <HardHat
                          className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-hidden
                        />
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {t.subcontractors ?? "Subcontractors"}
                        </h4>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                          ({complianceByTarget.subcontractor.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {complianceByTarget.subcontractor.map((field) =>
                          renderComplianceFieldRow(field, "sub")
                        )}
                      </div>
                    </div>
                  ) : null}
                  {complianceByTarget.vehicle.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-start gap-2">
                        <Truck
                          className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                              {t.vehicles ?? "Vehicles"}
                            </h4>
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                              ({complianceByTarget.vehicle.length})
                            </span>
                            <span className="inline-flex min-h-[24px] items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-200">
                              {tl.compliance_vehicles_badge ?? tl.compliance_vehicles_hint ?? ""}
                            </span>
                          </div>
                          {(tl.compliance_vehicles_hint ?? "").trim() ? (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {tl.compliance_vehicles_hint}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {complianceByTarget.vehicle.map((field) => renderComplianceFieldRow(field, "veh"))}
                      </div>
                    </div>
                  ) : null}
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
                  + {t.addComplianceField ?? "Add compliance field"}
                </button>
              </section>
          ) : null}

          {activeSettingsSection === "billing" && showBillingSection && billingSection && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {tl.settingsBilling ?? ""}
              </h3>
              <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/50 dark:bg-slate-800/30 p-4 sm:p-6">
                {billingSection}
              </div>
            </div>
          )}

          {activeSettingsSection === "help" && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                {tl.helpAndTutorials ?? ""}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-prose">{tl.helpSectionIntro ?? ""}</p>

              <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {tl.help_email_support ?? "Support email"}
                  </p>
                  <a
                    href={`mailto:${tl.help_support_email_value ?? "support@machin.pro"}`}
                    className="mt-1 block text-base font-medium text-zinc-900 dark:text-zinc-100 break-all hover:text-orange-600 dark:hover:text-orange-400"
                  >
                    {tl.help_support_email_value ?? "support@machin.pro"}
                  </a>
                </div>
                <a
                  href={`mailto:${tl.help_support_email_value ?? "support@machin.pro"}`}
                  className="inline-flex min-h-[44px] w-full max-w-sm items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 sm:w-auto"
                >
                  {tl.help_contact_support ?? "Contact support"}
                </a>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-slate-700 p-4 space-y-2">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tl.help_documentation ?? "Documentation"}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{tl.help_documentation_hint ?? ""}</p>
                <a
                  href={tl.help_documentation_url ?? "https://docs.machin.pro"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline break-all"
                >
                  {tl.help_documentation_url ?? "https://docs.machin.pro"}
                </a>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tl.help_faq_title ?? "FAQ"}</h4>
                <div className="space-y-2">
                  {(
                    [
                      [tl.help_faq_invite, tl.help_faq_invite_answer],
                      [tl.help_faq_project, tl.help_faq_project_answer],
                      [tl.help_faq_daily, tl.help_faq_daily_answer],
                      [tl.help_faq_language, tl.help_faq_language_answer],
                      [tl.help_faq_support, tl.help_faq_support_answer],
                    ] as const
                  ).map(([q, a], i) => (
                    <details
                      key={i}
                      className="group rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 open:ring-1 open:ring-orange-200/80 dark:open:ring-orange-900/40"
                    >
                      <summary className="cursor-pointer list-none px-4 py-3 min-h-[44px] flex items-center text-sm font-medium text-zinc-900 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
                        <span className="flex-1 pr-2">{q}</span>
                        <span className="text-zinc-400 group-open:rotate-180 transition-transform" aria-hidden>
                          ▾
                        </span>
                      </summary>
                      <p className="px-4 pb-4 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {complianceModalOpen && canManageCompliance && onComplianceFieldsChange && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" aria-hidden onClick={() => { setComplianceModalOpen(false); setEditingComplianceField(null); }} />
          <div role="dialog" aria-modal className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              {editingComplianceField ? (t.edit ?? "Edit") : (t.addComplianceField ?? "Add compliance field")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.name ?? "Name"} *</label>
                <input
                  type="text"
                  value={complianceDraft.name ?? ""}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.description ?? "Description"}</label>
                <textarea
                  value={complianceDraft.description ?? ""}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[80px] resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t.category ?? "Type"}</label>
                <select
                  value={complianceDraft.fieldType ?? "date"}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, fieldType: e.target.value as ComplianceFieldType }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px]"
                >
                  <option value="date">{t.fieldTypeDate ?? "Expiry date"}</option>
                  <option value="document">{t.document ?? "Document URL"}</option>
                  <option value="text">{t.text ?? "Text"}</option>
                  <option value="checkbox">{t.checkbox ?? "Yes / No"}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t.appliesTo ?? "Applies to"}</label>
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
                        {targetKey === "employee" ? (t.employees ?? "Employees") : targetKey === "subcontractor" ? (t.subcontractors ?? "Subcontractors") : (t.vehicles ?? "Vehicles")}
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
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.required ?? "Required"}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {tl.compliance_alert_days_label ?? t.alertBefore ?? "Remind (days before expiry)"}
                </label>
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
                {t.cancel ?? "Cancel"}
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
                {t.save ?? "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
