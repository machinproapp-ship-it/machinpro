# Stripe LIVE readiness checklist

## Implemented in code

- **Price IDs**: `src/lib/stripe-prices.ts` resolves every price from `STRIPE_PRICE_*` env vars with TEST fallbacks.
- **Checkout**: `POST /api/stripe/checkout` uses `verifyCompanyAccess`, PPP coupons, trial metadata (`company_id`, `plan_key`, geo tier).
- **Portal**: `/api/stripe/portal` (existing) — confirm live **Customer portal** URLs in Stripe Dashboard.
- **Webhook** (`POST /api/stripe/webhook`): verifies signature with `STRIPE_WEBHOOK_SECRET`; handles:
  - `checkout.session.completed` — sync subscription, send confirmation email to admins (`RESEND_*`).
  - `customer.subscription.updated` / `customer.subscription.created` — sync `subscriptions` + update `companies.plan`.
  - `customer.subscription.deleted` — graceful downgrade (`plan` → `trial`, status canceled).
  - `invoice.payment_failed` — email admins with invoice link when possible.
  - `invoice.payment_succeeded` — re-sync subscription for recurring/create cycles.

## Manual steps before switching to LIVE

1. **Stripe Dashboard**: Create/copy LIVE products & prices matching `STRIPE_PRICE_*` names in `.env` / Vercel.
2. **Webhook endpoint**: Register `https://machin.pro/api/stripe/webhook` (or preview URL) for LIVE; paste signing secret into `STRIPE_WEBHOOK_SECRET` **for production**.
3. **Webhook events selected**: Ensure at least:
   `checkout.session.completed`,
   `customer.subscription.created`,
   `customer.subscription.updated`,
   `customer.subscription.deleted`,
   `invoice.payment_failed`,
   `invoice.payment_succeeded`.
4. **Secrets on Vercel**: `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live), all `STRIPE_PRICE_*` (live Price IDs), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
5. **Tax / customer portal**: Confirm Stripe Tax and Customer Portal settings match production policies.
6. **Smoke test**: Use Stripe test clocks or a low-price LIVE test account before full cutover.

## Notes

- API route path is **`/api/stripe/checkout`** (not `create-checkout`).
- Confirmation email is sent on **`checkout.session.completed`** when subscription is `trialing` or `active`.
- Trial expiry emails/notifications run from **`GET /api/cron/notifications`** (hourly cron).
