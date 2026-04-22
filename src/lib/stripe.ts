import Stripe from "stripe";
import type { GeoTier } from "@/lib/geoTier";
import { STRIPE_PRICE_EXTRA_SEAT_ID, STRIPE_PRICES } from "@/lib/stripe-prices";

export { STRIPE_PRICE_EXTRA_SEAT_ID } from "@/lib/stripe-prices";

/** Paid product keys (Stripe checkout + subscription) — Pricing 3.0 */
export type PaidPlanKey = "esencial" | "operaciones" | "logistica" | "todo_incluido";

/** Includes trial + legacy DB values still seen in subscriptions / invites. */
export type PlanKey =
  | PaidPlanKey
  | "trial"
  | "starter"
  | "pro"
  | "enterprise"
  | "foundation"
  | "obras"
  | "horarios";

export type BillingPeriod = "monthly" | "annual";

/** Stripe coupon ID — create in Dashboard with id `BETA_FOUNDER` (e.g. 100% 3 months). */
export const STRIPE_COUPON_BETA_FOUNDER_ID = "BETA_FOUNDER";

export const PAID_PLAN_ORDER: PaidPlanKey[] = [
  "esencial",
  "operaciones",
  "logistica",
  "todo_incluido",
];

/** Multiplicadores PPP por tier geográfico. */
export const GEO_TIERS: Record<GeoTier, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.6,
};

/**
 * Precios de referencia en USD (checkout Stripe en USD).
 * Anual ≈ 20% de descuento vs 12× mensual.
 */
export const PLAN_PRICES_USD: Record<PaidPlanKey, { monthly: number; annual: number }> = {
  esencial: { monthly: 39, annual: 374.4 },
  operaciones: { monthly: 59, annual: 566.4 },
  logistica: { monthly: 59, annual: 566.4 },
  todo_incluido: { monthly: 99, annual: 950.4 },
};

/** @deprecated Use PLAN_PRICES_USD — valores idénticos; el cobro es USD. */
export const PLAN_PRICES_CAD = PLAN_PRICES_USD;

/**
 * Tipos de cambio fijos (solo UI). 1 USD = `rate` unidades locales.
 * Si el país no está listado → se muestra USD sin conversión adicional (solo PPP).
 */
export const PRICING_EXCHANGE_RATES: Record<string, { currency: string; symbol: string; rate: number }> = {
  CA: { currency: "CAD", symbol: "CA$", rate: 1.36 },
  US: { currency: "USD", symbol: "$", rate: 1.0 },
  GB: { currency: "GBP", symbol: "£", rate: 0.79 },
  DE: { currency: "EUR", symbol: "€", rate: 0.92 },
  FR: { currency: "EUR", symbol: "€", rate: 0.92 },
  ES: { currency: "EUR", symbol: "€", rate: 0.92 },
  IT: { currency: "EUR", symbol: "€", rate: 0.92 },
  PT: { currency: "EUR", symbol: "€", rate: 0.92 },
  NL: { currency: "EUR", symbol: "€", rate: 0.92 },
  BE: { currency: "EUR", symbol: "€", rate: 0.92 },
  AT: { currency: "EUR", symbol: "€", rate: 0.92 },
  CH: { currency: "CHF", symbol: "CHF", rate: 0.9 },
  SE: { currency: "SEK", symbol: "kr", rate: 10.42 },
  NO: { currency: "NOK", symbol: "kr", rate: 10.58 },
  DK: { currency: "DKK", symbol: "kr", rate: 6.88 },
  AU: { currency: "AUD", symbol: "A$", rate: 1.53 },
  NZ: { currency: "NZD", symbol: "NZ$", rate: 1.67 },
  MX: { currency: "MXN", symbol: "MX$", rate: 17.15 },
  AR: { currency: "ARS", symbol: "$", rate: 890 },
  CL: { currency: "CLP", symbol: "$", rate: 935 },
  CO: { currency: "COP", symbol: "$", rate: 3900 },
  BR: { currency: "BRL", symbol: "R$", rate: 4.97 },
};

/** ISO 4217 para Intl; USD si no hay tabla o país desconocido. */
export function getPricingDisplayCurrencyCode(countryCode: string | null | undefined): string {
  const cc = (countryCode ?? "").trim().toUpperCase();
  if (!cc) return "USD";
  const row = PRICING_EXCHANGE_RATES[cc];
  return row?.currency ?? "USD";
}

