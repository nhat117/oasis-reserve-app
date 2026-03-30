-- ============================================================
-- Multi-tenancy: tenant isolation for multiple salon frontends
-- ============================================================
-- Each salon = a tenant. Every data row gets a tenant_id.
-- Frontend identifies tenant via VITE_TENANT_ID env var.
-- RLS policies enforce isolation.

-- 1. Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,          -- e.g. "oasis-nails", used in env var or subdomain
  name TEXT NOT NULL,                  -- display name e.g. "Oasis Nails & Spa"
  owner_email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Anon policy can be created now (no dependency on tenant_id column)
CREATE POLICY "anon_read_active_tenants" ON public.tenants
  FOR SELECT TO anon USING (is_active = true);

-- 2. Add tenant_id to all business tables FIRST (policies depend on this column)
-- We use a default of NULL initially so existing rows aren't broken.
-- After migration, a default tenant should be created and rows backfilled.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.shop_holidays
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.therapist_unavailability
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.membership_tiers
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.guest_visits
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.suppressed_emails
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.email_unsubscribe_tokens
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 3. Helper function + tenant policy (now that user_roles.tenant_id exists)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "authenticated_read_own_tenant" ON public.tenants
  FOR SELECT TO authenticated USING (
    id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())
  );

-- 4. Indexes for tenant_id lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON public.services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_therapists_tenant ON public.therapists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON public.bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON public.sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant ON public.app_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shop_holidays_tenant ON public.shop_holidays(tenant_id);
CREATE INDEX IF NOT EXISTS idx_membership_tiers_tenant ON public.membership_tiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_tenant ON public.discount_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guest_visits_tenant ON public.guest_visits(tenant_id);

-- 5. Make app_settings unique per tenant (key + tenant_id)
-- Drop old unique constraint on key alone, add composite
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_tenant_key UNIQUE (tenant_id, key);

-- 6. Updated RLS policies — drop old, create tenant-scoped ones
-- We use a pattern where:
--   - Anon: can SELECT rows matching a tenant_id passed via request header
--   - Authenticated: can access rows matching their tenant from user_roles

-- Helper: read tenant_id from request header (set by frontend via supabase client)
CREATE OR REPLACE FUNCTION public.request_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-tenant-id', '')::UUID;
$$;

-- ---- SERVICES ----
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;
DROP POLICY IF EXISTS "Admin/employee full access to services" ON public.services;

CREATE POLICY "anon_view_tenant_services" ON public.services
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_view_tenant_services" ON public.services
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "auth_manage_tenant_services" ON public.services
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- THERAPISTS ----
DROP POLICY IF EXISTS "Anyone can view active therapists" ON public.therapists;
DROP POLICY IF EXISTS "Admin/employee full access to therapists" ON public.therapists;

CREATE POLICY "anon_view_tenant_therapists" ON public.therapists
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_view_tenant_therapists" ON public.therapists
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "auth_manage_tenant_therapists" ON public.therapists
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- BOOKINGS ----
DROP POLICY IF EXISTS "Anon can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anon can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin/employee full access to bookings" ON public.bookings;

CREATE POLICY "anon_insert_tenant_bookings" ON public.bookings
  FOR INSERT TO anon
  WITH CHECK (tenant_id = public.request_tenant_id());

CREATE POLICY "anon_view_tenant_bookings" ON public.bookings
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- SALES ----
DROP POLICY IF EXISTS "Admin/employee full access to sales" ON public.sales;

CREATE POLICY "auth_manage_tenant_sales" ON public.sales
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- APP_SETTINGS ----
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anon can view safe settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "admin_manage_settings" ON public.app_settings;
DROP POLICY IF EXISTS "anon_read_safe_settings" ON public.app_settings;

CREATE POLICY "anon_view_tenant_settings" ON public.app_settings
  FOR SELECT TO anon
  USING (
    tenant_id = public.request_tenant_id()
    AND key NOT IN ('resend_api_key', 'stripe_secret_key', 'twilio_auth_token', 'twilio_account_sid')
  );

CREATE POLICY "auth_manage_tenant_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- SHOP_HOLIDAYS ----
DROP POLICY IF EXISTS "Anyone can view holidays" ON public.shop_holidays;
DROP POLICY IF EXISTS "Admin/employee can manage holidays" ON public.shop_holidays;

CREATE POLICY "anon_view_tenant_holidays" ON public.shop_holidays
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_holidays" ON public.shop_holidays
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- THERAPIST_UNAVAILABILITY ----
DROP POLICY IF EXISTS "Anyone can view therapist unavailability" ON public.therapist_unavailability;
DROP POLICY IF EXISTS "Admin/employee can manage unavailability" ON public.therapist_unavailability;

CREATE POLICY "anon_view_tenant_unavailability" ON public.therapist_unavailability
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_unavailability" ON public.therapist_unavailability
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- MEMBERSHIP_TIERS ----
DROP POLICY IF EXISTS "Anyone can view active tiers" ON public.membership_tiers;
DROP POLICY IF EXISTS "Admin can manage tiers" ON public.membership_tiers;

CREATE POLICY "anon_view_tenant_tiers" ON public.membership_tiers
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_manage_tenant_tiers" ON public.membership_tiers
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- DISCOUNT_CODES ----
DROP POLICY IF EXISTS "Anyone can view active codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Admin can manage codes" ON public.discount_codes;

CREATE POLICY "anon_view_tenant_discounts" ON public.discount_codes
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_manage_tenant_discounts" ON public.discount_codes
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- GUEST_VISITS ----
DROP POLICY IF EXISTS "Admin/employee can manage guest visits" ON public.guest_visits;
DROP POLICY IF EXISTS "anon_insert_guest_visits" ON public.guest_visits;

CREATE POLICY "anon_insert_tenant_guest_visits" ON public.guest_visits
  FOR INSERT TO anon
  WITH CHECK (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_guest_visits" ON public.guest_visits
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- USER_ROLES (authenticated only) ----
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;

CREATE POLICY "auth_view_own_role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "auth_admin_manage_tenant_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- ACTIVITY_LOGS ----
DROP POLICY IF EXISTS "Admin/employee can view logs" ON public.activity_logs;

CREATE POLICY "auth_view_tenant_logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "auth_insert_tenant_logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- 7. Backfill: create a default tenant for existing data
-- Run this AFTER migration to assign all existing rows to a default tenant.
-- Usage:
--   INSERT INTO tenants (slug, name, owner_email) VALUES ('default', 'My Salon', 'owner@example.com');
--   UPDATE services SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default');
--   UPDATE therapists SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default');
--   ... repeat for all tables ...
