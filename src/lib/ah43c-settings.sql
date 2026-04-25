-- AH-43C: Company settings persistence (MachinPro)
-- Ejecutar en Supabase SQL Editor antes de usar companies.settings en la app.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_companies_settings
  ON public.companies USING GIN (settings);
