-- Sprint AH — hazards (ejecutar manualmente en Supabase SQL Editor)
-- Requiere public.companies y public.user_profiles.

create table if not exists hazards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id text,
  project_name text,
  title text not null,
  description text,
  category text not null check (
    category in (
      'electrical',
      'chemical',
      'physical',
      'ergonomic',
      'biological',
      'fire',
      'other'
    )
  ),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  probability text not null default 'medium' check (probability in ('low', 'medium', 'high')),
  risk_score integer not null default 4 check (risk_score >= 1 and risk_score <= 9),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  location text,
  reported_by uuid references user_profiles(id),
  reported_by_name text,
  assigned_to uuid references user_profiles(id),
  assigned_to_name text,
  due_date date,
  resolved_at timestamptz,
  resolved_by_name text,
  resolution_notes text,
  photos text[] not null default '{}',
  corrective_actions text[] not null default '{}',
  tags text[] not null default '{}',
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hazards_company_id_idx on hazards(company_id);
create index if not exists hazards_project_id_idx on hazards(project_id);
create index if not exists hazards_status_idx on hazards(status);
create index if not exists hazards_created_at_idx on hazards(created_at desc);

create or replace function public.set_hazards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hazards_set_updated_at on hazards;
create trigger hazards_set_updated_at
  before update on hazards
  for each row
  execute function public.set_hazards_updated_at();

alter table hazards enable row level security;

-- Lectura: cualquier miembro autenticado de la empresa
create policy "hazards_select_company"
  on hazards for select
  to authenticated
  using (
    company_id in (
      select company_id from user_profiles where id = auth.uid()
    )
  );

-- Alta: solo admin y supervisor de la empresa
create policy "hazards_insert_admin_supervisor"
  on hazards for insert
  to authenticated
  with check (
    company_id in (
      select company_id from user_profiles where id = auth.uid()
    )
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid()
        and up.role in ('admin', 'supervisor')
    )
  );

-- Edición: solo admin y supervisor
create policy "hazards_update_admin_supervisor"
  on hazards for update
  to authenticated
  using (
    company_id in (
      select company_id from user_profiles where id = auth.uid()
    )
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid()
        and up.role in ('admin', 'supervisor')
    )
  )
  with check (
    company_id in (
      select company_id from user_profiles where id = auth.uid()
    )
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid()
        and up.role in ('admin', 'supervisor')
    )
  );

-- Borrado opcional: restringido (descomentar si se necesita)
-- create policy "hazards_delete_admin" ...
