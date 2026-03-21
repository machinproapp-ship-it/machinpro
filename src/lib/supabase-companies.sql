-- Tabla de empresas
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text default 'CA',
  language text default 'en',
  currency text default 'CAD',
  plan text default 'starter'
    check (plan in ('starter','professional','enterprise')),
  storage_used_gb numeric default 0,
  storage_limit_gb numeric default 10,
  is_active boolean default true,
  invite_token text unique,
  invite_expires_at timestamptz,
  created_at timestamptz default now(),
  activated_at timestamptz
);

-- Añadir company_id a todas las tablas existentes
alter table employees
  add column if not exists company_id uuid references companies(id);
alter table projects
  add column if not exists company_id uuid references companies(id);
alter table user_profiles
  add column if not exists company_id uuid references companies(id);

-- RLS en companies
alter table companies enable row level security;
create policy "users_see_own_company" on companies
  for select using (
    id = (select company_id from user_profiles where id = auth.uid())
  );

-- RLS en employees
alter table employees enable row level security;
create policy "company_isolation_employees" on employees
  for all using (
    company_id = (
      select company_id from user_profiles where id = auth.uid()
    )
  );

-- RLS en projects
alter table projects enable row level security;
create policy "company_isolation_projects" on projects
  for all using (
    company_id = (
      select company_id from user_profiles where id = auth.uid()
    )
  );

-- Actualizar user_profiles para incluir company_id
alter table user_profiles
  add column if not exists company_id uuid references companies(id);
