import { notFound } from "next/navigation";

import { SITE } from "@/constants/site";
import { getPageImage, source } from "@/lib/source";
import { renderOgImage } from "@/seo/og-image";

export const revalidate = false;

export const GET = async (
  _req: Request,
  { params }: RouteContext<"/og/docs/[...slug]">
) => {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) {
    notFound();
  }

  return renderOgImage({
    description: page.data.description ?? SITE.DESCRIPTION.META,
    title: page.data.title,
  });
};

export const generateStaticParams = () =>
  source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
