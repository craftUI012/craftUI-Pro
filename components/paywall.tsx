import { Lock } from "lucide-react";
import Link from "next/link";

import { CheckoutButton } from "@/components/checkout-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { LIFETIME_PLAN, YEARLY_PLAN, formatPrice } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

// The plans, as compact cards with their own checkout buttons, so a locked
// item can be bought right where it's locked (the same buttons as /pricing).
const PLANS = [
  { label: "Subscribe yearly", per: "/year", plan: YEARLY_PLAN },
  { label: "Buy lifetime", per: " once", plan: LIFETIME_PLAN },
] as const;

export const Paywall = ({
  className,
  signedIn = false,
  title = "Payment required",
  description = "This content needs an active plan. Get lifetime or yearly all-access.",
}: {
  className?: string;
  // Signed in without access (e.g. a lapsed yearly plan): no sign-in link.
  signedIn?: boolean;
  title?: string;
  description?: string;
}) => (
  <Card className={cn("shadow-elevated gap-5 border-0 py-6", className)}>
    <CardHeader className="items-start gap-3">
      <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
        <Lock className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className={cn(TYPE.headingPanel, "text-foreground")}>{title}</p>
        <p
          className={cn(
            TYPE.cardDescription,
            "text-muted-foreground text-pretty"
          )}
        >
          {description}
        </p>
      </div>
    </CardHeader>
    <CardContent className="flex flex-col items-center gap-4">
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {PLANS.map(({ label, per, plan }) => (
          <div
            className="flex flex-col gap-3 rounded-lg border p-4"
            key={plan.kind}
          >
            <div className="flex flex-col gap-1">
              <p className={cn(TYPE.cardLabel, "text-muted-foreground")}>
                {plan.name}
              </p>
              <p className={cn(TYPE.cardMetric, "text-foreground")}>
                {formatPrice(plan.priceCents)}
                <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
                  {per}
                </span>
              </p>
              <p
                className={cn(
                  TYPE.cardCaption,
                  "text-muted-foreground text-pretty"
                )}
              >
                {plan.tagline}
              </p>
            </div>
            <CheckoutButton label={label} plan={plan.kind} />
          </div>
        ))}
      </div>
      {signedIn ? null : (
        <Link
          className={cn(
            TYPE.cardCaption,
            "text-muted-foreground hover:text-foreground underline underline-offset-4"
          )}
          href={ROUTES.LOGIN}
        >
          Already have access? Sign in
        </Link>
      )}
    </CardContent>
  </Card>
);
