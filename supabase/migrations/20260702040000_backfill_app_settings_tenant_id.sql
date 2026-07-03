-- Backfill any app_settings rows still missing tenant_id (e.g. rows
-- inserted before the multi-tenancy migration added the column) so the
-- later NOT NULL/primary-key tightening migration can run.
UPDATE public.app_settings
SET tenant_id = '28125b20-bc18-463e-b50d-f8a41b398b4b'
WHERE tenant_id IS NULL;
