-- MACHINPRO — GDPR hard delete (retain anonymized user_profiles after auth user removal)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase antes de usar /api/employees/hard-delete.
--
-- Por defecto `user_profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` borra la fila
-- al eliminar el usuario de Auth. Para anonimizar y conservar company_id / FKs operativas,
-- hay que quitar esa restricción (el id UUID sigue siendo único en user_profiles).

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