/** Fallback legacy para componentes que aún referencian tier-only (preferir país + tabla). */
export const CURRENCY_BY_TIER: Record<GeoTier, "CAD" | "USD" | "MXN"> = {
  1: "CAD",
  2: "USD",
  3: "MXN",
};

/**
 * Precio mostrado: base USD × PPP tier × tipo fijo por país (redondeo entero).
 * Sin fila en la tabla → importe en USD ya ajustado por PPP.
 */
export function getPriceForTier(
  plan: PaidPlanKey,
  period: BillingPeriod,
  tier: GeoTier,
  countryCode?: string | null
): number {
  const baseUsd = PLAN_PRICES_USD[plan][period];
  const adjustedUsd = baseUsd * GEO_TIERS[tier];
  const cc = (countryCode ?? "").trim().toUpperCase();
  const row = cc ? PRICING_EXCHANGE_RATES[cc] : undefined;
  if (!row) {
    return Math.round(adjustedUsd);
  }
  return Math.round(adjustedUsd * row.rate);
}

export type PlanDefinition = {
  labelKey: string;
  monthly: { priceId: string };
  annual: { priceId: string };
  seats: number;
  /** null = sin tope práctico en UI */
  projects: number | null;
  storageGb: number;
  /** clave i18n: línea de usuarios (p. ej. pricing_essential_users) */
  usersDescriptionKey: string;
  /** clave i18n: línea de almacenamiento (p. ej. pricing_essential_storage) */
  storageDescriptionKey: string;
  /** claves i18n: resumen de módulos incluidos */
  featureKeys: string[];
};

export const PLANS: Record<PaidPlanKey, PlanDefinition> = {
  esencial: {
    labelKey: "plan_esencial",
    monthly: { priceId: STRIPE_PRICES.essential_monthly },
    annual: { priceId: STRIPE_PRICES.essential_annual },
    seats: 999_999,
    projects: null,
    storageGb: 15,
    usersDescriptionKey: "pricing_essential_users",
    storageDescriptionKey: "pricing_essential_storage",
    featureKeys: ["pricing_essential_includes"],
  },
  operaciones: {
    labelKey: "plan_operaciones",
    monthly: { priceId: STRIPE_PRICES.operations_monthly },
    annual: { priceId: STRIPE_PRICES.operations_annual },
    seats: 999_999,
    projects: null,
    storageGb: 30,
    usersDescriptionKey: "pricing_operations_users",
    storageDescriptionKey: "pricing_operations_storage",
    featureKeys: ["pricing_operations_includes"],
  },
  logistica: {
    labelKey: "pricing_plan_logistics",
    monthly: { priceId: STRIPE_PRICES.logistics_monthly },
    annual: { priceId: STRIPE_PRICES.logistics_annual },
    seats: 999_999,
    projects: null,
    storageGb: 30,
    usersDescriptionKey: "pricing_logistics_users",
    storageDescriptionKey: "pricing_logistics_storage",
    featureKeys: ["pricing_logistics_includes"],
  },
  todo_incluido: {
    labelKey: "plan_todo_incluido",
    monthly: { priceId: STRIPE_PRICES.todo_incluido_monthly },
    annual: { priceId: STRIPE_PRICES.todo_incluido_annual },
    seats: 999_999,
    projects: null,
    storageGb: 200,
    usersDescriptionKey: "pricing_all_inclusive_users",
    storageDescriptionKey: "pricing_all_inclusive_storage",
    featureKeys: ["pricing_all_inclusive_includes"],
  },
};

const PRICE_ID_TO_PLAN = new Map<string, { plan: PaidPlanKey; period: BillingPeriod }>();
for (const k of PAID_PLAN_ORDER) {
  const def = PLANS[k];
  PRICE_ID_TO_PLAN.set(def.monthly.priceId, { plan: k, period: "monthly" });
  PRICE_ID_TO_PLAN.set(def.annual.priceId, { plan: k, period: "annual" });
}

export function getPlanFromPriceId(priceId: string | undefined | null): {
  plan: PaidPlanKey;
  period: BillingPeriod;
} | null {
  if (!priceId || priceId === STRIPE_PRICE_EXTRA_SEAT_ID) return null;
  return PRICE_ID_TO_PLAN.get(priceId) ?? null;
}

