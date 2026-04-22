"use client";

import { useCallback, useMemo, useState } from "react";
import { CreditCard, AlertTriangle, Sparkles, ExternalLink, LayoutGrid, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/lib/useSubscription";
import type { PlanKey } from "@/lib/stripe";
import { PricingModule } from "@/components/PricingModule";
import type { UserRole } from "@/types/shared";
import { formatDate } from "@/lib/dateUtils";
import { useMachinProDisplayPrefs } from "@/hooks/useMachinProDisplayPrefs";
import { planUsersDescriptionI18nKey } from "@/lib/stripe";
import { usePPPPricing } from "@/hooks/usePPPPricing";

export interface BillingModuleProps {
  t: Record<string, string>;
  companyId: string;
  companyName?: string | null;
  email?: string | null;
  employeesCount: number;
  projectsCount: number;
  storageUsedGb: number;
  /** Rol efectivo en la app (p. ej. admin para facturación). */
  userRole: UserRole;
  dateLocale: string;
  timeZone: string;
}

const TRIAL_TOTAL_DAYS = 14;

function statusLabel(
  t: Record<string, string>,
  status: string | undefined
): string {
  switch (status) {
    case "active":
      return t.billing_status_active ?? "Active";
    case "trialing":
      return t.subscription_status_trialing ?? t.billing_status_trialing ?? "In trial";
    case "past_due":
      return t.billing_status_past_due ?? "Past due";
    case "canceled":
      return t.billing_status_canceled ?? "Canceled";
    default:
      return status ?? "—";
  }
}

function pct(used: number, limit: number | null | undefined): number {
  if (limit == null || limit <= 0 || limit >= 999000) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function planDisplayName(t: Record<string, string>, plan: string | undefined): string {
  if (!plan) return "—";
  const lx = t as Record<string, string>;
  const key = plan.toLowerCase().trim();
  const pk = `plan_${key}`;
  if (lx[pk]) return lx[pk];
  const pkOld = `pricing_${key}`;
  if (lx[pkOld]) return lx[pkOld];
  const legacy: Record<string, string> = {
    trial: lx.pricing_plan_trial ?? lx.subscription_status_trialing ?? "Trial",
    starter: lx.plan_esencial ?? "Esencial",
    foundation: lx.plan_esencial ?? "Esencial",
    horarios: lx.plan_esencial ?? "Esencial",
    esencial: lx.plan_esencial ?? "Esencial",
    pro: lx.plan_operaciones ?? "Operaciones",
    obras: lx.plan_operaciones ?? "Operaciones",
    operaciones: lx.plan_operaciones ?? "Operaciones",
    professional: lx.plan_operaciones ?? "Operaciones",
    logistica: lx.plan_logistica ?? "Logística",
    enterprise: lx.plan_todo_incluido ?? "Todo Incluido",
    todo_incluido: lx.plan_todo_incluido ?? "Todo Incluido",
  };
  return legacy[key] ?? plan;
}

export function BillingModule({
  t,
  companyId,
  companyName,
  email,
  employeesCount,
  projectsCount,
  storageUsedGb,
  userRole,
  dateLocale,
  timeZone,
}: BillingModuleProps) {
  void useMachinProDisplayPrefs();
  const ppp = usePPPPricing();
  const lx = t as Record<string, string>;
  const {
    subscription,
    loading,
    refresh,
    isTrial,
    trialDaysLeft,
    alerts,
  } = useSubscription(companyId);
  const [portalLoading, setPortalLoading] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const openPortal = useCallback(async () => {
    setLocalError(null);
    setPortalLoading(true);
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      const token = session?.access_token;
      if (!token) {
        setLocalError(t.billing_no_company ?? "Session required");
        setPortalLoading(false);
        return;
      }
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setLocalError(data.error ?? (t.billing_loading ?? "Error"));
        setPortalLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setLocalError(t.billing_loading ?? "Error");
    } finally {
      setPortalLoading(false);
    }
  }, [companyId, t]);

  const trialProgress = useMemo(() => {
    if (trialDaysLeft == null || trialDaysLeft <= 0) return 100;
    return Math.min(
      100,
      Math.max(0, ((TRIAL_TOTAL_DAYS - trialDaysLeft) / TRIAL_TOTAL_DAYS) * 100)
    );
  }, [trialDaysLeft]);

  const seatsLimit = subscription?.seats_limit ?? null;
  const projectsLimit = subscription?.projects_limit ?? null;
  const storageLimit = subscription?.storage_limit_gb ?? null;

  const currentPlanKey = subscription?.plan as PlanKey | undefined;

  const overUsers =
    seatsLimit != null && seatsLimit > 0 && seatsLimit < 999000 && employeesCount > seatsLimit;
  const overProjects =
    projectsLimit != null &&
    projectsLimit > 0 &&
    projectsLimit < 999000 &&
    projectsCount > projectsLimit;
  const overStorage =
    storageLimit != null && storageLimit > 0 && storageUsedGb > storageLimit;

  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-10"
      data-section-user-role={userRole}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {t.billing_title ?? "Billing"}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t.pricing_current_plan ?? t.billing_plan_current ?? "Current plan"}:{" "}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {planDisplayName(t, subscription?.plan)}
            </span>
          </p>
          {(() => {
            const dk = planUsersDescriptionI18nKey(subscription?.plan);
            const line = (t as Record<string, string>)[dk];
            return line ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug max-w-lg">
                {line}
              </p>
            ) : null;
          })()}
        </div>
        <div className="flex flex-col xs:flex-row gap-2">
          <button
            type="button"
            onClick={() => setPricingOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <LayoutGrid className="h-4 w-4" />
            {t.pricing_upgrade ?? t.billing_change_plan ?? "Change plan"}
          </button>
          <button
            type="button"
            disabled={portalLoading || !subscription?.stripe_customer_id}
            onClick={() => void openPortal()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            {portalLoading ? (t.billing_loading ?? "…") : (t.billing_manage ?? "Manage subscription")}
            <ExternalLink className="h-4 w-4 opacity-80" />
          </button>
          <button
            type="button"
            disabled={portalLoading || !subscription?.stripe_customer_id}
            onClick={() => void openPortal()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-500/60 bg-transparent hover:bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-200 disabled:opacity-50"
          >
            <Users className="h-4 w-4" />
            {t.billing_add_seats ?? t.pricing_extra_user ?? "Add seats"}
          </button>
        </div>
      </div>

      {localError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {localError}
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500 mb-6">{t.billing_loading ?? "Loading…"}</p>
      )}

      {isTrial && trialDaysLeft != null && trialDaysLeft > 0 && (
        <div
          className={`mb-6 rounded-2xl border p-4 sm:p-6 ${
            trialDaysLeft <= 7
              ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/50"
              : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
          }`}
        >
          <div className="flex items-start gap-3">
            <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                {t.billing_trial_banner ?? "Trial"}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                {(t.billing_trial_days_left ?? "{n} days left").replace(
                  "{n}",
                  String(trialDaysLeft)
                )}
              </p>
              {trialDaysLeft <= 7 && alerts.some((a) => a.type === "trial_ending") && (
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mt-2">
                  {t.billing_upgrade ?? "Upgrade"}
                </p>
              )}
              <div className="mt-3 h-2 rounded-full bg-amber-200/80 dark:bg-amber-900/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${trialProgress}%` }}
                />
              </div>
              {ppp.pricingReady && ppp.tier > 1 ? (
                <p className="mt-3 text-xs font-medium text-amber-900/95 dark:text-amber-100/95">
                  {ppp.tier === 2
                    ? (lx.ppp_tier2_note ?? lx.ppp_badge ?? "")
                    : (lx.ppp_tier3_note ?? lx.ppp_badge ?? "")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {(overUsers || overProjects || overStorage) && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-4 flex flex-col sm:flex-row sm:items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-100 flex-1">
            {t.billing_overage_notice ??
              "You're above your plan limits. You can keep working — upgrade or add seats when ready."}
          </p>
        </div>
      )}

      {alerts.some((a) => a.type === "past_due") && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-900 dark:text-red-100">
              {t.billing_status_past_due ?? "Past due"}
            </p>
            <p className="text-sm text-red-800 dark:text-red-200">
              {t.billing_update_payment ?? "Update your payment method to avoid interruption."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openPortal()}
            className="min-h-[44px] shrink-0 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {t.billing_update_payment ?? "Update payment"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 p-4 sm:p-6 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t.billing_plan_current ?? "Subscription"}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t.billing_field_status ?? "Status"}</dt>
            <dd className="font-medium text-gray-900 dark:text-white mt-1">
              {statusLabel(t, subscription?.status)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">{t.billing_next_charge ?? "Next billing"}</dt>
            <dd className="font-medium text-gray-900 dark:text-white mt-1">
              {subscription?.current_period_end
                ? formatDate(subscription.current_period_end, dateLocale, timeZone)
                : (t.billing_no_payment_scheduled ?? "—")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 p-4 sm:p-6 shadow-sm mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t.billing_usage_title ?? "Usage & limits"}
        </h2>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">{t.billing_limit_users ?? "Users"}</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {employeesCount} / {seatsLimit != null && seatsLimit < 999000 ? seatsLimit : "∞"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  seatsLimit != null &&
                  seatsLimit > 0 &&
                  seatsLimit < 999000 &&
                  employeesCount >= seatsLimit
                    ? employeesCount > seatsLimit
                      ? "bg-red-500"
                      : "bg-orange-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${pct(employeesCount, seatsLimit)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">{t.billing_limit_projects ?? "Projects"}</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {projectsCount} / {projectsLimit != null && projectsLimit < 999000 ? projectsLimit : "∞"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${pct(projectsCount, projectsLimit)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">{t.billing_limit_storage ?? "Storage"}</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {storageUsedGb.toFixed(1)} GB / {storageLimit != null ? `${storageLimit} GB` : "—"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${pct(storageUsedGb, storageLimit)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 text-center sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t.billing_invoices_title ?? "Invoices"}
        </h2>
        <div className="mt-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
          <div className="flex min-w-0 snap-x snap-mandatory gap-3 pb-2 sm:block sm:snap-none">
            <div className="min-w-[min(100%,280px)] shrink-0 snap-start rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:min-w-0 sm:snap-align-none">
              <p className="leading-snug">{t.billing_invoices_placeholder ?? "Invoice history will appear here."}</p>
            </div>
          </div>
        </div>
      </div>

      {pricingOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="min-h-full flex items-start justify-center py-6 sm:py-10 px-2">
            <div className="relative w-full max-w-6xl rounded-2xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 my-4">
              <PricingModule
                t={t}
                companyId={companyId}
                companyName={companyName}
                email={email}
                currentPlanKey={currentPlanKey ?? null}
                onClose={() => {
                  setPricingOpen(false);
                  void refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
