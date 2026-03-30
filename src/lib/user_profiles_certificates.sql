-- MACHINPRO — employee safety certificates (JSON) for Compliance Watchdog + notification cron.
-- Run in Supabase SQL Editor. Shape: [{ "id"?, "name", "status"?: "valid"|"expired", "expiryDate"?: "YYYY-MM-DD" }]

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS certificates JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_profiles.certificates IS 'MachinPro employee certs; synced from app; used by /api/notifications/check-certificates';
