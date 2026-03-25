-- MACHINPRO Sprint AV-6 — Configuración del panel Central (widgets / accesos rápidos)
-- Ejecutar manualmente en Supabase SQL Editor.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS dashboard_config JSONB DEFAULT NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS dashboard_config JSONB DEFAULT NULL;

-- Si el cliente no puede guardar el panel: añade una política UPDATE en `companies`
-- para admins de la empresa o usa la ruta API (service role) ya incluida en la app.
