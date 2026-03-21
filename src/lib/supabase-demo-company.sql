-- Crear empresa demo para pruebas
-- Nota: si id debe ser UUID válido, usa por ejemplo: 'a0000001-0000-4000-8000-000000000001'
insert into companies (id, name, country, language, currency, plan, is_active)
values (
  'a0000001-0000-4000-8000-000000000001',
  'Maddison Construction',
  'CA',
  'en',
  'CAD',
  'professional',
  true
) on conflict (id) do nothing;

-- Asignar todos los usuarios existentes a la empresa demo
update user_profiles
set company_id = 'a0000001-0000-4000-8000-000000000001'
where company_id is null;

-- Asignar todos los empleados existentes a la empresa demo
update employees
set company_id = 'a0000001-0000-4000-8000-000000000001'
where company_id is null;

-- Asignar todos los proyectos existentes a la empresa demo
update projects
set company_id = 'a0000001-0000-4000-8000-000000000001'
where company_id is null;
