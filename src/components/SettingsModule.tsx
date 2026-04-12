"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  Sliders,
  LogOut,
  Bell,
  HelpCircle,
  Settings,
  User,
  Building2,
  Globe,
  CreditCard,
  Shield,
  Factory,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useToast } from "@/components/Toast";
import { registerPushSubscription, unsubscribeFromPush } from "@/lib/pushNotifications";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { LANGUAGES, CURRENCY_META, ALL_TRANSLATIONS } from "@/lib/i18n";
import type { Language } from "@/types/shared";
import {
  DEFAULT_IANA_TIMEZONE,
  isValidIanaTimeZone,
  resolveUserTimezone,
} from "@/lib/dateUtils";
import { REGIONAL_TIMEZONE_GROUPS, allGroupedTimezones, cityLabelFromIana } from "@/lib/regionalTimezones";
import { REGIONAL_COUNTRY_DEFAULTS as COUNTRY_DEFAULTS, REGIONAL_COUNTRIES as COUNTRIES } from "@/lib/regionalCountries";
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";
import { supabase } from "@/lib/supabase";
import type { Factor } from "@supabase/supabase-js";
import type { CatalogItem } from "@/lib/productionCatalog";
import { ProductionCatalogSettingsSection } from "@/components/ProductionCatalogSettingsSection";

const SETTINGS_SUPPORT_EMAIL = "support@machin.pro";

