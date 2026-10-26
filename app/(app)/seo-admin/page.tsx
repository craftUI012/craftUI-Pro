import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import manifest from "@/app/manifest";
import { GET as getRobots } from "@/app/robots.txt/route";
import sitemap from "@/app/sitemap";
import { PageTransition } from "@/components/page-transition";
import { PageAudit } from "@/components/seo-admin/page-audit";
import { SeoCode, SeoSection } from "@/components/seo-admin/seo-section";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { FALLBACK_SITE_ORIGIN, SITE } from "@/constants/site";
import { TYPE } from "@/constants/typography";
import { showSeoAdmin } from "@/lib/flags";
import { LIMITS, readJsonLd } from "@/lib/seo-audit";
import { cn } from "@/lib/utils";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  description:
    "Internal audit of craftUI's SEO: metadata, structured data, sitemap, robots and icons.",
  noIndex: true,
  path: ROUTES.SEO_ADMIN,
  title: "SEO Admin",
});

// Reads the live site on every visit.
export const dynamic = "force-dynamic";

// Which file controls what. Paths are repo-relative; `url` is where the
// result is served, when it's a route of its own.
const WIRING: { controls: string; file: string; url?: string }[] = [
  {
    controls:
      "Site name, tagline, meta description, keywords, public URL, logo URL",
    file: "constants/site.ts",
  },
  {
    controls:
      "Site-wide defaults (baseMetadata: title template, icons, robots, social card) and per-page metadata (createPageMetadata: title, description, canonical, card, noindex)",
    file: "seo/metadata.ts",
  },
  {
    controls:
      "A page's own metadata: `export const metadata` or `generateMetadata`, built with createPageMetadata",
    file: "app/**/page.tsx (or layout.tsx)",
  },
  {
    controls:
      "Structured data: WebSite, Organization, SoftwareSourceCode (freemium offer), BreadcrumbList, FAQPage (about page)",
    file: "seo/json-ld.tsx",
  },
  {
    controls: "The social card design, shared by both card routes",
    file: "seo/og-image.tsx",
  },
  {
    controls: "Site and app pages' card (?title=&description=)",
    file: "app/og/route.tsx",
    url: ROUTES.OG,
  },
  {
    controls: "One card per docs page, prerendered",
    file: "app/og/docs/[...slug]/route.tsx",
    url: `${ROUTES.OG}${ROUTES.DOCS}/installation/image.png`,
  },
  {
    controls: "Every indexable page",
    file: "app/sitemap.ts",
    url: ROUTES.SITEMAP,
  },
  {
    controls: "What crawlers may fetch, and where the sitemap is",
    file: "app/robots.txt/route.ts",
    url: ROUTES.ROBOTS,
  },
  {
    controls: "Installable app: name, colours, icons",
    file: "app/manifest.ts",
    url: ROUTES.MANIFEST,
  },
  {
    controls: "Every icon in public/ from the logo masters in public/logo",
    file: "scripts/generate-brand-icons.mjs (pnpm brand:icons)",
  },
  {
    controls: "Docs pages kept in the repo but not published",
    file: "source.config.ts (HIDDEN_DOCS)",
  },
  {
    controls: "Index for AI assistants, and its full-text version",
    file: "app/llms.txt/route.ts, app/llms-full.txt",
    url: ROUTES.LLMS,
  },
  {
    controls: "Changelog feed",
    file: "app/rss.xml/route.ts",
    url: ROUTES.RSS,
  },
];

// Every icon `pnpm brand:icons` writes, as linked from the metadata and the
// manifest.
const ICONS: { path: string; size: string; usedFor: string }[] = [
  { path: "/favicon.svg", size: "vector", usedFor: "Browser tab" },
  { path: "/favicon.ico", size: "16, 32, 48", usedFor: "Older browsers" },
  { path: "/favicon-96x96.png", size: "96", usedFor: "Browser tab (PNG)" },
  { path: "/apple-touch-icon.png", size: "180", usedFor: "iOS home screen" },
  {
    path: "/android-chrome-192x192.png",
    size: "192",
    usedFor: "Android / manifest",
  },
  {
    path: "/android-chrome-512x512.png",
    size: "512",
    usedFor: "Android / manifest",
  },
  {
    path: "/android-chrome-maskable-512x512.png",
    size: "512",
    usedFor: "Android adaptive icon",
  },
  { path: "/logo/logo-512.png", size: "512", usedFor: "Organization logo" },
  { path: "/logo/logo-mark-256.png", size: "256", usedFor: "Social cards" },
];

