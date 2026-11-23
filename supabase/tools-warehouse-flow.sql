-- Control de herramientas: el almacén asigna a una obra (sin persona) o a una persona,
-- y la obra se guarda siempre igual en las dos columnas (assigned_to_project_id = current_project_id).

-- 1) Entregar a una persona. Logística y supervisor eligen la obra tal cual ("Sin obra" la quita);
--    el trabajador con permiso mantiene la obra que tenía si no elige otra.
create or replace function public.tool_take(p_item_id text, p_project_id text default null, p_note text default null, p_to_user uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.inventory_items;
  v_role text := public.tool_role();
  v_to uuid := coalesce(p_to_user, auth.uid());
  v_prev text;
  v_prev_project text;
  v_project text;
begin
  if v_role is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v := public.tool_load_mine(p_item_id);
  if not exists (select 1 from public.user_profiles where id = v_to and company_id = v.company_id and deleted_at is null) then
    raise exception 'bad_person' using errcode = '22023';
  end if;
  if v_role = 'helper' and v_to <> auth.uid() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_project_id is not null then
    if not exists (select 1 from public.projects where id = p_project_id and company_id = v.company_id) then
      raise exception 'bad_project' using errcode = '22023';
    end if;
    if v_role = 'site' and not public.is_on_project(p_project_id) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  if not public.tool_can_use_by(v, v_to) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_prev := v.assigned_to_employee_id;
  v_prev_project := coalesce(v.assigned_to_project_id, v.current_project_id);
  v_project := case when v_role in ('logistics', 'site') then p_project_id
                    else coalesce(p_project_id, v_prev_project) end;
  update public.inventory_items
     set assigned_to_employee_id = v_to::text,
         current_project_id = v_project,
         assigned_to_project_id = v_project,
         tool_status = case when tool_status in ('maintenance', 'out_of_service', 'lost') then tool_status else 'in_use' end,
         updated_at = now()
   where id = v.id;
  insert into public.inventory_movements (item_id, movement_type, quantity, from_project_id, to_project_id,
                                          from_user_id, to_user_id, notes)
  values (v.id, 'checkout', 1, v_prev_project, v_project, v_prev, v_to::text, nullif(trim(p_note), ''));
  return jsonb_build_object('ok', true, 'itemId', v.id, 'projectId', v_project, 'to', v_to);
end;
$function$;

-- 2) Dejarla en una obra sin persona (la caseta de la obra). Solo logística o el supervisor en sus obras.
create or replace function public.tool_assign_project(p_item_id text, p_project_id text, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.inventory_items;
  v_role text := public.tool_role();
  v_prev_project text;
begin
  if v_role is null or v_role not in ('logistics', 'site') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v := public.tool_load_mine(p_item_id);
  if p_project_id is null
     or not exists (select 1 from public.projects where id = p_project_id and company_id = v.company_id) then
    raise exception 'bad_project' using errcode = '22023';
  end if;
  if v_role = 'site' and not public.is_on_project(p_project_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_prev_project := coalesce(v.assigned_to_project_id, v.current_project_id);
  update public.inventory_items
     set assigned_to_employee_id = null,
         current_project_id = p_project_id,
         assigned_to_project_id = p_project_id,
         tool_status = case when tool_status in ('maintenance', 'out_of_service', 'lost') then tool_status else 'in_use' end,
         updated_at = now()
   where id = v.id;
  insert into public.inventory_movements (item_id, movement_type, quantity, from_location, to_location,
                                          from_project_id, to_project_id, from_user_id, to_user_id, notes)
  values (v.id, 'transfer', 1, case when v_prev_project is null then 'warehouse' else 'project' end, 'project',
          v_prev_project, p_project_id, v.assigned_to_employee_id, null, nullif(trim(p_note), ''));
  return jsonb_build_object('ok', true, 'itemId', v.id, 'projectId', p_project_id);
end;
$function$;

-- 3) Recibir en el almacén: vale también para herramientas que estaban en una obra sin persona.
create or replace function public.tool_return(p_item_id text, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.inventory_items;
  v_role text := public.tool_role();
begin
  if v_role is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v := public.tool_load_mine(p_item_id);
  if v_role = 'helper' and coalesce(v.assigned_to_employee_id, '') <> auth.uid()::text then
    raise exception 'not_holder' using errcode = '42501';
  end if;
  update public.inventory_items
     set assigned_to_employee_id = null,
         current_project_id = null,
         assigned_to_project_id = null,
         location = 'warehouse',
         tool_status = case when tool_status = 'in_use' then 'available' else tool_status end,
         updated_at = now()
   where id = v.id;
  insert into public.inventory_movements (item_id, movement_type, quantity, from_project_id, to_project_id,
                                          from_user_id, to_user_id, to_location, notes)
  values (v.id, 'return', 1, coalesce(v.assigned_to_project_id, v.current_project_id), null,
          v.assigned_to_employee_id, null, 'warehouse', nullif(trim(p_note), ''));
  return jsonb_build_object('ok', true, 'itemId', v.id);
end;
$function$;

revoke all on function public.tool_assign_project(text, text, text) from public, anon;
grant execute on function public.tool_assign_project(text, text, text) to authenticated, service_role;

-- 4) Una sola obra por artículo: la columna antigua se iguala a la que usa la app.
update public.inventory_items
   set current_project_id = assigned_to_project_id
 where current_project_id is distinct from assigned_to_project_id;
