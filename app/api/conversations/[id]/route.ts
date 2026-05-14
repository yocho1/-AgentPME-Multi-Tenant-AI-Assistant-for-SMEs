import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/conversations/:id
 * Update conversation status, assignment, etc.
 */
export async function PATCH(
  request: Request,
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
  const body = await request.json();
  const { status, assigned_to } = body;

  // Verify the conversation belongs to this tenant
  const { data: conv } = await (supabase.from("conversations") as any)
    .select("id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (status === "open" || status === "closed" || status === "escalated") {
    update.status = status;
  }
  if (assigned_to === null || typeof assigned_to === "string") {
    update.assigned_to = assigned_to;
  }

  const { error } = await (supabase.from("conversations") as any)
    .update(update)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * GET /api/conversations/:id
 * Get conversation details with messages.
 */
export async function GET(
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
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const { id } = await params;

  const { data: conversation, error: convErr } = await (supabase
    .from("conversations") as any)
    .select(
      "id, channel, status, user_name, user_email, user_phone, assigned_to, created_at, updated_at"
    )
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (convErr) {
    console.error("[conversations/detail] select failed:", convErr);
    return NextResponse.json({ error: convErr.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error: msgErr } = await (supabase
    .from("messages") as any)
    .select("role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error("[conversations/detail] messages select failed:", msgErr);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  console.log("[conversations/detail] found", messages?.length ?? 0, "messages for conv", id);
  return NextResponse.json({ conversation, messages: messages ?? [] });
}
