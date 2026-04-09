-- AH-20: GPS tracking accuracy + location sharing preference
-- Run in Supabase SQL editor or via migration tooling.

ALTER TABLE gps_tracking
  ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS location_sharing_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_profiles.location_sharing_enabled IS 'When false, no periodic GPS samples during active shift (browser).';
