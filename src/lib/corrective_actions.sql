-- Sprint AI — corrective_actions (ejecutar manualmente en Supabase SQL Editor)

create table if not exists corrective_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  hazard_id uuid references hazards(id) on delete set null,
  project_id text,
  project_name text,
  title text not null,
  description text,
  root_cause text,
  action_type text not null default 'corrective' check (action_type in ('immediate', 'corrective', 'preventive')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'pending_review', 'verified', 'closed')
  ),
  assigned_to uuid references user_profiles(id),
  assigned_to_name text,
  created_by uuid references user_profiles(id),
  created_by_name text,
  due_date date,
  completed_at timestamptz,
  verified_at timestamptz,
  verified_by_name text,
  verification_notes text,
  photos text[] not null default '{}',
  evidence_notes text,
  effectiveness_rating integer check (effectiveness_rating is null or (effectiveness_rating >= 1 and effectiveness_rating <= 5)),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corrective_actions_company_id_idx on corrective_actions(company_id);
create index if not exists corrective_actions_hazard_id_idx on corrective_actions(hazard_id);
create index if not exists corrective_actions_status_idx on corrective_actions(status);
create index if not exists corrective_actions_due_date_idx on corrective_actions(due_date);

create or replace function public.set_corrective_actions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists corrective_actions_set_updated_at on corrective_actions;
create trigger corrective_actions_set_updated_at
  before update on corrective_actions
  for each row
  execute function public.set_corrective_actions_updated_at();

alter table corrective_actions enable row level security;

create policy "corrective_actions_select_company"
  on corrective_actions for select
  to authenticated
  using (
    company_id in (
      select company_id from user_profiles where id = auth.uid()
    )
  );

create policy "corrective_actions_insert_admin_supervisor"
  on corrective_actions for insert
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

create policy "corrective_actions_update_admin_supervisor"
  on corrective_actions for update
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
