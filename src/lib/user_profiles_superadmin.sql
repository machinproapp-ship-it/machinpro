-- Superadmin flag (MachinPro owner). Ejecutar en Supabase SQL Editor.
alter table user_profiles add column if not exists is_superadmin boolean default false;

-- Ajustar email al usuario real del panel.
update user_profiles set is_superadmin = true where email = 'admin@machinpro.com';
