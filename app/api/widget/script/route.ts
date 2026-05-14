import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/widget/script?tenant=:slug
 * Returns a JavaScript snippet that embeds the AgentPME widget on any website.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenant");

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "Missing tenant slug" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: tenant } = await (supabase.from("tenants") as any)
    .select("widget_enabled, widget_position")
    .eq("slug", tenantSlug)
    .single();

  if (!tenant || !tenant.widget_enabled) {
    return new NextResponse(
      "// AgentPME widget is disabled for this tenant.",
      {
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${new URL(request.url).protocol}//${new URL(request.url).host}`;

  const position = tenant.widget_position || "bottom-right";

  const script = `(function () {
  var slug = "${tenantSlug}";
  var base = "${baseUrl}";
  var pos = "${position}";

  if (document.getElementById("agentpme-widget-" + slug)) return;

  var container = document.createElement("div");
  container.id = "agentpme-widget-" + slug;
  container.style.cssText =
    "position:fixed;bottom:0;" + (pos === "bottom-left" ? "left:0;" : "right:0;") +
    "width:420px;height:480px;border:none;z-index:9999;overflow:hidden;pointer-events:none;";

  var iframe = document.createElement("iframe");
  iframe.src = base + "/widget/" + slug;
  iframe.style.cssText =
    "width:100%;height:100%;border:none;background:transparent;pointer-events:auto;";
  iframe.allow = "clipboard-read; clipboard-write";

  container.appendChild(iframe);
  document.body.appendChild(container);
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
