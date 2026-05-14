"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { PLANS, type PlanTier } from "@/lib/stripe";

interface Subscription {
  status: string;
  tier: string | null;
  expires_at: string | null;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<PlanTier | null>(null);

  useEffect(() => {
    fetch("/api/tenant/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.tenant) {
          setSubscription({
            status: data.tenant.subscription_status,
            tier: data.tenant.subscription_tier,
            expires_at: data.tenant.subscription_expires_at,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function subscribe(tier: PlanTier) {
    setCheckingOut(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setCheckingOut(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const currentTier = subscription?.tier;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage your subscription and upgrade your plan.
        </p>
      </div>

      {subscription && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h3 className="text-sm font-medium">Current Plan</h3>
          <div className="mt-2 flex items-center gap-3">
            <Zap className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-semibold capitalize">
                {currentTier || "Free Trial"}
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Status: {subscription.status}
                {subscription.expires_at &&
                  ` · Expires ${new Date(subscription.expires_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          return (
            <div
              key={plan.tier}
              className={`rounded-xl border p-6 transition-shadow hover:shadow-md ${
                isCurrent
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] bg-[var(--color-card)]"
              }`}
            >
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {plan.description}
              </p>
              <div className="mt-4">
                <span className="text-3xl font-bold">${plan.priceMonthly}</span>
                <span className="text-sm text-[var(--color-muted-foreground)]">/mo</span>
              </div>

              <ul className="mt-4 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribe(plan.tier)}
                disabled={checkingOut === plan.tier || isCurrent}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "cursor-default bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                    : "bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                }`}
              >
                {checkingOut === plan.tier ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  "Current Plan"
                ) : (
                  "Subscribe"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
