-- ============================================================
-- Fix: app_settings still had a global PRIMARY KEY on `key` alone
-- ============================================================
-- The multi-tenancy migration (20260330210000) added a
-- UNIQUE (tenant_id, key) constraint but never dropped the original
-- `key text PRIMARY KEY` from the pre-tenancy schema. That left `key`
-- globally unique across ALL tenants, so any upsert targeting the
-- default (key) conflict target would silently overwrite a DIFFERENT
-- tenant's row for the same settings key instead of creating its own.
--
-- All application code now upserts via (tenant_id, key) explicitly.
-- This migration removes the stale global constraint so the database
-- itself can no longer allow a cross-tenant collision on this table.

-- Safety check: fail loudly instead of silently corrupting data if any
-- row still has a NULL tenant_id when this runs.
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT count(*) INTO v_null_count FROM public.app_settings WHERE tenant_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'app_settings has % row(s) with NULL tenant_id — backfill before running this migration', v_null_count;
  END IF;
END $$;

ALTER TABLE public.app_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
-- app_settings_tenant_key (UNIQUE (tenant_id, key), added in 20260330210000)
-- is now the sole uniqueness guarantee on this table.
