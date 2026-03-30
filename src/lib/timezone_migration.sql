-- MACHINPRO Sprint i18n — user timezone for Intl date/time display (run in Supabase SQL Editor).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Toronto';

COMMENT ON COLUMN public.user_profiles.timezone IS 'IANA timezone e.g. America/Toronto; used by app dateUtils / Intl formatting';
