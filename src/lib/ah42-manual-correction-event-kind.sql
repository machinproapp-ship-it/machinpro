-- AH-42 — Run once in Supabase SQL Editor (extends AH-41 clock_entries.event_kind).

ALTER TABLE public.clock_entries
  DROP CONSTRAINT IF EXISTS clock_entries_event_kind_check;

ALTER TABLE public.clock_entries
  ADD CONSTRAINT clock_entries_event_kind_check CHECK (
    event_kind IS NULL
    OR event_kind IN ('break_start', 'break_end', 'project_switch', 'manual_correction')
  );
