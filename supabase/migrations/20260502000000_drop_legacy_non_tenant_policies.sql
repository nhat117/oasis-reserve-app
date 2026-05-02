-- ============================================================
-- Drop legacy non-tenant-scoped RLS policies
-- ============================================================
-- The multi-tenancy migration (20260330210000) added tenant-scoped policies
-- but left the older role-based policies in place. In Postgres, RLS policies
-- are OR'd together, so the legacy policies (e.g. `has_role(...)` with no
-- tenant_id check) overrode tenant isolation and leaked cross-tenant data.
--
-- Verified bug: an admin for tenant A could SELECT services/bookings/therapists
-- from tenant B because `Admins can manage <table>` returned true regardless
-- of tenant_id. `Public can check availability` on bookings also returned
-- `USING (true)`, exposing every booking to anyone with the anon key.
--
-- This migration drops those legacy policies. The surviving `auth_*_tenant_*`
-- and `anon_*_tenant_*` policies enforce tenant_id via get_my_tenant_id() and
-- request_tenant_id().

BEGIN;

-- activity_logs
DROP POLICY IF EXISTS "Admins can delete activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Employees can insert logs" ON public.activity_logs;

-- app_settings
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read non-sensitive settings" ON public.app_settings;
DROP POLICY IF EXISTS "Staff can read all settings" ON public.app_settings;

-- bookings
DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Employees can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Employees can read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Employees can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can check availability" ON public.bookings;
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;

-- discount_codes
DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Anyone can increment usage" ON public.discount_codes;
DROP POLICY IF EXISTS "Anyone can read active codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Employees can read discounts" ON public.discount_codes;

-- guest_visits
DROP POLICY IF EXISTS "Admins can manage guest visits" ON public.guest_visits;
DROP POLICY IF EXISTS "Anyone can read guest visits" ON public.guest_visits;
DROP POLICY IF EXISTS "Employees can read visits" ON public.guest_visits;
DROP POLICY IF EXISTS "Staff can insert guest visits" ON public.guest_visits;
DROP POLICY IF EXISTS "Staff can update guest visits" ON public.guest_visits;

-- membership_tiers
DROP POLICY IF EXISTS "Admins can manage membership tiers" ON public.membership_tiers;
DROP POLICY IF EXISTS "Anyone can read active tiers" ON public.membership_tiers;
DROP POLICY IF EXISTS "Employees can read tiers" ON public.membership_tiers;

-- sales
DROP POLICY IF EXISTS "Admins can manage sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Employees can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Employees can read sales" ON public.sales;

-- services
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Employees can read services" ON public.services;

-- shop_holidays
DROP POLICY IF EXISTS "Admins can manage shop holidays" ON public.shop_holidays;
DROP POLICY IF EXISTS "Anyone can read shop holidays" ON public.shop_holidays;
DROP POLICY IF EXISTS "Employees can read holidays" ON public.shop_holidays;

-- therapist_unavailability
DROP POLICY IF EXISTS "Admins can manage unavailability" ON public.therapist_unavailability;
DROP POLICY IF EXISTS "Anyone can read unavailability" ON public.therapist_unavailability;
DROP POLICY IF EXISTS "Employees can insert unavailability" ON public.therapist_unavailability;
DROP POLICY IF EXISTS "Employees can read unavailability" ON public.therapist_unavailability;

-- therapists
DROP POLICY IF EXISTS "Admins can manage therapists" ON public.therapists;
DROP POLICY IF EXISTS "Employees can read therapists" ON public.therapists;

-- user_roles: cross-tenant admin leak only; `auth_view_own_role` and
-- `Users can view own roles` both permit a user to see their own role rows,
-- which is needed for login role resolution — keep those.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

COMMIT;
