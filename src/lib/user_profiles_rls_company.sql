-- MACHINPRO Sprint AV-5a — Políticas user_profiles por empresa
-- Ejecutar en Supabase SQL Editor si solo ves tu propio perfil (RLS demasiado restrictivo).

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Lectura: todos los perfiles de la misma company que el usuario autenticado
DROP POLICY IF EXISTS "Usuario ve perfiles de su empresa" ON user_profiles;
CREATE POLICY "Usuario ve perfiles de su empresa"
  ON user_profiles FOR SELECT
  USING (
    company_id IS NOT NULL
    AND company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Alternativa explícita solicitada (equivalente si company_id siempre coincide):
-- CREATE POLICY "Admin ve todos los perfiles de su empresa"
--   ON user_profiles FOR SELECT
--   USING (company_id IN (
--     SELECT company_id FROM user_profiles WHERE id = auth.uid()
--   ));

-- Nota: INSERT/UPDATE de perfiles ajenos suele hacerse con service role (API) o políticas extra.
-- Si ya tienes políticas en conflicto, revísalas en Dashboard → Authentication → Policies.
