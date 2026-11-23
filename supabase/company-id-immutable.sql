-- Cada fila pertenece a una empresa para siempre: nadie desde la app puede cambiar su company_id.
-- (Solo el servidor con service role, o un superadmin, para soporte.)
create or replace function public.prevent_company_id_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if old.company_id is not null
     and new.company_id is distinct from old.company_id
     and auth.uid() is not null
     and not exists (select 1 from public.user_profiles s where s.id = auth.uid() and coalesce(s.is_superadmin, false)) then
    raise exception 'forbidden: company_id cannot change' using errcode = '42501';
  end if;
  return new;
end;
$function$;

do $$
declare t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'company_id' and tb.table_type = 'BASE TABLE'
       and c.table_name <> 'user_profiles'  -- ya protegido por protect_profile_privileges
  loop
    execute format('create trigger trg_company_id_immutable before update of company_id on public.%I for each row execute function public.prevent_company_id_change()', t.table_name);
  end loop;
end $$;
