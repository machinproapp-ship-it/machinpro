-- AH-29: optional user_id on integration_waitlist (run if POST fails on unknown column)
ALTER TABLE public.integration_waitlist
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_waitlist_company_integration_email
  ON public.integration_waitlist (company_id, integration, email);
