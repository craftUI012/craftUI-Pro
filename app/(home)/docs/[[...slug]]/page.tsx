import { notFound } from "next/navigation";

import { DocsArticle } from "@/components/docs-article";
import { ROUTES } from "@/constants/routes";
import { formatTitleFromSlug } from "@/lib/docs";
import { getPageImage, source } from "@/lib/source";
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
    ogImage: getPageImage(page).url,
    ogType: "article",
    path: page.url,
    title: page.data.title,
  });
};

const buildBreadcrumbs = (
  slugs: string[],
  pageTitle: string,
  pageUrl: string
) => {
  const items: { name: string; path: string }[] = [
    { name: "Home", path: ROUTES.HOME },
  ];

  if (slugs.length === 0) {
    items.push({ name: pageTitle, path: pageUrl });
    return items;
  }

  items.push({ name: "Docs", path: ROUTES.DOCS });

  let currentPath: string = ROUTES.DOCS;
  for (let i = 0; i < slugs.length - 1; i += 1) {
    currentPath += `/${slugs[i]}`;
    items.push({ name: formatTitleFromSlug(slugs[i]), path: currentPath });
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
