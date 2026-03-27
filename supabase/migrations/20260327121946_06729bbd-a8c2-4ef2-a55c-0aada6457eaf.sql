-- Tighten employee permissions on bookings: no DELETE access
DROP POLICY IF EXISTS "Employees can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Employees can read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Employees can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Employees can update bookings" ON public.bookings;

CREATE POLICY "Employees can read bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::public.app_role));

CREATE POLICY "Employees can create bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'employee'::public.app_role));

CREATE POLICY "Employees can update bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'employee'::public.app_role));