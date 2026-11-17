"use client";

import { posthog } from "posthog-js";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LIFETIME_PLAN, YEARLY_PLAN } from "@/lib/billing/plans";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

const PLAN_PRICE_CENTS = {
  lifetime: LIFETIME_PLAN.priceCents,
  yearly: YEARLY_PLAN.priceCents,
};

// Past this, stop waiting and let the buyer try again (the server gives up
// on Dodo at about 30s: 15s and one retry).
const CHECKOUT_TIMEOUT_MS = 25_000;

// The server's checkout route (app/api/checkout).
const CHECKOUT_URL = "/api/checkout";

let warmed = false;
const warmCheckout = async () => {
  if (warmed) {
    return;
  }
  warmed = true;
  try {
    await fetch(CHECKOUT_URL, { method: "GET" });
  } catch {
    // Only a warm-up: the click still works without it.
  }
};

interface CheckoutButtonProps {
  plan: "lifetime" | "yearly";
  label: string;
  // Extra classes, size and style, for pages with their own layout (the
  // pricing page's large buttons). Defaults: the standard filled button.
  className?: string;
  size?: "default" | "lg";
  variant?: "default" | "secondary";
  // The price the visitor saw, when it isn't the plan's own (a sale).
  priceCents?: number;
}

export const CheckoutButton = ({
  className,
  label,
  plan,
  priceCents,
  size = "default",
  variant = "default",
}: CheckoutButtonProps) => {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  // Coming back from Dodo with the Back button can restore this page from
  // the browser's back-forward cache exactly as it was left: "Redirecting…"
  // and disabled, so the buyer couldn't try again. Reset it when that
  // happens.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setState("idle");
        setFailure(null);
      }
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // Warm the checkout function while the buyer reads the plans, so the
  // click doesn't wait for a cold start. Once per page, however many
  // buttons it has; fire and forget.
  useEffect(() => {
    warmCheckout();
  }, []);

  const handleClick = async () => {
    setState("loading");
    setFailure(null);
    // The price with the plan: prices change, and reports need the one the
    // visitor actually saw.
    trackEvent({
      name: "checkout_started",
      properties: {
        plan,
        price_cents: priceCents ?? PLAN_PRICE_CENTS[plan],
      },
    });
    try {
      const response = await fetch(CHECKOUT_URL, {
        // The PostHog ID lets the purchase (recorded by the payment
        // webhook) join this visitor's journey in the funnel.
        body: JSON.stringify({
          distinctId: posthog.get_distinct_id?.() || undefined,
          plan,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(CHECKOUT_TIMEOUT_MS),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout failed.");
      }
      window.location.href = data.url;
    } catch (error) {
      setState("error");
      if (error instanceof DOMException && error.name === "TimeoutError") {
        setFailure("Checkout is taking too long. Please try again.");
        return;
      }
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
