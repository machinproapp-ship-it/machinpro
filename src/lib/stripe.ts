import Stripe from "stripe";
import { getCurrencyForCountry, type GeoTier } from "@/lib/geoTier";

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

/** Add-on: extra seat (subscription item). */
export const STRIPE_PRICE_EXTRA_SEAT_ID = "price_1TG3eEHskIYiyc3EpCXpgXnT";

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
 * Precios de referencia en CAD (Pricing 3.0 — producción Stripe).
 * Anual ≈ 20% de descuento vs 12× mensual.
 */
export const PLAN_PRICES_CAD: Record<PaidPlanKey, { monthly: number; annual: number }> = {
  esencial: { monthly: 39, annual: 374.4 },
  operaciones: { monthly: 59, annual: 566.4 },
  logistica: { monthly: 59, annual: 566.4 },
  todo_incluido: { monthly: 99, annual: 950.4 },
};

/**
 * Moneda por tier cuando no hay código de país (fallback).
 * Tier 1 incluye UK (GB) — usar siempre `getCurrencyForCountry("GB", 1)` → GBP en UI.
 */
export const CURRENCY_BY_TIER: Record<GeoTier, "CAD" | "USD" | "MXN"> = {
  1: "CAD",
  2: "USD",
  3: "MXN",
};

/** Conversión aproximada CAD → moneda de tier (solo UI; cobro real vía Stripe). */
const CAD_TO_USD = 0.74;
const CAD_TO_MXN = 13.5;
const USD_TO_GBP = 0.78;
const CAD_TO_GBP = CAD_TO_USD * USD_TO_GBP;

/**
 * Precio mostrado según plan, periodo, tier PPP y país (redondeado).
 */
export function getPriceForTier(
  plan: PaidPlanKey,
  period: BillingPeriod,
  tier: GeoTier,
  countryCode?: string | null
): number {
  const baseCad = PLAN_PRICES_CAD[plan][period];
  const adjustedCad = baseCad * GEO_TIERS[tier];
  const currency = getCurrencyForCountry(countryCode, tier);
  switch (currency) {
    case "CAD":
      return Math.round(adjustedCad);
    case "USD":
      return Math.round(adjustedCad * CAD_TO_USD);
    case "GBP":
      return Math.round(adjustedCad * CAD_TO_GBP);
    case "MXN":
      return Math.round(adjustedCad * CAD_TO_MXN);
    case "BRL":
      return Math.round(adjustedCad * CAD_TO_USD * 5.5);
    default:
      return Math.round(adjustedCad);
  }
}

export type PlanDefinition = {
  labelKey: string;
  monthly: { priceId: string };
  annual: { priceId: string };
  seats: number;
  /** null = sin tope práctico en UI */
  projects: number | null;
  storageGb: number;
  /** clave i18n para la línea de usuarios del plan (p. ej. plan_users_esencial) */
  usersDescriptionKey: string;
  /** claves i18n (pricing_feat_*) */
  featureKeys: string[];
};

