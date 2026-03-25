-- MACHINPRO Sprint AV — ejecutar manualmente en Supabase SQL Editor
-- Subcontratistas, fichaje GPS, solicitudes de vacaciones, columnas perfil

-- ─── Subcontractors ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  trade TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','pending')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subcontractor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS subcontractor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  file_url TEXT,
  expires_at DATE,
  status TEXT DEFAULT 'valid'
    CHECK (status IN ('valid','expiring','expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- project_id: usar el mismo tipo que `projects.id` en tu BD (TEXT o UUID)
CREATE TABLE IF NOT EXISTS subcontractor_projects (
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  PRIMARY KEY (subcontractor_id, project_id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve sus subcontratistas" ON subcontractors;
CREATE POLICY "Empresa ve sus subcontratistas"
  ON subcontractors FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- ─── Time tracking & GPS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id TEXT,
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMPTZ,
  clock_in_lat DOUBLE PRECISION,
  clock_in_lng DOUBLE PRECISION,
  clock_out_lat DOUBLE PRECISION,
  clock_out_lng DOUBLE PRECISION,
  total_minutes INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','manual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  notes TEXT,
  admin_comment TEXT,
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Perfil empleado (además de las columnas del sprint)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS vacation_days_allowed INTEGER,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS custom_role_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB,
  ADD COLUMN IF NOT EXISTS profile_status TEXT DEFAULT 'active';

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empleado ve sus fichajes" ON time_entries;
CREATE POLICY "Empleado ve sus fichajes"
  ON time_entries FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin ve fichajes de su empresa" ON time_entries;
CREATE POLICY "Admin ve fichajes de su empresa"
  ON time_entries FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Empleado crea sus fichajes" ON time_entries;
CREATE POLICY "Empleado crea sus fichajes"
  ON time_entries FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Empleado actualiza sus fichajes activos" ON time_entries;
CREATE POLICY "Empleado actualiza sus fichajes activos"
  ON time_entries FOR UPDATE
  USING (user_id = auth.uid() AND status = 'active');

DROP POLICY IF EXISTS "Empleado inserta su GPS" ON gps_tracking;
CREATE POLICY "Empleado inserta su GPS"
  ON gps_tracking FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin ve GPS de su empresa" ON gps_tracking;
CREATE POLICY "Admin ve GPS de su empresa"
  ON gps_tracking FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Empleado ve sus solicitudes" ON vacation_requests;
CREATE POLICY "Empleado ve sus solicitudes"
  ON vacation_requests FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin ve solicitudes de su empresa" ON vacation_requests;
CREATE POLICY "Admin ve solicitudes de su empresa"
  ON vacation_requests FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Empleado crea solicitudes" ON vacation_requests;
CREATE POLICY "Empleado crea solicitudes"
  ON vacation_requests FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin actualiza solicitudes vacaciones" ON vacation_requests;
CREATE POLICY "Admin actualiza solicitudes vacaciones"
  ON vacation_requests FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- ─── Employee projects & documents (Sprint AV-3) ─────────────────────────────
CREATE TABLE IF NOT EXISTS employee_projects (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE employee_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa gestiona employee_projects" ON employee_projects;
CREATE POLICY "Empresa gestiona employee_projects"
  ON employee_projects FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve employee_documents" ON employee_documents;
CREATE POLICY "Empresa ve employee_documents"
  ON employee_documents FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Subcontractor extended profile (Sprint AV-3)
ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS gst_hst TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]'::jsonb;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS use_role_permissions BOOLEAN DEFAULT true;
