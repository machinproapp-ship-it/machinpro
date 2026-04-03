-- ============================================================================
-- MACHINPRO — Datos demo realistas (Canariense Inc)
-- ============================================================================
-- company_id fijo (UUID demo):
--   a0000001-0000-4000-8000-000000000001
--
-- IMPORTANTE — Ejecución:
--   • Ejecutar en el SQL Editor de Supabase como rol que BYPASEE RLS
--     (p. ej. postgres / service role). Las políticas de time_entries solo
--     permiten INSERT con user_id = auth.uid(); los INSERT de demo para
--     varios perfiles fallarían como usuario normal.
--
-- user_profiles sin auth:
--   Si user_profiles.id sigue con FK a auth.users, estos INSERT fallan hasta
--   aplicar (una vez): src/lib/user_profiles_gdpr_hard_delete.sql
--
-- Columnas verificadas en repo:
--   • time_entries → src/lib/sprint-av-schema.sql
--     status IN ('active','completed','manual')  — NO approved/pending/in_progress
--   • daily_reports + hijos → src/lib/daily_reports.sql
--     weather IN ('sunny','cloudy','rain','wind','snow') — detalle en site_conditions
--   • user_profiles → src/lib/supabase-schema.sql + migraciones (company_id, email, …)
--   • Flota en UI: localStorage machinpro_vehicles (src/app/page.tsx). No hay tabla
--     en el esquema base; aquí se añade CREATE opcional fleet_vehicles + INSERTs.
--
-- Proyecto "Obra Centro": en código inicial id = 'p1'. Ajusta PROYECTO_OBRA si tu
-- fila en `projects` tiene otro id (subconsulta comentada abajo).
--
-- NO hacer push automático — revisar antes de ejecutar.
-- Audit logs: solo INSERT; este script no UPDATE/DELETE en tablas de auditoría.
-- ============================================================================

BEGIN;

-- Opcional: branding empresa demo
UPDATE public.companies
SET name = 'Canariense Inc'
WHERE id = 'a0000001-0000-4000-8000-000000000001';

-- ─── IDs estables demo (perfiles + empleados texto) ─────────────────────────
-- Perfiles (UUID) — enlazados a employees.id (text) para fichaje / UI
-- carlos_ld   Luis   ana   miguel   roberto

-- Empleados: requeridos para usual_driver en flota y user_profiles.employee_id
INSERT INTO public.employees (id, name, role, company_id, pay_type, email)
VALUES
  ('demo-emp-carlos', 'Carlos Mendoza', 'Capataz', 'a0000001-0000-4000-8000-000000000001', 'hourly', 'carlos.mendoza.demo@canariense.inc'),
  ('demo-emp-luis', 'Luis Herrera', 'Operador de maquinaria', 'a0000001-0000-4000-8000-000000000001', 'hourly', 'luis.herrera.demo@canariense.inc'),
  ('demo-emp-ana', 'Ana Torres', 'Administrativa de obra', 'a0000001-0000-4000-8000-000000000001', 'hourly', 'ana.torres.demo@canariense.inc'),
  ('demo-emp-miguel', 'Miguel Ángel Ramos', 'Electricista', 'a0000001-0000-4000-8000-000000000001', 'hourly', 'miguel.ramos.demo@canariense.inc'),
  ('demo-emp-roberto', 'Roberto Díaz', 'Albañil', 'a0000001-0000-4000-8000-000000000001', 'hourly', 'roberto.diaz.demo@canariense.inc')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  company_id = EXCLUDED.company_id,
  email = EXCLUDED.email;

