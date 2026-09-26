"use client";

import { useState } from "react";

import { CheckoutButton } from "@/components/checkout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  LIFETIME_PLAN,
  TEMPLATES,
  YEARLY_PLAN,
  formatPrice,
} from "@/lib/billing/plans";

interface PricingClientProps {
  prefilledEmail?: string;
}

export const PricingClient = ({ prefilledEmail = "" }: PricingClientProps) => {
  const [email, setEmail] = useState(prefilledEmail);

  return (
    <div className="space-y-8">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Where do we send access?</CardTitle>
          <CardDescription>
            Pay with your email first, then sign in with a magic link using the
            same email to unlock everything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </CardContent>
      </Card>

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
            <CheckoutButton
              email={email}
              label="Subscribe yearly"
              plan="yearly"
            />
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
            <CheckoutButton
              email={email}
              label="Buy lifetime"
              plan="lifetime"
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="pb-4 text-xl font-bold">Single templates</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {TEMPLATES.map((template) => (
            <Card key={template.slug}>
              <CardHeader>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-bold">
                  {formatPrice(template.priceCents)}
                </p>
                <CheckoutButton
                  email={email}
                  label={`Buy ${template.name}`}
                  plan="template"
                  templateSlug={template.slug}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
