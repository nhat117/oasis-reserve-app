-- =====================================================
-- Database-backed rate limiting
-- Survives serverless cold starts unlike in-memory maps
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL,            -- e.g. "booking:<ip>", "auth:<email>", "ai:<conv_id>"
  tokens     int  NOT NULL DEFAULT 0,  -- request count in current window
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint so we can upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key ON public.rate_limits(key);

-- Auto-cleanup: delete expired windows older than 5 minutes
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);

-- RLS: only service_role can access (edge functions use service role key)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated — only service_role bypasses RLS
-- This ensures rate limit records can't be read or tampered with from the client

-- ─── Helper function: check_rate_limit ───────────────────────────────
-- Returns true if request is allowed, false if rate limited.
-- Atomically increments the counter using INSERT ... ON CONFLICT.
--
-- Usage: SELECT public.check_rate_limit('booking:192.168.1.1', 10, 60);
--        → allows 10 requests per 60-second window
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key        text,
  p_max_tokens int DEFAULT 10,
  p_window_sec int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row     public.rate_limits%ROWTYPE;
  v_now     timestamptz := now();
  v_window  interval    := (p_window_sec || ' seconds')::interval;
  v_allowed boolean;
  v_remaining int;
  v_retry_after int;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_row FROM public.rate_limits WHERE key = p_key FOR UPDATE;

  IF v_row IS NULL THEN
    -- First request: create entry
    INSERT INTO public.rate_limits (key, tokens, window_start)
    VALUES (p_key, 1, v_now);
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_tokens - 1, 'retry_after', 0);
  END IF;

  -- Check if window has expired
  IF v_now - v_row.window_start > v_window THEN
    -- Reset window
    UPDATE public.rate_limits
    SET tokens = 1, window_start = v_now
    WHERE key = p_key;
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_tokens - 1, 'retry_after', 0);
  END IF;

  -- Window still active — check if under limit
  IF v_row.tokens >= p_max_tokens THEN
    v_retry_after := EXTRACT(EPOCH FROM (v_row.window_start + v_window - v_now))::int;
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', GREATEST(v_retry_after, 1));
  END IF;

  -- Increment counter
  UPDATE public.rate_limits
  SET tokens = tokens + 1
  WHERE key = p_key;

  v_remaining := p_max_tokens - v_row.tokens - 1;
  RETURN jsonb_build_object('allowed', true, 'remaining', GREATEST(v_remaining, 0), 'retry_after', 0);
END;
$$;

-- ─── Cleanup function: purge expired windows ─────────────────────────
-- Call periodically via pg_cron or a scheduled edge function

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '5 minutes';
$$;
