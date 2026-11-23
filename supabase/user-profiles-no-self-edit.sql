-- Nadie edita su perfil sin permiso: sin "Gestionar empleados", uno solo puede cambiar sus
-- preferencias de la app (idioma, zona horaria, panel). Los datos (nombre, teléfono, foto,
-- contacto de emergencia, GPS…) solo los cambia quien tiene el permiso.
create or replace function public.protect_profile_privileges()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  me record;
  prefs constant text[] := array['locale', 'timezone', 'dashboard_config'];
begin
  -- service role / SQL editor: auth.uid() es null
  if auth.uid() is null then
    return new;
  end if;

  select role, company_id, coalesce(is_superadmin,false) as sa
    into me
    from public.user_profiles
   where id = auth.uid();

  if found and me.sa then
    return new;
  end if;

  if found and me.role = 'admin' and old.company_id is not null and me.company_id = old.company_id then
    if new.company_id is distinct from old.company_id then
      raise exception 'forbidden: a company admin cannot move users to another company' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Sin permiso de gestionar empleados: solo preferencias propias.
  if not (public.has_permission('canManageEmployees') or public.has_permission('canEditCentral')) then
    if (to_jsonb(new) - prefs) is distinct from (to_jsonb(old) - prefs) then
      raise exception 'forbidden: profile changes need permission' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role                    is distinct from old.role
  or new.custom_role_id          is distinct from old.custom_role_id
  or new.custom_permissions      is distinct from old.custom_permissions
  or new.use_role_permissions    is distinct from old.use_role_permissions
  or new.company_id              is distinct from old.company_id
  or new.employee_id             is distinct from old.employee_id
  or new.hourly_rate             is distinct from old.hourly_rate
  or new.pay_amount              is distinct from old.pay_amount
  or new.pay_currency            is distinct from old.pay_currency
  or new.pay_period              is distinct from old.pay_period
  or new.pay_type                is distinct from old.pay_type
  or new.payment_amount          is distinct from old.payment_amount
  or new.payment_currency        is distinct from old.payment_currency
  or new.payment_period          is distinct from old.payment_period
  or new.payment_type            is distinct from old.payment_type
  or new.vacation_days_allowed   is distinct from old.vacation_days_allowed
  or new.vacation_days_per_year  is distinct from old.vacation_days_per_year
  or new.vacation_managed        is distinct from old.vacation_managed
  or new.vacation_policy_enabled is distinct from old.vacation_policy_enabled
  or new.profile_status          is distinct from old.profile_status
  or new.deleted_at              is distinct from old.deleted_at
  then
    raise exception 'forbidden: only an admin can change roles, permissions, pay, vacation policy or status' using errcode = '42501';
  end if;

  return new;
end;
$function$;
