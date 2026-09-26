export type PlanKind = "lifetime" | "yearly" | "template";

export interface Plan {
  kind: PlanKind;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  polarProductId: string | undefined;
  templateSlug?: string;
}

export interface TemplateProduct {
  slug: string;
  name: string;
  description: string;
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

export const TEMPLATES: TemplateProduct[] = [
  {
    description: "A polished marketing landing page built on CraftUI.",
    name: "Landing Starter",
    polarProductId: process.env.POLAR_TEMPLATE_LANDING_PRODUCT_ID,
    priceCents: 2000,
    slug: "landing-starter",
  },
  {
    description: "Full admin dashboard with charts, tables and settings.",
    name: "Dashboard Pro",
    polarProductId: process.env.POLAR_TEMPLATE_DASHBOARD_PRODUCT_ID,
    priceCents: 3000,
    slug: "dashboard-pro",
  },
  {
    description: "Portfolio template with case-study pages and blog.",
    name: "Portfolio",
    polarProductId: process.env.POLAR_TEMPLATE_PORTFOLIO_PRODUCT_ID,
    priceCents: 2500,
    slug: "portfolio",
  },
];

export const templateBySlug = (slug: string) =>
  TEMPLATES.find((template) => template.slug === slug);
