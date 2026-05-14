# AgentPME

A production-grade, multi-tenant B2B SaaS platform that lets small business owners deploy an AI assistant for customer queries via an embeddable web widget and WhatsApp. Built for the Moroccan SME market with multi-language support (Arabic, French, English), SaaS billing via Stripe, and real-time conversation management.

## Architecture Overview

```
                          +-------------------+
     Customer (Web)  ----> |  Embeddable Chat  | ----> Next.js API ----> Supabase
     Customer (WA)   ----> |  WhatsApp Cloud   | ----> Webhook ----> RAG Agent
                          +-------------------+
                                              |
                                              v
                                    +-------------------+
                                    |  AI Agent (RAG)   |
                                    |  OpenRouter LLM   |
                                    |  pgvector Search  |
                                    +-------------------+
                                              |
                                              v
                                    +-------------------+
                                    |  Dashboard        |
                                    |  - Conversations  |
                                    |  - Knowledge Base |
                                    |  - Analytics      |
                                    |  - Billing        |
                                    +-------------------+
```

## Tech Stack

| Layer            | Technology                                                                         |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Frontend**     | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, TypeScript (strict) |
| **Backend**      | Next.js API Routes (Edge-ready), Supabase (Auth, Postgres, Storage)                |
| **Database**     | PostgreSQL 15 + pgvector extension (1536-dim embeddings)                           |
| **AI/LLM**       | OpenRouter (GPT-3.5-Turbo + text-embedding-3-small)                                |
| **Agent**        | LangGraph (StateGraph: Retrieve → Generate)                                        |
| **RAG**          | pgvector similarity search via RPC (`match_chunks`)                                |
| **Auth**         | Supabase Auth (email/password, session-based)                                      |
| **Multi-tenant** | Row Level Security (RLS), tenant_id isolation                                      |
| **Payments**     | Stripe Checkout + Subscription webhooks                                            |
| **Integrations** | Meta WhatsApp Cloud API                                                            |
| **Deployment**   | Vercel (frontend + API), Supabase Cloud                                            |

## Features

### Sprint 1: Foundation

- Multi-tenant architecture with tenant isolation via RLS
- Supabase Auth (signup/login/logout)
- Dashboard shell with sidebar navigation
- Auto-provisioning of tenant + profile on first login

### Sprint 2: Knowledge Base & AI Agent

- Document upload and chunking (1000 chars, 200 overlap)
- OpenAI text-embedding-3-small for vectorization
- pgvector `match_chunks` RPC for semantic search
- LangGraph agent: Retrieve relevant chunks → Generate answer
- OpenRouter integration with proper API key passing in `configuration`

### Sprint 3: Embeddable Web Widget

- Zero-config iframe widget (`/widget/[tenantSlug]`)
- Script loader API (`/api/widget/script`) generates embed snippet
- Real-time chat with conversation creation + message storage
- Customizable greeting, position, enabled/disabled toggle

### Sprint 4: WhatsApp Integration

- Meta WhatsApp Cloud API webhook (`/api/whatsapp/webhook`)
- Message receiving, conversation creation, AI response
- WhatsApp reply sent back via Graph API
- Green WhatsApp icon in conversation list
- Human handoff: Escalate / Close status management
- Dashboard conversation detail with full message history
- Live polling for real-time updates

### Sprint 5: Analytics, Multi-Language & Billing

- **Analytics Dashboard**: KPI cards, channel breakdown, recent queries, activity feed
- **Multi-language**: Auto-detects Arabic (Unicode), French (keyword heuristics), English; instructs LLM to respond in same language
- **Stripe Billing**: 3 tiers (Starter $29, Pro $79, Enterprise $199), checkout sessions, webhook lifecycle management

## Project Structure

```
app/
  (auth)/                    # Route group: login, register
  (dashboard)/               # Route group: protected dashboard
    dashboard/
      analytics/             # Analytics page + API
      billing/               # Stripe pricing + checkout
      conversations/         # Conversation list + detail + status actions
      knowledge/             # Document upload + list
      settings/              # Tenant settings
      team/                  # Team management
    layout.tsx               # Sidebar nav with auth check
  api/
    analytics/route.ts        # KPI metrics endpoint
    billing/
      checkout/route.ts     # Stripe checkout session
      webhook/route.ts      # Stripe webhook handler
    chat/route.ts            # Widget chat endpoint (conversation + message creation)
    conversations/           # List, detail, update endpoints
    documents/route.ts       # Document upload + chunking + embedding
    tenant/settings/route.ts # GET/PATCH tenant config
    whatsapp/webhook/route.ts # Meta webhook verification + message processing
    widget/script/route.ts   # JS embed snippet generator
  widget/[tenantSlug]/       # Embeddable widget page
components/
  ui/                        # Button, Input, Label (shadcn-style)
  widget/chat-widget.tsx     # React chat widget component
lib/
  agent.ts                   # LangGraph RAG agent (retrieveNode, generateNode)
  embeddings.ts            # OpenRouter embedding generation
  retrieval.ts               # pgvector chunk retrieval (service role)
  stripe.ts                  # Stripe client + plan definitions
  supabase/
    server.ts               # Auth + service role clients
    client.ts               # Browser client
    middleware.ts           # Session refresh middleware
types/
  database.ts               # TypeScript DB types
supabase/
  migrations/                 # Initial schema + idempotent ALTERs
```

