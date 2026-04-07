"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Sparkles, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrencyForCountry, type GeoTier } from "@/lib/geoTier";
import { useGeo } from "@/hooks/useGeo";
import {
  PLANS,
  getPriceForTier,
  getStripePriceId,
  CURRENCY_BY_TIER,
  PAID_PLAN_ORDER,
  type PaidPlanKey,
  type BillingPeriod,
} from "@/lib/stripe";

export interface PricingModuleProps {
  t: Record<string, string>;
  companyId: string;
  companyName?: string | null;
  email?: string | null;
  currentPlanKey?: PaidPlanKey | string | null;
  onClose?: () => void;
}

function formatMoney(amount: number, currency: string): string {
  const locale =
    currency === "CAD"
      ? "en-CA"
      : currency === "GBP"
        ? "en-GB"
        : currency === "MXN"
          ? "es-MX"
          : currency === "BRL"
            ? "pt-BR"
            : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: amount >= 100 && amount % 1 !== 0 ? 2 : 0,
  }).format(amount);
}

function normalizeCurrentPlan(raw: string | null | undefined): PaidPlanKey | null {
  if (!raw) return null;
  const r = raw.toLowerCase().trim();
  const legacy: Record<string, PaidPlanKey> = {
    starter: "esencial",
    foundation: "esencial",
    horarios: "esencial",
    pro: "operaciones",
    obras: "operaciones",
    enterprise: "todo_incluido",
    esencial: "esencial",
    operaciones: "operaciones",
    professional: "operaciones",
    logistica: "logistica",
    todo_incluido: "todo_incluido",
  };
  return legacy[r] ?? null;
}

const PLAN_USERS_DESCRIPTION_FALLBACK: Record<string, string> = {
  plan_users_esencial: "15 users included",
  plan_users_operaciones: "Everything in Essential plus 15 additional users (30 total)",
  plan_users_logistica: "Everything in Essential plus 15 additional users (30 total)",
  plan_users_todo_incluido: "Unlimited users",
};

