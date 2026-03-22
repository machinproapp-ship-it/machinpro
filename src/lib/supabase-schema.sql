-- EMPLOYEES
create table employees (
  id text primary key,
  name text not null,
  role text not null,
  hours numeric default 0,
  pay_type text check (pay_type in ('hourly','salary')),
  hourly_rate numeric,
  monthly_salary numeric,
  phone text,
  email text,
  created_at timestamptz default now()
);

-- PROJECTS
create table projects (
  id text primary key,
  name text not null,
  type text,
  location text,
  project_code text unique,
  budget_cad numeric default 0,
  spent_cad numeric default 0,
  estimated_start date,
  estimated_end date,
  location_lat numeric,
  location_lng numeric,
  archived boolean default false,
  assigned_employee_ids text[] default '{}',
  created_at timestamptz default now()
);

-- CERTIFICATES
create table certificates (
  id text primary key,
  employee_id text references employees(id) on delete cascade,
  name text not null,
  status text check (status in ('valid','expired','pending')),
  expiry_date date,
  document_url text,
  created_at timestamptz default now()
);

-- INVENTORY ITEMS
create table inventory_items (
  id text primary key,
  name text not null,
  type text check (type in ('material','tool')),
  quantity numeric default 0,
  unit text,
  purchase_price_cad numeric default 0,
  low_stock_threshold numeric,
  tool_status text,
  assigned_to_project_id text references projects(id),
  assigned_to_employee_id text references employees(id),
  created_at timestamptz default now()
);

-- CLOCK ENTRIES
create table clock_entries (
  id text primary key,
  employee_id text references employees(id) on delete cascade,
  project_id text references projects(id),
  project_code text,
  date date not null,
  clock_in time not null,
  clock_out time,
  location_lat numeric,
  location_lng numeric,
  location_alert boolean default false,
  created_at timestamptz default now()
);

-- SCHEDULE ENTRIES
create table schedule_entries (
  id text primary key,
  type text check (type in ('shift','event')),
  employee_ids text[] not null,
  project_id text references projects(id),
  project_code text,
  date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  event_label text,
  created_by text,
  created_at timestamptz default now()
);

-- BLUEPRINTS
create table blueprints (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  category text,
  name text not null,
  created_at timestamptz default now()
);

-- BLUEPRINT REVISIONS
create table blueprint_revisions (
  id text primary key,
  blueprint_id text references blueprints(id) on delete cascade,
  revision_number integer not null,
  file_url text,
  file_type text check (file_type in ('pdf','image')),
  file_name text,
  is_current boolean default false,
  uploaded_by text,
  uploaded_at timestamptz default now()
);

-- ANNOTATIONS
create table annotations (
  id text primary key,
  blueprint_id text references blueprints(id) on delete cascade,
  type text check (type in ('pin','note','photo')),
  x numeric not null,
  y numeric not null,
  content text,
  color text,
  resolved boolean default false,
  created_by text,
  created_at timestamptz default now()
);

-- USERS (vincula auth.users con employees)
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id text references employees(id),
  role text check (role in ('admin','supervisor','worker','logistic')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table employees enable row level security;
alter table projects enable row level security;
alter table clock_entries enable row level security;
alter table schedule_entries enable row level security;
alter table blueprints enable row level security;
alter table annotations enable row level security;
alter table user_profiles enable row level security;

-- Sprint AG: registro de visitantes (ver también src/lib/visitor_logs.sql para políticas completas)
-- create table visitor_logs (...);  — ejecutar visitor_logs.sql en el editor SQL de Supabase

-- Sprint AH: hazards — ejecutar src/lib/hazards.sql en el editor SQL de Supabase
