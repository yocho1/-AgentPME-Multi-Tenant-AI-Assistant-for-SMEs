import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/chunking";
import { embedChunks } from "@/lib/embeddings";

/**
 * POST /api/documents
 * Upload a knowledge base document: chunk, embed, store.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's tenant
  const { data: profile } = await (supabase.from("profiles") as any)
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const tenantId = profile.tenant_id;
  const body = await request.json();
  const { title, content, source = "upload" } = body;

  if (!title || !content || typeof content !== "string") {
    return NextResponse.json(
      { error: "Missing title or content" },
      { status: 400 }
    );
  }

  // 1. Insert document
  const { data: document, error: docError } = await (supabase.from("documents") as any)
    .insert({
      tenant_id: tenantId,
      title,
      content,
      source,
      status: "active",
    })
    .select("id")
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: docError?.message }, { status: 500 });
  }

  // 2. Chunk the content
  const chunks = chunkText(content, 1000, 100);

  // 3. Generate embeddings
  let embeddings: number[][];
  try {
    embeddings = await embedChunks(chunks);
  } catch (err) {
    // Rollback: delete document if embedding fails
    await (supabase.from("documents") as any).delete().eq("id", document.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Embedding failed" },
      { status: 500 }
    );
  }

  // 4. Insert chunks with embeddings
  const chunkRows = chunks.map((chunkContent, i) => ({
    tenant_id: tenantId,
    document_id: document.id,
    content: chunkContent,
    embedding: embeddings[i] as unknown as string, // pgvector accepts array via Supabase
    chunk_index: i,
  }));

  const { error: chunkError } = await (supabase.from("chunks") as any).insert(chunkRows);

  if (chunkError) {
    // Rollback
    await (supabase.from("documents") as any).delete().eq("id", document.id);
    return NextResponse.json({ error: chunkError.message }, { status: 500 });
  }

  // 5. Update chunk_count
  await (supabase.from("documents") as any)
    .update({ chunk_count: chunks.length })
    .eq("id", document.id);

  return NextResponse.json({
    id: document.id,
    chunkCount: chunks.length,
  });
}

/**
 * GET /api/documents
 * List knowledge base documents for the current tenant.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await (supabase.from("profiles") as any)
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const { data, error } = await (supabase.from("documents") as any)
    .select("id, title, source, status, chunk_count, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
