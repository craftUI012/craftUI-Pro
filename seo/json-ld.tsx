import { LINK } from "@/constants/links";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

// Stable ids, so the separate scripts describe one graph: the WebSite is
// published by the Organization, and search engines merge the two.
const ORGANIZATION_ID = `${SITE.URL}/#organization`;
const WEBSITE_ID = `${SITE.URL}/#website`;

// `<` is escaped (as Next.js recommends) so text in the data can never close
// the script tag.
const JsonLdScript = ({ data }: { data: Record<string, unknown> }) => (
  <script
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replaceAll("<", String.raw`\u003c`),
    }}
    type="application/ld+json"
  />
);

export const WebsiteJsonLd = () => (
  <JsonLdScript
    data={{
      "@context": "https://schema.org",
      "@id": WEBSITE_ID,
      "@type": "WebSite",
      description: SITE.DESCRIPTION.META,
      inLanguage: "en-US",
      name: SITE.NAME,
      publisher: { "@id": ORGANIZATION_ID },
      url: SITE.URL,
    }}
  />
);

export const SoftwareSourceCodeJsonLd = () => (
  <JsonLdScript
    data={{
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      applicationCategory: "DeveloperApplication",
      author: {
        "@type": "Person",
        name: SITE.AUTHOR.NAME,
        url: LINK.GITHUB_ORG,
      },
      codeRepository: LINK.GITHUB,
      description: SITE.DESCRIPTION.LONG,
      keywords: SITE.KEYWORDS,
      license: LINK.LICENSE,
      maintainer: {
        "@type": "Person",
        name: SITE.AUTHOR.NAME,
        url: LINK.GITHUB_ORG,
      },
      name: SITE.NAME,
      // Freemium: some components are free, the rest need a paid plan. Only
      // the free tier is listed as an Offer (paid prices aren't final yet);
      // the paid plans are on the pricing page.
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        description:
          "Freemium: some components and blocks are free; the rest are included in a paid plan.",
        name: "Free tier",
        price: "0",
        priceCurrency: "USD",
        url: `${SITE.URL}${ROUTES.PRICING}`,
      },
      programmingLanguage: ["TypeScript", "React", "Next.js"],
      runtimePlatform: "Node.js",
      url: SITE.URL,
    }}
  />
);

export const OrganizationJsonLd = () => (
  <JsonLdScript
    data={{
      "@context": "https://schema.org",
      "@id": ORGANIZATION_ID,
      "@type": "Organization",
      founder: {
        "@type": "Person",
        name: SITE.AUTHOR.NAME,
        url: LINK.GITHUB_ORG,
      },
      // A square logo (512 × 512), as search engines ask for, not the
      // 1200 × 630 social card this used to point at.
      logo: {
        "@type": "ImageObject",
        height: 512,
        url: SITE.LOGO,
        width: 512,
      },
      name: SITE.NAME,
      sameAs: [LINK.GITHUB, LINK.GITHUB_ORG],
      url: SITE.URL,
    }}
  />
);

export const BreadcrumbJsonLd = ({
  items,
}: {
  items: { name: string; path: string }[];
}) => (
  <JsonLdScript
    data={{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        item: `${SITE.URL}${item.path.startsWith(ROUTES.HOME) ? item.path : `${ROUTES.HOME}${item.path}`}`,
        name: item.name,
        position: index + 1,
      })),
    }}
  />
);

// A page of questions and answers (the about page's FAQ). Answers are plain
// text, as search engines read them.
export const FaqPageJsonLd = ({
  items,
}: {
  items: { answer: string; question: string }[];
}) => (
  <JsonLdScript
    data={{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        acceptedAnswer: { "@type": "Answer", text: item.answer },
        name: item.question,
      })),
    }}
  />
);

export const JsonLdScripts = () => (
  <>
    <WebsiteJsonLd />
    <SoftwareSourceCodeJsonLd />
    <OrganizationJsonLd />
  </>
);
