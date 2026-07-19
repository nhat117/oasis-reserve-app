-- Multi-block (split-shift) weekly template. A day can now have zero, one,
-- or several therapist_weekly_hours rows for the same day_of_week — each
-- row is one contiguous work block (e.g. 09:00-12:00 and 13:00-18:00 as two
-- rows instead of one row + a break_start/break_end pair). A break is no
-- longer stored: it's just the gap between two consecutive blocks, computed
-- in application code (see src/lib/weeklyScheduleLogic.ts).
--
-- is_working is KEPT (not dropped) as a denormalized convenience column —
-- always is_working = true for every row inserted going forward, since a
-- row's mere existence for a day now means "working that day." The
-- AUTHORITATIVE signal for "is this day off" is "zero rows exist for that
-- day_of_week," never this column. Off days simply have no rows at all.

-- Drop the old one-row-per-day uniqueness so a day can have N blocks.
ALTER TABLE public.therapist_weekly_hours
  DROP CONSTRAINT IF EXISTS therapist_weekly_hours_therapist_id_day_of_week_key;

-- Data migration FIRST (before dropping break columns): split any existing
-- row that has a fully-contained break into two rows [start,break_start)
-- and [break_end,end); rows with a break window that isn't fully contained
-- just lose the break marker on column drop below (no work-time data loss).
WITH splittable AS (
  SELECT id, therapist_id, day_of_week, start_minute, end_minute,
         break_start_minute, break_end_minute, tenant_id
  FROM public.therapist_weekly_hours
  WHERE break_start_minute IS NOT NULL
    AND break_end_minute IS NOT NULL
    AND break_start_minute > start_minute
    AND break_end_minute < end_minute
    AND break_start_minute < break_end_minute
)
INSERT INTO public.therapist_weekly_hours
  (therapist_id, day_of_week, is_working, start_minute, end_minute, tenant_id)
SELECT therapist_id, day_of_week, true, break_end_minute, end_minute, tenant_id
FROM splittable;

UPDATE public.therapist_weekly_hours t
SET end_minute = s.break_start_minute
FROM (
  SELECT id, break_start_minute
  FROM public.therapist_weekly_hours
  WHERE break_start_minute IS NOT NULL
    AND break_end_minute IS NOT NULL
    AND break_start_minute > start_minute
    AND break_end_minute < end_minute
    AND break_start_minute < break_end_minute
) s
WHERE t.id = s.id;

-- Now safe to drop the break columns — every block's break is derived, never stored.
ALTER TABLE public.therapist_weekly_hours
  DROP COLUMN break_start_minute,
  DROP COLUMN break_end_minute;

-- Rows are now individual blocks; a day-off day simply has none. Normalize
-- any stale is_working=false rows to true rather than deleting them —
-- the app will never write is_working=false again after this migration.
UPDATE public.therapist_weekly_hours SET is_working = true WHERE is_working = false;

-- Composite index to support "all blocks for (therapist, day)" lookups,
-- which now return N rows instead of at most 1.
CREATE INDEX IF NOT EXISTS idx_therapist_weekly_hours_therapist_day
  ON public.therapist_weekly_hours(therapist_id, day_of_week);
