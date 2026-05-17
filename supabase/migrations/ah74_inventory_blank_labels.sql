-- AH-74: Etiquetas QR vírgenes (modo B). Ejecutar manualmente en Supabase SQL Editor.

CREATE TABLE public.inventory_blank_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  qr_code text NOT NULL UNIQUE,
  sequence_number integer NOT NULL,
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id),
  consumed_at timestamptz,
  consumed_into_item_id text
);

CREATE INDEX idx_blank_labels_company ON public.inventory_blank_labels(company_id);
CREATE INDEX idx_blank_labels_qr ON public.inventory_blank_labels(qr_code);
CREATE INDEX idx_blank_labels_consumed ON public.inventory_blank_labels(consumed_at);

ALTER TABLE public.inventory_blank_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blank_labels_select_company"
  ON public.inventory_blank_labels
  FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "blank_labels_insert_company"
  ON public.inventory_blank_labels
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "blank_labels_update_company"
  ON public.inventory_blank_labels
  FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());
