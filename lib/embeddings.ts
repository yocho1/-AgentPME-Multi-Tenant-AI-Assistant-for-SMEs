/**
 * DEPRECATED: Embeddings now handled by FastAPI backend.
 * Document processing routes through /api/v1/documents in FastAPI.
 *
 * The FastAPI backend handles:
 * - PyMuPDF text extraction
 * - tiktoken chunking (1000 tokens, 200 overlap)
 * - OpenRouter embeddings (text-embedding-3-small)
 * - pgvector storage
 *
 * @deprecated Use lib/fastapi-proxy.ts or direct API calls instead
 */

console.warn("[DEPRECATED] lib/embeddings.ts is deprecated. Embeddings are handled by FastAPI.");

export async function embedChunks(_chunks: string[]): Promise<number[][]> {
  throw new Error("embedChunks moved to FastAPI backend. Use lib/fastapi-proxy.ts");
}

export async function embedQuery(_query: string): Promise<number[]> {
  throw new Error("embedQuery moved to FastAPI backend. Use lib/fastapi-proxy.ts");
}
