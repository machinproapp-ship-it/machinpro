-- Push subscriptions (Web Push) — ejecutar en Supabase SQL editor
-- Requiere tablas public.user_profiles y public.companies existentes.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

comment on table public.push_subscriptions is 'Web Push subscription JSON per user/device';
