-- Backfill the default tenant row that later migrations assume exists.
-- Original database had this row created manually (not via migration);
-- this makes fresh databases consistent.
INSERT INTO public.tenants (id, slug, name, owner_email, is_active)
VALUES (
  '28125b20-bc18-463e-b50d-f8a41b398b4b',
  'oasis-reserve',
  'Oasis Reserve',
  'owner@oasis-reserve.test',
  true
)
ON CONFLICT (id) DO NOTHING;
