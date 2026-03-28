-- Preferido UI locale (código MachinPro: es, en, fr, …). Idempotente.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS locale text;

COMMENT ON COLUMN public.user_profiles.locale IS 'MachinPro language code (es, en, fr, de, it, pt, …); synced from app settings.';
