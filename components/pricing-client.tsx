"use client";

import { CheckoutButton } from "@/components/checkout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LIFETIME_PLAN, YEARLY_PLAN, formatPrice } from "@/lib/billing/plans";

export const PricingClient = () => (
  <div className="space-y-8">
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{YEARLY_PLAN.name}</CardTitle>
          <CardDescription>{YEARLY_PLAN.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold">
            {formatPrice(YEARLY_PLAN.priceCents)}
            <span className="text-muted-foreground text-base font-normal">
              /year
            </span>
          </p>
          <CheckoutButton label="Subscribe yearly" plan="yearly" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{LIFETIME_PLAN.name}</CardTitle>
          <CardDescription>{LIFETIME_PLAN.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold">
            {formatPrice(LIFETIME_PLAN.priceCents)}
            <span className="text-muted-foreground text-base font-normal">
              {" "}
              once
            </span>
          </p>
          <CheckoutButton label="Buy lifetime" plan="lifetime" />
        </CardContent>
      </Card>
    </div>

    <p className="text-muted-foreground text-center text-sm">
      You&apos;ll enter your email at checkout, then sign in with a magic link
      using the same email to unlock everything.
    </p>
  </div>
);
