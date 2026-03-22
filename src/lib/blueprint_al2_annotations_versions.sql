-- Sprint AL-2 — anotaciones post-it + versiones de planos (ejecutar manualmente en Supabase SQL Editor)
-- Requiere: companies, user_profiles, blueprints

-- ---------------------------------------------------------------------------
-- Tabla blueprint_annotations (post-its)
-- ---------------------------------------------------------------------------
create table if not exists blueprint_annotations (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references blueprints(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  project_id text not null,
  x_percent numeric(5, 2) not null check (x_percent >= 0 and x_percent <= 100),
  y_percent numeric(5, 2) not null check (y_percent >= 0 and y_percent <= 100),
  content text not null check (char_length(content) <= 500 and char_length(content) >= 1),
  color text not null default '#fbbf24',
  author_name text,
  author_id uuid references user_profiles(id),
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blueprint_annotations_blueprint_id_idx on blueprint_annotations(blueprint_id);
create index if not exists blueprint_annotations_company_id_idx on blueprint_annotations(company_id);

create or replace function public.set_blueprint_annotations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blueprint_annotations_set_updated_at on blueprint_annotations;
create trigger blueprint_annotations_set_updated_at
  before update on blueprint_annotations
  for each row execute function public.set_blueprint_annotations_updated_at();

alter table blueprint_annotations enable row level security;

create policy "blueprint_annotations_select_company"
  on blueprint_annotations for select to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
  );

create policy "blueprint_annotations_insert_company"
  on blueprint_annotations for insert to authenticated
  with check (
    company_id in (select company_id from user_profiles where id = auth.uid())
  );

create policy "blueprint_annotations_update_author_or_lead"
  on blueprint_annotations for update to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
    and (
      author_id = auth.uid()
      or exists (
        select 1 from user_profiles up
        where up.id = auth.uid() and up.role in ('admin', 'supervisor')
      )
    )
  )
  with check (
    company_id in (select company_id from user_profiles where id = auth.uid())
  );

create policy "blueprint_annotations_delete_author_or_lead"
  on blueprint_annotations for delete to authenticated
  using (
    company_id in (select company_id from user_profiles where id = auth.uid())
    and (
      author_id = auth.uid()
      or exists (
        select 1 from user_profiles up
        where up.id = auth.uid() and up.role in ('admin', 'supervisor')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Columnas de versionado en blueprints
-- ---------------------------------------------------------------------------
alter table blueprints add column if not exists parent_version_id uuid references blueprints(id) on delete set null;
alter table blueprints add column if not exists version_notes text;
