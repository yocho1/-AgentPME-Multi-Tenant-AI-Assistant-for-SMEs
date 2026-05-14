/**
 * DEPRECATED: AI agent logic moved to FastAPI backend.
 * This file is kept for backward compatibility but should not be used.
 * All AI operations now route through /lib/fastapi-proxy.ts
 *
 * The FastAPI backend handles:
 * - RAG (pgvector similarity search)
 * - OpenRouter LLM completions
 * - LangGraph orchestration
 * - n8n hot-lead detection
 * - Document chunking and embeddings
 *
 * @deprecated Use lib/fastapi-proxy.ts instead
 */

console.warn("[DEPRECATED] lib/agent.ts is deprecated. Use lib/fastapi-proxy.ts for AI operations.");

// Re-export from fastapi-proxy for backward compatibility
export { proxyToFastAPI as runAgent } from "./fastapi-proxy";
