-- MachinPro: production catalog (piecework), project overrides, production reports

CREATE TABLE IF NOT EXISTS production_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'unit',
  cost_price DECIMAL(10,4) DEFAULT 0,
  sell_price DECIMAL(10,4) DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE production_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve su catalogo" ON production_catalog;
CREATE POLICY "Empresa ve su catalogo"
  ON production_catalog FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS project_task_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  catalog_item_id UUID NOT NULL REFERENCES production_catalog(id) ON DELETE CASCADE,
  custom_cost_price DECIMAL(10,4),
  custom_sell_price DECIMAL(10,4),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE project_task_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve sus overrides" ON project_task_overrides;
CREATE POLICY "Empresa ve sus overrides"
  ON project_task_overrides FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS production_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entries JSONB DEFAULT '[]'::jsonb,
  total_units DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  total_sell DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE production_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve sus reportes" ON production_reports;
CREATE POLICY "Empresa ve sus reportes"
  ON production_reports FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));
