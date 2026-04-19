-- Safe Work Procedures + signatures — run once in Supabase SQL Editor.
-- App UI: Security → SWP tab (src/components/SwpModule.tsx).

CREATE TABLE IF NOT EXISTS public.safe_work_procedures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  title TEXT NOT NULL,
  equipment TEXT NOT NULL,
  description TEXT,
  steps JSONB DEFAULT '[]',
  ppe_required JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.swp_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  swp_id UUID NOT NULL REFERENCES public.safe_work_procedures(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  signed_at TIMESTAMPTZ DEFAULT now(),
  signature_data TEXT,
  UNIQUE(swp_id, user_id)
);

ALTER TABLE public.safe_work_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swp_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view SWPs"
  ON public.safe_work_procedures FOR SELECT
  USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage SWPs"
  ON public.safe_work_procedures FOR ALL
  USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can sign SWPs"
  ON public.swp_signatures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Company members can view signatures"
  ON public.swp_signatures FOR SELECT
  USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));
