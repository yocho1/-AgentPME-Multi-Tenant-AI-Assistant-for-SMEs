import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PLANS, type PlanTier } from "@/lib/stripe";

/**
 * POST /api/billing/checkout
 * Create a Stripe checkout session for subscription.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await (supabase.from("profiles") as any)
    .select("tenant_id, stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const body = await request.json();
  const { tier } = body as { tier: PlanTier };

  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan || !plan.priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Get or create Stripe customer
  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const { data: tenant } = await (supabase.from("tenants") as any)
      .select("name")
      .eq("id", profile.tenant_id)
      .single();

    const customer = await stripe.customers.create({
      email: user.email,
      name: tenant?.name || "AgentPME Customer",
      metadata: {
        tenant_id: profile.tenant_id,
        user_id: user.id,
      },
    });
    customerId = customer.id;

    await (supabase.from("profiles") as any)
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?canceled=true`,
    metadata: {
      tenant_id: profile.tenant_id,
      user_id: user.id,
      tier,
    },
    subscription_data: {
      metadata: {
        tenant_id: profile.tenant_id,
        tier,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
