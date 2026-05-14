# AgentPME

A production-grade, multi-tenant B2B SaaS platform that lets small business owners deploy an AI assistant for customer queries via a web widget and WhatsApp.

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, TypeScript (strict mode)
- **Backend/DB:** Supabase (Auth, Postgres, Storage) + pgvector extension
- **AI:** Anthropic Claude API (primary LLM), OpenAI text-embedding-3-small (embeddings)
- **Agent framework:** LangGraph (multi-agent orchestration)
- **Automations:** n8n (self-hosted via Docker)
- **Integrations:** Meta WhatsApp Cloud API
- **Deployment:** Vercel (frontend + API routes), Supabase cloud

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  (auth)/           # Route group for auth pages
    login/
    register/
    layout.tsx
  (dashboard)/      # Route group for dashboard pages
    dashboard/
      conversations/
      settings/
      team/
    layout.tsx
  api/              # API routes
    auth/signout/
  layout.tsx        # Root layout
  page.tsx          # Landing page
  globals.css       # Tailwind v4 + CSS variables
components/
  ui/               # Reusable UI components
lib/
  supabase/         # Supabase clients (browser, server, middleware)
  utils.ts          # cn() helper
 types/
   database.ts       # TypeScript database types
```

## Environment Variables

See `.env.example` for required variables. You need:
- Supabase URL and anon key (public)
- Supabase service role key (server-only)
- Anthropic API key
- OpenAI API key
- WhatsApp Cloud API credentials

## Sprint Status

- [x] **Sprint 1:** Foundation — Next.js setup, Supabase auth, dashboard shell, multi-tenant types
- [ ] **Sprint 2:** Knowledge base & AI agent core (Claude API, LangGraph, RAG with pgvector)
- [ ] **Sprint 3:** Web widget (embeddable chat widget, real-time WebSocket)
- [ ] **Sprint 4:** WhatsApp integration (Meta Cloud API)
- [ ] **Sprint 5:** n8n automations & advanced features
- [ ] **Sprint 6:** Production polish, monitoring, deployment
