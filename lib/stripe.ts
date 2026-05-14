import Stripe from "stripe";

/**
 * Lazy Stripe client — only instantiated server-side where env vars are available.
 */
export function getStripe(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("Stripe client is server-only");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-04-22.dahlia",
  });
}

export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "",
};

export type PlanTier = "starter" | "pro" | "enterprise";

export interface Plan {
  tier: PlanTier;
  name: string;
  description: string;
  priceMonthly: number;
  features: string[];
  priceId: string;
}

export const PLANS: Plan[] = [
  {
    tier: "starter",
    name: "Starter",
    description: "Perfect for small businesses getting started",
    priceMonthly: 29,
    features: [
      "1,000 conversations/month",
      "Web widget",
      "Knowledge base (50 docs)",
      "Email support",
    ],
    priceId: STRIPE_PRICE_IDS.starter,
  },
  {
    tier: "pro",
    name: "Pro",
    description: "For growing businesses with more customers",
    priceMonthly: 79,
    features: [
      "10,000 conversations/month",
      "Web widget + WhatsApp",
      "Knowledge base (500 docs)",
      "Priority support",
      "Analytics dashboard",
      "Multi-language",
    ],
    priceId: STRIPE_PRICE_IDS.pro,
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    description: "For large teams with custom needs",
    priceMonthly: 199,
    features: [
      "Unlimited conversations",
      "All channels (widget, WhatsApp, more)",
      "Unlimited knowledge base",
      "24/7 dedicated support",
      "Custom integrations",
      "SSO & team management",
    ],
    priceId: STRIPE_PRICE_IDS.enterprise,
  },
];
