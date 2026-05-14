import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/tenant/settings
 * Update widget and branding settings for the current tenant.
 */
export async function PATCH(request: Request) {
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

  if (!["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { widget_enabled, widget_greeting, widget_position, primary_color } =
    body;

  const update: Record<string, unknown> = {};
  if (typeof widget_enabled === "boolean") update.widget_enabled = widget_enabled;
  if (typeof widget_greeting === "string") update.widget_greeting = widget_greeting;
  if (widget_position === "bottom-right" || widget_position === "bottom-left")
    update.widget_position = widget_position;
  if (typeof primary_color === "string") update.primary_color = primary_color;

  const { error } = await (supabase.from("tenants") as any)
    .update(update)
    .eq("id", profile.tenant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * GET /api/tenant/settings
 * Get current tenant settings.
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

  const { data, error } = await (supabase.from("tenants") as any)
    .select(
      "name, slug, logo_url, primary_color, widget_enabled, widget_greeting, widget_position"
    )
    .eq("id", profile.tenant_id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Not found" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
