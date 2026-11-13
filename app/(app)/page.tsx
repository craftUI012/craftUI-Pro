import type { Metadata } from "next";

import {
  CraftHero,
  LandingComponents,
  LandingFaq,
  LandingHowToUse,
  LandingPricing,
} from "@/components/landing";
import { getHomeData } from "@/components/new-hero-section";
import type { ShowcaseItem } from "@/components/new-hero-section/data/home-types";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = {
  ...createPageMetadata({
    description: SITE.DESCRIPTION.META,
    ogImage: SITE.OG_IMAGE,
    path: ROUTES.HOME,
    title: `${SITE.NAME} – ${SITE.TAGLINE}`,
  }),
  title: { absolute: `${SITE.NAME} – ${SITE.TAGLINE}` },
};

export const dynamic = "force-static";
export const revalidate = false;

const HomePage = async () => {
  const data = await getHomeData();

  // Group items by category for the showcase section
  const categories: Record<string, ShowcaseItem[]> = {
    blocks: data.libraries.find((l) => l.id === "blocks")?.items ?? [],
    components: data.libraries.find((l) => l.id === "components")?.items ?? [],
    illustrations: [
      ...(data.libraries.find((l) => l.id === "isometric")?.items ?? []),
      ...(data.libraries.find((l) => l.id === "illustrations")?.items ?? []),
    ],
    sections: data.libraries.find((l) => l.id === "templates")?.items ?? [],
  };

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: ROUTES.HOME }]} />
      <div className="flex flex-1 flex-col">
        {/* 1. Hero Section */}
        <CraftHero />

        {/* 2. Components Section (Sections, Components, Illustrations, Blocks) */}
        <LandingComponents categories={categories} />

        {/* 3. How to Use It Section */}
        <LandingHowToUse />

        {/* 4. Pricing Section */}
        <LandingPricing />

        {/* 5. FAQ Section */}
        <LandingFaq />
      </div>
    </>
  );
};

export default HomePage;
