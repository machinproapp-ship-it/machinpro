-- MACHINPRO — Actualización rápida datos demo (Supabase SQL editor, rol con bypass RLS)
-- Empresa demo: a0000001-0000-4000-8000-000000000001

UPDATE public.user_profiles SET hourly_rate = 28.50, pay_type = 'hourly' WHERE full_name = 'Carlos Mendoza' AND company_id = 'a0000001-0000-4000-8000-000000000001';
UPDATE public.user_profiles SET hourly_rate = 32.00, pay_type = 'hourly' WHERE full_name = 'Ana Torres' AND company_id = 'a0000001-0000-4000-8000-000000000001';
UPDATE public.user_profiles SET hourly_rate = 25.00, pay_type = 'hourly' WHERE full_name = 'Luis Herrera' AND company_id = 'a0000001-0000-4000-8000-000000000001';
UPDATE public.user_profiles SET hourly_rate = 30.00, pay_type = 'hourly' WHERE full_name = 'Roberto Díaz' AND company_id = 'a0000001-0000-4000-8000-000000000001';
UPDATE public.user_profiles SET hourly_rate = 27.00, pay_type = 'hourly' WHERE full_name = 'Miguel Ángel Ramos' AND company_id = 'a0000001-0000-4000-8000-000000000001';
