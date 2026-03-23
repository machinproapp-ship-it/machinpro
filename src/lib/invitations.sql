-- Invitaciones superadmin → nuevas empresas (ejecutar manualmente en Supabase SQL editor)
-- Requiere: public.user_profiles con columna is_superadmin (ver user_profiles_superadmin.sql)

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default (gen_random_uuid()::text),
  email text not null,
  company_name text not null,
  invited_by uuid references public.user_profiles (id) on delete set null,
  invited_by_name text,
  plan text not null default 'trial'
    check (plan in ('trial', 'starter', 'pro', 'enterprise')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_company_id uuid references public.companies (id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists invitations_status_idx on public.invitations (status);
create index if not exists invitations_email_idx on public.invitations (lower(email));

alter table public.invitations enable row level security;

create policy "invitations_superadmin_select"
  on public.invitations for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and coalesce(up.is_superadmin, false) = true
    )
  );

create policy "invitations_superadmin_insert"
  on public.invitations for insert
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and coalesce(up.is_superadmin, false) = true
    )
  );

create policy "invitations_superadmin_update"
  on public.invitations for update
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and coalesce(up.is_superadmin, false) = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and coalesce(up.is_superadmin, false) = true
    )
  );

create policy "invitations_superadmin_delete"
  on public.invitations for delete
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and coalesce(up.is_superadmin, false) = true
    )
  );

comment on table public.invitations is 'Company signup invitations (superadmin only via RLS; server routes use service role).';
