-- Sprint AL-1 — planos interactivos (ejecutar en Supabase SQL Editor)
-- Requiere: companies, user_profiles, hazards, corrective_actions

create table if not exists blueprints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id text not null,
  project_name text,
  name text not null,
  version integer not null default 1,
  image_url text not null,
  file_type text not null default 'image' check (file_type in ('image', 'pdf')),
  width integer,
  height integer,
  is_active boolean not null default true,
  created_by uuid references user_profiles(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blueprints_company_id_idx on blueprints(company_id);
create index if not exists blueprints_project_id_idx on blueprints(project_id);

create table if not exists blueprint_pins (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references blueprints(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  project_id text,
  x_percent numeric(5, 2) not null check (x_percent >= 0 and x_percent <= 100),
  y_percent numeric(5, 2) not null check (y_percent >= 0 and y_percent <= 100),
  layer text not null default 'general' check (
    layer in ('general', 'electrical', 'structural', 'plumbing', 'safety', 'progress')
  ),
  pin_type text not null default 'annotation' check (
    pin_type in ('annotation', 'hazard', 'corrective_action', 'photo')
  ),
  title text not null,
  description text,
  hazard_id uuid references hazards(id) on delete set null,
  corrective_action_id uuid references corrective_actions(id) on delete set null,
  color text not null default '#ef4444',
  icon text not null default 'pin',
  status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  created_by uuid references user_profiles(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists blueprint_pins_blueprint_id_idx on blueprint_pins(blueprint_id);
create index if not exists blueprint_pins_company_id_idx on blueprint_pins(company_id);

create or replace function public.set_blueprints_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blueprints_set_updated_at on blueprints;
create trigger blueprints_set_updated_at
  before update on blueprints
  for each row execute function public.set_blueprints_updated_at();

alter table blueprints enable row level security;
alter table blueprint_pins enable row level security;

-- blueprints: lectura miembros empresa
create policy "blueprints_select_company"
  on blueprints for select to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
  );

create policy "blueprints_insert_admin_supervisor"
  on blueprints for insert to authenticated
  with check (
    company_id in (select company_id from user_profiles where id = auth.uid())
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'supervisor')
    )
  );

create policy "blueprints_update_admin_supervisor"
  on blueprints for update to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'supervisor')
    )
  )
  with check (
    company_id in (select company_id from user_profiles where id = auth.uid())
  );

-- blueprint_pins
create policy "blueprint_pins_select_company"
  on blueprint_pins for select to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
  );

create policy "blueprint_pins_insert_admin_supervisor"
  on blueprint_pins for insert to authenticated
  with check (
    company_id in (select company_id from user_profiles where id = auth.uid())
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'supervisor')
    )
  );

create policy "blueprint_pins_update_admin_supervisor"
  on blueprint_pins for update to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'supervisor')
    )
  )
  with check (
    company_id in (select company_id from user_profiles where id = auth.uid())
  );

create policy "blueprint_pins_delete_admin_supervisor"
  on blueprint_pins for delete to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
    and exists (
      select 1 from user_profiles up
      where up.id = auth.uid() and up.role in ('admin', 'supervisor')
    )
  );
