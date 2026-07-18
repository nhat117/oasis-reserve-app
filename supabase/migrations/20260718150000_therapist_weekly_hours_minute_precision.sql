-- Upgrade therapist_weekly_hours from whole-hour to minute precision, so
-- the admin drag-to-paint schedule grid can snap to any half-hour boundary
-- (e.g. a 9:30 start or a 12:30 lunch break), not just the top of the hour.
ALTER TABLE public.therapist_weekly_hours
  ADD COLUMN start_minute INTEGER,
  ADD COLUMN end_minute INTEGER,
  ADD COLUMN break_start_minute INTEGER,
  ADD COLUMN break_end_minute INTEGER;

UPDATE public.therapist_weekly_hours SET
  start_minute = start_hour * 60,
  end_minute = end_hour * 60,
  break_start_minute = CASE WHEN break_start IS NOT NULL THEN break_start * 60 END,
  break_end_minute = CASE WHEN break_end IS NOT NULL THEN break_end * 60 END;

ALTER TABLE public.therapist_weekly_hours
  ALTER COLUMN start_minute SET NOT NULL,
  ALTER COLUMN start_minute SET DEFAULT 540,
  ALTER COLUMN end_minute SET NOT NULL,
  ALTER COLUMN end_minute SET DEFAULT 1080,
  ADD CONSTRAINT therapist_weekly_hours_start_minute_check CHECK (start_minute BETWEEN 0 AND 1440),
  ADD CONSTRAINT therapist_weekly_hours_end_minute_check CHECK (end_minute BETWEEN 0 AND 1440),
  ADD CONSTRAINT therapist_weekly_hours_break_start_minute_check CHECK (break_start_minute IS NULL OR break_start_minute BETWEEN 0 AND 1440),
  ADD CONSTRAINT therapist_weekly_hours_break_end_minute_check CHECK (break_end_minute IS NULL OR break_end_minute BETWEEN 0 AND 1440);

ALTER TABLE public.therapist_weekly_hours
  DROP COLUMN start_hour,
  DROP COLUMN end_hour,
  DROP COLUMN break_start,
  DROP COLUMN break_end;