INSERT INTO public.user_profiles (
  id,
  employee_id,
  role,
  company_id,
  email,
  full_name,
  display_name,
  profile_status
)
VALUES
  (
    'a0000c01-0000-4000-8000-000000000001',
    'demo-emp-carlos',
    'supervisor',
    'a0000001-0000-4000-8000-000000000001',
    'carlos.mendoza.demo@canariense.inc',
    'Carlos Mendoza',
    'Carlos Mendoza',
    'active'
  ),
  (
    'a0000c02-0000-4000-8000-000000000002',
    'demo-emp-luis',
    'worker',
    'a0000001-0000-4000-8000-000000000001',
    'luis.herrera.demo@canariense.inc',
    'Luis Herrera',
    'Luis Herrera',
    'active'
  ),
  (
    'a0000c03-0000-4000-8000-000000000003',
    'demo-emp-ana',
    'worker',
    'a0000001-0000-4000-8000-000000000001',
    'ana.torres.demo@canariense.inc',
    'Ana Torres',
    'Ana Torres',
    'active'
  ),
  (
    'a0000c04-0000-4000-8000-000000000004',
    'demo-emp-miguel',
    'worker',
    'a0000001-0000-4000-8000-000000000001',
    'miguel.ramos.demo@canariense.inc',
    'Miguel Ángel Ramos',
    'Miguel Ángel Ramos',
    'active'
  ),
  (
    'a0000c05-0000-4000-8000-000000000005',
    'demo-emp-roberto',
    'worker',
    'a0000001-0000-4000-8000-000000000001',
    'roberto.diaz.demo@canariense.inc',
    'Roberto Díaz',
    'Roberto Díaz',
    'active'
  )
