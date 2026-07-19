-- A shift block can now have its own optional break, so a broken/split shift
-- (e.g. 09:00-13:00 with a break at 11:00, plus a separate 16:00-20:00 block)
-- is represented as one therapist_shifts row per block, each with its own
-- break window, rather than one break shared across the whole day.
ALTER TABLE public.therapist_shifts
  ADD COLUMN break_start_minute INTEGER,
  ADD COLUMN break_end_minute INTEGER;
