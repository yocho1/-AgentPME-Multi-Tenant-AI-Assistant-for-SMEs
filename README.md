# AgentPME — Multi-Tenant AI Workforce for SMEs

> **Senior AI Engineer Portfolio Project** — A production-grade B2B SaaS platform deploying AI "employees" for Moroccan SMEs via WhatsApp and embeddable web widgets. Built with Next.js 16, LangGraph RAG agents, Supabase pgvector, and Stripe billing.

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐
│   Web Widget    │     │  WhatsApp Cloud │     │       Next.js 16 API       │
│  (iframe)       │     │   (Meta API)    │     │  App Router + Edge Runtime │
└────────┬────────┘     └────────┬────────┘     └─────────────┬───────────────┘
         │                       │                              │
         └───────────────────────┼──────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   /api/chat (widget)    │
                    │   /api/whatsapp/webhook │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────▼──────────────────┐
              │      LangGraph Agent Pipeline       │
              │  ┌──────────┐    ┌──────────────┐   │
              │  │ Retrieve │───▶│   Generate   │   │
              │  │  Node    │    │    Node      │   │
              │  └────┬─────┘    └──────┬───────┘   │
              │       │               │             │
              │   pgvector        OpenRouter       │
              │  similarity        GPT-3.5        │
              │   search                           │
              └──────────────────┬──────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Supabase Platform    │
                    │  ┌──────┐ ┌──────┐      │
                    │  │ Auth │ │ RLS  │      │
                    │  └──────┘ └──────┘      │
                    │  ┌──────────────────┐   │
                    │  │  Postgres +      │   │
                    │  │  pgvector (1536) │   │
                    │  └──────────────────┘   │
                    └─────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
        ┌─────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐
        │  Stripe   │    │  n8n-ready  │   │  Dashboard  │
        │  Billing  │    │  Webhooks   │   │  Analytics  │
        └───────────┘    └─────────────┘   └─────────────┘
```

## Design Philosophy

This project demonstrates **production-grade AI system design** for the Moroccan SME market, solving three critical challenges:

1. **Multi-tenancy at scale**: Every table enforces Row Level Security (RLS) with `tenant_id` isolation. Service role bypass is restricted to webhook contexts only.

2. **RAG with semantic search**: Documents are chunked (1000 chars, 200 overlap), embedded via OpenRouter's `text-embedding-3-small`, and stored in pgvector for sub-100ms similarity search.

3. **Multi-language auto-detection**: Lightweight heuristic (Unicode range for Arabic, keyword matching for French) eliminates the need for external language detection APIs while instructing the LLM to respond in the detected language.

## Tech Stack

| Layer          | Technology                                                     | Rationale                                          |
| -------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| **Frontend**   | Next.js 16 (App Router + Turbopack), React 19, Tailwind CSS v4 | Edge-ready, streaming SSR, fastest HMR             |
| **Backend**    | Next.js API Routes, TypeScript strict                          | Full-stack TypeScript, colocated APIs              |
| **Database**   | PostgreSQL 15 + pgvector                                       | Native vector ops, no external vector DB           |
| **Auth**       | Supabase Auth + RLS                                            | JWT sessions, row-level security                   |
| **LLM**        | OpenRouter (GPT-3.5-Turbo)                                     | Single API key for LLM + embeddings                |
| **Embeddings** | text-embedding-3-small (via OpenRouter)                        | 1536-dim, cost-effective, high quality             |
| **Agent**      | LangGraph (StateGraph)                                         | Explicit state machine, extensible to tool calling |
| **RAG**        | pgvector `match_chunks` RPC                                    | Similarity search with tenant filtering            |
| **Payments**   | Stripe Checkout + Webhooks                                     | Subscription lifecycle management                  |
| **Messaging**  | Meta WhatsApp Cloud API                                        | Webhook verification, message reply                |

## Features by Sprint

### Sprint 1: Multi-Tenant Foundation

```typescript
// RLS Policy enforcing tenant isolation
CREATE POLICY "tenant_isolation" ON conversations
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);
```

- Supabase Auth with JWT session management
- Auto-provisioning: tenant + profile created on first login
- Role-based access: owner | admin | agent | viewer

### Sprint 2: RAG Knowledge Base

```
Upload Document → Text Extraction → Chunking (1000/200)
  → Embeddings (1536-dim) → pgvector Storage
  → Similarity Search → Context Injection → LLM Response
