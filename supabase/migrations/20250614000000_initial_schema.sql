-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- TENANTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT,
  widget_enabled BOOLEAN NOT NULL DEFAULT true,
  widget_greeting TEXT DEFAULT 'Hello! How can I help you today?',
  widget_position TEXT NOT NULL DEFAULT 'bottom-right' CHECK (widget_position IN ('bottom-right', 'bottom-left')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subscription_status TEXT NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled')),
  subscription_expires_at TIMESTAMPTZ
);

COMMENT ON TABLE public.tenants IS 'Business workspaces (multi-tenant isolation boundary)';

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profiles linked to tenants with RBAC';

-- ============================================
-- DOCUMENTS (Knowledge Base)
-- ============================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT, -- e.g. 'upload', 'website', 'manual'
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documents IS 'Knowledge base documents per tenant';

-- ============================================
-- CHUNKS (with pgvector embeddings)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chunks IS 'Document chunks with vector embeddings for RAG';

-- Index for similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON public.chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_id TEXT, -- WhatsApp message ID or widget session ID
  channel TEXT NOT NULL DEFAULT 'widget' CHECK (channel IN ('widget', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'escalated')),
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversations IS 'Customer conversations across channels';

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messages IS 'Individual messages within conversations';

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);

-- ============================================
-- RLS: ENABLE
-- ============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS: TENANTS
-- ============================================
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY tenants_insert ON public.tenants
  FOR INSERT WITH CHECK (true); -- Allow creation during signup

CREATE POLICY tenants_update ON public.tenants
  FOR UPDATE USING (
    id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ============================================
-- RLS: PROFILES
-- ============================================
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() OR
    (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')))
  );

-- ============================================
-- RLS: DOCUMENTS
-- ============================================
CREATE POLICY documents_select ON public.documents
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY documents_insert ON public.documents
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'agent'))
  );

CREATE POLICY documents_update ON public.documents
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'agent'))
  );

CREATE POLICY documents_delete ON public.documents
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ============================================
-- RLS: CHUNKS
-- ============================================
CREATE POLICY chunks_select ON public.chunks
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY chunks_insert ON public.chunks
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'agent'))
  );

CREATE POLICY chunks_delete ON public.chunks
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ============================================
-- RLS: CONVERSATIONS
-- ============================================
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT WITH CHECK (true); -- Allow public widget/ WhatsApp creation

CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'agent'))
  );

-- ============================================
-- RLS: MESSAGES
-- ============================================
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (true); -- Allow public widget/ WhatsApp messages

CREATE POLICY messages_update ON public.messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'agent'))
    )
  );

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- TRIGGER: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
BEGIN
  -- Extract metadata from the signup
  v_tenant_name := COALESCE(NEW.raw_user_meta_data->>'tenant_name', 'My Business');

  -- Create tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (v_tenant_name, lower(regexp_replace(v_tenant_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6))
  RETURNING id INTO v_tenant_id;

  -- Create profile linked to tenant
  INSERT INTO public.profiles (id, tenant_id, role, full_name)
  VALUES (
    NEW.id,
    v_tenant_id,
    'owner',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RPC: match_chunks (pgvector similarity search)
-- ============================================
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(1536),
  match_tenant_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  document_id UUID,
  content TEXT,
  chunk_index INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  WHERE c.tenant_id = match_tenant_id
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
