-- MachinPro: formación (training_records) + push_subscriptions (Supabase)
-- Ejecutar en el SQL editor del proyecto.

CREATE TABLE IF NOT EXISTS training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  training_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration_hours DECIMAL(5,2),
  completed_date DATE,
  expiry_date DATE,
  certificate_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','pending')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve sus formaciones" ON training_records;
CREATE POLICY "Empresa ve sus formaciones"
  ON training_records FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuario ve sus suscripciones" ON push_subscriptions;
CREATE POLICY "Usuario ve sus suscripciones"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());
