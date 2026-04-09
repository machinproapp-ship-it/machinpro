-- AH-23: allow approved status on daily_reports (run in Supabase SQL Editor if table already exists)
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_status_check;
ALTER TABLE public.daily_reports
  ADD CONSTRAINT daily_reports_status_check
  CHECK (status IN ('draft', 'published', 'approved'));
