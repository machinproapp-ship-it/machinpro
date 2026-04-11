-- MachinPro: payroll + manual project expenses (run in Supabase SQL editor)

CREATE TABLE IF NOT EXISTS payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours_worked DECIMAL(8,2) DEFAULT 0,
  regular_hours DECIMAL(8,2) DEFAULT 0,
  overtime_hours DECIMAL(8,2) DEFAULT 0,
  gross_pay DECIMAL(10,2) DEFAULT 0,
  deductions JSONB DEFAULT '[]'::jsonb,
  total_deductions DECIMAL(10,2) DEFAULT 0,
  net_pay DECIMAL(10,2) DEFAULT 0,
  employer_cost DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  country_code TEXT DEFAULT 'CA',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve sus nóminas" ON payroll_entries;
CREATE POLICY "Empresa ve sus nóminas"
  ON payroll_entries FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  category TEXT DEFAULT 'other' CHECK (category IN ('personnel','material','tool','rental','other')),
  expense_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve sus gastos" ON project_expenses;
CREATE POLICY "Empresa ve sus gastos"
  ON project_expenses FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));
