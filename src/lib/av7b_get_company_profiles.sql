-- MACHINPRO Sprint AV-7b — RPC para widget Fichaje hoy (perfiles por empresa; evita filas vacías por RLS)
-- Si ya existe en Supabase con otra firma, alinear el nombre del parámetro con el cliente: p_company_id

CREATE OR REPLACE FUNCTION public.get_company_profiles(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  display_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.full_name, up.display_name, up.email
  FROM public.user_profiles up
  WHERE up.company_id = p_company_id
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles me
      WHERE me.id = auth.uid()
        AND me.company_id = p_company_id
    )
  ORDER BY up.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_company_profiles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_profiles(uuid) TO authenticated;
