-- Web Push subscription storage — one row per browser/device that has
-- granted notification permission and registered a service worker push
-- subscription. Push notifications were previously entirely unimplemented:
-- there was no device registration, no token storage, and no send path,
-- so nothing could ever reach a user's phone/desktop regardless of
-- notification settings. This table is the missing device registry;
-- send-push-notification (edge function) reads from it to deliver pushes.
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX idx_push_subscriptions_tenant ON public.push_subscriptions(tenant_id);
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated admin users register/unregister their own device's
-- subscription. Delivery itself happens server-side via the service role
-- key in the send-push-notification edge function, which bypasses RLS.
CREATE POLICY "auth_manage_own_push_subscription" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id());
