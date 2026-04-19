# MachinPro application architecture

## Overview

MachinPro is a **Next.js 15** (App Router + client-heavy main shell) construction operations platform backed by **Supabase** (Postgres + Auth + RLS + Storage). Billing is handled by **Stripe** (checkout, portal, webhooks). transactional email uses **Resend**.

## Layers

| Layer | Responsibility |
| -------- | ---------------- |
| `src/app/page.tsx` | Authenticated SPA shell: navigation, sections, global search, keyboard shortcuts, subscription-aware UI. |
| `src/app/api/*` | Server routes: Stripe, cron, invitations, uploads, provisioning. Service role (`createSupabaseAdmin`) where RLS bypass is required. |
| `src/components/*` | Feature modules (`CentralModule`, `ProjectsModule`, etc.) composed by the shell. |
| `src/lib/*` | Stripe helpers, cron evaluation, notifications, geo/PPP, billing links, audit helpers. |

## Main data flows

1. **Auth**: Supabase Auth session → `AuthContext` loads `user_profiles` (role, company, locale).
2. **Subscriptions**: Stripe webhooks upsert `subscriptions` and mirror plan into `companies.plan`. Client reads subscription via `useSubscription`.
3. **Notifications**: Hourly cron `/api/cron/notifications` runs per-company rules (certificates, inventory, training, **trial expiry**, etc.) → inserts into `notifications` + optional web push.
4. **Audit**: Client and server append-only audit entries where configured.

## Environment variables (representative)

- **Public**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Cloudinary preset if used.
- **Server**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`.

See `deployment.md` for deploy-specific notes.
