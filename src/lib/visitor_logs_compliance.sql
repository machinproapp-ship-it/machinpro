-- Sprint AT-2 — visitor signature traceability (run in Supabase if columns missing)
alter table visitor_logs add column if not exists ip_address text;
alter table visitor_logs add column if not exists user_agent text;
alter table visitor_logs add column if not exists terms_version text;
alter table visitor_logs add column if not exists consent_timestamp timestamptz;
