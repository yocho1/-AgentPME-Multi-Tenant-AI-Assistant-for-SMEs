import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent";
import { v4 as uuidv4 } from "uuid";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * POST /api/chat
 * Process a chat message using the RAG agent.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow both authenticated dashboard users and anonymous widget users
  const body = await request.json();
  const { message, conversationId, tenantId: providedTenantId } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  let tenantId: string;
  let conversation_id: string;

  if (user) {
    // Authenticated user from dashboard
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 });
    }
    tenantId = profile.tenant_id;
  } else if (providedTenantId) {
    // Anonymous user from widget (tenantId provided by widget config)
    tenantId = providedTenantId;
  } else {
    return NextResponse.json(
      { error: "Missing tenant_id" },
      { status: 400 }
    );
  }

  // Get or create conversation
  if (conversationId) {
    const { data: conv } = await (supabase.from("conversations") as any)
      .select("id")
      .eq("id", conversationId)
      .eq("tenant_id", tenantId)
      .single();
    conversation_id = conv?.id ?? uuidv4();
  } else {
    conversation_id = uuidv4();
    const { error: convErr } = await (supabase.from("conversations") as any).insert({
      id: conversation_id,
      tenant_id: tenantId,
      channel: "widget",
      status: "open",
    });
    if (convErr) {
      console.error("[chat] conversation insert failed:", convErr);
    } else {
      console.log("[chat] created conversation:", conversation_id, "tenant:", tenantId);
    }
  }

  // Fetch conversation history
  const { data: history } = await (supabase.from("messages") as any)
    .select("role, content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true });

  const messages: ChatMessage[] = [
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  // Run the agent
  let reply: string;
  try {
    reply = await runAgent(tenantId, messages);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent failed" },
      { status: 500 }
    );
  }

  // Store messages
  const { error: msgErr } = await (supabase.from("messages") as any).insert([
    { conversation_id, role: "user", content: message },
    { conversation_id, role: "assistant", content: reply },
  ]);
  if (msgErr) {
    console.error("[chat] message insert failed:", msgErr);
  } else {
    console.log("[chat] stored 2 messages for conversation:", conversation_id);
  }

  return NextResponse.json({
    reply,
    conversationId: conversation_id,
  });
}
