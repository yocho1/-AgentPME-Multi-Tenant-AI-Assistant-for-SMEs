import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/documents/:id
 * Delete a knowledge base document and its chunks.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await (supabase.from("profiles") as any)
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const { id } = await params;

  // Verify the document belongs to this tenant before deleting
  const { data: doc } = await (supabase.from("documents") as any)
    .select("id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete chunks first (FK constraint)
  await (supabase.from("chunks") as any).delete().eq("document_id", id);

  // Delete document
  const { error } = await (supabase.from("documents") as any)
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
