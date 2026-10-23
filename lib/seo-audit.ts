// Live SEO audit for /seo-admin (dev only). Fetches each page's rendered HTML
// from the running server and reads back what search engines and link
// previews actually get: title, description, canonical, robots, social card,
// h1s and structured data. Nothing here runs in production.

export const LIMITS = {
  descriptionMax: 160,
  descriptionMin: 50,
  titleMax: 60,
} as const;

export interface PageAudit {
  canonical?: string;
  description?: string;
  h1Count: number;
  indexable: boolean;
  inSitemap: boolean;
  issues: string[];
  jsonLdTypes: string[];
  ogImage?: string;
  ogImageStatus?: number;
  path: string;
  status: number;
  title?: string;
}

const decode = (text: string) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

// The content of <meta name|property="key" content="…"> (attributes in the
// order Next.js renders them).
const metaContent = (head: string, key: string) => {
  const match = head.match(
    new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`)
  );
  return match ? decode(match[1]) : undefined;
};

// The raw JSON of every <script type="application/ld+json"> on a page.
export const readJsonLd = (html: string) =>
  [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    ),
  ].map((match) => match[1]);

const jsonLdTypes = (html: string) =>
  readJsonLd(html).map((json) => {
    try {
      return String(JSON.parse(json)["@type"] ?? "?");
    } catch {
      return "invalid JSON";
    }
  });

// Pages to audit run a few at a time, so the dev server isn't asked to compile
// every route at once.
export const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>
) => {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
};

const statusOf = async (url: string) => {
  try {
    const response = await fetch(url, { cache: "no-store" });
    await response.arrayBuffer();
    return response.status;
  } catch {
    return 0;
  }
};

// What's wrong with a fetched page, as short readable lines.
const descriptionIssue = (description?: string) => {
  if (!description) {
    return "No description";
  }
  if (description.length > LIMITS.descriptionMax) {
    return `Description over ${LIMITS.descriptionMax} characters`;
  }
  if (description.length < LIMITS.descriptionMin) {
    return `Description under ${LIMITS.descriptionMin} characters`;
  }
};

const canonicalIssue = (path: string, siteUrl: string, canonical?: string) => {
  if (!canonical) {
    return "No canonical";
  }
  const expected = `${siteUrl}${path === "/" ? "" : path}`;
  if (canonical.replace(/\/$/, "") !== expected.replace(/\/$/, "")) {
    return "Canonical points elsewhere";
  }
};

const findIssues = (
  audit: Omit<PageAudit, "issues">,
  siteUrl: string
): string[] => {
  const issues: (string | undefined)[] = [];
  if (audit.status !== 200) {
    issues.push(`HTTP ${audit.status}`);
  }
  if (!audit.title) {
    issues.push("No title");
  } else if (audit.title.length > LIMITS.titleMax) {
    issues.push(`Title over ${LIMITS.titleMax} characters`);
  }
  if (!audit.indexable) {
    issues.push(audit.inSitemap ? "Noindex, but in the sitemap" : undefined);
    return issues.filter((issue) => issue !== undefined);
  }
  issues.push(
    descriptionIssue(audit.description),
    canonicalIssue(audit.path, siteUrl, audit.canonical)
  );
  if (audit.h1Count !== 1) {
    issues.push(`${audit.h1Count} h1s (want 1)`);
  }
  if (!audit.ogImage) {
    issues.push("No social image");
  } else if (audit.ogImageStatus !== 200) {
    issues.push(`Social image returns ${audit.ogImageStatus}`);
  }
  if (!audit.inSitemap) {
    issues.push("Indexable but not in the sitemap");
  }
  return issues.filter((issue) => issue !== undefined);
};

export const auditPage = async ({
  inSitemap,
  origin,
  path,
  siteUrl,
}: {
  inSitemap: boolean;
  origin: string;
  path: string;
  siteUrl: string;
}): Promise<PageAudit> => {
  const issues: string[] = [];
  let html = "";
  let status = 0;
  try {
    const response = await fetch(`${origin}${path}`, {
      cache: "no-store",
      redirect: "manual",
    });
    ({ status } = response);
    html = await response.text();
  } catch {
    issues.push("Couldn't fetch the page");
  }

  if (status >= 300 && status < 400) {
    return {
      h1Count: 0,
      inSitemap,
      indexable: false,
      issues: inSitemap ? ["Redirects, but is in the sitemap"] : [],
      jsonLdTypes: [],
      path,
      status,
    };
  }

  const head = html.slice(0, html.indexOf("</head>"));
  const titleMatch = head.match(/<title>([^<]*)<\/title>/);
  const title = titleMatch ? decode(titleMatch[1]) : undefined;
  const description = metaContent(head, "description");
  const canonicalMatch = head.match(/<link rel="canonical" href="([^"]*)"/);
  const canonical = canonicalMatch ? decode(canonicalMatch[1]) : undefined;
  const robots = metaContent(head, "robots") ?? "";
  const indexable = !robots.includes("noindex");
  const ogImage = metaContent(head, "og:image");
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;

  // The card URL points at the site's public address; check it on this server.
  const ogImageStatus = ogImage
    ? await statusOf(ogImage.replace(siteUrl, origin))
    : undefined;

  const audit = {
    canonical,
    description,
    h1Count,
    inSitemap,
    indexable,
    jsonLdTypes: jsonLdTypes(html),
    ogImage,
    ogImageStatus,
    path,
    status,
    title,
  };
  return {
    ...audit,
    issues: [...issues, ...findIssues(audit, siteUrl)],
  };
};
