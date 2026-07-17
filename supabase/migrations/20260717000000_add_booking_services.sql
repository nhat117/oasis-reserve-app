-- Multi-service appointments: one row per service on a booking, so a
-- single appointment can span Manicure + Pedicure (or any N services)
-- instead of being limited to bookings.service_id (a single FK).
CREATE TABLE public.booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_services_booking_id ON public.booking_services(booking_id);
CREATE INDEX idx_booking_services_tenant ON public.booking_services(tenant_id);

ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

-- Customer-facing booking flow uses the anon key, so it needs to insert and
-- read back the service rows it just created for the confirmation step.
CREATE POLICY "anon_insert_tenant_booking_services" ON public.booking_services
  FOR INSERT TO anon
  WITH CHECK (tenant_id = public.request_tenant_id());

CREATE POLICY "anon_view_tenant_booking_services" ON public.booking_services
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_booking_services" ON public.booking_services
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Backfill existing single-service bookings so old appointments still show
-- their service via booking_services (bookings.service_id is left in place
-- as the "primary" service for backward compatibility).
INSERT INTO public.booking_services (booking_id, service_id, service_name, duration_minutes, price, is_primary, tenant_id)
SELECT b.id, b.service_id, s.name, s.duration_minutes, s.price, true, b.tenant_id
FROM public.bookings b
JOIN public.services s ON s.id = b.service_id;
