import {
  BookOpen01Icon,
  CommandLineIcon,
  InfinityIcon,
  PackageAddIcon,
  Refresh01Icon,
  Search01Icon,
  SourceCodeIcon,
  SparklesIcon,
  ViewIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import type { IconSvg } from "@/components/icon";
import { FAQ } from "@/constants/faq";
import type { PlanKind } from "@/lib/billing/plans";
import { LIFETIME_PLAN, YEARLY_PLAN } from "@/lib/billing/plans";

// Everything the pricing page (/pricing) shows, in one place: edit the copy,
// plans, features and icons here, and the page follows. Layout and styling
// are in components/pricing-plans.tsx (from the Figma "Pricing card03"
// frame, Design-System-01).
//
// Prices aren't typed here: paid plans read theirs from lib/billing/plans.ts
// (NEXT_PUBLIC_LIFETIME_PRICE_USD / NEXT_PUBLIC_YEARLY_PRICE_USD), so the
// page, checkout and analytics always agree. Icons are Hugeicons
// (@hugeicons/core-free-icons), drawn by components/icon.tsx at the site's
// icon size and stroke.

export interface PricingFeature {
  icon: IconSvg;
  text: string;
}

// What a plan's button does: open Dodo checkout for a paid plan, or go to a
// page (the free tier).
export type PricingAction =
  | { kind: "checkout"; plan: PlanKind }
  | { href: string; kind: "link" };

export interface PricingPlan {
  // Plan name and one line under it.
  name: string;
  tagline: string;
  // Price in cents (0 for free) and what follows it ("per year", "one time").
  priceCents: number;
  priceSuffix: string;
  // Optional line above the features, e.g. "Everything in Yearly, plus:".
  includes?: string;
  features: PricingFeature[];
  cta: { action: PricingAction; label: string };
  // The plan to steer people to: its button is the filled, primary one.
  highlighted?: boolean;
}

export const PRICING: {
  heading: string;
  subheading: string;
  // The pill under the subheading (a billing toggle in the Figma frame; we
  // have no monthly prices, so it's a note). Null hides it.
  pill: { chip: string; text: string } | null;
  plans: PricingPlan[];
  // Small print under the cards.
  footnote: string;
  // The FAQ under the cards: its heading, and the questions, which are the
  // shared list in constants/faq.ts (the about page shows the same). Null
  // hides the section.
  faq: { heading: string; items: typeof FAQ } | null;
} = {
  faq: { heading: "Frequently asked questions", items: FAQ },
  footnote:
    "Pay with your email at checkout, then sign in with the magic link we send to that address. Your plan unlocks as soon as you're in.",
  heading: "Pricing",
  pill: { chip: "Sign in after you pay", text: "No account needed" },
  plans: [
    {
      cta: { action: { href: "/", kind: "link" }, label: "Browse the library" },
      features: [
        { icon: ViewIcon, text: "Live preview of every item" },
        { icon: Search01Icon, text: "Search and filter the library" },
        { icon: BookOpen01Icon, text: "Docs for every item" },
      ],
      name: "Explore",
      priceCents: 0,
      priceSuffix: "forever",
      tagline: "See everything before you buy",
    },
    {
      cta: {
        action: { kind: "checkout", plan: "yearly" },
        label: "Subscribe yearly",
      },
      features: [
        { icon: SourceCodeIcon, text: "Full source of every item" },
        { icon: CommandLineIcon, text: "Install any item with one command" },
        { icon: SparklesIcon, text: "Copy for AI on every item" },
        { icon: Refresh01Icon, text: "New items while you're subscribed" },
      ],
      highlighted: true,
      includes: "Everything in Explore, plus:",
      name: YEARLY_PLAN.name,
      priceCents: YEARLY_PLAN.priceCents,
      priceSuffix: "per year",
      tagline: "Full access, renewed each year",
    },
    {
      cta: {
        action: { kind: "checkout", plan: "lifetime" },
        label: "Buy lifetime",
      },
      features: [
        { icon: InfinityIcon, text: "Access that never expires" },
        { icon: PackageAddIcon, text: "Every future item included" },
        { icon: Wallet01Icon, text: "No subscription to renew" },
      ],
      includes: "Everything in Yearly, plus:",
      name: LIFETIME_PLAN.name,
      priceCents: LIFETIME_PLAN.priceCents,
      priceSuffix: "once",
      tagline: "Pay once, keep everything",
    },
  ],
  subheading:
    "Preview every section, block and illustration for free. Pay yearly or once to get the code.",
};
