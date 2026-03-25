-- MACHINPRO Sprint AV-7 — Campos de remuneración y política de vacaciones en perfiles
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS pay_type text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_pay_type_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_pay_type_check
  CHECK (pay_type IS NULL OR pay_type IN ('fixed', 'hourly', 'unspecified'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS pay_amount numeric;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS pay_currency text;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS pay_period text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_pay_period_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_pay_period_check
  CHECK (pay_period IS NULL OR pay_period IN ('monthly', 'biweekly', 'weekly'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS vacation_policy_enabled boolean DEFAULT false;
