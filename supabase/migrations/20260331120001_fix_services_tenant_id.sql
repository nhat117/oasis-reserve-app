-- Set tenant_id on newly inserted nail salon services that are missing it
UPDATE public.services
SET tenant_id = '28125b20-bc18-463e-b50d-f8a41b398b4b'
WHERE tenant_id IS NULL AND is_active = true;
