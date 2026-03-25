-- MACHINPRO Sprint AV-7 — Vacaciones en schedule_entries + company_id
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.schedule_entries
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.schedule_entries
  DROP CONSTRAINT IF EXISTS schedule_entries_type_check;
ALTER TABLE public.schedule_entries
  ADD CONSTRAINT schedule_entries_type_check
  CHECK (type IN ('shift', 'event', 'vacation'));
