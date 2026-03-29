-- Sprint AW-3: onboarding completion flag and optional company logo URL (Supabase SQL Editor).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text;