const LEGACY_LIMIT_KEY: Record<string, PaidPlanKey> = {
  trial: "esencial",
  starter: "esencial",
  foundation: "esencial",
  horarios: "esencial",
  esencial: "esencial",
  obras: "operaciones",
  operaciones: "operaciones",
  pro: "operaciones",
  professional: "operaciones",
  logistica: "logistica",
  todo_incluido: "todo_incluido",
  enterprise: "todo_incluido",
};

/** Límites de suscripción para UI y webhook; normaliza claves legacy. */
export function getLimitsForPlan(plan: PlanKey | string | null | undefined): {
  seats_limit: number;
  projects_limit: number;
  storage_limit_gb: number;
} {
  const raw = (plan ?? "esencial").toString().toLowerCase();
  if (raw === "trial") {
    return {
      seats_limit: 999_999,
      projects_limit: 999_999,
      storage_limit_gb: 999,
    };
  }
  const paidKey = LEGACY_LIMIT_KEY[raw] ?? "esencial";
  const p = PLANS[paidKey];
  return {
    seats_limit: p.seats,
    projects_limit: p.projects ?? 999_999,
    storage_limit_gb: p.storageGb,
  };
}

/** Clave i18n (`plan_users_*`) según plan en DB, normalizando valores legacy. */
export function planUsersDescriptionI18nKey(plan: PlanKey | string | null | undefined): string {
  const raw = (plan ?? "esencial").toString().toLowerCase();
  const paidKey = LEGACY_LIMIT_KEY[raw] ?? "esencial";
  return PLANS[paidKey].usersDescriptionKey;
}

export function paidPlanKeyFromString(v: string | null | undefined): PaidPlanKey | null {
  if (!v) return null;
  if ((PAID_PLAN_ORDER as string[]).includes(v)) return v as PaidPlanKey;
  return null;
}

/** Accepts current keys and legacy names sent by older clients. */
export function resolvePaidPlanForCheckout(planRaw: string | undefined | null): PaidPlanKey | null {
  const s = typeof planRaw === "string" ? planRaw.trim() : "";
  if (!s) return null;
  return paidPlanKeyFromString(s) ?? normalizePlanKeyFromMetadata(s);
}

export function normalizePlanKeyFromMetadata(v: string | null | undefined): PaidPlanKey | null {
  if (!v) return null;
  const map: Record<string, PaidPlanKey> = {
    esencial: "esencial",
    operaciones: "operaciones",
    logistica: "logistica",
    todo_incluido: "todo_incluido",
    foundation: "esencial",
    horarios: "esencial",
    starter: "esencial",
    obras: "operaciones",
    pro: "operaciones",
    professional: "operaciones",
    enterprise: "todo_incluido",
  };
  return map[v] ?? null;
}

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return stripeSingleton;
}

export function getStripePriceId(plan: PaidPlanKey, period: BillingPeriod): string {
  return period === "monthly" ? PLANS[plan].monthly.priceId : PLANS[plan].annual.priceId;
}

/**
 * PPP Stripe Coupons — crear en Stripe Dashboard y asignar IDs en env (ej. PPP_TIER2).
 * Sin env → checkout sin cupón PPP (Stripe cobra lista USD tier 1).
 */
export function getStripeCouponPppTier2(): string | undefined {
  const v = process.env.STRIPE_COUPON_PPP_TIER2?.trim();
  return v ? v : undefined;
}

export function getStripeCouponPppTier3(): string | undefined {
  const v = process.env.STRIPE_COUPON_PPP_TIER3?.trim();
  return v ? v : undefined;
}

/** @deprecated Prefer env vars — sin fallback en checkout */
export const PPP_STRIPE_COUPON_TIER2_ID = "PPP_TIER2";
/** @deprecated Prefer env vars — sin fallback en checkout */
export const PPP_STRIPE_COUPON_TIER3_ID = "PPP_TIER3";

export function checkoutDiscountsForTier(
  tier: GeoTier
): Stripe.Checkout.SessionCreateParams.Discount[] | undefined {
  if (tier === 2) {
    const id = getStripeCouponPppTier2();
    return id ? [{ coupon: id }] : undefined;
  }
  if (tier === 3) {
    const id = getStripeCouponPppTier3();
    return id ? [{ coupon: id }] : undefined;
  }
  return undefined;
}
