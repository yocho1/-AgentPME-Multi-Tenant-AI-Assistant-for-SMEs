import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events for subscription lifecycle.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err: any) {
    console.error("[stripe webhook] signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id;
      const tier = session.metadata?.tier;

      if (tenantId && tier) {
        await (supabase.from("tenants") as any)
          .update({
            subscription_status: "active",
            stripe_subscription_id: session.subscription as string,
            subscription_tier: tier,
          })
          .eq("id", tenantId);
        console.log("[stripe webhook] subscription activated for tenant:", tenantId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        await (supabase.from("tenants") as any)
          .update({ subscription_status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId);
        console.log("[stripe webhook] payment failed for subscription:", subscriptionId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      const tenantId = subscription.metadata?.tenant_id;

      if (tenantId) {
        const periodEnd = Number(subscription.current_period_end) * 1000;
        await (supabase.from("tenants") as any)
          .update({
            subscription_status: "canceled",
            subscription_expires_at: new Date(periodEnd).toISOString(),
          })
          .eq("id", tenantId);
        console.log("[stripe webhook] subscription canceled for tenant:", tenantId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as any;
      const tenantId = subscription.metadata?.tenant_id;
      const status = subscription.status;

      if (tenantId) {
        const mappedStatus =
          status === "active" ? "active" :
          status === "past_due" ? "past_due" :
          status === "canceled" ? "canceled" :
          status === "trialing" ? "trialing" : "active";

        const periodEnd = Number(subscription.current_period_end) * 1000;
        await (supabase.from("tenants") as any)
          .update({
            subscription_status: mappedStatus,
            subscription_expires_at: new Date(periodEnd).toISOString(),
          })
          .eq("id", tenantId);
        console.log("[stripe webhook] subscription updated for tenant:", tenantId, "status:", mappedStatus);
      }
      break;
    }

    default:
      console.log("[stripe webhook] unhandled event:", event.type);
  }

  return NextResponse.json({ received: true });
}
