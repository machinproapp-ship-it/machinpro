/**
 * Central Stripe Price IDs — override via environment variables on Vercel (LIVE mode).
 * Fallback values match the current TEST Dashboard IDs wired in code before env-based config.
 *
 * -----------------------------------------------------------------------------
 * TEST MODE Price IDs (April 2026) — reference when recreating products in Stripe:
 * -----------------------------------------------------------------------------
 * essential_monthly: price_1TG3GgHskIYiyc3EdYtn4TpH
 * essential_annual: price_1TG3GgHskIYiyc3EHsq40Iau
 * obras_monthly: price_1TG3T0HskIYiyc3E3Hepflbw
 * obras_annual: price_1TG3T0HskIYiyc3E4TG5d7MF
 * horarios_monthly: price_1TG3c0HskIYiyc3Eu9T6SFIO
 * horarios_annual: price_1TG3c0HskIYiyc3ETChxtpFA
 * logistica_monthly: price_1TG3crHskIYiyc3EUE5RVx2G
 * logistica_annual: price_1TG3crHskIYiyc3E0edoWwfS
 * todo_incluido_monthly: price_1TG3diHskIYiyc3Egv0Qj3MV
 * todo_incluido_annual: price_1TG3diHskIYiyc3EXzLBfOA0
 * usuario_adicional: price_1TG3eEHskIYiyc3EpCXpgXnT
 */

function envPrice(envKey: string, devFallback: string): string {
  const v = process.env[envKey];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : devFallback;
}

/** Resolved at runtime in API routes / server bundles. Same public Price IDs Stripe exposes to checkout. */
export const STRIPE_PRICES = {
  essential_monthly: envPrice(
    "STRIPE_PRICE_ESSENTIAL_MONTHLY",
    "price_1THiu4HskIYiyc3Erls1elC9"
  ),
  essential_annual: envPrice(
    "STRIPE_PRICE_ESSENTIAL_ANNUAL",
    "price_1THiu4HskIYiyc3EH98ZjVsN"
  ),
  operations_monthly: envPrice(
    "STRIPE_PRICE_OPERATIONS_MONTHLY",
    "price_1THiv5HskIYiyc3Eun5AOLu7"
  ),
  operations_annual: envPrice(
    "STRIPE_PRICE_OPERATIONS_ANNUAL",
    "price_1THiv5HskIYiyc3Ehqmch8mB"
  ),
  logistics_monthly: envPrice(
    "STRIPE_PRICE_LOGISTICS_MONTHLY",
    "price_1THiw2HskIYiyc3EEVZh13pt"
  ),
  logistics_annual: envPrice(
    "STRIPE_PRICE_LOGISTICS_ANNUAL",
    "price_1THiw2HskIYiyc3EXSUNCS3E"
  ),
  todo_incluido_monthly: envPrice(
    "STRIPE_PRICE_TODO_INCLUIDO_MONTHLY",
    "price_1THiwsHskIYiyc3ER6Mlken8"
  ),
  todo_incluido_annual: envPrice(
    "STRIPE_PRICE_TODO_INCLUIDO_ANNUAL",
    "price_1THiwsHskIYiyc3Eg2DrbW1m"
  ),
  additional_user: envPrice(
    "STRIPE_PRICE_ADDITIONAL_USER",
    "price_1TG3eEHskIYiyc3EpCXpgXnT"
  ),
} as const;

/** Add-on subscription item (extra seat) — exclude when resolving main plan from Stripe line items. */
export const STRIPE_PRICE_EXTRA_SEAT_ID = STRIPE_PRICES.additional_user;
