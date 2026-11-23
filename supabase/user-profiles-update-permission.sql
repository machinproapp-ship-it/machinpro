-- Cada uno solo edita su propio perfil (Mi perfil); los demás, solo quien tenga permiso para gestionar empleados.
alter policy update_own_company_profiles on public.user_profiles
  using (
    company_id = public.get_my_company_id()
    and (
      id = auth.uid()
      or public.has_permission('canManageEmployees')
      or public.has_permission('canEditCentral')
    )
  )
  with check (company_id = public.get_my_company_id());