ON CONFLICT (id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  role = EXCLUDED.role,
  company_id = EXCLUDED.company_id,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  display_name = EXCLUDED.display_name,
  profile_status = EXCLUDED.profile_status;

-- Horas en UTC; equivalente a horario local España (CEST, UTC+2) en esa semana.
-- L = 2026-03-30 .. V = 2026-04-03 (semana con jueves 2026-04-02).
-- Mapa estado negocio → time_entries.status (CHECK):
--   aprobado → completed | pendiente / en curso → active (sin clock_out) |
--   manual disponible si más adelante ampliáis CHECK

-- project_id Obra Centro (ajusta si tu BD usa otro id):
--   (SELECT id FROM projects WHERE company_id = 'a0000001-0000-4000-8000-000000000001' AND name = 'Obra Centro' LIMIT 1)

INSERT INTO public.time_entries (
  id,
  company_id,
  user_id,
  project_id,
  clock_in_at,
  clock_out_at,
  total_minutes,
  notes,
  status
) VALUES
-- Carlos: L–V 7:00–16:00 (9h) completed — hoja aprobada (metadato en notas)
  ('a0000e01-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','a0000c01-0000-4000-8000-000000000001','p1','2026-03-30T05:00:00Z','2026-03-30T14:00:00Z',540,'Hoja: aprobada','completed'),
  ('a0000e01-0000-4000-8000-000000000002','a0000001-0000-4000-8000-000000000001','a0000c01-0000-4000-8000-000000000001','p1','2026-03-31T05:00:00Z','2026-03-31T14:00:00Z',540,'Hoja: aprobada','completed'),
  ('a0000e01-0000-4000-8000-000000000003','a0000001-0000-4000-8000-000000000001','a0000c01-0000-4000-8000-000000000001','p1','2026-04-01T05:00:00Z','2026-04-01T14:00:00Z',540,'Hoja: aprobada','completed'),
  ('a0000e01-0000-4000-8000-000000000004','a0000001-0000-4000-8000-000000000001','a0000c01-0000-4000-8000-000000000001','p1','2026-04-02T05:00:00Z','2026-04-02T14:00:00Z',540,'Hoja: aprobada','completed'),
  ('a0000e01-0000-4000-8000-000000000005','a0000001-0000-4000-8000-000000000001','a0000c01-0000-4000-8000-000000000001','p1','2026-04-03T05:00:00Z','2026-04-03T14:00:00Z',540,'Hoja: aprobada','completed'),
-- Luis: L–J 7:00–17:30 (10.5h) completed; V pendiente → active sin salida
  ('a0000e02-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','a0000c02-0000-4000-8000-000000000002','p1','2026-03-30T05:00:00Z','2026-03-30T15:30:00Z',630,'Hoja: aprobada (extras)','completed'),
  ('a0000e02-0000-4000-8000-000000000002','a0000001-0000-4000-8000-000000000001','a0000c02-0000-4000-8000-000000000002','p1','2026-03-31T05:00:00Z','2026-03-31T15:30:00Z',630,'Hoja: aprobada (extras)','completed'),
  ('a0000e02-0000-4000-8000-000000000003','a0000001-0000-4000-8000-000000000001','a0000c02-0000-4000-8000-000000000002','p1','2026-04-01T05:00:00Z','2026-04-01T15:30:00Z',630,'Hoja: aprobada (extras)','completed'),
  ('a0000e02-0000-4000-8000-000000000004','a0000001-0000-4000-8000-000000000001','a0000c02-0000-4000-8000-000000000002','p1','2026-04-02T05:00:00Z','2026-04-02T15:30:00Z',630,'Hoja: aprobada (extras)','completed'),
  ('a0000e02-0000-4000-8000-000000000005','a0000001-0000-4000-8000-000000000001','a0000c02-0000-4000-8000-000000000002','p1','2026-04-03T05:00:00Z',NULL,NULL,'Hoja: pendiente de cierre/aprobación','active'),
-- Ana: L–V 8:00–16:00 (8h) completed
  ('a0000e03-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','a0000c03-0000-4000-8000-000000000003','p1','2026-03-30T06:00:00Z','2026-03-30T14:00:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e03-0000-4000-8000-000000000002','a0000001-0000-4000-8000-000000000001','a0000c03-0000-4000-8000-000000000003','p1','2026-03-31T06:00:00Z','2026-03-31T14:00:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e03-0000-4000-8000-000000000003','a0000001-0000-4000-8000-000000000001','a0000c03-0000-4000-8000-000000000003','p1','2026-04-01T06:00:00Z','2026-04-01T14:00:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e03-0000-4000-8000-000000000004','a0000001-0000-4000-8000-000000000001','a0000c03-0000-4000-8000-000000000003','p1','2026-04-02T06:00:00Z','2026-04-02T14:00:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e03-0000-4000-8000-000000000005','a0000001-0000-4000-8000-000000000001','a0000c03-0000-4000-8000-000000000003','p1','2026-04-03T06:00:00Z','2026-04-03T14:00:00Z',480,'Hoja: aprobada','completed'),
-- Miguel: L–Mi completed; Ju–Vi en curso → active sin salida
  ('a0000e04-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','a0000c04-0000-4000-8000-000000000004','p1','2026-03-30T05:00:00Z','2026-03-30T14:00:00Z',540,'Hoja: aprobada','completed'),
  ('a0000e04-0000-4000-8000-000000000002','a0000001-0000-4000-8000-000000000001','a0000c04-0000-4000-8000-000000000004','p1','2026-03-31T05:00:00Z','2026-03-31T14:00:00Z',540,'Hoja: aprobada','completed'),
  ('a0000e04-0000-4000-8000-000000000003','a0000001-0000-4000-8000-000000000001','a0000c04-0000-4000-8000-000000000004','p1','2026-04-01T05:00:00Z','2026-04-01T14:00:00Z',540,'Hoja: aprobada','completed'),
  ('a0000e04-0000-4000-8000-000000000004','a0000001-0000-4000-8000-000000000001','a0000c04-0000-4000-8000-000000000004','p1','2026-04-02T05:00:00Z',NULL,NULL,'Fichaje en curso (hoja en revisión)','active'),
  ('a0000e04-0000-4000-8000-000000000005','a0000001-0000-4000-8000-000000000001','a0000c04-0000-4000-8000-000000000004','p1','2026-04-03T05:00:00Z',NULL,NULL,'Fichaje en curso (hoja en revisión)','active'),
-- Roberto: L–V 7:30–15:30 (8h) completed
  ('a0000e05-0000-4000-8000-000000000001','a0000001-0000-4000-8000-000000000001','a0000c05-0000-4000-8000-000000000005','p1','2026-03-30T05:30:00Z','2026-03-30T13:30:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e05-0000-4000-8000-000000000002','a0000001-0000-4000-8000-000000000001','a0000c05-0000-4000-8000-000000000005','p1','2026-03-31T05:30:00Z','2026-03-31T13:30:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e05-0000-4000-8000-000000000003','a0000001-0000-4000-8000-000000000001','a0000c05-0000-4000-8000-000000000005','p1','2026-04-01T05:30:00Z','2026-04-01T13:30:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e05-0000-4000-8000-000000000004','a0000001-0000-4000-8000-000000000001','a0000c05-0000-4000-8000-000000000005','p1','2026-04-02T05:30:00Z','2026-04-02T13:30:00Z',480,'Hoja: aprobada','completed'),
  ('a0000e05-0000-4000-8000-000000000005','a0000001-0000-4000-8000-000000000001','a0000c05-0000-4000-8000-000000000005','p1','2026-04-03T05:30:00Z','2026-04-03T13:30:00Z',480,'Hoja: aprobada','completed')
ON CONFLICT (id) DO UPDATE SET
  clock_in_at = EXCLUDED.clock_in_at,
  clock_out_at = EXCLUDED.clock_out_at,
  total_minutes = EXCLUDED.total_minutes,
  notes = EXCLUDED.notes,
  status = EXCLUDED.status,
  project_id = EXCLUDED.project_id;

-- ─── Flota: tabla NO incluida en el esquema base del repo; opcional para BI / futuro.
-- La pantalla Logística sigue usando localStorage hasta que enlacéis esta tabla.
CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  plate text NOT NULL,
  vehicle_status text NOT NULL DEFAULT 'available'
    CHECK (vehicle_status IN ('available', 'in_use', 'maintenance', 'out_of_service')),
  usual_driver_employee_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  current_project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  insurance_expires_on date,
  inspection_expires_on date,
  last_maintenance_on date,
  next_maintenance_on date,
  odometer_or_hours numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, plate)
);

