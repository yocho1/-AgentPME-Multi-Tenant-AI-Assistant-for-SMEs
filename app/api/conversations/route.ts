import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/conversations
 * List conversations for the current tenant.
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

  const { data, error } = await (supabase.from("conversations") as any)
    .select("id, channel, status, user_name, user_email, user_phone, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}
