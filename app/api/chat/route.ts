import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import {
  proxyToFastAPI,
  checkFastAPIHealth,
} from "@/lib/fastapi-proxy";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Configuration
const USE_FASTAPI = process.env.NEXTJS_STANDALONE_MODE !== "true";

/**
 * POST /api/chat
 * Process a chat message using the RAG agent.
 *
 * Routes to FastAPI if available, otherwise falls back to built-in Next.js agent.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow both authenticated dashboard users and anonymous widget users
  const body = await request.json();
  const { message, conversationId, tenantId: providedTenantId, stream } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  let tenantId: string;

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

  // Check if FastAPI is available
  const fastapiHealthy = USE_FASTAPI ? await checkFastAPIHealth() : { healthy: false };

  if (fastapiHealthy.healthy) {
    // Route to FastAPI
    console.log("[chat] Routing to FastAPI backend");

    const endpoint = stream ? "/chat/stream" : "/chat/";

    const response = await proxyToFastAPI(endpoint, {
      method: "POST",
      body: {
        message,
        conversation_id: conversationId,
        tenant_id: tenantId,
        channel: "widget",
        stream: stream || false,
      },
      tenantId,
    });

    // For streaming, return the response directly
    if (stream && response.ok) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // For non-streaming, parse and return JSON
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const error = await response.text();
      return NextResponse.json(
        { error: "FastAPI error", detail: error },
        { status: response.status }
      );
    }
  }

  // Fallback: Use built-in Next.js agent (legacy mode)
  console.log("[chat] Using built-in Next.js agent (FastAPI unavailable)");

  // Import agent only when needed (lazy load)
  const { runAgent } = await import("@/lib/agent");

  let conversation_id: string;

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

  // Fetch tenant n8n config
  const { data: tenantConfig } = await (supabase.from("tenants") as any)
    .select("slug, n8n_enabled, n8n_webhook_url")
    .eq("id", tenantId)
    .single();

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

  // Run the agent with n8n metadata
  let reply: string;
  try {
    reply = await runAgent(tenantId, messages, {
      conversationId: conversation_id,
      channel: "widget",
      tenantSlug: tenantConfig?.slug,
      n8nEnabled: tenantConfig?.n8n_enabled ?? false,
      n8nWebhookUrl: tenantConfig?.n8n_webhook_url,
    });
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
