export type PlanKind = "lifetime" | "yearly";

// What a purchase row can be: an all-access plan, or one item (a template,
// later) identified by its product code.
export type PurchaseKind = PlanKind | "item";

export interface Plan {
  kind: PlanKind;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  // The plan's product in Dodo Payments (test or live mode, matching the API
  // key). Undefined in the browser: server-only env.
  dodoProductId: string | undefined;
}

export const formatPrice = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

// The prices shown on the site, from NEXT_PUBLIC_LIFETIME_PRICE_USD and
// NEXT_PUBLIC_YEARLY_PRICE_USD (whole dollars, e.g. "249", or "129.99").
// They're display only: Dodo charges its product's own price, so change both
// together. NEXT_PUBLIC_ values are built into the page, so a change needs a
// restart locally and a redeploy on Vercel. Unset or not a positive number:
// the fallback below.
const priceCentsFrom = (value: string | undefined, fallbackCents: number) => {
  const dollars = Number(value);
  return value && Number.isFinite(dollars) && dollars > 0
    ? Math.round(dollars * 100)
    : fallbackCents;
};

export const LIFETIME_PLAN: Plan = {
  dodoProductId: process.env.DODO_LIFETIME_PRODUCT_ID,
  kind: "lifetime",
  name: "Lifetime",
  // Read by name (not process.env[key]) so Next.js can inline it.
  priceCents: priceCentsFrom(
    process.env.NEXT_PUBLIC_LIFETIME_PRICE_USD,
    24_900
  ),
  slug: "lifetime",
  tagline: "Every component and every template, forever.",
};

export const YEARLY_PLAN: Plan = {
  dodoProductId: process.env.DODO_YEARLY_PRODUCT_ID,
  kind: "yearly",
  name: "Yearly",
  priceCents: priceCentsFrom(process.env.NEXT_PUBLIC_YEARLY_PRICE_USD, 12_900),
  slug: "yearly",
  tagline: "Every component and every template while subscribed.",
};