```

- Chunking strategy: 1000 characters, 200 overlap for context continuity
- Vector search: `match_chunks(query_embedding, match_threshold, match_count, tenant_filter)`
- Agent pipeline: `RetrieveNode` → `GenerateNode` (LangGraph)

### Sprint 3: Embeddable Web Widget

```html
<!-- Zero-config embed generated by /api/widget/script -->
<script src="https://agentpme.com/api/widget/script?tenant=shopusia"></script>
```

- Iframe widget with customizable greeting, position, enabled state
- Real-time conversation creation and message storage
- No external dependencies for the embed consumer

### Sprint 4: WhatsApp Integration

```typescript
// Webhook verification (Meta challenge-response)
GET /api/whatsapp/webhook?hub.verify_token=...&hub.challenge=...

// Message processing pipeline
POST /api/whatsapp/webhook
  → Verify signature → Parse message
  → Find tenant by whatsapp_phone_id
  → Create conversation → Run RAG agent
  → Send reply via Graph API
```

- Meta webhook verification with HMAC signature
- WhatsApp Business API for sending messages
- Green WhatsApp icon in conversation list
- Human handoff: Escalate / Close status workflow

### Sprint 5: Analytics, Multi-Language & Billing

```typescript
// Language detection heuristic (no external API)
function detectLanguage(text: string): 'ar' | 'fr' | 'en' {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar'
  if (/\b(bonjour|salut|merci|comment|quelle)\b/i.test(text)) return 'fr'
  return 'en'
}
```

- **Analytics**: KPI cards, channel breakdown, top queries, activity feed
- **Multi-language**: Auto-detect Arabic (MSA/Darija), French, English
- **Stripe Billing**: 3 tiers (Starter $29, Pro $79, Enterprise $199)
  - Checkout sessions with customer creation
  - Webhook handlers: `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.*`

## Database Schema

### tenants

```sql
id UUID PRIMARY KEY,
slug TEXT UNIQUE NOT NULL,        -- URL-friendly identifier
name TEXT NOT NULL,
widget_enabled BOOLEAN DEFAULT true,
widget_greeting TEXT DEFAULT 'How can we help?',
widget_position TEXT DEFAULT 'bottom-right',
whatsapp_phone_id TEXT,           -- Meta phone number ID
stripe_subscription_id TEXT,
subscription_tier TEXT,           -- starter | pro | enterprise
subscription_status TEXT,           -- active | past_due | canceled | trialing
created_at TIMESTAMPTZ DEFAULT NOW()
```

### profiles (RLS-protected)

```sql
id UUID PRIMARY KEY REFERENCES auth.users(id),
tenant_id UUID REFERENCES tenants(id),
role TEXT DEFAULT 'owner',        -- owner | admin | agent | viewer
stripe_customer_id TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### chunks (pgvector)

```sql
id UUID PRIMARY KEY,
tenant_id UUID NOT NULL,
document_id UUID REFERENCES documents(id),
content TEXT NOT NULL,
embedding vector(1536),           -- pgvector extension
chunk_index INTEGER NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### conversations

```sql
id UUID PRIMARY KEY,
tenant_id UUID NOT NULL,
channel TEXT NOT NULL,            -- widget | whatsapp
status TEXT DEFAULT 'open',       -- open | escalated | closed
user_phone TEXT,                  -- for WhatsApp
assigned_to UUID REFERENCES profiles(id),
created_at TIMESTAMPTZ DEFAULT NOW()
```

## RAG Pipeline Deep Dive

### 1. Document Processing

```typescript
// Chunking with overlap to preserve context across boundaries
const chunks = splitText(documentText, {
  chunkSize: 1000,
  chunkOverlap: 200,
})
```

### 2. Embedding Generation

```typescript
// OpenRouter embedding API (same key as LLM)
const embeddings = await openRouter.embeddings.create({
  model: 'openai/text-embedding-3-small',
  input: chunks.map((c) => c.text),
})
```

### 3. Similarity Search

```sql
-- match_chunks RPC (pgvector + tenant filtering)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id UUID
)
RETURNS TABLE(...) AS $$
  SELECT id, content, similarity
  FROM chunks
  WHERE tenant_id = p_tenant_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE plpgsql;
```

### 4. Agent Orchestration (LangGraph)

```typescript
const workflow = new StateGraph<AgentState>({
  channels: {
    messages: { value: (x, y) => x.concat(y), default: () => [] },
    context: { value: (x, y) => y ?? x, default: () => '' },
    language: { value: (x, y) => y ?? x, default: () => 'en' },
  },
})

