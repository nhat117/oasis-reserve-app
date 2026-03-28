-- Tighten RLS on guest_visits: remove anonymous INSERT/UPDATE access
-- Previously, anonymous users could INSERT and UPDATE any guest_visits record,
-- allowing data tampering. Restrict write operations to authenticated staff only.

-- Drop the overly permissive INSERT and UPDATE policies
DROP POLICY IF EXISTS "Anyone can insert guest visits" ON public.guest_visits;
DROP POLICY IF EXISTS "Anyone can update guest visits" ON public.guest_visits;

-- Only authenticated admins or employees can insert guest visits
CREATE POLICY "Staff can insert guest visits"
ON public.guest_visits
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- Only authenticated admins or employees can update guest visits
CREATE POLICY "Staff can update guest visits"
ON public.guest_visits
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- NOTE on bookings "Public can check availability" SELECT policy:
-- The public booking flow requires reading bookings to check therapist availability,
-- so the public SELECT policy on bookings must remain. However, this exposes customer
-- PII (names, phones, emails) to anonymous users. The proper mitigation is to create
-- a Postgres VIEW (e.g. public.booking_availability) that exposes only
-- id, therapist_id, booking_date, start_time, end_time, status columns,
-- then grant public SELECT on the view instead. This is a larger refactoring
-- and should be addressed in a follow-up migration.
