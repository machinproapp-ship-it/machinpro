-- ============================================================================
-- MACHINPRO — Actividad demo adicional (audit_logs)
-- ============================================================================
-- Empresa demo: a0000001-0000-4000-8000-000000000001
-- Perfiles (user_id): Carlos c01, Luis c02, Ana c03, Miguel c04, Roberto c05
-- Ejecutar en SQL Editor con rol que bypass RLS (p. ej. service_role).
-- INSERT-only; ON CONFLICT por id.
-- ============================================================================

BEGIN;

INSERT INTO public.audit_logs (id, company_id, user_id, user_name, action, entity_type, entity_id, created_at)
VALUES
  (
    'b0000da1-0000-4000-8000-000000000001'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c01-0000-4000-8000-000000000001',
    'Carlos Mendoza',
    'clock_in',
    'clock_entry',
    'demo-act-ce-1',
    now() - interval '3 hours'
  ),
  (
    'b0000da1-0000-4000-8000-000000000002'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c01-0000-4000-8000-000000000001',
    'Carlos Mendoza',
    'clock_out',
    'clock_entry',
    'demo-act-ce-2',
    now() - interval '2 hours 30 minutes'
  ),
  (
    'b0000da1-0000-4000-8000-000000000003'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c03-0000-4000-8000-000000000003',
    'Ana Torres',
    'form_submitted',
    'form',
    'demo-act-form-1',
    now() - interval '2 hours'
  ),
  (
    'b0000da1-0000-4000-8000-000000000004'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c02-0000-4000-8000-000000000002',
    'Luis Herrera',
    'production_reported',
    'project',
    'demo-act-prod-1',
    now() - interval '90 minutes'
  ),
  (
    'b0000da1-0000-4000-8000-000000000005'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c01-0000-4000-8000-000000000001',
    'Carlos Mendoza',
    'inventory_transfer',
    'tool',
    'demo-act-inv-1',
    now() - interval '75 minutes'
  ),
  (
    'b0000da1-0000-4000-8000-000000000006'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c01-0000-4000-8000-000000000001',
    'Carlos Mendoza',
    'vacation_approved',
    'employee',
    'demo-act-vac-1',
    now() - interval '60 minutes'
  ),
  (
    'b0000da1-0000-4000-8000-000000000007'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c04-0000-4000-8000-000000000004',
    'Miguel Ángel Ramos',
    'hazard_reported',
    'hazard',
    'demo-act-haz-1',
    now() - interval '45 minutes'
  ),
  (
    'b0000da1-0000-4000-8000-000000000008'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c05-0000-4000-8000-000000000005',
    'Roberto Díaz',
    'document_uploaded',
    'document',
    'demo-act-doc-1',
    now() - interval '30 minutes'
  ),
  (
    'b0000da1-0000-4000-8000-000000000009'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c02-0000-4000-8000-000000000002',
    'Luis Herrera',
    'clock_in',
    'clock_entry',
    'demo-act-ce-3',
    now() - interval '20 minutes'
  ),
  (
    'b0000da1-0000-4000-8000-000000000010'::uuid,
    'a0000001-0000-4000-8000-000000000001',
    'a0000c03-0000-4000-8000-000000000003',
    'Ana Torres',
    'production_reported',
    'project',
    'demo-act-prod-2',
    now() - interval '10 minutes'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
