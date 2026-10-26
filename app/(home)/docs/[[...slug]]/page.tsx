import { notFound } from "next/navigation";

import { DocsArticle } from "@/components/docs-article";
import { DocsRelated } from "@/components/docs-related";
import { ROUTES } from "@/constants/routes";
import { LIBRARIES } from "@/constants/taxonomy";
import { isIndexableDocsPage } from "@/lib/registry";
import { getPageImage, source } from "@/lib/source";
import { isLibraryId } from "@/lib/taxonomy";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

// The docs, inside the browse shell (see app/(home)/layout.tsx). No page
// transition here and no header/footer prev-next: the article swaps in place,
// only the rail animates, and the rail already lists every page.
//
// Static: every page prerendered at build.
export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () => source.generateParams();

export const generateMetadata = async (props: {
  params: Promise<{ slug?: string[] }>;
}) => {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  return createPageMetadata({
    description: page.data.description,
    // Placeholder pages (no registry item yet) stay out of search.
    noIndex: !isIndexableDocsPage(page.slugs, page.url),
    ogImage: getPageImage(page).url,
    ogType: "article",
    path: page.url,
    title: page.data.title,
  });
};

// Home → the item's library on the browse page → the page. There's no /docs
// index (it redirects to /about) and no page per docs folder, so neither is
// a crumb. Guides outside the library folders (Installation) are Home → page.
const buildBreadcrumbs = (
  slugs: string[],
  pageTitle: string,
  pageUrl: string
) => {
  const items: { name: string; path: string }[] = [
    { name: "Home", path: ROUTES.HOME },
  ];

  const [folder] = slugs;
  if (isLibraryId(folder)) {
    const library = LIBRARIES[folder];
    items.push({
      name: library.label,
      path: `${ROUTES.HOME}?library=${library.slug}`,
    });
  }

  items.push({ name: pageTitle, path: pageUrl });
  return items;
};

const DocsPage = async (props: { params: Promise<{ slug?: string[] }> }) => {
  const { slug } = await props.params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={buildBreadcrumbs(slug ?? [], page.data.title, page.url)}
      />
      {/* The same top spacing the old /docs layout gave its articles. */}
      <div className="px-4 md:px-6 [--top-spacing:0] lg:[--top-spacing:calc(var(--spacing)*4)]">
        <DocsArticle
          after={<DocsRelated pageTitle={page.data.title} url={page.url} />}
          page={page}
          footerNav={false}
          headerActions={false}
          transition={false}
        />
      </div>
    </>
  );
};

export default DocsPage;
