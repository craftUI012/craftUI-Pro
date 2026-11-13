import type { Metadata } from "next";

import { NewHomeBrowse } from "@/components/new-hero-section";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

// The browse page: browse sections, blocks, illustrations and isometric art.
export const metadata: Metadata = {
  ...createPageMetadata({
    description: SITE.DESCRIPTION.META,
    ogImage: SITE.OG_IMAGE,
    path: ROUTES.BROWSE,
    title: `Browse Components, Blocks & Art – ${SITE.NAME}`,
  }),
  title: { absolute: `Browse – ${SITE.NAME}` },
};

export const dynamic = "force-static";
export const revalidate = false;

const BrowsePage = () => (
  <>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", path: ROUTES.HOME },
        { name: "Browse", path: ROUTES.BROWSE },
      ]}
    />
    <NewHomeBrowse />
  </>
);

export default BrowsePage;
