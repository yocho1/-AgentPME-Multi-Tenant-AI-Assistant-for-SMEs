import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/widget/config/:tenantSlug
 * Public endpoint: returns widget configuration for embedding.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const supabase = await createClient();
  const { tenantSlug } = await params;

  const { data: tenant, error } = await (supabase.from("tenants") as any)
    .select(
      "id, name, slug, logo_url, primary_color, widget_enabled, widget_greeting, widget_position"
    )
    .eq("slug", tenantSlug)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (!tenant.widget_enabled) {
    return NextResponse.json(
      { error: "Widget disabled" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    tenantId: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoUrl: tenant.logo_url,
    primaryColor: tenant.primary_color || "#0f172a",
    greeting: tenant.widget_greeting || "Hello! How can I help you today?",
    position: tenant.widget_position || "bottom-right",
  });
}