// Indexable pages come from the sitemap; these are the public routes kept out
// of search (noindex), checked so they stay that way.
// A placeholder docs page (no registry item behind it) is checked too.
const NOINDEX_PAGES = [
  ROUTES.LOGIN,
  ROUTES.DASHBOARD,
  ROUTES.CHECKOUT_SUCCESS,
  `${ROUTES.DOCS_BLOCKS}/team-invites`,
];

const Field = ({
  label,
  max,
  value,
}: {
  label: string;
  max?: number;
  value: string;
}) => (
  <div className="flex flex-col gap-1 border-b py-3 last:border-b-0 md:flex-row md:gap-6">
    <dt
      className={cn(TYPE.cardLabel, "text-muted-foreground shrink-0 md:w-48")}
    >
      {label}
    </dt>
    <dd className={cn(TYPE.cardBody, "min-w-0 flex-1 text-pretty")}>
      {value}
      {max !== undefined && (
        <span
          className={cn(
            "ml-2 font-mono tabular-nums",
            value.length > max ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {value.length}/{max}
        </span>
      )}
    </dd>
  </div>
);

const AuditFallback = () => (
  <div className="flex flex-col gap-2">
    <p className={cn(TYPE.cardCaption, "text-muted-foreground")}>
      Fetching every page from this server. The first run compiles each route,
      so it can take a little while.
    </p>
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton key={index} className="h-14 w-full" />
    ))}
  </div>
);

