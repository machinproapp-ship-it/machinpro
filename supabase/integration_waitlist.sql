-- Parte B: waitlist for integration interest (run in Supabase SQL editor)
CREATE TABLE IF NOT EXISTS public.integration_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_waitlist_company ON public.integration_waitlist(company_id);

ALTER TABLE public.integration_waitlist ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; app uses admin client from authenticated API route.
