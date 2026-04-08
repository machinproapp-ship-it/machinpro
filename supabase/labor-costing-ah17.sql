-- AH-17: optional labor costing rate per employee (user profile).
-- Run in Supabase SQL editor if not using migrations.

alter table public.user_profiles
  add column if not exists hourly_rate numeric(12, 4);

comment on column public.user_profiles.hourly_rate is
  'Optional hourly labor rate for costing (company currency); distinct from pay_amount.';
