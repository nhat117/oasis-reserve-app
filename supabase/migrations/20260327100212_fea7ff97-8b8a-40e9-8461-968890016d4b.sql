
-- Function to upsert guest visit count when booking status changes to completed
CREATE OR REPLACE FUNCTION public.track_guest_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    INSERT INTO public.guest_visits (customer_phone, customer_name, visit_count)
    VALUES (NEW.customer_phone, NEW.customer_name, 1)
    ON CONFLICT (customer_phone)
    DO UPDATE SET
      visit_count = guest_visits.visit_count + 1,
      customer_name = COALESCE(NEW.customer_name, guest_visits.customer_name),
      updated_at = now();
    
    -- Auto-assign membership tier based on visit count
    UPDATE public.guest_visits
    SET membership_tier_id = (
      SELECT id FROM public.membership_tiers
      WHERE is_active = true AND min_visits <= guest_visits.visit_count
      ORDER BY min_visits DESC
      LIMIT 1
    )
    WHERE customer_phone = NEW.customer_phone;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on bookings table
CREATE TRIGGER track_guest_visit_trigger
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.track_guest_visit();

-- Also populate existing data: count completed bookings per phone
INSERT INTO public.guest_visits (customer_phone, customer_name, visit_count)
SELECT 
  customer_phone,
  MAX(customer_name) as customer_name,
  COUNT(*) as visit_count
FROM public.bookings
WHERE status = 'completed'
GROUP BY customer_phone
ON CONFLICT (customer_phone)
DO UPDATE SET
  visit_count = EXCLUDED.visit_count,
  customer_name = EXCLUDED.customer_name,
  updated_at = now();

-- Auto-assign tiers for existing data
UPDATE public.guest_visits gv
SET membership_tier_id = (
  SELECT id FROM public.membership_tiers
  WHERE is_active = true AND min_visits <= gv.visit_count
  ORDER BY min_visits DESC
  LIMIT 1
);
