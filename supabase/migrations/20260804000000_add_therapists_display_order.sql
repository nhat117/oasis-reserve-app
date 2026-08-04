-- Staff always rendered in whatever order Postgres happened to return
-- (Booking.tsx had no ORDER BY at all, the admin list used created_at), so the
-- same one or two people sat at the top of the customer-facing picker and took
-- most of the bookings. This adds an admin-controlled manual order, mirroring
-- services.sort_order (see 20260722010000_add_services_sort_order.sql).
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Backfill with a stable initial order matching the admin list's current
-- created_at ordering, per tenant, so existing staff keep the order admins
-- already see. Skipped for any tenant that already has a non-zero value, so
-- re-running this never clobbers an order an admin has set.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM public.therapists
)
UPDATE public.therapists th
SET display_order = ranked.rn
FROM ranked
WHERE th.id = ranked.id
  AND NOT EXISTS (
    SELECT 1 FROM public.therapists th2
    WHERE th2.tenant_id IS NOT DISTINCT FROM th.tenant_id
      AND th2.display_order <> 0
  );

CREATE INDEX IF NOT EXISTS idx_therapists_tenant_display_order
  ON public.therapists(tenant_id, display_order);
