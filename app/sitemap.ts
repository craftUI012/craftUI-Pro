import type { MetadataRoute } from "next";

import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { isIndexableDocsPage } from "@/lib/registry";
import { source } from "@/lib/source";

// Every public, indexable page. Left out: admin, account, checkout and
// preview routes (noindex), /docs itself (it redirects to /about), and docs
// pages with no registry item behind them (placeholders, also noindex). No
// `lastModified`: we don't track real edit dates yet, and a date that's
// always "now" teaches search engines to ignore the field for the whole site.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      changeFrequency: "weekly",
      priority: 1,
      url: SITE.URL,
    },
    {
      changeFrequency: "monthly",
      priority: 0.7,
      url: `${SITE.URL}${ROUTES.PRICING}`,
    },
    {
      changeFrequency: "monthly",
      priority: 0.6,
      url: `${SITE.URL}${ROUTES.ABOUT}`,
    },
    {
      changeFrequency: "monthly",
      priority: 0.6,
      url: `${SITE.URL}${ROUTES.BUILD_LANDING_PAGES}`,
    },
    {
      changeFrequency: "monthly",
      priority: 0.4,
      url: `${SITE.URL}${ROUTES.SPONSOR}`,
    },
  ];

  const docPages: MetadataRoute.Sitemap = source
    .getPages()
    .filter((page) => isIndexableDocsPage(page.slugs, page.url))
    .map((page) => ({
      changeFrequency: "weekly" as const,
      priority: 0.8,
      url: `${SITE.URL}${page.url}`,
    }));

  return [...staticPages, ...docPages];
}
