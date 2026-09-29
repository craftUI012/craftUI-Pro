import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsArticle } from "@/components/docs-article";
import { ROUTES } from "@/constants/routes";
import { source } from "@/lib/source";
import { createPageMetadata } from "@/seo/metadata";

// The docs, inside the /homepage-new shell. Same articles as /docs (one
// shared DocsArticle), with page-to-page links kept under
// ROUTES.HOME_NEW_DOCS, so the rail stays on its docs menu while reading.
//
// Static like /docs: every page prerendered at build.
export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () => source.generateParams();

// Kept out of search: the canonical copy of every page is under /docs.
export const generateMetadata = async (props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> => {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }
  return createPageMetadata({
    description: page.data.description,
    noIndex: true,
    path: `${ROUTES.HOME_NEW_DOCS}${slug?.length ? `/${slug.join("/")}` : ""}`,
    title: page.data.title,
  });
};

const HomepageNewDocsPage = async (props: {
  params: Promise<{ slug?: string[] }>;
}) => {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  return (
    // The same top spacing the /docs layout gives its articles.
    <div className="px-4 md:px-6 [--top-spacing:0] lg:[--top-spacing:calc(var(--spacing)*4)]">
      <DocsArticle page={page} basePath={ROUTES.HOME_NEW_DOCS} />
    </div>
  );
};

export default HomepageNewDocsPage;
