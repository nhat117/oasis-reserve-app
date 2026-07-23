-- services.sort_order already exists in production (added out-of-band,
-- with no tracked migration) and is read by the customer-facing site
-- (`.order('sort_order')` in Booking.tsx / Services.tsx), but the admin
-- Services tab never wrote to it, so services always rendered in
-- created_at order with no way to reorder them. This migration makes the
-- column reproducible from migrations and backfills it for any environment
-- where it's still missing.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows that are all sort_order=0 (fresh column) with a
-- stable initial order matching current created_at ordering, per tenant.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM public.services
)
UPDATE public.services s
SET sort_order = ranked.rn
FROM ranked
WHERE s.id = ranked.id
  AND NOT EXISTS (
    SELECT 1 FROM public.services s2 WHERE s2.tenant_id = s.tenant_id AND s2.sort_order <> 0
  );

CREATE INDEX IF NOT EXISTS idx_services_tenant_sort ON public.services(tenant_id, sort_order);
