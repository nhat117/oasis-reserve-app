
-- Drop the overly permissive INSERT policy
DROP POLICY "Anyone can create bookings" ON public.bookings;

-- Replace with a more restrictive policy that still allows public inserts
-- but validates required fields via CHECK constraints (already on the table)
CREATE POLICY "Public can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    customer_name IS NOT NULL 
    AND customer_phone IS NOT NULL 
    AND booking_date >= CURRENT_DATE
    AND status = 'confirmed'
  );
