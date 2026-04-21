# Stripe LIVE readiness checklist

## Implemented in code

- **Price IDs**: `src/lib/stripe-prices.ts` resolves every price from `STRIPE_PRICE_*` env vars with TEST fallbacks (no hardcoded live IDs in source).
- **Checkout** (`POST /api/stripe/checkout`): session and subscription metadata include `company_id`, `user_id` (authenticated profile), `plan`, `plan_key`, PPP `geo_tier`, `checkout_country`; PPP coupons via `checkoutDiscountsForTier`; optional `BETA_FOUNDER` coupon when `betaFounder: true`; prices from env via `getStripePriceId`.
- **Portal**: `/api/stripe/portal` — confirm live **Customer portal** URLs in Stripe Dashboard.
- **Webhook** (`POST /api/stripe/webhook`): verifies signature with `STRIPE_WEBHOOK_SECRET`; handles:
  - `checkout.session.completed` — sync subscription, send confirmation email to admins (`RESEND_*`).
  - `customer.subscription.created` / `customer.subscription.updated` — sync `subscriptions` + update `companies.plan`.
  - `customer.subscription.deleted` — downgrade (`companies.plan` → `trial`, subscription row canceled).
  - `invoice.payment_failed` — email admins; **in-app notifications** for each company admin (`billing_payment_failed`).
  - `invoice.payment_succeeded` — re-sync subscription for subscription create/cycle invoices.

**Supabase updates**: `subscriptions` upsert (including `trial_ends_at` from Stripe when trialing), `companies.plan` from active paid plan or `trial` when canceled. Trial end for the company is reflected on the subscription row (`trial_ends_at`); there is no separate `companies.trial_ends_at` column in the default schema.

## Pasos exactos para activar LIVE

1. En **Stripe Dashboard** → activar cuenta **LIVE** (completar verificación si aplica).
2. Crear **productos y precios LIVE** con los mismos nombres / estructura que en test (planes Esencial, Operaciones, etc.).
3. Copiar los **Price IDs** de LIVE (`price_...`).
4. En **Vercel** (producción), actualizar variables:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → `whsec_...` del endpoint LIVE (paso 7)
   - `STRIPE_PRICE_ESSENTIAL_MONTHLY` → `price_live_...` (y el resto de `STRIPE_PRICE_*` según `src/lib/stripe-prices.ts`)
5. Crear **webhook** en Stripe **LIVE**: URL `https://machin.pro/api/stripe/webhook`.
6. Eventos a enviar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
7. Copiar el **signing secret** del webhook LIVE → `STRIPE_WEBHOOK_SECRET` en Vercel y redesplegar.
8. Realizar un **pago de prueba** con importe mínimo (p. ej. 1 USD) con tarjeta real.
9. Verificar en **Supabase** que la fila en `subscriptions` y `companies.plan` reflejan el plan activo.

## Notes

- API route path is **`/api/stripe/checkout`** (not `create-checkout`).
- Confirmation email is sent on **`checkout.session.completed`** when subscription is `trialing` or `active`.
- Trial expiry emails/notifications run from **`GET /api/cron/notifications`** (hourly cron).
