-- MACHINPRO Sprint AV-7 — Perfiles empresa para widget Fichaje (evita fallos RLS / orden en user_profiles)
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_company_profiles_for_attendance(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  display_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS DISTINCT FROM (
    SELECT company_id FROM public.user_profiles WHERE public.user_profiles.id = auth.uid() LIMIT 1
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT up.id, up.full_name, up.display_name, up.email
  FROM public.user_profiles up
  WHERE up.company_id = p_company_id
  ORDER BY
    COALESCE(NULLIF(TRIM(up.full_name), ''), NULLIF(TRIM(up.display_name), ''), NULLIF(TRIM(up.email), ''), up.id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_company_profiles_for_attendance(uuid) TO authenticated;
