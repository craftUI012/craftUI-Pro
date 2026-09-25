import { findNeighbour } from "fumadocs-core/page-tree";
import { notFound } from "next/navigation";

import { DocsNavLink } from "@/components/docs-nav-link";
import { DocsTableOfContents } from "@/components/docs-toc";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { showDocsAdmin } from "@/lib/flags";
import { adminSource } from "@/lib/source";
import { mdxComponents } from "@/mdx-components";
import { createPageMetadata } from "@/seo/metadata";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () =>
  showDocsAdmin ? adminSource.generateParams() : [];

export const generateMetadata = async (props: {
  params: Promise<{ slug?: string[] }>;
}) => {
  const params = await props.params;
  const page = adminSource.getPage(params.slug);

  if (!showDocsAdmin || !page) {
    notFound();
  }

  return createPageMetadata({
    description: page.data.description,
    noIndex: true,
    path: page.url,
    title: `${page.data.title} · Docs Admin`,
  });
};

const Page = async (props: { params: Promise<{ slug?: string[] }> }) => {
  const params = await props.params;
  const page = adminSource.getPage(params.slug);

  if (!showDocsAdmin || !page) {
    notFound();
  }

  const doc = page.data;
  const MdxContent = doc.body;
  const neighbours = findNeighbour(adminSource.pageTree, page.url);

  return (
    <PageTransition>
      <div
        data-slot="docs"
        className="flex items-stretch text-[1.05rem] sm:text-[15px] xl:w-full"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-(--top-spacing) shrink-0" />
          <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-1 flex-col gap-8 px-4 py-6 text-neutral-800 md:px-0 lg:py-8 dark:text-neutral-300">
            <div className="flex flex-col gap-2">
              <Badge variant="secondary" className="w-fit">
                Internal · development only
              </Badge>
              <h1 className="scroll-m-20 text-4xl font-semibold tracking-tight sm:text-3xl xl:text-4xl">
                {doc.title}
              </h1>
              {doc.description && (
                <p className="text-muted-foreground text-[1.05rem] text-balance sm:text-base">
                  {doc.description}
                </p>
              )}
            </div>
            <div className="w-full flex-1 *:data-[slot=alert]:first:mt-0">
              <MdxContent components={mdxComponents} />
            </div>
          </div>
          <div className="mx-auto hidden h-16 w-full max-w-2xl items-center gap-2 px-4 sm:flex md:px-0">
            {neighbours.previous && (
              <DocsNavLink
                href={neighbours.previous.url}
                transitionTypes={["nav-back"]}
                size="sm"
              >
                {neighbours.previous.name}
              </DocsNavLink>
            )}
            {neighbours.next && (
              <DocsNavLink
                href={neighbours.next.url}
                transitionTypes={["nav-forward"]}
                className="ml-auto"
                size="sm"
              >
                {neighbours.next.name}
              </DocsNavLink>
            )}
          </div>
        </div>
        <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[calc(100svh-var(--footer-height)+2rem)] w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
          <div className="h-(--top-spacing) shrink-0" />
          {doc.toc?.length ? (
            <div className="no-scrollbar overflow-y-auto mx-8">
              <DocsTableOfContents toc={doc.toc} />
            </div>
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
};

export default Page;
