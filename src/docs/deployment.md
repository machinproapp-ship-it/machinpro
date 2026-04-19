# Deployment

## Platform

Production: **Vercel** auto-deploy from `main` → **https://machin.pro**.

## Build

```bash
npm ci
npx tsc --noEmit
npm run build
```

## Environment variables

Configure in Vercel project settings (Production + Preview as needed):

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **App URL**: `NEXT_PUBLIC_APP_URL` = `https://machin.pro` (used in Stripe redirects and emails).
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, all `STRIPE_PRICE_*` matching `src/lib/stripe-prices.ts`.
- **Email**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- **Cron**: `CRON_SECRET` — required header `x-cron-secret` on `/api/cron/notifications`.

## Stripe LIVE activation

1. Create LIVE products/prices in Stripe; copy Price IDs into Vercel env `STRIPE_PRICE_*`.
2. Switch **`STRIPE_SECRET_KEY`** to LIVE secret key.
3. Add LIVE webhook endpoint pointing to `/api/stripe/webhook`; set **`STRIPE_WEBHOOK_SECRET`** to LIVE signing secret.
4. Deploy; run a single real-card test with a small amount or Stripe test clocks as appropriate.

Details: **`src/docs/stripe-live-checklist.md`**.

## Rollback

In Vercel: **Deployments** → select previous production deployment → **Promote to Production**.

Revert Git: `git revert` offending commit(s) and push `main`.

Always keep Stripe webhook secret and Price IDs aligned with the promoted build’s env snapshot.
