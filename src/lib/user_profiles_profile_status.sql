-- MACHINPRO — Soft-delete flag on user_profiles (Sprint AW-1b)
-- Run in Supabase SQL Editor if employees cannot be deactivated from the app.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_status TEXT DEFAULT 'active';
