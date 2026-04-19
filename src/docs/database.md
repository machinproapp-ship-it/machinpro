# Database (Supabase)

## Core tables (conceptual)

| Table | Role |
| ------- | ----- |
| `companies` | Tenant; includes `plan` mirrored from Stripe subscription for quick gating. |
| `user_profiles` | User ↔ company, role (`admin`, `supervisor`, `worker`, `logistic`), locale, optional `email`. |
| `subscriptions` | Stripe subscription snapshot per company: plan, status, trial end, limits, `stripe_*` ids. |
| `notifications` | **Insert-only** user notifications; cron jobs dedupe via `data.dedupe`. |
| **Domain** | `projects`, `employees`, `time_entries`, `hazards`, `certificates`, `inventory_items`, `forms`, etc. |

## Relationships

- `user_profiles.company_id` → `companies.id`.
- Most domain tables carry `company_id` for tenancy.
- `subscriptions.company_id` is unique per company (upsert on webhook).

## RLS

Row Level Security is enabled on tenant tables; policies typically restrict reads/writes to rows where `company_id` matches the authenticated user’s profile (`user_profiles.company_id`). Server-only routes use the **service role** only where necessary (webhooks, cron, admin tooling).

## Functions

Application logic prefers explicit queries from Next.js API routes and the Supabase JS client. Any Postgres RPCs or triggers live in your hosted Supabase project (not duplicated in this repo snapshot).

## Audit logs

Audit entries are treated as **append-only** at the application level; do not delete or mutate historical audit rows.
