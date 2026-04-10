-- MachinPro · Seguridad integrada Parte B — ejecutar en Supabase SQL Editor
-- visitor_logs: checklist de requisitos confirmados en check-in (no bloqueante)
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS requirements_met JSONB DEFAULT '{}'::jsonb;

-- projects: EPIs y requisitos de seguridad personalizables por obra
ALTER TABLE projects ADD COLUMN IF NOT EXISTS safety_requirements JSONB DEFAULT '[]'::jsonb;
