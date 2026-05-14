import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  proxyToFastAPI,
  checkFastAPIHealth,
} from "@/lib/fastapi-proxy";

/**
 * POST /api/chat
 * Process a chat message using the RAG agent.
 *
 * Routes to FastAPI backend. Requires FastAPI to be running.
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
  const fastapiHealthy = await checkFastAPIHealth();

  if (!fastapiHealthy.healthy) {
    return NextResponse.json(
      { error: "AI service unavailable. Please ensure FastAPI backend is running." },
      { status: 503 }
    );
  }

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
      { error: "AI service error", detail: error },
      { status: response.status }
    );
  }
}
