-- Secure payment credentials from public/anon access
-- Replaces the previous policy with a comprehensive blocklist

DROP POLICY IF EXISTS "Public can read non-sensitive settings" ON public.app_settings;

CREATE POLICY "Public can read non-sensitive settings"
ON public.app_settings
FOR SELECT
TO public
USING (
  key NOT IN (
    -- Email credentials
    'resend_api_key',
    'resend_from_email',
    'resend_from_name',
    -- AI/Translation credentials
    'openai_api_key',
    -- Twilio credentials
    'twilio_account_sid',
    'twilio_auth_token',
    'twilio_phone_number',
    'twilio_from_number',
    -- Stripe credentials
    'stripe_secret_key',
    'stripe_webhook_secret',
    -- Square credentials
    'square_access_token'
  )
);
