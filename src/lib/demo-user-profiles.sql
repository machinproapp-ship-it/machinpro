-- ============================================================================
-- MACHINPRO — user_profiles de demostración (8 empleados “nuevos” Canariense)
-- ============================================================================
-- company_id: a0000001-0000-4000-8000-000000000001
-- `employee_id` enlaza con public.employees (texto: demo-emp-sofia … demo-emp-tomas)
--
-- Requisito: filas en public.employees (p. ej. src/lib/demo-video-data.sql).
-- IDs de perfil UUID deterministas (no coinciden con employee_id texto; FK es employee_id).
--
-- Si user_profiles.id sigue con FK estricta a auth.users, ejecutar primero en Supabase:
--   src/lib/user_profiles_gdpr_hard_delete.sql
-- y crear usuarios Auth correspondientes O ajustar políticas según tu entorno.
--
-- NO hacer commit obligatorio de este archivo en CI — uso manual en SQL Editor.
-- ============================================================================

BEGIN;

INSERT INTO public.user_profiles (
  id,
  company_id,
  employee_id,
  full_name,
  display_name,
  email,
  role,
  profile_status,
  locale
)
VALUES
  (
    'b1100001-0000-4000-8000-000000000001',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-sofia',
    'Sofia Martínez',
    'Sofia Martínez',
    'sofia.martinez.demo@canariense.inc',
    'worker',
    'active',
    'es'
  ),
  (
    'b1100002-0000-4000-8000-000000000002',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-diego',
    'Diego Fernández',
    'Diego Fernández',
    'diego.fernandez.demo@canariense.inc',
    'supervisor',
    'active',
    'es'
  ),
  (
    'b1100003-0000-4000-8000-000000000003',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-carmen',
    'Carmen López',
    'Carmen López',
    'carmen.lopez.demo@canariense.inc',
    'worker',
    'active',
    'es'
  ),
  (
    'b1100004-0000-4000-8000-000000000004',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-alejandro',
    'Alejandro García',
    'Alejandro García',
    'alejandro.garcia.demo@canariense.inc',
    'worker',
    'active',
    'es'
  ),
  (
    'b1100005-0000-4000-8000-000000000005',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-isabel',
    'Isabel Rodríguez',
    'Isabel Rodríguez',
    'isabel.rodriguez.demo@canariense.inc',
    'logistic',
    'active',
    'es'
  ),
  (
    'b1100006-0000-4000-8000-000000000006',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-pablo',
    'Pablo Sánchez',
    'Pablo Sánchez',
    'pablo.sanchez.demo@canariense.inc',
    'worker',
    'active',
    'es'
  ),
  (
    'b1100007-0000-4000-8000-000000000007',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-laura',
    'Laura Jiménez',
    'Laura Jiménez',
    'laura.jimenez.demo@canariense.inc',
    'worker',
    'active',
    'es'
  ),
  (
    'b1100008-0000-4000-8000-000000000008',
    'a0000001-0000-4000-8000-000000000001',
    'demo-emp-tomas',
    'Tomás Pérez',
    'Tomás Pérez',
    'tomas.perez.demo@canariense.inc',
    'worker',
    'active',
    'es'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
