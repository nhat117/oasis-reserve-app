-- ============================================================
-- Backfill: Assign all existing data to a default tenant
-- ============================================================
-- Run this in Supabase SQL Editor AFTER the multi-tenancy migration.
-- This creates your first tenant and assigns all existing rows to it.
--
-- IMPORTANT: Replace the values below with your actual salon info.
-- ============================================================

-- 1. Create the default tenant for your existing salon
INSERT INTO public.tenants (slug, name, owner_email)
VALUES ('royal-head-spa', 'Royal Head Spa', 'nhat117@gmail.com')
ON CONFLICT (slug) DO NOTHING;

-- 2. Get the tenant ID (for use in subsequent statements)
-- We use a DO block so everything runs in one shot.
DO $$
DECLARE
  tid UUID;
BEGIN
  SELECT id INTO tid FROM public.tenants WHERE slug = 'royal-head-spa';

  IF tid IS NULL THEN
    RAISE EXCEPTION 'Tenant not found! Make sure the INSERT above succeeded.';
  END IF;

  RAISE NOTICE 'Backfilling tenant_id = %', tid;

  -- 3. Backfill all tables
  UPDATE public.services SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.therapists SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.bookings SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.sales SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.app_settings SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.shop_holidays SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.therapist_unavailability SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.membership_tiers SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.discount_codes SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.guest_visits SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.activity_logs SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.email_send_log SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.suppressed_emails SET tenant_id = tid WHERE tenant_id IS NULL;
  UPDATE public.email_unsubscribe_tokens SET tenant_id = tid WHERE tenant_id IS NULL;

  -- 4. Link existing admin/employee users to this tenant
  UPDATE public.user_roles SET tenant_id = tid WHERE tenant_id IS NULL;

  RAISE NOTICE 'Done! All existing data now belongs to tenant %', tid;
  RAISE NOTICE 'Add this to your .env: VITE_TENANT_ID=%', tid;
END $$;

-- 5. Verify: show the tenant ID (copy this for your .env)
SELECT id AS "VITE_TENANT_ID", slug, name, owner_email
FROM public.tenants
WHERE slug = 'royal-head-spa';
