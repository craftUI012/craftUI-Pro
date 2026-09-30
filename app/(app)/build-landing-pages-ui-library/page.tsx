import { BlocksSection } from "@/components/hero-blocks";
import { FeaturesSection } from "@/components/hero-features";
import { HeroSection } from "@/components/hero-section";
import { TemplatesSection } from "@/components/hero-templates";
import { UIComponentsSection } from "@/components/hero-UI-components";
import { PageTransition } from "@/components/page-transition";
import { ROUTES } from "@/constants/routes";
import { YourComponent } from "@/registry/new-york/your-component";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

// The previous home page (hero, templates, features, blocks, components),
// moved here when the browse page took over /.
export const metadata = createPageMetadata({
  description:
    "Build landing pages with craftUI Pro: templates, sections, blocks and components, each shipped with its full design system.",
  path: ROUTES.BUILD_LANDING_PAGES,
  title: "Build landing pages",
});

export const dynamic = "force-static";
export const revalidate = false;

export default function BuildLandingPagesPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: ROUTES.HOME },
          { name: "Build landing pages", path: ROUTES.BUILD_LANDING_PAGES },
        ]}
      />
      <PageTransition>
        <HeroSection />
        <TemplatesSection />
        <FeaturesSection />
        <BlocksSection />
        <UIComponentsSection />

        <section className="container-wrapper pb-8 lg:pb-12">
          <div className="container flex flex-col items-center gap-6">
            <YourComponent className="w-full max-w-md" />
          </div>
        </section>
      </PageTransition>
    </>
  );
}
