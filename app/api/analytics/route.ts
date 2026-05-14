import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics
 * Return conversation and messaging analytics for the current tenant.
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

  const tenantId = profile.tenant_id;

  // Conversation counts by status
  const { data: statusCounts, error: statusErr } = await (supabase
    .from("conversations") as any)
    .select("status")
    .eq("tenant_id", tenantId);

  if (statusErr) {
    return NextResponse.json({ error: statusErr.message }, { status: 500 });
  }

  const total = statusCounts?.length ?? 0;
  const open = statusCounts?.filter((c: { status: string }) => c.status === "open").length ?? 0;
  const closed = statusCounts?.filter((c: { status: string }) => c.status === "closed").length ?? 0;
  const escalated = statusCounts?.filter((c: { status: string }) => c.status === "escalated").length ?? 0;

  // Conversations by channel
  const { data: channelCounts, error: channelErr } = await (supabase
    .from("conversations") as any)
    .select("channel")
    .eq("tenant_id", tenantId);

  if (channelErr) {
    return NextResponse.json({ error: channelErr.message }, { status: 500 });
  }

  const widget = channelCounts?.filter((c: { channel: string }) => c.channel === "widget").length ?? 0;
  const whatsapp = channelCounts?.filter((c: { channel: string }) => c.channel === "whatsapp").length ?? 0;

  // Recent conversations (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentConvs, error: recentErr } = await (supabase
    .from("conversations") as any)
    .select("id, channel, status, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  if (recentErr) {
    return NextResponse.json({ error: recentErr.message }, { status: 500 });
  }

  // Total messages
  const { data: msgCount, error: msgErr } = await (supabase
    .from("messages") as any)
    .select("id, conversation_id!inner(tenant_id)", { count: "exact", head: true })
    .eq("conversation_id.tenant_id", tenantId);

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Top user queries (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: topQueries, error: queryErr } = await (supabase
    .from("messages") as any)
    .select("content, conversation_id!inner(channel)")
    .eq("role", "user")
    .eq("conversation_id.tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  return NextResponse.json({
    totalConversations: total,
    openConversations: open,
    closedConversations: closed,
    escalatedConversations: escalated,
    widgetConversations: widget,
    whatsappConversations: whatsapp,
    totalMessages: msgCount?.length ?? 0,
    recentConversations: recentConvs ?? [],
    topQueries: (topQueries ?? []).map((q: { content: string; conversation_id: { channel: string } }) => ({
      query: q.content,
      channel: q.conversation_id.channel,
    })),
  });
}
