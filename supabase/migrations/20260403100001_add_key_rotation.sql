-- =====================================================
-- API key rotation support
-- Tracks key versions, rotation dates, and expiry
-- =====================================================

-- Add rotation metadata columns to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS rotated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS key_version  int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_value text;  -- holds old key during grace period

-- Index for finding expiring keys
CREATE INDEX IF NOT EXISTS idx_app_settings_expires
  ON public.app_settings(expires_at)
  WHERE expires_at IS NOT NULL;

-- ─── rotate_api_key function ─────────────────────────────────────────
-- Rotates a secret key in app_settings:
--   1. Copies current value to previous_value (grace period for in-flight requests)
--   2. Sets new value
--   3. Bumps key_version
--   4. Sets rotated_at to now()
--   5. Sets expires_at for previous key (default 24h grace)
--   6. Logs to activity_logs
--
-- Usage: SELECT public.rotate_api_key(
--          'my-tenant-uuid',
--          'stripe_secret_key',
--          'sk_live_new_key_here',
--          'admin-user-uuid'
--        );
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rotate_api_key(
  p_tenant_id     uuid,
  p_key_name      text,
  p_new_value     text,
  p_rotated_by    uuid DEFAULT NULL,
  p_grace_hours   int  DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row    public.app_settings%ROWTYPE;
  v_new_version int;
BEGIN
  -- Validate key name is a sensitive key that supports rotation
  IF p_key_name NOT IN (
    'stripe_secret_key', 'stripe_webhook_secret',
    'square_access_token', 'square_webhook_secret',
    'openai_api_key', 'resend_api_key',
    'twilio_auth_token'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Key does not support rotation: ' || p_key_name);
  END IF;

  -- Get existing record
  SELECT * INTO v_row
  FROM public.app_settings
  WHERE tenant_id = p_tenant_id AND key = p_key_name
  FOR UPDATE;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Key not found: ' || p_key_name);
  END IF;

  v_new_version := COALESCE(v_row.key_version, 1) + 1;

  -- Rotate: move current → previous, set new value
  UPDATE public.app_settings
  SET
    previous_value = value,
    value          = p_new_value,
    key_version    = v_new_version,
    rotated_at     = now(),
    expires_at     = now() + (p_grace_hours || ' hours')::interval,
    updated_at     = now()
  WHERE id = v_row.id;

  -- Audit log
  IF p_rotated_by IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, action, details, tenant_id)
    VALUES (
      p_rotated_by,
      'key_rotation',
      jsonb_build_object(
        'key_name', p_key_name,
        'new_version', v_new_version,
        'grace_hours', p_grace_hours
      ),
      p_tenant_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'key_name', p_key_name,
    'new_version', v_new_version,
    'grace_expires_at', (now() + (p_grace_hours || ' hours')::interval)::text
  );
END;
$$;

-- ─── Cleanup expired previous keys ──────────────────────────────────
-- Call periodically to null out previous_value after grace period ends.

CREATE OR REPLACE FUNCTION public.cleanup_expired_keys()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.app_settings
  SET previous_value = NULL
  WHERE previous_value IS NOT NULL
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Helper: get active key (checks both current and grace-period key) ──
-- Returns the current value. If the caller needs fallback logic, they can
-- also check previous_value within the grace window.

CREATE OR REPLACE FUNCTION public.get_active_key(
  p_tenant_id uuid,
  p_key_name  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_row public.app_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.app_settings
  WHERE tenant_id = p_tenant_id AND key = p_key_name;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('value', NULL, 'previous_value', NULL, 'in_grace_period', false);
  END IF;

  RETURN jsonb_build_object(
    'value', v_row.value,
    'previous_value', CASE
      WHEN v_row.previous_value IS NOT NULL AND v_row.expires_at > now()
      THEN v_row.previous_value
      ELSE NULL
    END,
    'in_grace_period', (v_row.previous_value IS NOT NULL AND v_row.expires_at > now()),
    'key_version', v_row.key_version
  );
END;
$$;
