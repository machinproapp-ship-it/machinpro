CREATE TABLE IF NOT EXISTS public.beta_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  country text,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.beta_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin can read beta_requests"
  ON public.beta_requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert beta_requests"
  ON public.beta_requests FOR INSERT
  WITH CHECK (true);
