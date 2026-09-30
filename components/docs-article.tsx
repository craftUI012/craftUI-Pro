import { findNeighbour } from "fumadocs-core/page-tree";
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

// import { DocsBaseSwitcher } from "@/components/docs-base-switcher";
import { DocsCopyPage } from "@/components/docs-copy-page";
import { DocsKeyboardShortcuts } from "@/components/docs-keyboard-shortcuts";
import { DocsNavLink } from "@/components/docs-nav-link";
import { DocsShareMenu } from "@/components/docs-share-menu";
// TOC sidebar is commented out below (see the JSX); its imports go with it.
// import { DocsTableOfContents } from "@/components/docs-toc";
// import { DocsTocFooter } from "@/components/docs-toc-footer";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { getPageMarkdownUrl, source } from "@/lib/source";
import { absoluteUrl, cn } from "@/lib/utils";
import { mdxComponents } from "@/mdx-components";

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

type NavTarget = { name: React.ReactNode; url: string } | null;

// Copy Page, share and prev/next beside the title (/docs only; see
// `headerActions` below).
const DocsHeaderActions = ({
  markdownUrl,
  next,
  pageUrl,
  previous,
  title,
}: {
  markdownUrl: string;
  next: NavTarget;
  pageUrl: string;
  previous: NavTarget;
  title: string;
}) => (
  <div className="docs-nav flex items-center gap-2">
    <div className="hidden sm:block">
      <DocsCopyPage
        markdownUrl={absoluteUrl(markdownUrl)}
        url={absoluteUrl(pageUrl)}
      />
    </div>
    <div className="ml-auto flex gap-2">
      <DocsShareMenu title={title} url={absoluteUrl(pageUrl)} />
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
);

// The body of a docs page: title, description, copy/share, prev/next, the MDX
// content and the table of contents. Rendered by /docs, inside the browse
// shell (app/(home)/docs).
//
// `basePath` rewrites the page-to-page links (prev/next, keyboard shortcuts)
// from /docs to another mount point, if the article is ever mounted
// elsewhere. Links written into the MDX content itself still point at /docs.
//
// `transition` wraps the article in PageTransition (the slide between docs
// pages). `footerNav` shows the prev/next bar under the article,
// `headerActions` the Copy Page / share / prev / next cluster beside the
// title. All three default on; the shell's /docs turns them off (only the
// rail animates, the rail lists every page, and each preview card carries
// its own share and "Copy for AI").
export const DocsArticle = ({
  basePath = ROUTES.DOCS,
  footerNav = true,
  headerActions = true,
  page,
  transition = true,
}: {
  basePath?: string;
  footerNav?: boolean;
  headerActions?: boolean;
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
          className={cn("flex items-stretch xl:w-full", TYPE.cardBody)}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-(--top-spacing) shrink-0" />
            <div className="container flex w-full min-w-0 flex-1 flex-col gap-8 py-6 text-neutral-800 lg:py-8 dark:text-neutral-300">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h1 className={cn("scroll-m-20", TYPE.headingDisplay)}>
                      {doc.title}
                    </h1>
                    {headerActions && (
                      <DocsHeaderActions
                        markdownUrl={markdownUrl}
                        next={next}
                        pageUrl={page.url}
                        previous={previous}
                        title={doc.title}
                      />
                    )}
                  </div>
                  {doc.description && (
                    <p
                      className={cn(
                        "text-muted-foreground text-balance",
                        TYPE.pageLead
                      )}
                    >
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
            {footerNav && (
              <div className="container hidden h-16 w-full items-center gap-2 sm:flex">
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
            )}
          </div>
          {/* TOC sidebar: commented out for now (full-width article). Not deleted — we may bring this back. */}
          {/* <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[calc(100svh-var(--footer-height)+2rem)] w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
            <div className="h-(--top-spacing) shrink-0" />
            {doc.toc?.length ? (
              <div className="no-scrollbar overflow-y-auto mx-8 border-b">
                <DocsTableOfContents toc={doc.toc} />
              </div>
            ) : null}
            <DocsTocFooter docId={page.path} className="mx-8" />
          </div> */}
        </div>
      </Wrapper>
    </>
  );
};
