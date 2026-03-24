-- Sprint AT-2 — optional company fiscal fields (run in Supabase if missing)
alter table companies add column if not exists tax_id text;
alter table companies add column if not exists country_code text;
