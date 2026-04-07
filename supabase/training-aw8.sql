-- AW-8: Training Hub + training assignments
-- Prerrequisito: public.get_my_company_id() (ver src/lib/av7_attendance_profiles_rpc.sql)

CREATE TABLE IF NOT EXISTS training_courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  duration_minutes integer,
  expires_after_days integer,
  document_url text,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

CREATE TABLE IF NOT EXISTS training_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  course_id uuid REFERENCES training_courses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES user_profiles(id),
  status text DEFAULT 'pending',
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_courses_company ON training_courses(company_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_company ON training_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_user ON training_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_course ON training_assignments(course_id);

ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros de la empresa
CREATE POLICY "training_courses_select" ON training_courses
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "training_assignments_select" ON training_assignments
  FOR SELECT USING (company_id = get_my_company_id());

-- Cursos: solo administradores (role = admin en user_profiles)
CREATE POLICY "training_courses_insert_admin" ON training_courses
  FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = company_id
        AND up.role::text = 'admin'
    )
  );

CREATE POLICY "training_courses_update_admin" ON training_courses
  FOR UPDATE USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = training_courses.company_id
        AND up.role::text = 'admin'
    )
  )
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "training_courses_delete_admin" ON training_courses
  FOR DELETE USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = training_courses.company_id
        AND up.role::text = 'admin'
    )
  );

-- Asignaciones: alta y borrado solo admin
CREATE POLICY "training_assignments_insert_admin" ON training_assignments
  FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = company_id
        AND up.role::text = 'admin'
    )
  );

CREATE POLICY "training_assignments_delete_admin" ON training_assignments
  FOR DELETE USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = training_assignments.company_id
        AND up.role::text = 'admin'
    )
  );

-- Actualizar asignación: el propio usuario (marcar completado) o admin
CREATE POLICY "training_assignments_update_self" ON training_assignments
  FOR UPDATE USING (company_id = get_my_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = get_my_company_id() AND user_id = auth.uid());

CREATE POLICY "training_assignments_update_admin" ON training_assignments
  FOR UPDATE USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.company_id = training_assignments.company_id
        AND up.role::text = 'admin'
    )
  )
  WITH CHECK (company_id = get_my_company_id());
