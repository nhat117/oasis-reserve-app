-- ============================================================
-- Replace ManyChat with Sinch Conversation API
-- ============================================================
-- Drops ManyChat-specific columns from ai_config and adds
-- Sinch Conversation API credentials for per-tenant omnichannel messaging.

-- 1. Drop ManyChat columns from ai_config
ALTER TABLE public.ai_config
  DROP COLUMN IF EXISTS manychat_api_key_encrypted,
  DROP COLUMN IF EXISTS manychat_page_id;

-- 2. Add Sinch Conversation API columns to ai_config
ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS sinch_project_id TEXT,
  ADD COLUMN IF NOT EXISTS sinch_app_id TEXT,
  ADD COLUMN IF NOT EXISTS sinch_client_id TEXT,
  ADD COLUMN IF NOT EXISTS sinch_client_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS sinch_region TEXT DEFAULT 'us',
  ADD COLUMN IF NOT EXISTS sinch_webhook_secret TEXT;

-- 3. Add index on sinch_app_id for tenant lookup from webhook
CREATE INDEX IF NOT EXISTS idx_ai_config_sinch_app
  ON public.ai_config(sinch_app_id)
  WHERE sinch_app_id IS NOT NULL;
