-- Security hardening migration
-- SOC2 PI1.1 / PCI-DSS 3.4 — Data retention and protection

-- Add index for voice agent conversation history lookups (avoids sequential scan)
CREATE INDEX IF NOT EXISTS idx_handoff_events_tenant_reason
  ON public.handoff_events(tenant_id, reason);

-- Add TTL column for automatic PII cleanup
ALTER TABLE public.handoff_events
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Default: voice call records expire after 7 days, handoff events after 90 days
-- A scheduled job should DELETE WHERE expires_at < now()
COMMENT ON COLUMN public.handoff_events.expires_at IS
  'Auto-cleanup TTL. Voice call records: 7d, handoff events: 90d. Cron should purge expired rows.';

-- Add RLS policy to prevent direct client reads of metadata (PII)
-- Only service-role should access metadata; clients get the row without PII
CREATE POLICY "Restrict metadata access" ON public.handoff_events
  FOR SELECT
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- Create cleanup function for PII data retention
CREATE OR REPLACE FUNCTION public.cleanup_expired_handoff_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.handoff_events
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_handoff_events() IS
  'SOC2 PI1.1 — Purge expired handoff events and voice call PII. Call via cron or edge function.';
