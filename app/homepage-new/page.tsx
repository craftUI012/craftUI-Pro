import type { Metadata } from "next";

import { NewHomeBrowse } from "@/components/new-hero-section";
import { ROUTES } from "@/constants/routes";
import { createPageMetadata } from "@/seo/metadata";

// Kept out of search until it replaces the home page.
export const metadata: Metadata = createPageMetadata({
  description:
    "Browse craftUI Pro components, blocks and templates, each shipped with its full design system.",
  noIndex: true,
  path: ROUTES.HOME_NEW,
  title: "Browse",
});

// Prerendered once at build and served from the CDN like a static file. The
// data sits in the Data Cache under HOME_CACHE_TAG. When the building JSON
// changes, `revalidateTag(HOME_CACHE_TAG)` or `revalidatePath(ROUTES.HOME_NEW)`
// rebuilds only this page, with no redeploy.
export const dynamic = "force-static";
export const revalidate = false;

export default function HomepageNew() {
  return <NewHomeBrowse />;
}
