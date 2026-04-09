-- Sprint AW-4 — Parte diario / Daily report (ejecutar en Supabase SQL Editor)
-- Requiere: public.companies, public.user_profiles.
-- project_id usa TEXT (mismo tipo que projects.id en MachinPro).

-- ─── daily_reports ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  date DATE NOT NULL,
  weather TEXT NOT NULL DEFAULT 'sunny'
    CHECK (weather IN ('sunny', 'cloudy', 'rain', 'wind', 'snow')),
  site_conditions TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'approved')),
  ppe_selected TEXT[] NOT NULL DEFAULT '{}',
  ppe_other TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_reports_company_date_idx
  ON daily_reports(company_id, date DESC);
CREATE INDEX IF NOT EXISTS daily_reports_project_idx
  ON daily_reports(company_id, project_id);

CREATE OR REPLACE FUNCTION public.set_daily_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_reports_set_updated_at ON daily_reports;
CREATE TRIGGER daily_reports_set_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_daily_reports_updated_at();

-- ─── Child tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_report_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS daily_report_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT NOT NULL CHECK (method IN ('tap', 'drawing', 'tap_named')),
  signature_data TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_report_signatures_report_employee_uidx
  ON daily_report_signatures(report_id, employee_id);

CREATE TABLE IF NOT EXISTS daily_report_hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  ppe_required TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS daily_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  cloudinary_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_report_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late')),
  from_timeclock BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_report_attendance_report_employee_uidx
  ON daily_report_attendance(report_id, employee_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_attendance ENABLE ROW LEVEL SECURITY;

-- SELECT: mismo company
CREATE POLICY daily_reports_select_company ON daily_reports
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY daily_report_tasks_select_company ON daily_report_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY daily_report_signatures_select_company ON daily_report_signatures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY daily_report_hazards_select_company ON daily_report_hazards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY daily_report_photos_select_company ON daily_report_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY daily_report_attendance_select_company ON daily_report_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- Quién puede crear/editar partes (cabecera y filas hijas salvo políticas específicas)
-- admin, supervisor o custom_permissions.canManageDailyReports
CREATE POLICY daily_reports_insert_managers ON daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
      OR COALESCE(
        (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
        false
      )
    )
  );

CREATE POLICY daily_reports_update_managers ON daily_reports
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
      OR COALESCE(
        (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
        false
      )
    )
  );

CREATE POLICY daily_reports_delete_admin ON daily_reports
  FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

-- Tasks: managers pueden todo
CREATE POLICY daily_report_tasks_all_managers ON daily_report_tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  );

-- Empleado: marcar completada su tarea en parte publicado
CREATE POLICY daily_report_tasks_update_own_completed ON daily_report_tasks
  FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id AND dr.status = 'published'
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id AND dr.status = 'published'
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- Hazards, photos, attendance: managers only (insert/update/delete)
CREATE POLICY daily_report_hazards_all_managers ON daily_report_hazards
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  );

CREATE POLICY daily_report_photos_all_managers ON daily_report_photos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  );

CREATE POLICY daily_report_attendance_all_managers ON daily_report_attendance
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  );

-- Firmas: managers pueden borrar/insertar en borrador; en publicado inserta el propio empleado
CREATE POLICY daily_report_signatures_all_managers ON daily_report_signatures
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND dr.status = 'draft'
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
        AND dr.status = 'draft'
        AND (
          EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'supervisor'))
          OR COALESCE(
            (SELECT (custom_permissions->>'canManageDailyReports')::boolean FROM user_profiles WHERE id = auth.uid()),
            false
          )
        )
    )
  );

CREATE POLICY daily_report_signatures_insert_published_self ON daily_report_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = report_id
        AND dr.status = 'published'
        AND dr.company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- Un solo registro de firma por empleado: UPDATE no permitido para empleados (solo INSERT con conflicto evitado en app)
