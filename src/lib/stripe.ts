import Stripe from "stripe";
import { getCurrencyForCountry, type GeoTier } from "@/lib/geoTier";

/** Paid product keys (Stripe checkout + subscription). */
export type PaidPlanKey =
  | "foundation"
  | "obras"
  | "horarios"
  | "logistica"
  | "todo_incluido";

/** Includes trial + legacy DB values still seen in subscriptions / invites. */
export type PlanKey =
  | PaidPlanKey
  | "trial"
  | "starter"
  | "pro"
  | "enterprise";

export type BillingPeriod = "monthly" | "annual";

/** Add-on: extra seat (subscription item). */
export const STRIPE_PRICE_EXTRA_SEAT_ID = "price_1TG3eEHskIYiyc3EpCXpgXnT";

export const PAID_PLAN_ORDER: PaidPlanKey[] = [
  "foundation",
  "obras",
  "horarios",
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
 * Precios de referencia en CAD (Pricing 2.0 — alineados con Stripe test).
 * Anual = cobro anual con ~20% de descuento vs 12× mensual.
 */
export const PLAN_PRICES_CAD: Record<PaidPlanKey, { monthly: number; annual: number }> = {
  foundation: { monthly: 19, annual: 182.4 },
  obras: { monthly: 39, annual: 374.4 },
  horarios: { monthly: 39, annual: 374.4 },
  logistica: { monthly: 39, annual: 374.4 },
  todo_incluido: { monthly: 79, annual: 758.4 },
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
  /** claves i18n (pricing_feat_*) */
  featureKeys: string[];
};

export const PLANS: Record<PaidPlanKey, PlanDefinition> = {
  foundation: {
    labelKey: "pricing_foundation",
    monthly: { priceId: "price_1TG3GgHskIYiyc3EdYtn4TpH" },
    annual: { priceId: "price_1TG3GgHskIYiyc3EHsq40Iau" },
    seats: 10,
    projects: null,
    storageGb: 10,
    featureKeys: [
      "pricing_feat_foundation_1",
      "pricing_feat_foundation_2",
      "pricing_feat_foundation_3",
    ],
  },
  obras: {
    labelKey: "pricing_obras",
    monthly: { priceId: "price_1TG3T0HskIYiyc3E3Hepflbw" },
    annual: { priceId: "price_1TG3T0HskIYiyc3E4TG5d7MF" },
    seats: 10,
    projects: null,
    storageGb: 10,
    featureKeys: ["pricing_feat_obras_1", "pricing_feat_obras_2", "pricing_feat_obras_3"],
  },
  horarios: {
    labelKey: "pricing_horarios",
    monthly: { priceId: "price_1TG3c0HskIYiyc3Eu9T6SFIO" },
    annual: { priceId: "price_1TG3c0HskIYiyc3ETChxtpFA" },
    seats: 10,
    projects: null,
    storageGb: 10,
    featureKeys: ["pricing_feat_horarios_1", "pricing_feat_horarios_2", "pricing_feat_horarios_3"],
  },
  logistica: {
    labelKey: "pricing_logistica",
    monthly: { priceId: "price_1TG3crHskIYiyc3EUE5RVx2G" },
    annual: { priceId: "price_1TG3crHskIYiyc3E0edoWwfS" },
    seats: 10,
    projects: null,
    storageGb: 10,
    featureKeys: ["pricing_feat_logistica_1", "pricing_feat_logistica_2", "pricing_feat_logistica_3"],
  },
  todo_incluido: {
    labelKey: "pricing_todo_incluido",
    monthly: { priceId: "price_1TG3diHskIYiyc3Egv0Qj3MV" },
    annual: { priceId: "price_1TG3diHskIYiyc3EXzLBfOA0" },
    seats: 25,
    projects: null,
    storageGb: 50,
    featureKeys: ["pricing_feat_all_1", "pricing_feat_all_2", "pricing_feat_all_3"],
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
  trial: "foundation",
  starter: "foundation",
  foundation: "foundation",
  obras: "obras",
  horarios: "horarios",
  logistica: "logistica",
  todo_incluido: "todo_incluido",
  pro: "obras",
  enterprise: "todo_incluido",
};

/** Límites de suscripción para UI y webhook; normaliza claves legacy. */
export function getLimitsForPlan(plan: PlanKey | string | null | undefined): {
  seats_limit: number;
  projects_limit: number;
  storage_limit_gb: number;
} {
  const raw = (plan ?? "foundation").toString();
  const paidKey = LEGACY_LIMIT_KEY[raw] ?? "foundation";
  const p = PLANS[paidKey];
  return {
    seats_limit: p.seats,
    projects_limit: p.projects ?? 999_999,
    storage_limit_gb: p.storageGb,
  };
}

export function paidPlanKeyFromString(v: string | null | undefined): PaidPlanKey | null {
  if (!v) return null;
  if ((PAID_PLAN_ORDER as string[]).includes(v)) return v as PaidPlanKey;
  return null;
}

export function normalizePlanKeyFromMetadata(v: string | null | undefined): PaidPlanKey | null {
  if (!v) return null;
  const map: Record<string, PaidPlanKey> = {
    foundation: "foundation",
    obras: "obras",
    horarios: "horarios",
    logistica: "logistica",
    todo_incluido: "todo_incluido",
    starter: "foundation",
    pro: "obras",
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
 *
 * Antes de producción, crear manualmente en Stripe Dashboard (recomendado validar en Test mode):
 * - ID exacto: ppp_tier2 · Percent off: 20% · Duration: Forever · sin límite de redenciones
 * - ID exacto: ppp_tier3 · Percent off: 40% · Duration: Forever · sin límite de redenciones
 *
 * El servidor también intenta `retrieve` + `create` vía API si faltan (IDs deben coincidir).
 */
export const PPP_STRIPE_COUPON_TIER2_ID = "ppp_tier2";
export const PPP_STRIPE_COUPON_TIER3_ID = "ppp_tier3";

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
