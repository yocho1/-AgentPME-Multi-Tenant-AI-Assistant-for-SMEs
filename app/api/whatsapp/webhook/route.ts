import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runAgent } from "@/lib/agent";

/**
 * GET /api/whatsapp/webhook
 * Meta WhatsApp verification challenge.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Receive incoming WhatsApp messages from Meta.
 */
export async function POST(request: Request) {
  const body = await request.json();

  // Extract message entry
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages;

  if (!messages || messages.length === 0) {
    return NextResponse.json({ status: "no_messages" });
  }

  const supabase = createServiceClient();

  for (const msg of messages) {
    if (msg.type !== "text") continue;

    const fromPhone = msg.from; // user's WhatsApp number
    const text = msg.text.body;
    const phoneNumberId = value.metadata?.phone_number_id;

    // Find tenant by WhatsApp phone number ID
    const { data: tenant } = await (supabase.from("tenants") as any)
      .select("id")
      .eq("whatsapp_phone_id", phoneNumberId)
      .single();

    if (!tenant) {
      console.warn("[whatsapp] No tenant for phone_number_id:", phoneNumberId);
      continue;
    }

    const tenantId = tenant.id;

    // Find or create conversation
    const { data: existingConv } = await (supabase.from("conversations") as any)
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("user_phone", fromPhone)
      .eq("channel", "whatsapp")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let conversationId: string;
    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await (supabase.from("conversations") as any)
        .insert({
          tenant_id: tenantId,
          channel: "whatsapp",
          status: "open",
          user_phone: fromPhone,
        })
        .select("id")
        .single();
      conversationId = newConv.id;
    }

    // Store user message
    await (supabase.from("messages") as any).insert({
      conversation_id: conversationId,
      role: "user",
      content: text,
    });

    // Only auto-respond if conversation is open (not escalated)
    if (existingConv?.status === "escalated") {
      continue;
    }

    // Fetch history and run agent
    const { data: history } = await (supabase.from("messages") as any)
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const chatMessages = (history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    let reply: string;
    try {
      reply = await runAgent(tenantId, chatMessages);
    } catch (err) {
      console.error("[whatsapp] agent failed:", err);
      reply = "Sorry, I'm having trouble right now. A human agent will assist you shortly.";
    }

    // Store assistant message
    await (supabase.from("messages") as any).insert({
      conversation_id: conversationId,
      role: "assistant",
      content: reply,
    });

    // Send reply back via WhatsApp (fire-and-forget)
    sendWhatsAppMessage(fromPhone, reply, phoneNumberId).catch(console.error);
  }

  return NextResponse.json({ status: "processed" });
}

async function sendWhatsAppMessage(
  to: string,
  text: string,
  phoneNumberId: string
) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return;

  await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );
}
