-- AH-55 · form_templates y form_instances con RLS

CREATE TABLE IF NOT EXISTS form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  region TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT NOT NULL DEFAULT 'general',
  is_base BOOLEAN NOT NULL DEFAULT false,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_all_signatures BOOLEAN NOT NULL DEFAULT false,
  expires_in_hours INTEGER NOT NULL DEFAULT 168,
  language TEXT NOT NULL DEFAULT 'es',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_templates_company_id ON form_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(category);

CREATE TABLE IF NOT EXISTS form_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES form_templates(id) ON DELETE SET NULL,
  project_id TEXT,
  context_type TEXT DEFAULT 'project',
  context_id TEXT,
  context_name TEXT,
  created_by UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'approved')),
  field_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  sign_token TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,
  doc_number TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_instances_company_id ON form_instances(company_id);
CREATE INDEX IF NOT EXISTS idx_form_instances_project_id ON form_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_form_instances_sign_token ON form_instances(sign_token) WHERE sign_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_instances_status ON form_instances(status);

-- Secuencia para DOC#
CREATE SEQUENCE IF NOT EXISTS form_doc_number_seq START 10000;

-- Trigger: updated_at en ambas tablas; doc_number solo en form_instances (no existe en form_templates)
CREATE OR REPLACE FUNCTION update_form_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_TABLE_NAME = 'form_instances' THEN
    IF NEW.doc_number IS NULL THEN
      NEW.doc_number = LPAD(nextval('form_doc_number_seq')::text, 5, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS form_templates_updated_at ON form_templates;
CREATE TRIGGER form_templates_updated_at
  BEFORE INSERT OR UPDATE ON form_templates
  FOR EACH ROW EXECUTE FUNCTION update_form_updated_at_column();

DROP TRIGGER IF EXISTS form_instances_updated_at ON form_instances;
CREATE TRIGGER form_instances_updated_at
  BEFORE INSERT OR UPDATE ON form_instances
  FOR EACH ROW EXECUTE FUNCTION update_form_updated_at_column();

-- RLS
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_instances ENABLE ROW LEVEL SECURITY;

-- Policies form_templates
DROP POLICY IF EXISTS form_templates_select ON form_templates;
CREATE POLICY form_templates_select ON form_templates
  FOR SELECT USING (company_id = get_my_company_id() OR is_base = true);

DROP POLICY IF EXISTS form_templates_insert ON form_templates;
CREATE POLICY form_templates_insert ON form_templates
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS form_templates_update ON form_templates;
CREATE POLICY form_templates_update ON form_templates
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS form_templates_delete ON form_templates;
CREATE POLICY form_templates_delete ON form_templates
  FOR DELETE USING (company_id = get_my_company_id());

-- Policies form_instances
DROP POLICY IF EXISTS form_instances_select ON form_instances;
CREATE POLICY form_instances_select ON form_instances
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS form_instances_insert ON form_instances;
CREATE POLICY form_instances_insert ON form_instances
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS form_instances_update ON form_instances;
CREATE POLICY form_instances_update ON form_instances
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS form_instances_delete ON form_instances;
CREATE POLICY form_instances_delete ON form_instances
  FOR DELETE USING (company_id = get_my_company_id());

-- Tabla de log de firmas externas (audit trail INSERT-ONLY)
CREATE TABLE IF NOT EXISTS form_external_signatures_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_instance_id UUID REFERENCES form_instances(id) ON DELETE CASCADE,
  attendee_name TEXT NOT NULL,
  attendee_company TEXT,
  attendee_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_external_sigs_form_id
  ON form_external_signatures_log(form_instance_id);

ALTER TABLE form_external_signatures_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS form_external_sigs_select ON form_external_signatures_log;
CREATE POLICY form_external_sigs_select ON form_external_signatures_log
  FOR SELECT USING (
    form_instance_id IN (
      SELECT id FROM form_instances WHERE company_id = get_my_company_id()
    )
  );
-- INSERT desde service_role (no policy = solo service role puede insertar)
