-- sales.therapist_id is ON DELETE SET NULL, so deleting a therapist would
-- silently erase which staff member earned a tip on every past sale — with
-- no way to recover the name, unlike sale_items which snapshots service_name
-- alongside its nullable service_id. Snapshot the therapist's name at time
-- of sale the same way, so tip/commission history survives staff turnover.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS therapist_name TEXT;

UPDATE public.sales s
SET therapist_name = t.name
FROM public.therapists t
WHERE s.therapist_id = t.id AND s.therapist_name IS NULL;
