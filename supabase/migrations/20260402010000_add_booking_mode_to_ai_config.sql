-- Add booking_mode to ai_config: 'local' (default) or 'fresha'
-- Also add fresha_partner_token for API calls

ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS booking_mode TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS fresha_partner_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS fresha_location_id TEXT,
  ADD COLUMN IF NOT EXISTS fresha_api_base_url TEXT DEFAULT 'https://partner-api.fresha.com/v1';

-- Constraint to ensure valid values
ALTER TABLE public.ai_config
  ADD CONSTRAINT ai_config_booking_mode_check
  CHECK (booking_mode IN ('local', 'fresha'));
