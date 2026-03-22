-- RFIs (Request For Information) — ejecutar en Supabase

create table if not exists public.rfis (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id text,
  project_name text,
  rfi_number text not null,
  title text not null,
  description text not null,
  category text,
  priority text not null default 'medium',
  status text not null default 'draft',
  submitted_by uuid references public.user_profiles (id),
  submitted_by_name text,
  assigned_to_name text,
  assigned_to_email text,
  due_date date,
  answered_at timestamptz,
  answer text,
  answered_by_name text,
  photos text[] not null default '{}',
  documents text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rfis_company_idx on public.rfis (company_id);
create index if not exists rfis_company_number_idx on public.rfis (company_id, rfi_number);

alter table public.rfis enable row level security;

create policy "rfis_company_all"
  on public.rfis for all
  using (
    company_id in (
      select company_id from public.user_profiles where id = auth.uid()
    )
  )
  with check (
    company_id in (
      select company_id from public.user_profiles where id = auth.uid()
    )
  );