export const PLANS: Record<PaidPlanKey, PlanDefinition> = {
  esencial: {
    labelKey: "plan_esencial",
    monthly: { priceId: "price_1THiu4HskIYiyc3Erls1elC9" },
    annual: { priceId: "price_1THiu4HskIYiyc3EH98ZjVsN" },
    seats: 15,
    projects: null,
    storageGb: 15,
    usersDescriptionKey: "plan_users_esencial",
    featureKeys: [
      "pricing_feat_esencial_1",
      "pricing_feat_esencial_2",
      "pricing_feat_esencial_3",
      "pricing_feat_esencial_4",
      "pricing_feat_esencial_5",
    ],
  },
  operaciones: {
    labelKey: "plan_operaciones",
    monthly: { priceId: "price_1THiv5HskIYiyc3Eun5AOLu7" },
    annual: { priceId: "price_1THiv5HskIYiyc3Ehqmch8mB" },
    seats: 30,
    projects: null,
    storageGb: 10,
    usersDescriptionKey: "plan_users_operaciones",
    featureKeys: [
      "pricing_feat_operaciones_1",
      "pricing_feat_operaciones_2",
      "pricing_feat_operaciones_3",
      "pricing_feat_operaciones_4",
      "pricing_feat_operaciones_5",
      "pricing_feat_operaciones_6",
      "pricing_feat_operaciones_7",
      "pricing_feat_operaciones_8",
    ],
  },
  logistica: {
    labelKey: "plan_logistica",
    monthly: { priceId: "price_1THiw2HskIYiyc3EEVZh13pt" },
    annual: { priceId: "price_1THiw2HskIYiyc3EXSUNCS3E" },
    seats: 30,
    projects: null,
    storageGb: 30,
    usersDescriptionKey: "plan_users_logistica",
    featureKeys: [
      "pricing_feat_logistica_1",
      "pricing_feat_logistica_2",
      "pricing_feat_logistica_3",
      "pricing_feat_logistica_4",
      "pricing_feat_logistica_5",
      "pricing_feat_logistica_6",
    ],
  },
  todo_incluido: {
    labelKey: "plan_todo_incluido",
    monthly: { priceId: "price_1THiwsHskIYiyc3ER6Mlken8" },
    annual: { priceId: "price_1THiwsHskIYiyc3Eg2DrbW1m" },
    seats: 999_999,
    projects: null,
    storageGb: 200,
    usersDescriptionKey: "plan_users_todo_incluido",
    featureKeys: [
      "pricing_feat_all_1",
      "pricing_feat_all_2",
      "pricing_feat_all_3",
      "pricing_feat_all_4",
      "pricing_feat_all_5",
      "pricing_feat_all_6",
    ],
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
 * PPP Stripe Coupons — precios del checkout (Tier 1 list) se alinean con la UI vía descuento.
 * IDs solicitados para producción/live mode.
 */
export const PPP_STRIPE_COUPON_TIER2_ID = "PPP_TIER2";
export const PPP_STRIPE_COUPON_TIER3_ID = "PPP_TIER3";

let pppCouponsEnsurePromise: Promise<void> | null = null;

async function retrieveOrCreateCoupon(
  stripe: Stripe,
  id: string,
  createParams: Stripe.CouponCreateParams
): Promise<void> {
  try {
    await stripe.coupons.retrieve(id);
    return;
  } catch (err: unknown) {
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing"
    ) {
      try {
        await stripe.coupons.create({ id, ...createParams });
      } catch (createErr: unknown) {
        if (
          createErr instanceof Stripe.errors.StripeInvalidRequestError &&
          createErr.code === "resource_already_exists"
        ) {
          return;
        }
        throw createErr;
      }
      return;
    }
    throw err;
  }
}

/** Garantiza cupones PPP en Stripe (idempotente por proceso). */
export async function ensurePppCoupons(stripe: Stripe): Promise<void> {
  if (!pppCouponsEnsurePromise) {
    pppCouponsEnsurePromise = (async () => {
      await retrieveOrCreateCoupon(stripe, PPP_STRIPE_COUPON_TIER2_ID, {
        percent_off: 20,
        duration: "forever",
        name: "PPP Tier 2",
      });
      await retrieveOrCreateCoupon(stripe, PPP_STRIPE_COUPON_TIER3_ID, {
        percent_off: 40,
        duration: "forever",
        name: "PPP Tier 3",
      });
    })().catch((e) => {
      pppCouponsEnsurePromise = null;
      throw e;
    });
  }
  await pppCouponsEnsurePromise;
}

export function checkoutDiscountsForTier(
  tier: GeoTier
): Stripe.Checkout.SessionCreateParams.Discount[] | undefined {
  if (tier === 2) return [{ coupon: PPP_STRIPE_COUPON_TIER2_ID }];
  if (tier === 3) return [{ coupon: PPP_STRIPE_COUPON_TIER3_ID }];
  return undefined;
}
