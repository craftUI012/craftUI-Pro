import type { Metadata } from "next";

import { NewHomeBrowse } from "@/components/new-hero-section";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

// The home page: browse sections, blocks, illustrations and isometric art.
// Its title is the site's default ("craftUI Pro – …"), so it's set as
// `absolute` here to skip the "%s | craftUI Pro" template.
//
// Prerendered once at build and served from the CDN like a static file. The
// data sits in the Data Cache under HOME_CACHE_TAG. When the registry
// changes, `revalidateTag(HOME_CACHE_TAG)` or `revalidatePath(ROUTES.HOME)`
// rebuilds only this page, with no redeploy.
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

export default function HomePage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: ROUTES.HOME }]} />
      <NewHomeBrowse />
    </>
  );
}
