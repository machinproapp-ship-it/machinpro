-- AH-41 — Run once in Supabase SQL Editor (extends legacy clock_entries for activity events).
-- Depends on public.time_entries existing.

ALTER TABLE public.clock_entries
  ADD COLUMN IF NOT EXISTS event_kind TEXT;

ALTER TABLE public.clock_entries
  DROP CONSTRAINT IF EXISTS clock_entries_event_kind_check;

ALTER TABLE public.clock_entries
  ADD CONSTRAINT clock_entries_event_kind_check CHECK (
    event_kind IS NULL
    OR event_kind IN ('break_start', 'break_end', 'project_switch')
  );

ALTER TABLE public.clock_entries
  ADD COLUMN IF NOT EXISTS parent_time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE;

ALTER TABLE public.clock_entries
  ADD COLUMN IF NOT EXISTS event_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_clock_entries_parent_time_entry
  ON public.clock_entries(parent_time_entry_id)
  WHERE parent_time_entry_id IS NOT NULL;
