-- Fix RLS blocklist regression: restore full secret blocklist for anon access
-- The multi-tenancy migration reduced the blocklist to only 4 keys,
-- exposing secrets like openai_api_key, square_access_token, stripe_webhook_secret, etc.

DROP POLICY IF EXISTS "anon_view_tenant_settings" ON public.app_settings;

CREATE POLICY "anon_view_tenant_settings" ON public.app_settings
  FOR SELECT TO anon
  USING (
    tenant_id = public.request_tenant_id()
    AND key NOT IN (
      'resend_api_key',
      'stripe_secret_key',
      'stripe_webhook_secret',
      'square_access_token',
      'square_webhook_secret',
      'twilio_auth_token',
      'twilio_account_sid',
      'twilio_phone_number',
      'twilio_from_number',
      'openai_api_key',
      'resend_from_email',
      'resend_from_name'
    )
  );
