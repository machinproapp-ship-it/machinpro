-- AH-20 — Beta feedback persistence (run in Supabase SQL editor if not already applied).
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies (id),
  user_id UUID NOT NULL REFERENCES auth.users (id),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  module TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.feedback;
CREATE POLICY "Users can insert their own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.feedback IS 'MachinPro in-app beta feedback; rows inserted via service role from /api/feedback.';
