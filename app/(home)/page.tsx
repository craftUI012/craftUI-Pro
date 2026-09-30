import { NewHomeBrowse } from "@/components/new-hero-section";
import { ROUTES } from "@/constants/routes";
import { BreadcrumbJsonLd } from "@/seo/json-ld";

// The home page: browse components, blocks and sections. Metadata comes from
// the root layout's site defaults, as the previous home page's did.
//
// Prerendered once at build and served from the CDN like a static file. The
// data sits in the Data Cache under HOME_CACHE_TAG. When the registry
// changes, `revalidateTag(HOME_CACHE_TAG)` or `revalidatePath(ROUTES.HOME)`
// rebuilds only this page, with no redeploy.
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
