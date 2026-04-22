"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { formatPricingMoney } from "@/lib/pricingMoney";
import {
  PAID_PLAN_ORDER,
  PLANS,
  getPriceForTier,
  getPricingDisplayCurrencyCode,
  type BillingPeriod,
  type PaidPlanKey,
} from "@/lib/stripe";
import type { PPPPricingResult } from "@/hooks/usePPPPricing";

type TxFn = (key: string, fallback: string) => string;

const PLAN_USERS_DESCRIPTION_FALLBACK: Record<string, string> = {
  pricing_essential_users: "Unlimited users",
  pricing_operations_users: "Unlimited users",
  pricing_logistics_users: "Unlimited users",
  pricing_all_inclusive_users: "Unlimited users",
};
const PLAN_STORAGE_DESCRIPTION_FALLBACK: Record<string, string> = {
  pricing_essential_storage: "15 GB storage",
  pricing_operations_storage: "30 GB storage",
  pricing_logistics_storage: "30 GB storage",
  pricing_all_inclusive_storage: "200 GB storage",
};

function landingPlanBlurbKey(plan: PaidPlanKey): string {
  const m: Record<PaidPlanKey, string> = {
    esencial: "landing_plan_blurb_esencial",
    operaciones: "landing_plan_blurb_operaciones",
    logistica: "landing_plan_blurb_logistica",
    todo_incluido: "landing_plan_blurb_todo",
  };
  return m[plan];
}

