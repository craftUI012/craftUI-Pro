import { FAQ } from "@/constants/faq";
import { PRICING } from "@/constants/pricing";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { AGENT_DOCS_DIRECTIVE_MARKDOWN } from "@/lib/agent-discovery/directive";

// Markdown versions of the pricing and about pages, for AI agents (served at
// /pricing.md, /about.md and on Accept: text/markdown, see proxy.ts). Built
// from the same data as the pages (constants/pricing.ts, constants/faq.ts),
// so they can't drift from what people see.

const price = (cents: number) =>
  cents === 0
    ? "Free"
    : `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;

const faqMarkdown = (heading: string) =>
  [
    `## ${heading}`,
    ...FAQ.map((item) => `### ${item.question}\n\n${item.answer}`),
  ].join("\n\n");

export const pricingMarkdown = (origin: string) => {
  const base = origin.replace(/\/$/, "");
  const plans = PRICING.plans.map((plan) => {
    const features = plan.features.map((feature) => `- ${feature.text}`);
    return [
      `### ${plan.name}: ${price(plan.priceCents)} ${plan.priceSuffix}`,
      plan.tagline,
      ...(plan.includes ? [plan.includes] : []),
      features.join("\n"),
    ].join("\n\n");
  });
  return [
    `# ${PRICING.heading}`,
    PRICING.subheading,
    AGENT_DOCS_DIRECTIVE_MARKDOWN,
    "## Plans",
    ...plans,
    PRICING.footnote,
    `Checkout and plan details: ${base}${ROUTES.PRICING}`,
    ...(PRICING.faq ? [faqMarkdown(PRICING.faq.heading)] : []),
  ].join("\n\n");
};

export const aboutMarkdown = (origin: string) => {
  const base = origin.replace(/\/$/, "");
  return [
    `# About ${SITE.NAME}`,
    SITE.DESCRIPTION.LONG,
    AGENT_DOCS_DIRECTIVE_MARKDOWN,
    "## Links",
    [
      `- [Browse the library](${base}${ROUTES.HOME})`,
      `- [Installation](${base}${ROUTES.DOCS_INSTALLATION}.md)`,
      `- [Pricing](${base}${ROUTES.PRICING}.md)`,
      `- [LLM index (llms.txt)](${base}${ROUTES.LLMS})`,
    ].join("\n"),
    faqMarkdown("Frequently asked questions"),
  ].join("\n\n");
};
