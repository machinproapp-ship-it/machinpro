-- MachinPro inventory extensions + movement history (run in Supabase SQL editor)
-- Soft delete: prefer inventory_items.deleted_at (add if your table uses another pattern)

-- Nuevas columnas en inventory_items (si no existen)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'material' CHECK (item_type IN ('material', 'tool'));
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'warehouse';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS min_stock DECIMAL(10,2) DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS maintenance_date DATE;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS insurance_date DATE;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES user_profiles(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS supplier_id UUID;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,4) DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS current_project_id TEXT;

-- Tabla historial de movimientos INSERT-ONLY (aplicación: solo INSERT; RLS puede restringir UPDATE/DELETE en otro paso)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in','out','transfer','maintenance','status_change','import')),
  quantity DECIMAL(10,2) DEFAULT 0,
  from_location TEXT,
  to_location TEXT,
  from_project_id TEXT,
  to_project_id TEXT,
  performed_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Empresa ve sus movimientos" ON inventory_movements;
CREATE POLICY "Empresa ve sus movimientos"
  ON inventory_movements FOR ALL
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company_id ON inventory_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_company_id ON inventory_items(company_id);
