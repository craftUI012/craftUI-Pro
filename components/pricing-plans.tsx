import Link from "next/link";

import { CheckoutButton } from "@/components/checkout-button";
import { KitCard } from "@/components/design-admin/kit-card";
import { Icon } from "@/components/icon";
import { SaleCheckoutButton, SaleCoupon } from "@/components/pricing-sale";
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
import type { Sale, SaleInfo } from "@/lib/billing/sale";
import { getActiveSale, salePriceCents, toSaleInfo } from "@/lib/billing/sale";
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
//
// While a sale runs (lib/billing/sale.ts), a coupon with the code sits
// between the heading and the cards (components/pricing-sale.tsx), and the
// sale plan's card shows the old price struck through, the sale price,
// the saving, and a button that copies the code and opens checkout. The
// highlight moves to that plan for the sale.

// A sale's own price and saving for its card.
interface CardSale {
  info: SaleInfo;
  priceCents: number;
  savingCents: number;
}

const toCardSale = (sale: Sale): CardSale => {
  const priceCents = salePriceCents(sale);
  return {
    info: toSaleInfo(sale),
    priceCents,
    savingCents: sale.plan.priceCents - priceCents,
  };
};

const isSalePlan = (plan: PricingPlan, sale: CardSale | null) =>
  sale !== null &&
  plan.cta.action.kind === "checkout" &&
  plan.cta.action.plan === sale.info.plan;

const PlanButton = ({
  highlighted,
  plan,
  sale,
}: {
  highlighted: boolean;
  plan: PricingPlan;
  sale: CardSale | null;
}) => {
  const variant = highlighted ? "default" : "secondary";
  if (sale && isSalePlan(plan, sale)) {
    return (
      <SaleCheckoutButton
        sale={sale.info}
        salePriceCents={sale.priceCents}
        variant={variant}
      />
    );
  }
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
    <Button
      className="w-full"
      variant={variant}
      nativeButton={false}
      render={<Link href={plan.cta.action.href} />}
    >
      {plan.cta.label}
    </Button>
  );
};

const PriceRow = ({ plan }: { plan: PricingPlan }) => (
  <div className="flex items-baseline gap-1.5">
    <span className={cn(TYPE.cardMetricHero, "tabular-nums")}>
      {formatPrice(plan.priceCents)}
    </span>
    <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
      {plan.priceSuffix}
    </span>
  </div>
);

// The sale price, with the old one struck through.
const SalePriceRow = ({
  plan,
  sale,
}: {
  plan: PricingPlan;
  sale: CardSale;
}) => (
  <div className="flex flex-col">
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={cn(TYPE.cardMetricHero, "tabular-nums")}>
        {sale.info.salePriceLabel}
      </span>
      <s
        className={cn(
          TYPE.cardBody,
          "text-muted-foreground decoration-muted-foreground/60 tabular-nums"
        )}
      >
        <span className="sr-only">Was </span>
        {sale.info.priceLabel}
      </s>
      <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
        {plan.priceSuffix}
      </span>
    </div>
  </div>
);

const PlanCard = ({
  plan,
  sale,
}: {
  plan: PricingPlan;
  sale: CardSale | null;
}) => {
  const onSale = isSalePlan(plan, sale);
  // During a sale the sale plan is the one to steer people to.
  const highlighted = sale ? onSale : Boolean(plan.highlighted);
  return (
    <KitCard
      // Taller than their content from md up, as in the Figma frame: the
      // features breathe and the buttons line up at the bottom.
      // Every card gets the 1px (transparent) border that .card-highlight
      // needs, so the highlighted card's content doesn't sit 1px lower and
      // further in than its neighbours'.
      className={cn(
        "h-full border border-transparent md:min-h-120",
        highlighted && "card-highlight"
      )}
      contentClassName="flex flex-1 flex-col gap-4"
      title={plan.name}
      description={plan.tagline}
      // The saving, across from the plan's name: solid primary with white
      // text, so it reads on the card's wash in both themes. The wrapper
      // is one line of the title's type token tall (h-lh), so the badge is
      // centred on the title line at every breakpoint.
      action={
        sale && onSale ? (
          <span className={cn(TYPE.cardHeader, "flex h-lh items-center")}>
            <Badge className="tabular-nums">
              You save {formatPrice(sale.savingCents)}
            </Badge>
          </span>
        ) : undefined
      }
      footer={<PlanButton highlighted={highlighted} plan={plan} sale={sale} />}
    >
      {sale && onSale ? (
        <SalePriceRow plan={plan} sale={sale} />
      ) : (
        <PriceRow plan={plan} />
      )}

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
};

export const PricingPlans = () => {
  const active = getActiveSale();
  const sale = active ? toCardSale(active) : null;
  return (
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

      {sale && <SaleCoupon sale={sale.info} />}

      {/* #plans: the sale strip's "Get Lifetime" link lands here, below
          the sticky navbar. */}
      <div
        id="plans"
        className={cn(
          "grid w-full scroll-mt-24 gap-4",
          PRICING.plans.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
        )}
      >
        {PRICING.plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} sale={sale} />
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
          <Accordion multiple>
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
};