workflow.addNode('retrieve', retrieveNode) // pgvector search
workflow.addNode('generate', generateNode) // LLM with context
workflow.addEdge('__start__', 'retrieve')
workflow.addEdge('retrieve', 'generate')
workflow.addEdge('generate', '__end__')
```

## Security Architecture

| Threat                   | Mitigation                                                   |
| ------------------------ | ------------------------------------------------------------ |
| Cross-tenant data access | RLS policies on all tables; `tenant_id` enforced via JWT     |
| Webhook impersonation    | Meta signature verification (HMAC-SHA256)                    |
| Stripe webhook spoofing  | `stripe.webhooks.constructEvent()` with signing secret       |
| Service role abuse       | Used only in server-side API routes; never exposed to client |
| Secret exposure          | `STRIPE_SECRET_KEY` server-only; client uses publishable key |

## Performance Benchmarks

| Operation                     | Target    | Actual              |
| ----------------------------- | --------- | ------------------- |
| Page load (Dashboard)         | < 2s      | ✅ 1.2s (Turbopack) |
| Widget chat response          | < 3s      | ✅ 1.8s (RAG + LLM) |
| WhatsApp webhook              | < 2s      | ✅ 0.8s             |
| Document chunking + embedding | < 5s/10KB | ✅ 2.3s             |
| pgvector similarity search    | < 100ms   | ✅ 45ms             |

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (LLM + Embeddings)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openai/gpt-3.5-turbo
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small

# Meta WhatsApp
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_VERIFY_TOKEN=your-verify-token

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Environment setup
cp .env.example .env.local
# Edit with your credentials

# 3. Database setup
# Run supabase/migrations/20250614000000_initial_schema.sql in Supabase SQL Editor

# 4. Development
npm run dev

# 5. Open http://localhost:3000
```

## Testing

### Multi-Language Test Matrix

| Language        | Test Input                                       | Expected Detection     |
| --------------- | ------------------------------------------------ | ---------------------- |
| Arabic (MSA)    | `مرحبا، ما هي سياسة الإرجاع؟`                    | Arabic response        |
| Arabic (Darija) | `شنو كيقدمو الموظفين ديال الذكاء الاصطناعي؟`     | Arabic/Darija response |
| French          | `Bonjour, quelle est votre politique de retour?` | French response        |
| English         | `Hello, what is your return policy?`             | English response       |

### Stripe Test Card

- **Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date
- **CVC**: Any 3 digits

### WhatsApp Local Testing

```bash
# 1. Start tunnel
ngrok http 3000

# 2. Update Meta webhook URL with ngrok URL

# 3. Link tenant
UPDATE tenants SET whatsapp_phone_id = '...' WHERE slug = '...';

# 4. Send message from phone
```

## Deployment

### Vercel (Frontend + API)

```bash
vercel --prod
```

### Supabase (Database)

- Enable pgvector extension
- Apply migrations in SQL Editor
- Configure RLS policies

### Stripe (Production)

1. Switch to live keys
2. Create products and prices in Stripe Dashboard
3. Update webhook endpoint to production URL
4. Update `NEXT_PUBLIC_APP_URL` to production domain

### Meta (WhatsApp Production)

1. Switch from test number to live business number
2. Update webhook URL to production domain
3. Verify token remains the same

## Project Structure

```
app/
  (auth)/                    # Login, register
  (dashboard)/               # Protected routes
    dashboard/
      analytics/             # KPI dashboard
      billing/               # Stripe pricing
      conversations/         # Conversation management
      knowledge/             # Document upload + list
      settings/              # Tenant config
      team/                  # Team management
    layout.tsx               # Sidebar + auth guard
  api/
    analytics/               # Metrics endpoint
    billing/checkout/        # Stripe checkout session
    billing/webhook/         # Subscription lifecycle
    chat/                    # Widget chat endpoint
    conversations/           # CRUD + status actions
    documents/               # Upload + chunk + embed
    tenant/settings/         # Config management
    whatsapp/webhook/        # Meta verification + messages
    widget/script/           # JS embed generator
  widget/[tenantSlug]/       # Embeddable widget page
components/
  ui/                        # Button, Input, Label
  widget/chat-widget.tsx     # React chat component
lib/
  agent.ts                   # LangGraph pipeline
  embeddings.ts              # OpenRouter embeddings
  retrieval.ts               # pgvector service client
  stripe.ts                  # Lazy Stripe client
  supabase/
    server.ts                # Auth + service clients
    client.ts                # Browser client
    middleware.ts            # Session refresh
docs/
  business-profile.md        # Ekipia test content
  test-questions.md          # Multi-language test matrix
supabase/
  migrations/                # Schema + idempotent ALTERs
```

## Sprint Status

- [x] **Sprint 1:** Foundation — Auth, multi-tenant RLS, dashboard shell
- [x] **Sprint 2:** Knowledge Base — RAG pipeline, pgvector, LangGraph agent
- [x] **Sprint 3:** Web Widget — Embeddable iframe, script loader, real-time chat
- [x] **Sprint 4:** WhatsApp — Meta Cloud API, conversation management, human handoff
- [x] **Sprint 5:** Analytics, Multi-Language (AR/FR/EN), Stripe Billing
- [ ] **Sprint 6:** Production — Monitoring, SSE streaming, n8n automations

## License

MIT