INSERT INTO public.fleet_vehicles (
  id,
  company_id,
  label,
  plate,
  vehicle_status,
  usual_driver_employee_id,
  current_project_id,
  insurance_expires_on,
  inspection_expires_on,
  last_maintenance_on,
  next_maintenance_on,
  odometer_or_hours,
  notes
) VALUES
  (
    'a0000f01-0000-4000-8000-000000000001',
    'a0000001-0000-4000-8000-000000000001',
    'Ford F-150 2022',
    'ONT-4821',
    'available',
    'demo-emp-carlos',
    NULL,
    '2026-09-15',
    '2026-08-01',
    NULL,
    NULL,
    45230,
    NULL
  ),
  (
    'a0000f02-0000-4000-8000-000000000002',
    'a0000001-0000-4000-8000-000000000001',
    'Excavadora CAT 320',
    'CAT-320-001',
    'in_use',
    NULL,
    'p1',
    NULL,
    NULL,
    '2026-03-01',
    '2026-04-15',
    1240,
    'Asignada a Obra Centro. Próximo mantenimiento cercano (2026-04-15).'
  ),
  (
    'a0000f03-0000-4000-8000-000000000003',
    'a0000001-0000-4000-8000-000000000001',
    'Camión volteo Kenworth T370',
    'ONT-7734',
    'maintenance',
    NULL,
    NULL,
    '2026-05-20',
    NULL,
    NULL,
    NULL,
    112450,
    'En taller: cambio de frenos + revisión hidráulica.'
  ),
  (
    'a0000f04-0000-4000-8000-000000000004',
    'a0000001-0000-4000-8000-000000000001',
    'Compactadora Bomag BW120',
    'BOM-2024-02',
    'available',
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-02-10',
    NULL,
    890,
    'Sin proyecto asignado. Horas de operación acumuladas: 890 h.'
  )
ON CONFLICT (company_id, plate) DO UPDATE SET
  label = EXCLUDED.label,
  vehicle_status = EXCLUDED.vehicle_status,
  usual_driver_employee_id = EXCLUDED.usual_driver_employee_id,
  current_project_id = EXCLUDED.current_project_id,
  insurance_expires_on = EXCLUDED.insurance_expires_on,
  inspection_expires_on = EXCLUDED.inspection_expires_on,
  last_maintenance_on = EXCLUDED.last_maintenance_on,
  next_maintenance_on = EXCLUDED.next_maintenance_on,
  odometer_or_hours = EXCLUDED.odometer_or_hours,
  notes = EXCLUDED.notes;

