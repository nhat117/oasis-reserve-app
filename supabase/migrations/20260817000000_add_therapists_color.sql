-- Staff colours were derived from a row's index in whatever array the rendering
-- view happened to hold: the bookings calendar indexed by order of appearance
-- in the loaded bookings, the shift/day-off calendars by display_order. So the
-- same staff member showed up in two different colours across tabs, and every
-- colour shifted when a staff member was hidden or the list was reordered.
-- This makes the colour a real, admin-assignable attribute of the staff member.
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Only 6-digit hex, lowercase or upper — the UI writes '#rrggbb' and every
-- consumer (FullCalendar event colours, inline styles) assumes that shape.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'therapists_color_hex_check'
  ) THEN
    ALTER TABLE public.therapists
      ADD CONSTRAINT therapists_color_hex_check
      CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$');
  END IF;
END $$;

-- Backfill by cycling the shared palette in display_order per tenant, which is
-- the order the staff tab and the customer picker already show — so existing
-- staff keep roughly the colours admins see today. Palette must stay in sync
-- with THERAPIST_COLORS in src/lib/therapistColors.ts. Never overwrites a
-- colour that is already set, so re-running is safe.
WITH palette AS (
  SELECT * FROM unnest(ARRAY[
    '#2563eb', '#e11d48', '#059669', '#d97706',
    '#7c3aed', '#0891b2', '#db2777', '#ea580c',
    '#4f46e5', '#0d9488', '#65a30d', '#9333ea'
  ]) WITH ORDINALITY AS p(color, idx)
), ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY display_order, created_at, id) AS rn
  FROM public.therapists
)
UPDATE public.therapists th
SET color = palette.color
FROM ranked
JOIN palette ON palette.idx = ((ranked.rn - 1) % (SELECT count(*) FROM palette)) + 1
WHERE th.id = ranked.id
  AND th.color IS NULL;
