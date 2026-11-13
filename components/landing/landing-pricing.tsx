import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

import { CheckoutButton } from "@/components/checkout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRICING } from "@/constants/pricing";
import { formatPrice } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const LandingPricing = () => (
  <section id="pricing" className="relative py-20 md:py-28">
    <div className="container mx-auto px-4">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <Badge
          variant="outline"
          className="mb-3 rounded-full px-3 py-1 text-xs"
        >
          Pricing
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Preview everything for free. Upgrade to unlock full source code, 3D
          isometric scenes, and all future updates.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="mt-14 mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {PRICING.plans.map((plan) => {
          const isHighlighted = plan.highlighted;
          const price = formatPrice(plan.priceCents);

          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col justify-between rounded-3xl border bg-card p-8 shadow-sm transition hover:shadow-lg",
                isHighlighted
                  ? "border-primary shadow-primary/10 ring-1 ring-primary"
                  : "border-border/80"
              )}
            >
              {isHighlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs">
                    <Sparkles className="size-3" /> Most Popular
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  {plan.name}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground min-h-[2.5rem]">
                  {plan.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {price}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {plan.priceSuffix}
                  </span>
                </div>

                <div className="mt-8 border-t border-border/60 pt-6">
                  {plan.includes && (
                    <p className="mb-4 text-xs font-semibold text-foreground">
                      {plan.includes}
                    </p>
                  )}
                  <ul className="space-y-3 text-xs text-muted-foreground">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Check className="size-4 shrink-0 text-primary mt-0.5" />
                        <span>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border/50">
                {plan.cta.action.kind === "checkout" ? (
                  <CheckoutButton
                    label={plan.cta.label}
                    plan={plan.cta.action.plan}
                    variant={isHighlighted ? "default" : "secondary"}
                    className="w-full rounded-full"
                  />
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-full"
                  >
                    <Link href={plan.cta.action.href}>{plan.cta.label}</Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footnote */}
      <p className="mt-10 text-center text-xs text-muted-foreground">
        {PRICING.footnote}
      </p>
    </div>
  </section>
);