-- ─── Parte diario — Obra Centro — fecha fija “hoy” sprint (2026-04-02) ─────────
-- created_by: un perfil admin de la empresa demo (p. ej. admin@machinpro.com).
-- Si no hay filas, este bloque no inserta cabecera ni hijos (evita FK rotas).
INSERT INTO public.daily_reports (
  id,
  company_id,
  project_id,
  created_by,
  date,
  weather,
  site_conditions,
  notes,
  status,
  ppe_selected,
  ppe_other
)
SELECT
  'a0000d01-0000-4000-8000-000000000001',
  'a0000001-0000-4000-8000-000000000001',
  'p1',
  adm.id,
  '2026-04-02',
  'sunny',
  'Soleado, 8°C, sin viento.',
  E'Incidencias: ninguna.\n\nPersonal ausente: Ana Torres (día personal).\n\nPróximos pasos (resumen): completar colada columnas restantes; revisar nivel de losa antes de fraguado.',
  'published',
  ARRAY['helmet', 'vest', 'boots']::text[],
  ''
FROM (
  SELECT id
  FROM public.user_profiles
  WHERE company_id = 'a0000001-0000-4000-8000-000000000001' AND role = 'admin'
  ORDER BY created_at NULLS LAST
  LIMIT 1
) adm
ON CONFLICT (id) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  created_by = EXCLUDED.created_by,
  date = EXCLUDED.date,
  weather = EXCLUDED.weather,
  site_conditions = EXCLUDED.site_conditions,
  notes = EXCLUDED.notes,
  status = EXCLUDED.status,
  ppe_selected = EXCLUDED.ppe_selected;

-- Hijas: solo si existe la cabecera del parte (evita error si falta admin).
INSERT INTO public.daily_report_tasks (id, report_id, employee_id, description, completed)
SELECT v.id, v.report_id, v.employee_id, v.description, v.completed
FROM (
  VALUES
    (
      'a0000d11-0000-4000-8000-000000000001'::uuid,
      'a0000d01-0000-4000-8000-000000000001'::uuid,
      NULL::uuid,
      'Se completó el encofrado de la losa del segundo piso sector norte. Se inició colada de hormigón en columnas C-4 a C-8. Instalación de tubería conduit completada en planta baja.'::text,
      true
    ),
    (
      'a0000d12-0000-4000-8000-000000000002'::uuid,
      'a0000d01-0000-4000-8000-000000000001'::uuid,
      NULL::uuid,
      'Próximos pasos: completar colada columnas restantes. Revisar nivel de losa antes de fraguado.'::text,
      false
    )
) AS v(id, report_id, employee_id, description, completed)
INNER JOIN public.daily_reports dr ON dr.id = v.report_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.daily_report_attendance (id, report_id, employee_id, status, from_timeclock)
SELECT v.id, v.report_id, v.employee_id, v.status, v.from_timeclock
FROM (
  VALUES
    ('a0000da1-0000-4000-8000-000000000001'::uuid, 'a0000d01-0000-4000-8000-000000000001'::uuid, 'a0000c01-0000-4000-8000-000000000001'::uuid, 'present'::text, false),
    ('a0000da2-0000-4000-8000-000000000002'::uuid, 'a0000d01-0000-4000-8000-000000000001'::uuid, 'a0000c02-0000-4000-8000-000000000002'::uuid, 'present', false),
    ('a0000da3-0000-4000-8000-000000000003'::uuid, 'a0000d01-0000-4000-8000-000000000001'::uuid, 'a0000c04-0000-4000-8000-000000000004'::uuid, 'present', false),
    ('a0000da4-0000-4000-8000-000000000004'::uuid, 'a0000d01-0000-4000-8000-000000000001'::uuid, 'a0000c05-0000-4000-8000-000000000005'::uuid, 'present', false),
    ('a0000da5-0000-4000-8000-000000000005'::uuid, 'a0000d01-0000-4000-8000-000000000001'::uuid, 'a0000c03-0000-4000-8000-000000000003'::uuid, 'absent', false)
) AS v(id, report_id, employee_id, status, from_timeclock)
INNER JOIN public.daily_reports dr ON dr.id = v.report_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.daily_report_signatures (id, report_id, employee_id, signed_at, method, signature_data)
SELECT
  'a0000ds1-0000-4000-8000-000000000001'::uuid,
  'a0000d01-0000-4000-8000-000000000001'::uuid,
  'a0000c01-0000-4000-8000-000000000001'::uuid,
  now(),
  'tap_named',
  'Carlos Mendoza — Capataz'
FROM public.daily_reports dr
WHERE dr.id = 'a0000d01-0000-4000-8000-000000000001'
ON CONFLICT (id) DO NOTHING;

COMMIT;
