-- ============================================================
-- Replace Chatwoot with ManyChat
-- ============================================================
-- Renames Chatwoot-specific columns to generic external_* names
-- and adds ManyChat configuration to ai_config.

-- 1. Conversations: rename chatwoot columns to generic names
ALTER TABLE public.conversations
  RENAME COLUMN chatwoot_conversation_id TO external_conversation_id;

ALTER TABLE public.conversations
  RENAME COLUMN chatwoot_contact_id TO external_contact_id;

-- Change type from BIGINT to TEXT (ManyChat uses string subscriber IDs)
ALTER TABLE public.conversations
  ALTER COLUMN external_conversation_id TYPE TEXT USING external_conversation_id::TEXT;

ALTER TABLE public.conversations
  ALTER COLUMN external_contact_id TYPE TEXT USING external_contact_id::TEXT;

-- 2. Chat messages: rename chatwoot_message_id
ALTER TABLE public.chat_messages
  RENAME COLUMN chatwoot_message_id TO external_message_id;

ALTER TABLE public.chat_messages
  ALTER COLUMN external_message_id TYPE TEXT USING external_message_id::TEXT;

-- 3. AI config: drop Chatwoot columns, add ManyChat columns
ALTER TABLE public.ai_config
  DROP COLUMN IF EXISTS chatwoot_base_url,
  DROP COLUMN IF EXISTS chatwoot_api_token_encrypted,
  DROP COLUMN IF EXISTS chatwoot_account_id;

ALTER TABLE public.ai_config
  ADD COLUMN manychat_api_key_encrypted TEXT,
  ADD COLUMN manychat_page_id TEXT;

-- 4. Update index
DROP INDEX IF EXISTS idx_conversations_chatwoot;
CREATE INDEX idx_conversations_external ON public.conversations(external_conversation_id);
