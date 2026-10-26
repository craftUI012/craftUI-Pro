import Link from "next/link";

import { CheckoutButton } from "@/components/checkout-button";
import { KitCard } from "@/components/design-admin/kit-card";
import { Icon } from "@/components/icon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRICING } from "@/constants/pricing";
import type { PricingPlan } from "@/constants/pricing";
import { TYPE } from "@/constants/typography";
import { formatPrice } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

// The pricing page's content, after the Figma "Pricing card03" frame
// (Design-System-01, node 164:2), built from the design system on
// /design-admin: each plan is a KitCard (the shadcn Card shell the kit
// uses) with the kit's type roles, Badge, Button and Accordion. A centred
// heading with a badge under it, one card per plan (name and tagline in
// the card header, the price as a metric, features with icons, the button
// in the footer), the small print, then the FAQ under a heading like the
// page's, as wide as the cards.
//
// The highlighted plan's card adds a primary-colour wash from its top-left
// corner and a primary edge that is brightest there (.card-highlight in
// globals.css). The content is constants/pricing.ts. Cards stack on phones
// and sit side by side from md up.

const PlanButton = ({ plan }: { plan: PricingPlan }) => {
  const variant = plan.highlighted ? "default" : "secondary";
  if (plan.cta.action.kind === "checkout") {
    return (
      <div className="w-full">
        <CheckoutButton
          label={plan.cta.label}
          plan={plan.cta.action.plan}
          variant={variant}
        />
      </div>
    );
  }
  return (
    <Button asChild className="w-full" variant={variant}>
      <Link href={plan.cta.action.href}>{plan.cta.label}</Link>
    </Button>
  );
};

const PlanCard = ({ plan }: { plan: PricingPlan }) => (
  <KitCard
    // Taller than their content from md up, as in the Figma frame: the
    // features breathe and the buttons line up at the bottom.
    className={cn("h-full md:min-h-120", plan.highlighted && "card-highlight")}
    contentClassName="flex flex-1 flex-col gap-4"
    title={plan.name}
    description={plan.tagline}
    footer={<PlanButton plan={plan} />}
  >
    <div className="flex items-baseline gap-1.5">
      <span className={cn(TYPE.cardMetricHero, "tabular-nums")}>
        {formatPrice(plan.priceCents)}
      </span>
      <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
        {plan.priceSuffix}
      </span>
    </div>

    <div className="flex flex-col gap-2.5">
      {plan.includes && (
        <p className={cn(TYPE.cardCaption, "text-muted-foreground")}>
          {plan.includes}
        </p>
      )}
      <ul className="flex flex-col gap-2.5">
        {plan.features.map(({ icon, text }) => (
          <li
            key={text}
            className={cn(TYPE.cardBody, "flex items-center gap-2.5")}
          >
            <Icon icon={icon} className="text-muted-foreground" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  </KitCard>
);

export const PricingPlans = () => (
  <div className="flex flex-col items-center gap-12">
    <header className="flex flex-col items-center gap-4 text-center">
      <h1 className={cn(TYPE.headingHero, "tracking-tight")}>
        {PRICING.heading}
      </h1>
      <p
        className={cn(
          TYPE.pageLead,
          "text-muted-foreground max-w-xl text-pretty"
        )}
      >
        {PRICING.subheading}
      </p>
      {/* The badge: the highlighted card's primary edge (.card-highlight),
          and 1px more padding on the right, the side without the dot, so it
          looks even. */}
      {PRICING.pill && (
        <Badge
          variant="secondary"
          className="card-highlight gap-1.5 py-1 pr-2.75 pl-2.5"
        >
          <span aria-hidden className="bg-primary size-1.5 rounded-full" />
          {PRICING.pill.text}
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground">{PRICING.pill.chip}</span>
        </Badge>
      )}
    </header>

    <div
      className={cn(
        "grid w-full gap-4",
        PRICING.plans.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
      )}
    >
      {PRICING.plans.map((plan) => (
        <PlanCard key={plan.name} plan={plan} />
      ))}
    </div>

    <p
      className={cn(
        TYPE.cardBody,
        "text-muted-foreground max-w-2xl text-center text-pretty"
      )}
    >
      {PRICING.footnote}
    </p>

    {PRICING.faq && (
      <section
        aria-labelledby="pricing-faq"
        className="flex w-full flex-col gap-8"
      >
        <h2
          id="pricing-faq"
          className={cn(TYPE.headingHero, "text-center tracking-tight")}
        >
          {PRICING.faq.heading}
        </h2>
        <Accordion type="multiple">
          {PRICING.faq.items.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-pretty">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    )}
  </div>
);