export interface SettingsModuleProps {
  labels: Record<string, string>;
  language: Language;
  setLanguage: (lang: Language) => void;
  currency: string;
  setCurrency: (c: string) => void;
  measurementSystem: "metric" | "imperial";
  setMeasurementSystem: (v: "metric" | "imperial") => void;
  canEditCompanyProfile: boolean;
  /** Alertas push de incidencias / acciones correctivas (antes ligado a permiso compliance). */
  canManageHazardActionPush?: boolean;
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
  /** AH-20: share GPS during active shift (saved in user_profiles). */
  profileLocationSharingEnabled?: boolean;
  setProfileLocationSharingEnabled?: (v: boolean) => void;
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
  /** TOTP MFA (admin / supervisor). */
  showMfaSecuritySection?: boolean;
  /** Notificaciones push y preferencias (canManageNotifications). */
  canManageNotifications?: boolean;
  /** Catálogo de producción (piecework). */
  canManageProductionCatalog?: boolean;
  productionCatalogItems?: CatalogItem[];
  onRefreshProductionCatalog?: () => void;
  productionCatalogCurrencyDefault?: string;
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
  canManageHazardActionPush = false,
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
  profileLocationSharingEnabled = true,
  setProfileLocationSharingEnabled,
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
  showMfaSecuritySection = false,
  canManageNotifications = false,
  canManageProductionCatalog = false,
  productionCatalogItems = [],
  onRefreshProductionCatalog,
  productionCatalogCurrencyDefault = "CAD",
}: SettingsModuleProps) {
  const tl = t as Record<string, string>;
  const { showToast } = useToast();
  const [autoSetupMessage, setAutoSetupMessage] = useState<string | null>(null);
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

  const [mfaVerifiedFactorId, setMfaVerifiedFactorId] = useState<string | null>(null);
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaPendingFactorId, setMfaPendingFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);

  const refreshMfaFactors = useCallback(async () => {
    if (!showMfaSecuritySection || !session?.access_token) return;
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return;
    const v = (data.totp ?? []).find((f: Factor) => f.status === "verified");
    setMfaVerifiedFactorId(v?.id ?? null);
  }, [showMfaSecuritySection, session?.access_token]);

  useEffect(() => {
    void refreshMfaFactors();
  }, [refreshMfaFactors]);

  type SettingsSectionId =
    | "general"
    | "profile"
    | "company"
    | "notifications"
    | "regional"
    | "production"
    | "billing"
    | "help";

  const sectionNavIcons: Record<SettingsSectionId, typeof Settings> = {
    general: Settings,
    profile: User,
    company: Building2,
    notifications: Bell,
    regional: Globe,
    production: Factory,
    billing: CreditCard,
    help: HelpCircle,
  };

  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>("general");
  const [regionalTimezone, setRegionalTimezone] = useState(DEFAULT_IANA_TIMEZONE);

  const settingsNavEntries = useMemo(() => {
    const raw = [
      ["general", tl.settings_general_title ?? tl.settingsGeneral ?? t.tabGeneral ?? ""] as const,
      ["profile", tl.settingsProfile ?? ""] as const,
      ["company", tl.settingsCompany ?? ""] as const,
      ["notifications", tl.settingsNotifications ?? ""] as const,
      ["regional", tl.settings_regional_title ?? tl.settingsRegional ?? ""] as const,
      ["production", tl.production_catalog_title ?? ""] as const,
      ["billing", tl.settingsBilling ?? ""] as const,
      ["help", tl.helpAndTutorials ?? ""] as const,
    ] as const;
    return raw.filter(([id]) => {
      if (id === "company") return canEditCompanyProfile;
      if (id === "notifications")
        return !!(session?.access_token && companyId && canManageNotifications);
      if (id === "regional") return canManageRegionalConfig || canEditCompanyProfile;
      if (id === "production")
        return !!(canManageProductionCatalog && companyId && onRefreshProductionCatalog);
      if (id === "billing") return showBillingSection && !!billingSection;
      return true;
    });
  }, [
    tl,
    t,
    canEditCompanyProfile,
    session?.access_token,
    companyId,
    canManageRegionalConfig,
    showBillingSection,
    billingSection,
    canManageNotifications,
    canManageProductionCatalog,
    companyId,
    onRefreshProductionCatalog,
  ]);

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
    if (!focusHelpSectionSignal) return;
    setActiveSettingsSection("help");
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

  return (
    <section className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6 md:space-y-8 md:p-8 lg:p-10">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <Sliders className="h-5 w-5" />
        {t.settings}
      </h2>

      <div className="md:hidden min-w-0 -mx-1">
        <HorizontalScrollFade variant="inherit">
          <div
            className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0"
            role="tablist"
            aria-label={t.settings || ALL_TRANSLATIONS.en.settings}
          >
            {settingsNavEntries.map(([id, label]) => {
              const NavIcon = sectionNavIcons[id];
              const active = activeSettingsSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSettingsSection(id)}
                  className={`inline-flex shrink-0 items-center gap-2 min-h-[44px] rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    active
                      ? "border-amber-400 bg-amber-100 text-amber-950 ring-2 ring-amber-400/60 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-500/40"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-zinc-200"
                  }`}
                >
                  <NavIcon
                    className={`h-4 w-4 shrink-0 ${active ? "text-amber-700 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400"}`}
                    aria-hidden
                  />
                  <span className="max-w-[140px] truncate sm:max-w-none">{label}</span>
                </button>
              );
            })}
          </div>
        </HorizontalScrollFade>
      </div>

      <div className="flex min-h-0 flex-col overflow-x-hidden md:flex-row md:items-start md:gap-0">
        <nav
          className="hidden w-full shrink-0 flex-col gap-1 md:flex md:w-72 md:min-w-[18rem] md:max-w-[18rem] md:flex-shrink-0 md:border-r md:border-zinc-200 md:pr-4 dark:md:border-slate-700 lg:w-80 lg:min-w-[20rem] lg:max-w-[20rem] lg:pr-5"
          aria-label={t.settings || ALL_TRANSLATIONS.en.settings}
        >
          {settingsNavEntries.map(([id, label]) => {
            const NavIcon = sectionNavIcons[id];
            const active = activeSettingsSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSettingsSection(id)}
                className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber-100 text-amber-950 dark:bg-amber-900/35 dark:text-amber-100"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-slate-800"
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

        <div className="min-w-0 w-full flex-1 space-y-6 md:min-w-0 md:flex-1 md:pl-6">
          {activeSettingsSection === "general" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Settings className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
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
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={onReopenOnboarding}
                className="w-full max-w-md min-h-[44px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-900/40 sm:w-auto"
              >
                {tl.settings_reopen_onboarding ?? tl.onboarding_reopen ?? ""}
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
                {tl.settings_reopen_onboarding_hint ??
                  "Reconfigure your company name, country and currency"}
              </p>
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

          {activeSettingsSection === "profile" &&
            setProfileFullName &&
            setProfilePhone &&
            onSaveProfile &&
            setProfileLocationSharingEnabled && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <User className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
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
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t.email ?? "Email"}</label>
                  <span className="inline-flex min-h-[22px] items-center rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-400">
                    {tl.settings_email_readonly ?? "Read-only"}
                  </span>
                </div>
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
              <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/40 px-4 py-3 space-y-2 max-w-md">
                <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[44px]">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {tl.gps_location_sharing ?? ""}
                  </span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                    checked={profileLocationSharingEnabled}
                    onChange={(e) => setProfileLocationSharingEnabled(e.target.checked)}
                  />
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {tl.gps_location_sharing_hint ?? ""}
                </p>
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

              {showMfaSecuritySection && session?.access_token ? (
                <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/40 px-4 py-4 space-y-3 max-w-md">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    {tl.mfa_title ?? ""}
                  </h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {mfaVerifiedFactorId ? (tl.mfa_status_active ?? "") : (tl.mfa_status_inactive ?? "")}
                  </p>
                  {mfaMessage ? (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{mfaMessage}</p>
                  ) : null}

                  {!mfaEnrolling ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={mfaBusy || !!mfaVerifiedFactorId}
                        onClick={() => void (async () => {
                          setMfaBusy(true);
                          setMfaMessage(null);
                          const { data: en, error: enErr } = await supabase.auth.mfa.enroll({
                            factorType: "totp",
                            friendlyName: "MachinPro",
                            issuer: "MachinPro",
                          });
                          setMfaBusy(false);
                          if (enErr || !en?.id) {
                            setMfaMessage(tl.mfa_error ?? "");
                            return;
                          }
                          setMfaPendingFactorId(en.id);
                          const qr =
                            en.factor_type === "totp" && en.totp?.qr_code ? String(en.totp.qr_code) : "";
                          setMfaQr(qr || null);
                          setMfaEnrolling(true);
                          setMfaCode("");
                        })()}
                        className="min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
                      >
                        {tl.mfa_enable_btn ?? ""}
                      </button>
                      <button
                        type="button"
                        disabled={mfaBusy || !mfaVerifiedFactorId}
                        onClick={() => void (async () => {
                          if (!mfaVerifiedFactorId) return;
                          setMfaBusy(true);
                          setMfaMessage(null);
                          const { error: unErr } = await supabase.auth.mfa.unenroll({
                            factorId: mfaVerifiedFactorId,
                          });
                          setMfaBusy(false);
                          if (unErr) {
                            setMfaMessage(tl.mfa_error ?? "");
                            return;
                          }
                          setMfaVerifiedFactorId(null);
                          setMfaMessage(tl.mfa_disabled_success ?? "");
                          showToast("success", tl.mfa_disabled_success ?? "");
                          void refreshMfaFactors();
                        })()}
                        className="min-h-[44px] rounded-xl border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-800 dark:text-red-200 disabled:opacity-50"
                      >
                        {tl.mfa_disable_btn ?? ""}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{tl.mfa_scan_qr ?? ""}</p>
                      {mfaQr ? (
                        <img src={mfaQr} alt="" className="mx-auto h-40 w-40 rounded-lg border border-zinc-200 dark:border-slate-600" />
                      ) : null}
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {tl.mfa_enter_code ?? ""}
                        <input
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={mfaBusy || !mfaPendingFactorId || mfaCode.trim().length < 6}
                          onClick={() => void (async () => {
                            if (!mfaPendingFactorId) return;
                            setMfaBusy(true);
                            setMfaMessage(null);
                            const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
                              factorId: mfaPendingFactorId,
                              code: mfaCode.trim(),
                            });
                            setMfaBusy(false);
                            if (vErr) {
                              setMfaMessage(tl.mfa_error ?? "");
                              return;
                            }
                            setMfaEnrolling(false);
                            setMfaQr(null);
                            setMfaPendingFactorId(null);
                            setMfaCode("");
                            await refreshMfaFactors();
                            setMfaMessage(tl.mfa_success ?? "");
                            showToast("success", tl.mfa_success ?? "");
                          })()}
                          className="min-h-[44px] rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                        >
                          {tl.mfa_verify_btn ?? ""}
                        </button>
                        <button
                          type="button"
                          disabled={mfaBusy}
                          onClick={() => {
                            setMfaEnrolling(false);
                            setMfaQr(null);
                            setMfaPendingFactorId(null);
                            setMfaCode("");
                            setMfaMessage(null);
                          }}
                          className="min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium"
                        >
                          {tl.common_cancel ?? t.cancel ?? ""}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                  {tl.notifications_push_enable ?? tl.push_enable ?? "Enable push"}
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
                        showToast(
                          "success",
                          tl.notifications_push_enabled ?? tl.push_saved ?? "Saved"
                        );
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
                        showToast(
                          "success",
                          tl.notifications_push_disabled ?? tl.push_saved ?? "Saved"
                        );
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
                {canManageHazardActionPush
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
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  {tl.settingsCompany ?? ""}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
                  {tl.settings_company_hint ??
                    "Your information will appear in documents and PDF reports"}
                </p>
              </div>

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
                      <AddressAutocomplete
                        value={companyAddress}
                        onChange={onCompanyAddressChange}
                        placeholder={tl.company_address ?? ""}
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
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Globe className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
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
                      className="w-full min-w-0 sm:max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
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
                      className="w-full min-w-0 sm:max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 min-h-[44px] focus:ring-2 focus:ring-amber-500"
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
                      className="w-full min-w-0 sm:max-w-xs rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
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
                    className="w-full min-w-0 sm:max-w-md max-h-[min(50vh,320px)] overflow-y-auto rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm min-h-[44px]"
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

          {activeSettingsSection === "production" &&
            canManageProductionCatalog &&
            companyId &&
            onRefreshProductionCatalog && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Factory className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  {tl.production_catalog_title ?? ""}
                </h3>
                <ProductionCatalogSettingsSection
                  labels={tl}
                  companyId={companyId}
                  currencyDefault={productionCatalogCurrencyDefault}
                  items={productionCatalogItems}
                  onRefresh={onRefreshProductionCatalog}
                />
              </div>
            )}

          {activeSettingsSection === "billing" && showBillingSection && billingSection && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
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
              <Link
                href={`/help?lang=${language}`}
                className="inline-flex min-h-[44px] items-center text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                {tl.help_center_link ?? "Centro de ayuda (machin.pro/help)"}
              </Link>

              <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50/60 dark:bg-slate-800/40 p-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {tl.help_email_support ?? "Support email"}
                  </p>
                  <a
                    href={`mailto:${SETTINGS_SUPPORT_EMAIL}`}
                    className="mt-1 block text-base font-medium text-zinc-900 dark:text-zinc-100 break-all hover:text-orange-600 dark:hover:text-orange-400"
                  >
                    {tl.help_support_email_value?.trim() || SETTINGS_SUPPORT_EMAIL}
                  </a>
                </div>
                <a
                  href={`mailto:${SETTINGS_SUPPORT_EMAIL}`}
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
    </section>
  );
}
