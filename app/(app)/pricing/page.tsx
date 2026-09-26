import type { Metadata } from "next";
import { headers } from "next/headers";

import { PageTransition } from "@/components/page-transition";
import { PricingClient } from "@/components/pricing-client";
import { ROUTES } from "@/constants/routes";
import { auth } from "@/lib/auth";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  description:
    "Lifetime all-access, yearly all-access, or single templates. Pick the plan that fits.",
  path: ROUTES.PRICING,
  title: "Pricing",
});

const PricingPage = async () => {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  return (
    <PageTransition>
      <section className="container-wrapper">
        <div className="container flex max-w-4xl flex-col items-center gap-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple pricing
          </h1>
          <p className="text-muted-foreground max-w-xl text-base">
            Pay first, then sign in. Lifetime and yearly include every component
            and every template. Or buy a single template on its own — nothing
            else.
          </p>
        </div>
      </section>

      <section className="container-wrapper">
        <div className="container max-w-4xl pb-16">
          <PricingClient prefilledEmail={session?.user.email ?? ""} />
        </div>
      </section>
    </PageTransition>
  );
};

export default PricingPage;
