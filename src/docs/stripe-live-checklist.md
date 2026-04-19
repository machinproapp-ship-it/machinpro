# Stripe LIVE mode — checklist (MachinPro)

Follow these steps when switching from Stripe **Test** to **Live**. The app reads Price IDs and API keys from Vercel environment variables (see `env.local.example` and `src/lib/stripe-prices.ts`).

## 1. Create products in Stripe LIVE

In the [Stripe Dashboard (Live mode)](https://dashboard.stripe.com), recreate the same products and pricing as in Test:

- Plans: Esencial / Operaciones / Logística / Todo incluido (monthly + annual where applicable).
- Add-on: additional user seat (if used).

Match names and billing intervals to your Test catalog so internal metadata (`plan_key`) stays consistent.

## 2. Copy LIVE Price IDs

For each price, copy the ID (`price_…`) from **Product catalog → Prices**.

## 3. Update Vercel environment variables

In the Vercel project → **Settings → Environment Variables** (Production):

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Live publishable key (`pk_live_…`).
- `STRIPE_SECRET_KEY` — Live secret key (`sk_live_…`).
- `STRIPE_WEBHOOK_SECRET` — Signing secret from the **Live** webhook endpoint (`whsec_…`).
- `STRIPE_PRICE_ESSENTIAL_MONTHLY` / `STRIPE_PRICE_ESSENTIAL_ANNUAL`
- `STRIPE_PRICE_OPERATIONS_MONTHLY` / `STRIPE_PRICE_OPERATIONS_ANNUAL`
- `STRIPE_PRICE_LOGISTICS_MONTHLY` / `STRIPE_PRICE_LOGISTICS_ANNUAL`
- `STRIPE_PRICE_TODO_INCLUIDO_MONTHLY` / `STRIPE_PRICE_TODO_INCLUIDO_ANNUAL`
- `STRIPE_PRICE_ADDITIONAL_USER`

Redeploy after saving.

## 4. Configure the LIVE webhook

In Stripe **Live** → **Developers → Webhooks**:

- Endpoint URL: `https://machin.pro/api/stripe/webhook` (or your production domain).
- Events: at minimum `customer.subscription.*`, `checkout.session.completed`, `invoice.*` as currently required by `src/app/api/stripe/webhook/route.ts`.

Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` on Vercel.

## 5. Verify first payment

- Complete a **small** real checkout or use Stripe test cards only in Test mode (Live requires real payment method).
- Confirm subscription row updates in Supabase and MachinPro billing UI.
- Confirm webhook deliveries show `200` in Stripe Dashboard → Webhooks → Live endpoint.

---

**Rollback:** revert Vercel env to Test keys and Price IDs, redeploy.
