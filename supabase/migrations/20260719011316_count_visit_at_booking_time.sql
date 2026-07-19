-- Previously a customer only appeared in guest_visits (and their visit_count
-- only went up) once a booking was marked 'completed' — so a customer showed
-- as "no visits" in the directory for their entire time between booking and
-- appointment day. Now every new booking counts as a visit immediately, so
-- the customer shows up in the directory as soon as they book.
CREATE OR REPLACE FUNCTION public.track_guest_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.guest_visits (customer_phone, customer_name, visit_count, tenant_id)
  VALUES (NEW.customer_phone, NEW.customer_name, 1, NEW.tenant_id)
  ON CONFLICT (customer_phone)
  DO UPDATE SET
    visit_count = guest_visits.visit_count + 1,
    customer_name = COALESCE(NEW.customer_name, guest_visits.customer_name),
    updated_at = now();

  UPDATE public.guest_visits
  SET membership_tier_id = (
    SELECT id FROM public.membership_tiers
    WHERE is_active = true AND min_visits <= guest_visits.visit_count
    ORDER BY min_visits DESC
    LIMIT 1
  )
  WHERE customer_phone = NEW.customer_phone;
  RETURN NEW;
END;
$$;

-- Only fire on new bookings now — a booking counts as a visit the moment
-- it's created, not when its status later changes to 'completed'.
DROP TRIGGER IF EXISTS track_guest_visit_trigger ON public.bookings;
CREATE TRIGGER track_guest_visit_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.track_guest_visit();

-- Backfill: recompute every phone's visit_count from ALL of their bookings
-- (not just completed ones, matching the new "every booking counts" rule).
-- tenant_id has no MAX(uuid) aggregate, so grab one via DISTINCT ON instead.
INSERT INTO public.guest_visits (customer_phone, customer_name, visit_count, tenant_id)
SELECT
  agg.customer_phone,
  agg.customer_name,
  agg.visit_count,
  b.tenant_id
FROM (
  SELECT
    customer_phone,
    MAX(customer_name) AS customer_name,
    COUNT(*) AS visit_count
  FROM public.bookings
  GROUP BY customer_phone
) agg
JOIN LATERAL (
  SELECT tenant_id FROM public.bookings
  WHERE customer_phone = agg.customer_phone
  LIMIT 1
) b ON true
ON CONFLICT (customer_phone)
DO UPDATE SET
  visit_count = EXCLUDED.visit_count,
  customer_name = COALESCE(guest_visits.customer_name, EXCLUDED.customer_name),
  updated_at = now();

-- Re-assign tiers now that visit counts changed.
UPDATE public.guest_visits gv
SET membership_tier_id = (
  SELECT id FROM public.membership_tiers
  WHERE is_active = true AND min_visits <= gv.visit_count
  ORDER BY min_visits DESC
  LIMIT 1
);
