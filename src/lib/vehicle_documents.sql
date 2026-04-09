-- AH-21: vehicle_documents (run in Supabase SQL editor or migration pipeline)
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  name text NOT NULL,
  expiry_date date,
  document_url text,
  alert_days integer DEFAULT 30,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_documents_company" ON vehicle_documents
  FOR ALL USING (company_id = get_my_company_id());