export function PricingPlansPublicSection({
  tx,
  period,
  onPeriodChange,
  ppp,
  variant = "landing",
}: {
  tx: TxFn;
  period: BillingPeriod;
  onPeriodChange: (p: BillingPeriod) => void;
  ppp: PPPPricingResult;
  variant?: "landing" | "beta";
}) {
  const tierReady = ppp.pricingReady;
  const cc = tierReady ? ppp.effectiveCountryCode : null;
  const displayCurrencyCode = cc ? getPricingDisplayCurrencyCode(cc) : "USD";
  const geoTier = ppp.tier;
  const showRegionNote = tierReady && geoTier > 1;

  const sectionBg =
    variant === "beta"
      ? "rounded-2xl border border-white/15 bg-black/25 p-5 backdrop-blur-sm dark:bg-black/35 sm:p-8"
      : "";

  const inner = (
    <>
      {tierReady && geoTier > 1 ? (
        <div
          role="status"
          className={`mb-4 rounded-xl border px-3 py-2.5 text-center text-sm font-semibold ${
            variant === "beta"
              ? "border-sky-300/60 bg-sky-50/90 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100"
              : "mx-auto max-w-xl border-sky-200 bg-sky-50/90 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"
          }`}
        >
          {tx("ppp_badge", "Special price for your region")}
        </div>
      ) : null}
      <div className={variant === "beta" ? "text-center" : ""}>
        <h2
          className={`text-center font-bold text-slate-900 dark:text-white ${variant === "beta" ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}
        >
          {tx("landing_pricing_title", "Pricing")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600 dark:text-slate-400 sm:text-base">
          {tx("landing_pricing_subtitle", "")}
        </p>
        {variant === "landing" ? (
          <>
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-emerald-300/80 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100 sm:text-base">
              {tx("landing_pricing_trial_banner", "")}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
              <div className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 sm:w-auto sm:justify-center">
                <button
                  type="button"
                  onClick={() => onPeriodChange("monthly")}
                  className={`min-h-[44px] flex-1 rounded-lg px-5 text-sm font-semibold transition-colors sm:flex-none ${
                    period === "monthly"
                      ? "bg-[#f97316] text-white shadow"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {tx("landing_pricing_monthly", "Monthly")}
                </button>
                <button
                  type="button"
                  onClick={() => onPeriodChange("annual")}
                  className={`min-h-[44px] flex-1 rounded-lg px-5 text-sm font-semibold transition-colors sm:flex-none ${
                    period === "annual"
                      ? "bg-[#f97316] text-white shadow"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {tx("landing_pricing_annual", "Annual")}{" "}
                  <span className="opacity-90">({tx("landing_pricing_save", "save 20%")})</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <div className="inline-flex w-full rounded-xl border border-white/20 bg-white/10 p-1 dark:border-white/15 sm:w-auto sm:justify-center">
              <button
                type="button"
                onClick={() => onPeriodChange("monthly")}
                className={`min-h-[44px] flex-1 rounded-lg px-5 text-sm font-semibold transition-colors sm:flex-none ${
                  period === "monthly"
                    ? "bg-[#f97316] text-white shadow"
                    : "text-teal-50 hover:bg-white/10"
                }`}
              >
                {tx("landing_pricing_monthly", "Monthly")}
              </button>
              <button
                type="button"
                onClick={() => onPeriodChange("annual")}
                className={`min-h-[44px] flex-1 rounded-lg px-5 text-sm font-semibold transition-colors sm:flex-none ${
                  period === "annual"
                    ? "bg-[#f97316] text-white shadow"
                    : "text-teal-50 hover:bg-white/10"
                }`}
              >
                {tx("landing_pricing_annual", "Annual")}{" "}
                <span className="opacity-90">({tx("landing_pricing_save", "save 20%")})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={variant === "landing" ? "mt-10 min-w-0 overflow-x-auto pb-1" : "mt-8 min-w-0 overflow-x-auto pb-1"}>
        <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PAID_PLAN_ORDER.map((key) => {
            const plan = PLANS[key];
            const title = tx(plan.labelKey, key);
            const popular = key === "todo_incluido";
            const price =
              tierReady && cc != null ? getPriceForTier(key, period, geoTier, cc) : null;

            const listPriceTier1 =
              tierReady && cc != null ? getPriceForTier(key, period, 1, cc) : null;

            const cardShell =
              variant === "beta"
                ? `relative flex flex-col rounded-2xl border p-6 shadow-sm ${popular ? "border-[#f97316] ring-2 ring-[#f97316]/35 z-[1] bg-white dark:bg-slate-950/80" : "border-white/20 bg-white/95 dark:border-slate-700 dark:bg-slate-900/70"}`
                : `relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-950 ${popular ? "border-[#f97316] ring-2 ring-[#f97316]/35 z-[1]" : "border-slate-200 dark:border-slate-800"}`;

            return (
              <div key={key} className={cardShell}>
                {popular ? (
                  <div className="absolute -top-3 left-1/2 max-w-[90%] -translate-x-1/2">
                    <div className="inline-flex items-center gap-1 rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold text-white shadow">
                      <Star className="h-3.5 w-3.5 fill-white" aria-hidden />
                      {tx("landing_pricing_popular", "Most popular")}
                    </div>
                  </div>
                ) : null}
                <h3
                  className={`text-lg font-bold ${variant === "beta" ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-white"}`}
                >
                  {title}
                </h3>

                {!tierReady || geoTier <= 1 ? (
                  <p className="mt-4 flex min-h-[3rem] flex-wrap items-baseline gap-x-1 gap-y-0">
                    {!tierReady || price === null ? (
                      <span className="inline-block h-10 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                    ) : (
                      <>
                        <span className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">
                          {formatPricingMoney(price, displayCurrencyCode)}
                        </span>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {period === "monthly"
                            ? tx("landing_price_suffix", "/mo")
                            : tx("landing_price_suffix_annual", "/yr")}
                        </span>
                      </>
                    )}
                  </p>
                ) : (
                  <div className="mt-4 flex min-h-[3rem] flex-wrap items-baseline gap-x-2 gap-y-1">
                    {!tierReady || price === null ? (
                      <span className="inline-block h-10 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                    ) : (
                      <>
                        <span className="text-lg font-semibold text-slate-400 line-through decoration-slate-400 dark:text-slate-500">
                          {listPriceTier1 != null ? formatPricingMoney(listPriceTier1, displayCurrencyCode) : ""}
                        </span>
                        <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 sm:text-4xl">
                          {formatPricingMoney(price!, displayCurrencyCode)}
                        </span>
                        <span className="w-full text-sm text-slate-500 dark:text-slate-400 sm:w-auto">
                          {period === "monthly"
                            ? tx("landing_price_suffix", "/mo")
                            : tx("landing_price_suffix_annual", "/yr")}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {tierReady && geoTier > 1 ? (
                  <p className="mt-2 text-xs font-medium text-sky-800 dark:text-sky-200">
                    {tx(
                      geoTier === 2 ? "ppp_tier2_note" : "ppp_tier3_note",
                      geoTier === 2
                        ? "20% discount applied for your region"
                        : "40% discount applied for your region"
                    )}
                  </p>
                ) : null}

                {tierReady && geoTier > 1 ? (
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {(tx("ppp_original", "Original price: ~{{amount}} USD") || "").replace(
                      /\{\{amount\}\}/g,
                      String(getPriceForTier(key, period, 1, "US"))
                    )}
                  </p>
                ) : null}

                <ul
                  className={`mt-5 flex-1 space-y-2 text-left text-sm ${variant === "beta" ? "text-slate-700 dark:text-slate-300" : "text-slate-600 dark:text-slate-400"}`}
                >
                  <li className="flex gap-2 leading-snug">
                    <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                      ✓
                    </span>
                    <span>
                      {tx(
                        plan.usersDescriptionKey,
                        PLAN_USERS_DESCRIPTION_FALLBACK[plan.usersDescriptionKey] ?? ""
                      )}
                    </span>
                  </li>
                  <li className="flex gap-2 leading-snug">
                    <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                      ✓
                    </span>
                    <span>
                      {tx(
                        plan.storageDescriptionKey,
                        PLAN_STORAGE_DESCRIPTION_FALLBACK[plan.storageDescriptionKey] ??
                          `${plan.storageGb} GB ${tx("pricing_storage", "storage")}`
                      )}
                    </span>
                  </li>
                  <li className="flex gap-2 leading-snug">
                    <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                      ✓
                    </span>
                    <span>{tx(landingPlanBlurbKey(key), "")}</span>
                  </li>
                </ul>
                <Link
                  href="/register"
                  className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-orange-600 ${variant === "beta" ? "bg-[#f97316]" : "bg-[#f97316]"}`}
                >
                  {tx("landing_pricing_plan_cta", "Start free — 14 days")}
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {variant === "landing" && showRegionNote ? (
        <div
          role="status"
          className="mx-auto mt-8 flex max-w-2xl min-h-[44px] items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950 dark:border-amber-600 dark:bg-amber-950/35 dark:text-amber-100"
        >
          {tx("pricing_ppp_applied", "")}
        </div>
      ) : null}

      <div
        className={`mx-auto mt-8 max-w-2xl space-y-2 px-2 text-center text-xs font-medium ${variant === "beta" ? "text-teal-100/90" : "text-slate-600 dark:text-slate-400"}`}
      >
        <p className="break-words">
          {(tx("pricing_charged_usd", "") || "").trim()
            ? tx("pricing_charged_usd", "").replace(/\{currency\}/g, displayCurrencyCode)
            : `Prices shown in ${displayCurrencyCode}. Charged in USD.`}
        </p>
        <p className={variant === "beta" ? "text-teal-100/80" : "text-slate-500 dark:text-slate-500"}>
          {tx("pricing_local_currency_note", tx("landing_pricing_usd_note", ""))}
        </p>
        {variant === "landing" && showRegionNote ? (
          <p className="text-slate-500 dark:text-slate-500">
            {tx("pricing_ppp_notice", tx("landing_pricing_region_note", ""))}
          </p>
        ) : null}
      </div>
    </>
  );

  if (variant === "beta") {
    return <div className={sectionBg}>{inner}</div>;
  }

  return <>{inner}</>;
}
