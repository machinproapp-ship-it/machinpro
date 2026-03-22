"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Sparkles, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { detectGeoTier, type GeoTier } from "@/lib/geoTier";
import {
  PLANS,
  getPriceForTier,
  CURRENCY_BY_TIER,
  type PlanKey,
  type BillingPeriod,
} from "@/lib/stripe";

export interface PricingModuleProps {
  t: Record<string, string>;
  companyId: string;
  companyName?: string | null;
  email?: string | null;
  currentPlanKey?: PlanKey | null;
  onClose?: () => void;
}

function formatMoney(amount: number, tier: GeoTier): string {
  const currency = CURRENCY_BY_TIER[tier];
  const locale = tier === 1 ? "en-CA" : tier === 2 ? "en-US" : "es-MX";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const PLAN_ORDER: PlanKey[] = ["starter", "pro", "enterprise"];

export function PricingModule({
  t,
  companyId,
  companyName,
  email,
  currentPlanKey,
  onClose,
}: PricingModuleProps) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [geoTier, setGeoTier] = useState<GeoTier>(1);
  const [loadingTier, setLoadingTier] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingTier(true);
    void detectGeoTier().then((tier) => {
      if (!cancelled) {
        setGeoTier(tier);
        setLoadingTier(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startCheckout = useCallback(
    async (plan: PlanKey) => {
      setError(null);
      setCheckoutLoading(plan);
      try {
        const session = (await supabase?.auth.getSession())?.data.session;
        const token = session?.access_token;
        if (!token) {
          setError(t.billing_no_company ?? "Session required");
          setCheckoutLoading(null);
          return;
        }
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            plan,
            period,
            companyId,
            companyName: companyName ?? "",
            email: email ?? "",
            tier: geoTier,
          }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          setError(data.error ?? (t.billing_loading ?? "Error"));
          setCheckoutLoading(null);
          return;
        }
        window.location.href = data.url;
      } catch {
        setError(t.billing_loading ?? "Error");
        setCheckoutLoading(null);
      }
    },
    [companyId, companyName, email, geoTier, period, t]
  );

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4 py-8 sm:py-12">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 sm:right-4 sm:top-4 z-10 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          aria-label={t.billing_cancel ?? "Close"}
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-sm font-medium text-amber-900 dark:text-amber-200 mb-4">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>{t.billing_trial_banner ?? "14-day free trial — no card required"}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
          {t.billing_title ?? "Plans & pricing"}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          {t.billing_save_20 ?? "Save 20% with annual billing"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-10">
        <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`flex-1 sm:flex-none min-h-[44px] px-5 rounded-lg text-sm font-semibold transition-colors ${
              period === "monthly"
                ? "bg-amber-500 text-white shadow"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            {t.billing_period_monthly ?? "Monthly"}
          </button>
          <button
            type="button"
            onClick={() => setPeriod("annual")}
            className={`flex-1 sm:flex-none min-h-[44px] px-5 rounded-lg text-sm font-semibold transition-colors ${
              period === "annual"
                ? "bg-amber-500 text-white shadow"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            {t.billing_period_annual ?? "Annual"} ({t.billing_save_20 ?? "-20%"})
          </button>
        </div>
        {!loadingTier && (
          <p className="text-xs text-center sm:text-left text-zinc-500 dark:text-zinc-400">
            {CURRENCY_BY_TIER[geoTier]}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const price = getPriceForTier(key, period, geoTier);
          const isPro = key === "pro";
          const title =
            key === "starter"
              ? t.billing_plan_starter
              : key === "pro"
                ? t.billing_plan_pro
                : t.billing_plan_enterprise;
          const desc =
            key === "starter"
              ? t.billing_starter_desc
              : key === "pro"
                ? t.billing_pro_desc
                : t.billing_enterprise_desc;
          const isCurrent = currentPlanKey === key;

          return (
            <div
              key={key}
              className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 shadow-sm transition-shadow ${
                isPro
                  ? "border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30 dark:ring-amber-600/30 bg-white dark:bg-zinc-900 md:scale-[1.02] z-[1]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow">
                  {t.billing_most_popular ?? "Most popular"}
                </div>
              )}
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title ?? key}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 min-h-[3rem]">
                {desc ?? ""}
              </p>
              <div className="mt-6 mb-6">
                <span className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white">
                  {loadingTier ? "…" : formatMoney(price, geoTier)}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">
                  {period === "monthly" ? (t.billing_short_month ?? "/mo") : (t.billing_short_year ?? "/yr")}
                </span>
              </div>
              <ul className="space-y-3 mb-8 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex gap-2">
                  <Check className="h-5 w-5 shrink-0 text-emerald-500" />
                  <span>
                    {plan.seats >= 999000
                      ? `${t.billing_limit_users ?? "Users"}: ∞`
                      : `${plan.seats} ${t.billing_limit_users ?? "users"}`}
                  </span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-5 w-5 shrink-0 text-emerald-500" />
                  <span>
                    {plan.projects == null
                      ? `${t.billing_limit_projects ?? "Projects"}: ∞`
                      : `${plan.projects} ${t.billing_limit_projects ?? "projects"}`}
                  </span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-5 w-5 shrink-0 text-emerald-500" />
                  <span>
                    {plan.storageGb} GB {t.billing_limit_storage ?? "storage"}
                  </span>
                </li>
              </ul>
              <button
                type="button"
                disabled={!!checkoutLoading || isCurrent}
                onClick={() => void startCheckout(key)}
                className={`mt-auto w-full min-h-[44px] rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  isPro
                    ? "bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white disabled:opacity-50"
                }`}
              >
                {checkoutLoading === key
                  ? (t.billing_loading ?? "…")
                  : isCurrent
                    ? (t.billing_cta_current ?? "Current plan")
                    : (t.billing_cta_start ?? "Start free")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
