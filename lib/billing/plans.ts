export type PlanKind = "lifetime" | "yearly";

export interface Plan {
  kind: PlanKind;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  polarProductId: string | undefined;
}

export const formatPrice = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

// Placeholder prices — change anytime. Wire real Polar product IDs via env.
export const LIFETIME_PLAN: Plan = {
  kind: "lifetime",
  name: "Lifetime",
  polarProductId: process.env.POLAR_LIFETIME_PRODUCT_ID,
  priceCents: 24_900,
  slug: "lifetime",
  tagline: "Every component and every template, forever.",
};

export const YEARLY_PLAN: Plan = {
  kind: "yearly",
  name: "Yearly",
  polarProductId: process.env.POLAR_YEARLY_PRODUCT_ID,
  priceCents: 9900,
  slug: "yearly",
  tagline: "Every component and every template while subscribed.",
};
