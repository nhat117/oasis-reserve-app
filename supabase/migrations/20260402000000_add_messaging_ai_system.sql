-- ============================================================
-- Messaging + AI Chat Assistant System
-- ============================================================
-- Centralizes messages from Instagram/Facebook/TikTok via Chatwoot,
-- adds RAG-powered AI assistant with booking automation,
-- and human intervention controls.

-- 1. Enable pgvector for embedding search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Conversations table (one per external contact)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  chatwoot_conversation_id BIGINT,
  chatwoot_contact_id BIGINT,
  platform TEXT NOT NULL DEFAULT 'web',
  contact_name TEXT,
  contact_identifier TEXT,
  contact_avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  assigned_to UUID REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  chatwoot_message_id BIGINT,
  direction TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Knowledge base articles
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Vector embeddings for knowledge base
CREATE TABLE public.knowledge_base_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. AI configuration per tenant
CREATE TABLE public.ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  ai_enabled BOOLEAN DEFAULT true,
  api_base_url TEXT DEFAULT 'https://api.openai.com/v1',
  api_key_encrypted TEXT,
  model_name TEXT DEFAULT 'gpt-4o-mini',
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  system_prompt_override TEXT,
  max_tokens INTEGER DEFAULT 500,
  temperature NUMERIC DEFAULT 0.7,
  handoff_keywords TEXT[] DEFAULT ARRAY['speak to human', 'talk to staff', 'real person'],
  auto_handoff_on_negative_sentiment BOOLEAN DEFAULT true,
  chatwoot_base_url TEXT,
  chatwoot_api_token_encrypted TEXT,
  chatwoot_account_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 7. Indexes
CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX idx_conversations_status ON public.conversations(tenant_id, status);
CREATE INDEX idx_conversations_last_msg ON public.conversations(tenant_id, last_message_at DESC);
CREATE INDEX idx_conversations_chatwoot ON public.conversations(chatwoot_conversation_id);
CREATE INDEX idx_chat_messages_convo ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_tenant ON public.chat_messages(tenant_id);
CREATE INDEX idx_kb_tenant ON public.knowledge_base(tenant_id);
CREATE INDEX idx_kb_embeddings_tenant ON public.knowledge_base_embeddings(tenant_id);
CREATE INDEX idx_kb_embeddings_vector ON public.knowledge_base_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 8. RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

-- Conversations
CREATE POLICY "auth_manage_tenant_conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Chat messages
CREATE POLICY "auth_manage_tenant_chat_messages" ON public.chat_messages
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Knowledge base
CREATE POLICY "auth_manage_tenant_knowledge_base" ON public.knowledge_base
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Knowledge base embeddings
CREATE POLICY "auth_manage_tenant_kb_embeddings" ON public.knowledge_base_embeddings
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- AI config
CREATE POLICY "auth_manage_tenant_ai_config" ON public.ai_config
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- 9. Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- 10. Vector search function
CREATE OR REPLACE FUNCTION public.search_knowledge_base(
  query_embedding vector(1536),
  p_tenant_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  knowledge_base_id UUID,
  chunk_text TEXT,
  title TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kbe.id,
    kbe.knowledge_base_id,
    kbe.chunk_text,
    kb.title,
    kb.category,
    1 - (kbe.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base_embeddings kbe
  JOIN public.knowledge_base kb ON kb.id = kbe.knowledge_base_id
  WHERE kbe.tenant_id = p_tenant_id
    AND kb.is_active = true
    AND 1 - (kbe.embedding <=> query_embedding) > match_threshold
  ORDER BY kbe.embedding <=> query_embedding
  LIMIT match_count;
$$;