export function PricingModule({
  t,
  companyId,
  companyName,
  email,
  currentPlanKey,
  onClose,
}: PricingModuleProps) {
  const lx = t as Record<string, string>;
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const { country: geoCountry, tier: geoTierRaw, discount: pppDiscount, loading: loadingTier } = useGeo();
  const geoTier = geoTierRaw as GeoTier;
  const countryCode = geoCountry ? geoCountry : null;
  const [checkoutLoading, setCheckoutLoading] = useState<PaidPlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [betaFounder, setBetaFounder] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBetaFounder(new URLSearchParams(window.location.search).get("beta") === "true");
  }, []);

  const displayCurrency = getCurrencyForCountry(countryCode, geoTier);
  const currentNormalized = normalizeCurrentPlan(
    typeof currentPlanKey === "string" ? currentPlanKey : null
  );

  const startCheckout = useCallback(
    async (plan: PaidPlanKey) => {
      setError(null);
      setCheckoutLoading(plan);
      try {
        const session = (await supabase?.auth.getSession())?.data.session;
        const token = session?.access_token;
        if (!token) {
          setError(lx.billing_no_company ?? "Session required");
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
            billingCycle: period,
            priceId: getStripePriceId(plan, period),
            countryCode: geoCountry,
            companyId,
            companyName: companyName ?? "",
            email: email ?? "",
            betaFounder,
          }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          setError(data.error ?? (lx.billing_loading ?? "Error"));
          setCheckoutLoading(null);
          return;
        }
        window.location.href = data.url;
      } catch {
        setError(lx.billing_loading ?? "Error");
        setCheckoutLoading(null);
      }
    },
    [companyId, companyName, email, geoCountry, period, lx, betaFounder]
  );

  return (
    <div className="relative w-full max-w-[1400px] mx-auto px-4 py-8 sm:py-12 text-gray-900 dark:text-gray-100">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 sm:right-4 sm:top-4 z-10 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          aria-label={lx.billing_cancel ?? "Close"}
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="text-center mb-8 sm:mb-10">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-sm font-medium text-amber-900 dark:text-amber-200 min-h-[44px]">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>{lx.pricing_trial ?? lx.billing_trial_banner ?? "14-day free trial — no card required"}</span>
          </div>
          {betaFounder ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/50 px-4 py-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
              {lx.plan_beta_founder ?? "Beta Founder — 3 months free"}
            </div>
          ) : null}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
          {lx.billing_title ?? "Plans & pricing"}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          {lx.pricing_save_20 ?? lx.billing_save_20 ?? "Save 20% with annual billing"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-6">
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
            {lx.pricing_monthly ?? lx.billing_period_monthly ?? "Monthly"}
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
            {lx.pricing_annual ?? lx.billing_period_annual ?? "Annual"}{" "}
            <span className="opacity-90">({lx.pricing_save_20 ?? "-20%"})</span>
          </button>
        </div>
        {!loadingTier && (
          <div className="text-xs text-center sm:text-left text-zinc-500 dark:text-zinc-400 space-y-0.5">
            <p>
              {displayCurrency === "GBP"
                ? (lx.currency_gbp ?? "GBP (£)")
                : displayCurrency || CURRENCY_BY_TIER[geoTier]}
            </p>
            {(lx.pricing_ppp_notice || lx.pricing_ppp_note) ? (
              <p className="text-[11px] opacity-90">{lx.pricing_ppp_notice ?? lx.pricing_ppp_note}</p>
            ) : null}
            {displayCurrency === "GBP" && (
              <p className="text-[11px] opacity-90">
                {lx.billing_gbp_approx ?? "Approximate GBP (from CAD reference pricing)"}
              </p>
            )}
          </div>
        )}
      </div>

      {!loadingTier && geoTier > 1 ? (
        <div
          role="status"
          className="mb-6 flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-center text-sm font-medium text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/20 dark:text-sky-100 max-w-2xl mx-auto"
        >
          <span>{lx.ppp_badge ?? lx.pricing_ppp_applied ?? ""}</span>
          <span className="text-xs font-medium opacity-90">
            {(lx.ppp_discount ?? "").replace(/\{\{percent\}\}/g, String(pppDiscount))}
          </span>
        </div>
      ) : null}

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400 mb-8 max-w-xl mx-auto">
        {lx.pricing_extra_user_note ?? lx.pricing_extra_user ?? ""}
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        {PAID_PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const price = getPriceForTier(key, period, geoTier, countryCode);
          const listPrice = getPriceForTier(key, period, 1, countryCode);
          const title = lx[plan.labelKey] ?? plan.labelKey;
          const isFeatured = key === "todo_incluido";
          const isCurrent = currentNormalized === key;

          return (
            <div
              key={key}
              className={`relative flex flex-col rounded-2xl border p-5 sm:p-6 shadow-sm transition-shadow ${
                isFeatured
                  ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/40 dark:ring-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 xl:z-[1]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80"
              }`}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow max-w-[90%] text-center">
                  {lx.billing_most_popular ?? "Most popular"}
                </div>
              )}
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white pr-2">{title}</h2>
              <div className="mt-5 mb-5">
                {!loadingTier && geoTier > 1 ? (
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-lg font-semibold text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500">
                      {formatMoney(listPrice, displayCurrency)}
                    </span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">
                      {formatMoney(price, displayCurrency)}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 w-full sm:w-auto sm:ml-0">
                      {period === "monthly"
                        ? (lx.pricing_slash_mo ?? lx.billing_short_month ?? "/mo")
                        : (lx.pricing_slash_yr ?? lx.billing_short_year ?? "/yr")}
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                      {loadingTier ? "…" : formatMoney(price, displayCurrency)}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">
                      {period === "monthly"
                        ? (lx.pricing_slash_mo ?? lx.billing_short_month ?? "/mo")
                        : (lx.pricing_slash_yr ?? lx.billing_short_year ?? "/yr")}
                    </span>
                  </>
                )}
              </div>
              <ul className="space-y-2.5 mb-5 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex gap-2">
                  <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                  <span className={key === "todo_incluido" ? "font-semibold text-zinc-900 dark:text-white" : ""}>
                    {lx[plan.usersDescriptionKey] ??
                      PLAN_USERS_DESCRIPTION_FALLBACK[plan.usersDescriptionKey] ??
                      ""}
                  </span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                  <span>
                    {plan.storageGb} GB {lx.pricing_storage ?? lx.billing_limit_storage ?? "storage"}
                  </span>
                </li>
                {plan.featureKeys.map((fk) => (
                  <li key={fk} className="flex gap-2">
                    <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                    <span>{lx[fk] ?? fk}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={!!checkoutLoading || isCurrent}
                onClick={() => void startCheckout(key)}
                className={`mt-auto w-full min-h-[44px] rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  isFeatured
                    ? "bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white disabled:opacity-50"
                }`}
              >
                {checkoutLoading === key
                  ? (lx.billing_loading ?? "…")
                  : isCurrent
                    ? (lx.pricing_current_plan ?? lx.billing_cta_current ?? "Current plan")
                    : (lx.landing_pricing_plan_cta ??
                      lx.pricing_start_free ??
                      lx.billing_cta_start ??
                      "Start free 14 days")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
