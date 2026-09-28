import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TEMPLATE_COMPONENTS } from "@/components/hero-templates/sections";
import type { TemplateSlug } from "@/components/hero-templates/templates-data";
import { TEMPLATES } from "@/components/hero-templates/templates-data";

// Template pages for the landing page's device previews. Outside the (app)
// group so there's no site header or footer: the page is the template alone,
// and it lays out at the width of the iframe it's shown in.

export const dynamicParams = false;

export const generateStaticParams = () =>
  TEMPLATES.map((template) => ({ slug: template.slug }));

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Template preview",
};

const TemplatePreviewPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const Page = TEMPLATE_COMPONENTS[slug as TemplateSlug];

  if (!Page) {
    notFound();
  }

  return (
    <>
      {/* Devices don't show a desktop scrollbar; hide it in the preview. */}
      <style>{`html{scrollbar-width:none}html::-webkit-scrollbar{display:none}`}</style>
      <main className="bg-background text-foreground min-h-svh">
        <Page />
      </main>
    </>
  );
};

export default TemplatePreviewPage;
