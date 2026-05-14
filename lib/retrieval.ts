import type { Chunk } from "@/types/database";

/**
 * DEPRECATED: RAG retrieval moved to FastAPI backend.
 * Similarity search is now handled by the FastAPI service.
 *
 * The FastAPI backend handles:
 * - pgvector similarity search via match_chunks RPC
 * - Query embedding generation
 * - Context injection into LLM prompts
 *
 * @deprecated Use lib/fastapi-proxy.ts or call FastAPI directly
 */

console.warn("[DEPRECATED] lib/retrieval.ts is deprecated. RAG moved to FastAPI backend.");

export async function retrieveRelevantChunks(
  _tenantId: string,
  _queryEmbedding: number[],
  _topK = 5
): Promise<Pick<Chunk, "id" | "content" | "document_id" | "chunk_index">[]> {
  throw new Error("retrieveRelevantChunks moved to FastAPI backend. Use lib/fastapi-proxy.ts");
}
