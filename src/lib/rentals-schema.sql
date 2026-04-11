-- MachinPro: rentals (Sprint C). Ejecutar en Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  supplier TEXT,
  return_date DATE,
  cost DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  contract_url TEXT,
  project_id TEXT,
  equipment_type TEXT,
  equipment_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','returned','cancelled')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa ve sus alquileres" ON rentals;
CREATE POLICY "Empresa ve sus alquileres"
  ON rentals FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));
