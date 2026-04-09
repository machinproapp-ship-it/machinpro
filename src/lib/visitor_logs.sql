-- Sprint AG — visitor_logs (ejecutar manualmente en Supabase SQL Editor)
-- Requiere tabla public.companies(id uuid) existente.

create table if not exists visitor_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id text,
  project_name text,
  visitor_name text not null,
  visitor_company text,
  visitor_email text,
  visitor_phone text,
  visitor_id_number text,
  purpose text,
  host_name text,
  check_in timestamptz not null default now(),
  check_out timestamptz,
  status text not null default 'checked_in' check (status in ('checked_in', 'checked_out')),
  signature_data text,
  photo_url text,
  vehicle_plate text,
  safety_briefing_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists visitor_logs_company_id_idx on visitor_logs(company_id);
create index if not exists visitor_logs_check_in_idx on visitor_logs(check_in);
create index if not exists visitor_logs_status_idx on visitor_logs(status);

alter table visitor_logs enable row level security;

-- Check-in público (anon): insertar solo si la empresa existe
create policy "visitor_logs_anon_insert"
  on visitor_logs for insert
  to anon
  with check (
    exists (select 1 from companies c where c.id = company_id)
  );

-- Usuarios autenticados: ver visitantes de su empresa (get_my_company_id — ver av7_attendance_profiles_rpc.sql)
create policy "visitor_logs_select_company"
  on visitor_logs for select
  to authenticated
  using (company_id = public.get_my_company_id());

-- Usuarios autenticados: actualizar check-out manual
create policy "visitor_logs_update_company"
  on visitor_logs for update
  to authenticated
  using (company_id = public.get_my_company_id())
  with check (company_id = public.get_my_company_id());

-- Realtime (Dashboard → Database → Replication): añadir tabla visitor_logs a la publicación supabase_realtime si aplica:
-- alter publication supabase_realtime add table visitor_logs;
