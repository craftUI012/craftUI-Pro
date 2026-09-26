import { HeroSection } from "@/components/hero-section";
import { PageTransition } from "@/components/page-transition";
import { ROUTES } from "@/constants/routes";
import { YourComponent } from "@/registry/new-york/your-component";
import { BreadcrumbJsonLd } from "@/seo/json-ld";

export const dynamic = "force-static";
export const revalidate = false;

export default function IndexPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: ROUTES.HOME }]} />
      <PageTransition>
        <HeroSection />

        <section className="container-wrapper pb-8 lg:pb-12">
          <div className="container flex flex-col items-center gap-6">
            <YourComponent className="w-full max-w-md" />
          </div>
        </section>
      </PageTransition>
    </>
  );
}
