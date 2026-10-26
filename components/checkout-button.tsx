"use client";

import { posthog } from "posthog-js";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LIFETIME_PLAN, YEARLY_PLAN } from "@/lib/billing/plans";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

const PLAN_PRICE_CENTS = {
  lifetime: LIFETIME_PLAN.priceCents,
  yearly: YEARLY_PLAN.priceCents,
};

interface CheckoutButtonProps {
  plan: "lifetime" | "yearly";
  label: string;
  // Extra classes, size and style, for pages with their own layout (the
  // pricing page's large buttons). Defaults: the standard filled button.
  className?: string;
  size?: "default" | "lg";
  variant?: "default" | "secondary";
}

export const CheckoutButton = ({
  className,
  label,
  plan,
  size = "default",
  variant = "default",
}: CheckoutButtonProps) => {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  const handleClick = async () => {
    setState("loading");
    setFailure(null);
    // The price with the plan: prices change, and reports need the one the
    // visitor actually saw.
    trackEvent({
      name: "checkout_started",
      properties: { plan, price_cents: PLAN_PRICE_CENTS[plan] },
    });
    try {
      const response = await fetch("/api/checkout", {
        // The PostHog ID lets the purchase (recorded by the payment
        // webhook) join this visitor's journey in the funnel.
        body: JSON.stringify({
          distinctId: posthog.get_distinct_id?.() || undefined,
          plan,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout failed.");
      }
      window.location.href = data.url;
    } catch (error) {
      setState("error");
      setFailure(error instanceof Error ? error.message : "Checkout failed.");
    }
  };

  return (
    <div className="space-y-2">
      <Button
        className={cn("w-full", className)}
        size={size}
        variant={variant}
        disabled={state === "loading"}
        onClick={handleClick}
      >
        {state === "loading" ? "Redirecting…" : label}
      </Button>
      {state === "error" && failure ? (
        <p className="text-sm text-red-600">{failure}</p>
      ) : null}
    </div>
  );
};
