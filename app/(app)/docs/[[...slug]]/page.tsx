import { notFound } from "next/navigation";

import { DocsArticle } from "@/components/docs-article";
import { ROUTES } from "@/constants/routes";
import { formatTitleFromSlug } from "@/lib/docs";
import { getPageImage, source } from "@/lib/source";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () => source.generateParams();

export const generateMetadata = async (props: {
  params: Promise<{ slug?: string[] }>;
}) => {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const doc = page.data;
  const ogImage = getPageImage(page).url;

  return createPageMetadata({
    description: doc.description,
    ogImage,
    ogType: "article",
    path: page.url,
    title: doc.title,
  });
};

const buildBreadcrumbs = (
  slugs: string[],
  pageTitle: string,
  pageUrl: string
) => {
  const items: { name: string; path: string }[] = [{ name: "Home", path: "/" }];

  if (slugs.length === 0) {
    items.push({ name: pageTitle, path: pageUrl });
    return items;
  }

  items.push({ name: "Docs", path: ROUTES.DOCS });

  let currentPath = ROUTES.DOCS;
  for (let i = 0; i < slugs.length - 1; i += 1) {
    currentPath += `/${slugs[i]}`;
    items.push({ name: formatTitleFromSlug(slugs[i]), path: currentPath });
  }

  items.push({ name: pageTitle, path: pageUrl });
  return items;
};

const Page = async (props: { params: Promise<{ slug?: string[] }> }) => {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const breadcrumbs = buildBreadcrumbs(
    params.slug ?? [],
    page.data.title,
    page.url
  );

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />
      <DocsArticle page={page} />
    </>
  );
};

export default Page;
