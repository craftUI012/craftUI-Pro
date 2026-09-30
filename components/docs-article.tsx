import { findNeighbour } from "fumadocs-core/page-tree";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

// import { DocsBaseSwitcher } from "@/components/docs-base-switcher";
import { DocsCopyPage } from "@/components/docs-copy-page";
import { DocsKeyboardShortcuts } from "@/components/docs-keyboard-shortcuts";
import { DocsNavLink } from "@/components/docs-nav-link";
import { DocsShareMenu } from "@/components/docs-share-menu";
import { DocsTableOfContents } from "@/components/docs-toc";
import { DocsTocFooter } from "@/components/docs-toc-footer";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { getPageMarkdownUrl, source } from "@/lib/source";
import { absoluteUrl } from "@/lib/utils";
import { mdxComponents } from "@/mdx-components";

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

// The body of a docs page: title, description, copy/share, prev/next, the MDX
// content and the table of contents. Rendered by /docs and by /homepage-new's
// docs view, so both show the same article.
//
// `basePath` rewrites the page-to-page links (prev/next, keyboard shortcuts)
// from /docs to another mount point, so a reader inside /homepage-new stays
// inside it. Links written into the MDX content itself still point at /docs.
//
// `transition` wraps the article in PageTransition (the slide between docs
// pages). On by default for /docs; /homepage-new turns it off, so there only
// the rail animates and the article swaps in place.
export const DocsArticle = ({
  basePath = ROUTES.DOCS,
  page,
  transition = true,
}: {
  basePath?: string;
  page: DocsPage;
  transition?: boolean;
}) => {
  const Wrapper = transition ? PageTransition : Fragment;
  const toHref = (url: string) =>
    basePath === ROUTES.DOCS ? url : url.replace(ROUTES.DOCS, basePath);

  const doc = page.data;
  const MdxContent = doc.body;
  const neighbours = findNeighbour(source.pageTree, page.url);
  const previous = neighbours.previous
    ? { ...neighbours.previous, url: toHref(neighbours.previous.url) }
    : null;
  const next = neighbours.next
    ? { ...neighbours.next, url: toHref(neighbours.next.url) }
    : null;
  const markdownUrl = getPageMarkdownUrl(page).url;

  const { links } = doc as { links?: { doc?: string; api?: string } };

  return (
    <>
      <DocsKeyboardShortcuts
        previous={previous ? previous.url : null}
        next={next ? next.url : null}
      />

      <Wrapper>
        <div
          data-slot="docs"
          className="flex items-stretch text-[1.05rem] sm:text-[15px] xl:w-full"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-(--top-spacing) shrink-0" />
            <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-1 flex-col gap-8 px-4 py-6 text-neutral-800 md:px-0 lg:py-8 dark:text-neutral-300">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h1 className="scroll-m-20 text-4xl font-semibold tracking-tight sm:text-3xl xl:text-4xl">
                      {doc.title}
                    </h1>
                    <div className="docs-nav flex items-center gap-2">
                      <div className="hidden sm:block">
                        <DocsCopyPage
                          markdownUrl={absoluteUrl(markdownUrl)}
                          url={absoluteUrl(page.url)}
                        />
                      </div>
                      <div className="ml-auto flex gap-2">
                        <DocsShareMenu
                          title={doc.title}
                          url={absoluteUrl(page.url)}
                        />
                        {previous && (
                          <DocsNavLink
                            href={previous.url}
                            transitionTypes={["nav-back"]}
                            className="extend-touch-target size-8 md:size-7"
                            tooltip={{
                              icon: <ArrowLeftIcon />,
                              title: "Previous Page",
                            }}
                          >
                            <span className="sr-only">Previous</span>
                          </DocsNavLink>
                        )}
                        {next && (
                          <DocsNavLink
                            href={next.url}
                            transitionTypes={["nav-forward"]}
                            className="extend-touch-target size-8 md:size-7"
                            tooltip={{
                              icon: <ArrowRightIcon />,
                              title: "Next Page",
                            }}
                          >
                            <span className="sr-only">Next</span>
                          </DocsNavLink>
                        )}
                      </div>
                    </div>
                  </div>
                  {doc.description && (
                    <p className="text-muted-foreground text-[1.05rem] text-balance sm:text-base">
                      {doc.description}
                    </p>
                  )}
                </div>
                {links ? (
                  <div className="flex items-center space-x-2 pt-4">
                    {links?.doc && (
                      <Badge asChild variant="secondary">
                        <Link href={links.doc} target="_blank" rel="noreferrer">
                          Docs <ArrowUpRightIcon />
                        </Link>
                      </Badge>
                    )}
                    {links?.api && (
                      <Badge asChild variant="secondary">
                        <Link href={links.api} target="_blank" rel="noreferrer">
                          API Reference <ArrowUpRightIcon />
                        </Link>
                      </Badge>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="w-full flex-1 *:data-[slot=alert]:first:mt-0">
                {/* {params.slug &&
                params.slug[0] === "components" &&
                params.slug[1] &&
                params.slug[2] && (
                  <DocsBaseSwitcher
                    base={params.slug[1]}
                    component={params.slug.slice(2).join("/")}
                    className="mb-4"
                  />
                )} */}
                <MdxContent components={mdxComponents} />
              </div>
            </div>
            <div className="mx-auto hidden h-16 w-full max-w-2xl items-center gap-2 px-4 sm:flex md:px-0">
              {previous && (
                <DocsNavLink
                  href={previous.url}
                  transitionTypes={["nav-back"]}
                  size="sm"
                >
                  {previous.name}
                </DocsNavLink>
              )}
              {next && (
                <DocsNavLink
                  href={next.url}
                  transitionTypes={["nav-forward"]}
                  className="ml-auto"
                  size="sm"
                >
                  {next.name}
                </DocsNavLink>
              )}
            </div>
          </div>
          <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[calc(100svh-var(--footer-height)+2rem)] w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
            <div className="h-(--top-spacing) shrink-0" />
            {doc.toc?.length ? (
              <div className="no-scrollbar overflow-y-auto mx-8 border-b">
                <DocsTableOfContents toc={doc.toc} />
              </div>
            ) : null}
            <DocsTocFooter docId={page.path} className="mx-8" />
          </div>
        </div>
      </Wrapper>
    </>
  );
};
