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

  let { data: profile } = await (supabase.from("profiles") as any)
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  // Auto-create tenant + profile for existing users who signed up
  // before the handle_new_user trigger was installed.
  if (!profile) {
    const tenantName =
      user.user_metadata?.tenant_name ||
      user.user_metadata?.full_name ||
      (user.email ? user.email.split("@")[0] : "My Business");
    const baseSlug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const slug = `${baseSlug}-${randomSuffix}`;

    const { data: newTenant, error: tenantErr } = await (supabase
      .from("tenants") as any)
      .insert({ name: tenantName, slug })
      .select("id")
      .single();

    if (tenantErr || !newTenant) {
      return NextResponse.json(
        { error: "Failed to create tenant: " + tenantErr?.message },
        { status: 500 }
      );
    }

    const { error: profileErr } = await (supabase.from("profiles") as any)
      .insert({
        id: user.id,
        tenant_id: newTenant.id,
        role: "owner",
        full_name:
          user.user_metadata?.full_name ||
          (user.email ? user.email.split("@")[0] : "User"),
      });

    if (profileErr) {
      return NextResponse.json(
        { error: "Failed to create profile: " + profileErr.message },
        { status: 500 }
      );
    }

    profile = { tenant_id: newTenant.id, role: "owner" };
  }

  if (!profile?.tenant_id) {
    return NextResponse.json(
      { error: "No tenant associated with this account" },
      { status: 403 }
    );
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

  let { data: profile } = await (supabase.from("profiles") as any)
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  // Auto-create tenant + profile for existing users who signed up
  // before the handle_new_user trigger was installed.
  if (!profile) {
    const tenantName =
      user.user_metadata?.tenant_name ||
      user.user_metadata?.full_name ||
      (user.email ? user.email.split("@")[0] : "My Business");
    const baseSlug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const slug = `${baseSlug}-${randomSuffix}`;

    const { data: newTenant, error: tenantErr } = await (supabase
      .from("tenants") as any)
      .insert({ name: tenantName, slug })
      .select("id")
      .single();

    if (tenantErr || !newTenant) {
      return NextResponse.json(
        { error: "Failed to create tenant: " + tenantErr?.message },
        { status: 500 }
      );
    }

    const { error: profileErr } = await (supabase.from("profiles") as any)
      .insert({
        id: user.id,
        tenant_id: newTenant.id,
        role: "owner",
        full_name:
          user.user_metadata?.full_name ||
          (user.email ? user.email.split("@")[0] : "User"),
      });

    if (profileErr) {
      return NextResponse.json(
        { error: "Failed to create profile: " + profileErr.message },
        { status: 500 }
      );
    }

    profile = { tenant_id: newTenant.id };
  }

  if (!profile?.tenant_id) {
    return NextResponse.json(
      { error: "No tenant associated with this account" },
      { status: 403 }
    );
  }

  const { data, error } = await (supabase.from("tenants") as any)
    .select(
      "name, slug, logo_url, primary_color, widget_enabled, widget_greeting, widget_position"
    )
    .eq("id", profile.tenant_id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Tenant not found" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
