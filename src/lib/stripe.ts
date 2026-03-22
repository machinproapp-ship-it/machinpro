import Stripe from "stripe";
import type { GeoTier } from "@/lib/geoTier";

export type PlanKey = "starter" | "pro" | "enterprise";

export type BillingPeriod = "monthly" | "annual";

/** Multiplicadores PPP por tier geográfico. */
export const GEO_TIERS: Record<GeoTier, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.6,
};

/** Precios base de referencia en CAD (alineados con Stripe test prices). */
export const PLAN_PRICES_CAD: Record<PlanKey, { monthly: number; annual: number }> = {
  starter: { monthly: 49, annual: 470 },
  pro: { monthly: 129, annual: 1238 },
  enterprise: { monthly: 299, annual: 2870 },
};

/** Moneda de visualización por tier (PPP). */
export const CURRENCY_BY_TIER: Record<GeoTier, "CAD" | "USD" | "MXN"> = {
  1: "CAD",
  2: "USD",
  3: "MXN",
};

/** Conversión aproximada CAD → moneda de tier (solo UI; cobro real vía Stripe). */
const CAD_TO_USD = 0.74;
const CAD_TO_MXN = 13.5;

/**
 * Precio mostrado según plan, periodo y tier (redondeado).
 * Tier 1: CAD; Tier 2: USD; Tier 3: MXN.
 */
export function getPriceForTier(plan: PlanKey, period: BillingPeriod, tier: GeoTier): number {
  const baseCad = PLAN_PRICES_CAD[plan][period];
  const adjustedCad = baseCad * GEO_TIERS[tier];
  if (tier === 1) return Math.round(adjustedCad);
  if (tier === 2) return Math.round(adjustedCad * CAD_TO_USD);
  return Math.round(adjustedCad * CAD_TO_MXN);
}

export const PLANS: Record<
  PlanKey,
  {
    labelKey: string;
    monthly: { priceId: string };
    annual: { priceId: string };
    seats: number;
    /** null = ilimitado en UI */
    projects: number | null;
    storageGb: number;
    /** claves i18n o descripciones cortas */
    highlights: string[];
  }
> = {
  starter: {
    labelKey: "starter",
    monthly: { priceId: "price_1TDawaHskIYiyc3E54pdpnjQ" },
    annual: { priceId: "price_1TDawaHskIYiyc3E55nkEErn" },
    seats: 5,
    projects: 5,
    storageGb: 10,
    highlights: ["5 users", "5 projects", "10 GB"],
  },
  pro: {
    labelKey: "pro",
    monthly: { priceId: "price_1TDb2KHskIYiyc3E4VjtfEr2" },
    annual: { priceId: "price_1TDb2KHskIYiyc3Eg72eyWSb" },
    seats: 25,
    projects: null,
    storageGb: 50,
    highlights: ["25 users", "Unlimited projects", "50 GB"],
  },
  enterprise: {
    labelKey: "enterprise",
    monthly: { priceId: "price_1TDb4KHskIYiyc3ERii7RAmS" },
    annual: { priceId: "price_1TDb4KHskIYiyc3Eb5LpYGH8" },
    seats: 999999,
    projects: null,
    storageGb: 250,
    highlights: ["Unlimited seats", "Unlimited projects", "250 GB", "White-label"],
  },
};

const PRICE_ID_TO_PLAN = new Map<string, { plan: PlanKey; period: BillingPeriod }>([
  ["price_1TDawaHskIYiyc3E54pdpnjQ", { plan: "starter", period: "monthly" }],
  ["price_1TDawaHskIYiyc3E55nkEErn", { plan: "starter", period: "annual" }],
  ["price_1TDb2KHskIYiyc3E4VjtfEr2", { plan: "pro", period: "monthly" }],
  ["price_1TDb2KHskIYiyc3Eg72eyWSb", { plan: "pro", period: "annual" }],
  ["price_1TDb4KHskIYiyc3ERii7RAmS", { plan: "enterprise", period: "monthly" }],
  ["price_1TDb4KHskIYiyc3Eb5LpYGH8", { plan: "enterprise", period: "annual" }],
]);

export function getPlanFromPriceId(priceId: string | undefined | null): {
  plan: PlanKey;
  period: BillingPeriod;
} | null {
  if (!priceId) return null;
  return PRICE_ID_TO_PLAN.get(priceId) ?? null;
}

export function getLimitsForPlan(plan: PlanKey): {
  seats_limit: number;
  projects_limit: number;
  storage_limit_gb: number;
} {
  const p = PLANS[plan];
  return {
    seats_limit: p.seats,
    projects_limit: p.projects ?? 999_999,
    storage_limit_gb: p.storageGb,
  };
}

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      // Pin explícita (SDK types siguen la última versión Clover).
      apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return stripeSingleton;
}

export function getStripePriceId(plan: PlanKey, period: BillingPeriod): string {
  return period === "monthly" ? PLANS[plan].monthly.priceId : PLANS[plan].annual.priceId;
}
