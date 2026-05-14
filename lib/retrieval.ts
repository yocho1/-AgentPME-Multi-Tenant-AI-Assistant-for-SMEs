import { createClient } from "@/lib/supabase/server";
import type { Chunk } from "@/types/database";

/**
 * Retrieve the top-k most relevant chunks for a tenant using pgvector similarity search.
 * The query embedding must already be computed (e.g. via embedQuery).
 */
export async function retrieveRelevantChunks(
  tenantId: string,
  queryEmbedding: number[],
  topK = 5
): Promise<Pick<Chunk, "id" | "content" | "document_id" | "chunk_index">[]> {
  const supabase = await createClient();

  const { data, error } = await (supabase.rpc as any)("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_tenant_id: tenantId,
    match_count: topK,
  });

  if (error) {
    // If the RPC doesn't exist yet, fall back to a raw query
    if (error.message.includes("match_chunks")) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("chunks")
        .select("id, content, document_id, chunk_index")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(topK);

      if (fallbackError) throw fallbackError;
      return fallback ?? [];
    }
    throw error;
  }

  return data ?? [];
}
