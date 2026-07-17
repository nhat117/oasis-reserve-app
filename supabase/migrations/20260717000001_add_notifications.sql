-- Persistent notification feed for the admin dashboard bell — the existing
-- realtime toast on new bookings (AdminDashboard.tsx) is fire-and-forget and
-- has nothing to show after a page reload.
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  type TEXT NOT NULL DEFAULT 'new_booking',
  title TEXT NOT NULL,
  body TEXT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_tenant_created ON public.notifications(tenant_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- The customer-facing booking flow (anon key) creates the notification row
-- right after a booking is inserted.
CREATE POLICY "anon_insert_tenant_notifications" ON public.notifications
  FOR INSERT TO anon
  WITH CHECK (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
