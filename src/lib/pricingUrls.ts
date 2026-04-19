import type { PaidPlanKey } from "@/lib/stripe";

function normalizePaidPlan(planKey: string | null | undefined): PaidPlanKey {
  const normalized =
    typeof planKey === "string" && planKey.trim()
      ? planKey.trim().toLowerCase()
      : "esencial";
  if (
    normalized === "operaciones" ||
    normalized === "logistica" ||
    normalized === "todo_incluido" ||
    normalized === "esencial"
  ) {
    return normalized as PaidPlanKey;
  }
  return "esencial";
}

/** Upgrade link with plan pre-selected for `/pricing`. Safe for server and client. */
export function buildPricingUpgradeUrl(opts: {
  /** e.g. `https://machin.pro` or `window.location.origin` */
  origin: string;
  planKey?: string | null;
  billingPeriod?: string | null;
}): string {
  const base = opts.origin.replace(/\/$/, "").trim() || "";
  const paid = normalizePaidPlan(opts.planKey);
  const period =
    typeof opts.billingPeriod === "string" && opts.billingPeriod.trim().toLowerCase() === "annual"
      ? "annual"
      : "monthly";
  const q = new URLSearchParams({ plan: paid, period });
  const path = `/pricing?${q.toString()}`;
  return base ? `${base}${path}` : path;
}
