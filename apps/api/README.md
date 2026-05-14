# AgentPME FastAPI Backend

FastAPI-based AI microservice for AgentPME — handling all AI-heavy operations including OpenRouter LLM streaming, LangGraph orchestration, PDF processing, embeddings, and WhatsApp webhooks.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│   Next.js       │────▶│   FastAPI        │────▶│   Anthropic Claude      │
│   (Frontend)    │     │   (This Service) │     │   (LLM)                 │
└─────────────────┘     └──────────────────┘     └─────────────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────┐           ┌──────────────┐
                        │  Supabase    │           │  OpenAI      │
                        │  (Auth + DB) │           │  (Embeddings)│
                        └──────────────┘           └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  WhatsApp    │
                        │  (Meta API)  │
                        └──────────────┘
```

## Quick Start

### Prerequisites

- Python 3.12+
- Virtual environment (venv or conda)
- Supabase project
- Anthropic API key
- OpenAI API key

### Installation

```bash
# Navigate to the API directory
cd apps/api

# Create virtual environment
python -m venv .venv

# Activate it
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Or install with development dependencies
pip install -e ".[dev]"
```

### Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# Required: ANTHROPIC_API_KEY, OPENAI_API_KEY, SUPABASE_*
```

### Run Development Server

```bash
# Option 1: Using uvicorn directly
uvicorn app.main:app --reload --port 8000

# Option 2: Using python
python app/main.py

# Option 3: Using the run script (to be added)
python run.py
```

### Verify Installation

```bash
# Health check
curl http://localhost:8000/health

# API documentation (development only)
open http://localhost:8000/docs
```

## Project Structure

```
apps/api/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── core/                   # Core utilities
│   │   ├── __init__.py
│   │   ├── config.py           # Pydantic settings
│   │   ├── logging.py          # Structured logging
│   │   └── security.py         # JWT validation, API key auth
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   ├── v1/                 # API version 1
│   │   │   ├── __init__.py
│   │   │   ├── chat.py         # Chat endpoint with SSE streaming
│   │   │   ├── documents.py    # PDF upload + chunking + embedding
│   │   │   ├── whatsapp.py     # WhatsApp webhook handler
│   │   │   └── n8n.py          # n8n workflow triggers
│   │   └── deps.py             # Dependencies (DB, auth)
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── ai/                 # AI-related services
│   │   │   ├── __init__.py
│   │   │   ├── claude.py       # Claude API client
│   │   │   ├── embeddings.py   # OpenAI embeddings
│   │   │   ├── agent.py        # LangGraph orchestration
│   │   │   └── chunking.py     # Text chunking utilities
│   │   ├── db/                 # Database operations
│   │   │   ├── __init__.py
│   │   │   ├── supabase.py     # Supabase client
│   │   │   └── queries.py      # SQL queries
│   │   └── integrations/       # External integrations
│   │       ├── __init__.py
│   │       ├── whatsapp.py     # Meta WhatsApp API
│   │       └── n8n.py          # n8n webhook caller
│   └── models/                 # Pydantic models
│       ├── __init__.py
│       ├── chat.py
│       ├── document.py
│       └── webhook.py
├── tests/                      # Test suite
│   ├── __init__.py
│   ├── conftest.py             # pytest fixtures
│   ├── test_chat.py
│   ├── test_documents.py
│   └── test_whatsapp.py
├── .env.example                # Environment template
├── .env                        # Your local config (gitignored)
├── requirements.txt            # Dependencies
├── pyproject.toml              # Modern Python packaging
└── README.md                   # This file
```

## Features (Implemented)

- [x] **Project Structure**: Clean architecture with separation of concerns
- [x] **Configuration**: Pydantic Settings with environment validation
- [x] **Logging**: Structured logging with structlog
- [x] **Health Check**: `/health` endpoint for monitoring

## Features (To Be Implemented)

- [ ] **Chat API**: Claude streaming via SSE
- [ ] **Document Processing**: PDF upload → chunking → embeddings
- [ ] **RAG Pipeline**: pgvector similarity search + context injection
- [ ] **LangGraph Agent**: Multi-agent orchestration (Retrieve → Generate → n8n)
- [ ] **WhatsApp Webhook**: Meta Cloud API integration
- [ ] **n8n Automation**: Hot-lead detection + webhook firing
- [ ] **Authentication**: JWT validation from Supabase
- [ ] **Multi-tenancy**: Tenant isolation via RLS

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Development

### Code Quality Tools

```bash
# Format code
black app/
isort app/

# Lint
ruff check app/

# Type check
mypy app/

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html
```

### Environment Variables Reference

| Variable                | Required | Description                     |
| ----------------------- | -------- | ------------------------------- |
| `ANTHROPIC_API_KEY`     | Yes      | Claude API key                  |
| `OPENAI_API_KEY`        | Yes      | OpenAI API key for embeddings   |
| `SUPABASE_URL`          | Yes      | Supabase project URL            |
| `SUPABASE_SERVICE_KEY`  | Yes      | Supabase service role key       |
| `SUPABASE_JWT_SECRET`   | Yes      | JWT secret for token validation |
| `WHATSAPP_ACCESS_TOKEN` | Yes      | Meta WhatsApp token             |
| `N8N_WEBHOOK_URL`       | No       | n8n webhook for automations     |
| `SECRET_KEY`            | Yes      | Application secret key          |
| `LOG_LEVEL`             | No       | Logging level (default: info)   |

## Integration with Next.js Frontend

The FastAPI service is designed to be called by the Next.js backend:

```
User → Next.js API Route → FastAPI → AI/Database → Response
```

Example Next.js proxy:

```typescript
// app/api/chat/route.ts
export async function POST(request: Request) {
  const body = await request.json()

  // Forward to FastAPI
  const response = await fetch(`${process.env.FASTAPI_URL}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.FASTAPI_API_KEY,
    },
    body: JSON.stringify(body),
  })

  return response
}
```

## License

MIT
