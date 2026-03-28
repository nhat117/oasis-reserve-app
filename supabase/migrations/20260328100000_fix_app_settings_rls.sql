-- Fix app_settings RLS: restrict public access to non-sensitive keys only
-- Sensitive keys (API keys, credentials) should only be readable by admin/employee

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;

-- Drop the employee policy from migration 20260327121248 (now covered below)
DROP POLICY IF EXISTS "Employees can read settings" ON public.app_settings;

-- Public (anonymous) can only read non-sensitive keys
CREATE POLICY "Public can read non-sensitive settings"
ON public.app_settings
FOR SELECT
TO public
USING (
  key NOT IN (
    'resend_api_key',
    'resend_from_email',
    'resend_from_name',
    'openai_api_key',
    'twilio_from_number'
  )
);

-- Authenticated admin or employee can read ALL keys (including sensitive)
CREATE POLICY "Staff can read all settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);
