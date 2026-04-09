-- AH-19: visitor_logs RLS aligned with get_my_company_id() (Supabase Security Advisor).
-- Prerrequisito: public.get_my_company_id() (ver src/lib/av7_attendance_profiles_rpc.sql).
-- Ejecutar en SQL Editor tras revisar políticas existentes.

-- Quitar políticas antiguas que usan subconsulta a user_profiles (sustituir por helper único).
DROP POLICY IF EXISTS "visitor_logs_select_company" ON public.visitor_logs;
DROP POLICY IF EXISTS "visitor_logs_update_company" ON public.visitor_logs;

-- Lectura: solo la empresa del usuario autenticado.
CREATE POLICY "visitor_logs_select_company"
  ON public.visitor_logs
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_my_company_id());

-- Actualización (p. ej. check-out manual): misma empresa.
CREATE POLICY "visitor_logs_update_company"
  ON public.visitor_logs
  FOR UPDATE
  TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- Nota: el check-in público sigue en visitor_logs.sql (policy anon insert).
-- Si existiera una policy SELECT/UPDATE "always true" creada aparte, elimínela manualmente en el Advisor.
