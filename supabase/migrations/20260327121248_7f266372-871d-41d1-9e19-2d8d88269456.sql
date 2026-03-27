
-- Allow employees to manage bookings
CREATE POLICY "Employees can manage bookings"
ON public.bookings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to read/insert sales
CREATE POLICY "Employees can read sales"
ON public.sales
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can insert sales"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to manage services (read only)
CREATE POLICY "Employees can read services"
ON public.services
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to read therapists
CREATE POLICY "Employees can read therapists"
ON public.therapists
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to manage app_settings (read)
CREATE POLICY "Employees can read settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to read unavailability
CREATE POLICY "Employees can read unavailability"
ON public.therapist_unavailability
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to insert unavailability
CREATE POLICY "Employees can insert unavailability"
ON public.therapist_unavailability
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to read shop holidays
CREATE POLICY "Employees can read holidays"
ON public.shop_holidays
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to read membership tiers
CREATE POLICY "Employees can read tiers"
ON public.membership_tiers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to read discount codes
CREATE POLICY "Employees can read discounts"
ON public.discount_codes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to read guest visits
CREATE POLICY "Employees can read visits"
ON public.guest_visits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'employee'::app_role));

-- Allow employees to insert activity logs
CREATE POLICY "Employees can insert logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'employee'::app_role) AND auth.uid() = user_id);
