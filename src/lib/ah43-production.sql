-- AH-43 Production & Work Orders
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.work_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit DECIMAL(10,2),
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES public.work_catalog_items(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  category TEXT,
  assigned_employee_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_order_item_id UUID NOT NULL REFERENCES public.work_order_items(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  units DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_catalog_items_company
  ON public.work_catalog_items(company_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_project
  ON public.work_order_items(project_id);
CREATE INDEX IF NOT EXISTS idx_production_entries_employee
  ON public.production_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_production_entries_project_date
  ON public.production_entries(project_id, date);

ALTER TABLE public.work_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation_work_catalog"
  ON public.work_catalog_items
  USING (company_id = get_my_company_id());

CREATE POLICY "company_isolation_work_order_items"
  ON public.work_order_items
  USING (company_id = get_my_company_id());

CREATE POLICY "company_isolation_production_entries"
  ON public.production_entries
  USING (company_id = get_my_company_id());
