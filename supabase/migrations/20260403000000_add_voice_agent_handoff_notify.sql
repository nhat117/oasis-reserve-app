-- Add voice agent and handoff notification settings to ai_config
ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS handoff_notify_email TEXT,
  ADD COLUMN IF NOT EXISTS handoff_notify_sms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_agent_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS elevenlabs_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  ADD COLUMN IF NOT EXISTS elevenlabs_model_id TEXT DEFAULT 'eleven_multilingual_v2',
  ADD COLUMN IF NOT EXISTS twilio_voice_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_greeting TEXT DEFAULT 'Hello! Thank you for calling. How can I help you today?',
  ADD COLUMN IF NOT EXISTS voice_language TEXT DEFAULT 'en';

-- Track handoff events for analytics
CREATE TABLE IF NOT EXISTS public.handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  conversation_id UUID REFERENCES public.conversations(id),
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai_decision',
  notified_via TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for handoff_events"
  ON public.handoff_events FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_handoff_events_tenant ON public.handoff_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handoff_events_created ON public.handoff_events(created_at DESC);
