import type { Metadata } from "next";

import { PricingPlans } from "@/components/pricing-plans";
import { ROUTES } from "@/constants/routes";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  description:
    "Preview every craftUI item for free. Get the code with a yearly plan or pay once for lifetime access.",
  path: ROUTES.PRICING,
  title: "Pricing",
});

// No page transition: the pricing page and the links to it (navbar, CTAs)
// open in place, without the sideways slide. The content is
// constants/pricing.ts; the layout is components/pricing-plans.tsx.
const PricingPage = () => (
  <section className="container-wrapper">
    <div className="container max-w-5xl px-4 pt-16 pb-12 md:pt-20">
      <PricingPlans />
    </div>
  </section>
);

export default PricingPage;