const SeoAdminPage = async () => {
  if (!showSeoAdmin) {
    notFound();
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const origin = `http://${host}`;

  const sitemapEntries = sitemap();
  const sitemapPaths = sitemapEntries.map(
    (entry) => new URL(entry.url).pathname
  );
  const pages = [
    ...sitemapPaths.map((path) => ({ inSitemap: true, path })),
    ...NOINDEX_PAGES.filter((path) => !sitemapPaths.includes(path)).map(
      (path) => ({ inSitemap: false, path })
    ),
  ];

  const robots = await getRobots().text();
  const manifestJson = JSON.stringify(manifest(), null, 2);

  const homeHtml = await fetch(`${origin}${ROUTES.HOME}`, {
    cache: "no-store",
  })
    .then((response) => response.text())
    .catch(() => "");
  const jsonLd = readJsonLd(homeHtml)
    .map((json) => {
      try {
        return JSON.stringify(JSON.parse(json), null, 2);
      } catch {
        return json;
      }
    })
    .join("\n\n");

  const urlFromEnv = Boolean(process.env.NEXT_PUBLIC_SITE_URL);
  const urlIsLocal = SITE.URL.includes("localhost");

  return (
    <PageTransition>
      <div className="container-wrapper px-4 lg:px-6">
        <div className="3xl:fixed:container flex flex-col gap-16 py-8 lg:py-12">
          <header className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              Development only
            </Badge>
            <h1 className={cn(TYPE.headingDisplay, "text-balance")}>
              SEO Admin
            </h1>
            <p
              className={cn(
                TYPE.pageLead,
                "text-muted-foreground max-w-2xl text-pretty"
              )}
            >
              What search engines, link previews and browsers get from the site,
              read live from this server: where each piece is set, the values in
              use, and a check of every page.
            </p>
            <nav
              aria-label="Sections"
              className={cn(TYPE.cardLabel, "flex flex-wrap gap-x-4 gap-y-1")}
            >
              {[
                ["wiring", "How it's wired"],
                ["defaults", "Site defaults"],
                ["pages", "Page audit"],
                ["icons", "Icons & cards"],
                ["files", "Text files"],
                ["structured-data", "Structured data"],
              ].map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {label}
                </a>
              ))}
            </nav>
          </header>

          <SeoSection
            id="wiring"
            index="01"
            title="How it's wired"
            description="Each file and what it controls. Change the file, and the live values below change with it."
          >
            <div className="overflow-hidden rounded-lg border">
              <Table className={TYPE.cardCaption}>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Controls</TableHead>
                    <TableHead>Served at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {WIRING.map((row) => (
                    <TableRow key={row.file} className="align-top">
                      <TableCell className="font-mono whitespace-normal">
                        {row.file}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.controls}
                      </TableCell>
                      <TableCell className="font-mono">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline-offset-4 hover:underline"
                          >
                            {row.url.length > 32
                              ? `${row.url.slice(0, 31)}…`
                              : row.url}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SeoSection>

          <SeoSection
            id="defaults"
            index="02"
            title="Site defaults"
            description="From constants/site.ts. Every page inherits these unless it sets its own."
          >
            {(urlIsLocal || !urlFromEnv) && (
              <p
                className={cn(
                  TYPE.cardBody,
                  "rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-pretty"
                )}
              >
                The public URL is <code>{SITE.URL}</code>. Canonicals, the
                sitemap and social cards all use it, so production must set{" "}
                <code>NEXT_PUBLIC_SITE_URL</code> to the real domain (without
                it, production falls back to <code>{FALLBACK_SITE_ORIGIN}</code>
                ).
              </p>
            )}
            <dl className="rounded-lg border px-4">
              <Field label="Name" value={SITE.NAME} />
              <Field
                label="Home title"
                max={LIMITS.titleMax}
                value={`${SITE.NAME} – ${SITE.TAGLINE}`}
              />
              <Field label="Title template" value={`%s | ${SITE.NAME}`} />
              <Field
                label="Meta description"
                max={LIMITS.descriptionMax}
                value={SITE.DESCRIPTION.META}
              />
              <Field label="Long description" value={SITE.DESCRIPTION.LONG} />
              <Field label="Keywords" value={SITE.KEYWORDS.join(", ")} />
              <Field label="Public URL" value={SITE.URL} />
              <Field label="Default social card" value={SITE.OG_IMAGE} />
              <Field label="Logo (structured data)" value={SITE.LOGO} />
              <Field
                label="Pricing model"
                value="Freemium: some components and blocks are free, the rest need a paid plan."
              />
            </dl>
          </SeoSection>

          <SeoSection
            id="pages"
            index="03"
            title="Page audit"
            description={`Every page in the sitemap, plus the noindex ones, fetched from this server. Search results cut titles at about ${LIMITS.titleMax} characters and descriptions at about ${LIMITS.descriptionMax}.`}
          >
            <Suspense fallback={<AuditFallback />}>
              <PageAudit origin={origin} pages={pages} siteUrl={SITE.URL} />
            </Suspense>
          </SeoSection>

          <SeoSection
            id="icons"
            index="04"
            title="Icons & cards"
            description={
              <>
                Built from the masters in <code>public/logo</code> by{" "}
                <code>pnpm brand:icons</code>. The navbar draws the SVG master
                directly (components/logo.tsx).
              </>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {ICONS.map((icon) => (
                <figure
                  key={icon.path}
                  className="bg-card flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="bg-muted/50 flex aspect-square items-center justify-center rounded-md">
                    {/* oxlint-disable-next-line nextjs/no-img-element -- Shows the exact file served, unoptimised. */}
                    <img
                      src={icon.path}
                      alt=""
                      className="size-16 object-contain"
                    />
                  </div>
                  <figcaption className={cn(TYPE.cardCaption, "flex flex-col")}>
                    <span className="truncate font-mono">{icon.path}</span>
                    <span className="text-muted-foreground">
                      {icon.size} · {icon.usedFor}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <figure className="flex max-w-2xl flex-col gap-2">
              {/* oxlint-disable-next-line nextjs/no-img-element -- The generated card itself. */}
              <img
                src={ROUTES.OG}
                alt="The default social card"
                width={1200}
                height={630}
                className="h-auto w-full rounded-lg border"
              />
              <figcaption
                className={cn(TYPE.cardCaption, "text-muted-foreground")}
              >
                Default social card ({ROUTES.OG}), 1200 × 630
              </figcaption>
            </figure>
          </SeoSection>

          <SeoSection
            id="files"
            index="05"
            title="Text files"
            description="The files crawlers and browsers read, as this server serves them."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className={TYPE.cardHeader}>
                  <Link href={ROUTES.ROBOTS} target="_blank">
                    {ROUTES.ROBOTS}
                  </Link>
                </h3>
                <SeoCode>{robots}</SeoCode>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className={TYPE.cardHeader}>
                  <Link href={ROUTES.MANIFEST} target="_blank">
                    {ROUTES.MANIFEST}
                  </Link>
                </h3>
                <SeoCode>{manifestJson}</SeoCode>
              </div>
              <div className="flex flex-col gap-2 lg:col-span-2">
                <h3 className={TYPE.cardHeader}>
                  <Link href={ROUTES.SITEMAP} target="_blank">
                    {ROUTES.SITEMAP}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    · {sitemapEntries.length} URLs
                  </span>
                </h3>
                <SeoCode>
                  {sitemapEntries
                    .map(
                      (entry) =>
                        `${String(entry.priority ?? "").padEnd(4)} ${String(entry.changeFrequency ?? "").padEnd(8)} ${entry.url}`
                    )
                    .join("\n")}
                </SeoCode>
              </div>
            </div>
          </SeoSection>

          <SeoSection
            id="structured-data"
            index="06"
            title="Structured data"
            description="The JSON-LD on the home page (seo/json-ld.tsx). Docs pages add a BreadcrumbList for their path."
          >
            <SeoCode className="max-h-[40rem]">
              {jsonLd || "Couldn't read the home page."}
            </SeoCode>
          </SeoSection>
        </div>
      </div>
    </PageTransition>
  );
};

export default SeoAdminPage;