## Database Schema

### Core Tables

| Table           | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `tenants`       | Business workspaces (multi-tenant boundary)       |
| `profiles`      | User profiles with tenant membership + RBAC       |
| `documents`     | Knowledge base documents                          |
| `chunks`        | Vectorized text chunks (1536-dim, tenant-scoped)  |
| `conversations` | Customer conversations (widget/whatsapp channels) |
| `messages`      | Individual messages within conversations          |

### Key Columns

**tenants:**

- `slug` (unique), `name`, `widget_enabled`, `widget_greeting`, `widget_position`
- `whatsapp_phone_id`, `stripe_subscription_id`, `subscription_tier`, `subscription_status`

**profiles:**

- `tenant_id` (FK), `role` (owner/admin/agent/viewer), `stripe_customer_id`

**conversations:**

- `tenant_id` (FK), `channel` (widget/whatsapp), `status` (open/escalated/closed), `user_phone`
- `assigned_to` (FK to profiles)

**chunks:**

- `tenant_id` (FK), `document_id` (FK), `content`, `embedding` (vector(1536)), `chunk_index`

## Environment Variables

Copy `.env.example` → `.env.local` and fill in:

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

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Run Supabase migrations in SQL Editor
# Run supabase/migrations/20250614000000_initial_schema.sql

# 4. Start dev server
npm run dev

# 5. Open http://localhost:3000
```

## Key Design Decisions

### Why OpenRouter?

- Single API key for both LLM (GPT-3.5) and embeddings (text-embedding-3-small)
- No need for separate OpenAI and Anthropic accounts
- Built-in analytics and model switching

### Why Service Role for RAG Retrieval?

- WhatsApp webhooks have no authenticated user context (no cookies)
- RLS policies block unauthenticated chunk access
- `retrieveRelevantChunks()` uses `createServiceClient()` to bypass RLS
- Safe because it's an internal backend operation with tenant isolation

### Why LangGraph?

- Explicit state machine: Retrieve → Generate → End
- Easy to extend (add routing, tools, memory)
- Type-safe state channels

### Multi-tenant Isolation

- Every table has `tenant_id` FK
- RLS policies enforce: `tenant_id = (auth.jwt() -> 'tenant_id')`
- Service role used only for webhook contexts where auth is unavailable

## API Endpoints

| Method   | Path                      | Purpose                                         |
| -------- | ------------------------- | ----------------------------------------------- |
| GET      | `/api/analytics`          | Conversation metrics + KPIs                     |
| POST     | `/api/billing/checkout`   | Stripe checkout session                         |
| POST     | `/api/billing/webhook`    | Stripe webhook handler                          |
| POST     | `/api/chat`               | Widget chat (conversation + message + AI reply) |
| GET      | `/api/conversations`      | List tenant conversations                       |
| GET      | `/api/conversations/[id]` | Detail + messages                               |
| PATCH    | `/api/conversations/[id]` | Update status/assignment                        |
| POST     | `/api/documents`          | Upload + chunk + embed                          |
| GET      | `/api/tenant/settings`    | Tenant config                                   |
| PATCH    | `/api/tenant/settings`    | Update config                                   |
| GET/POST | `/api/whatsapp/webhook`   | Meta verification + messages                    |
| GET      | `/api/widget/script`      | JS embed snippet                                |

## Testing Stripe Billing Locally

1. Start ngrok: `ngrok http 3000`
2. Update webhook URL in Stripe Dashboard with ngrok URL
3. Add `STRIPE_WEBHOOK_SECRET` to `.env.local`
4. Go to Dashboard → Billing → Subscribe
5. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC

## Testing WhatsApp Locally

1. Start ngrok: `ngrok http 3000`
2. Configure webhook in Meta Developer Dashboard with ngrok URL
3. Set `WHATSAPP_VERIFY_TOKEN` in `.env.local`
4. Link tenant: `UPDATE tenants SET whatsapp_phone_id = '...' WHERE slug = '...'`
5. Send message from your phone to the test WhatsApp number

## Deployment Checklist

- [ ] Switch Stripe to live keys
- [ ] Configure production webhook endpoint (stable domain, not ngrok)
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Enable RLS on all tables
- [ ] Verify `match_chunks` RPC exists in production Supabase
- [ ] Configure WhatsApp webhook with production URL
- [ ] Set up monitoring (Vercel Analytics, Supabase logs)

## Sprint Status

- [x] **Sprint 1:** Foundation — Auth, multi-tenant DB, dashboard shell
- [x] **Sprint 2:** Knowledge Base & AI Agent — RAG with pgvector, LangGraph, OpenRouter
- [x] **Sprint 3:** Web Widget — Embeddable iframe, script loader, real-time chat
- [x] **Sprint 4:** WhatsApp Integration — Meta Cloud API, conversation management, human handoff
- [x] **Sprint 5:** Analytics, Multi-Language (AR/FR/EN), Stripe Billing
- [ ] **Sprint 6:** Production polish, monitoring, advanced features

## License

MIT
