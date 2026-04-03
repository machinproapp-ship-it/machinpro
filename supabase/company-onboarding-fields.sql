-- Optional profile fields collected during admin onboarding (sector + company size).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS company_size text;
