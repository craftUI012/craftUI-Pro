import { createHash } from "node:crypto";

import { LINK } from "@/constants/links";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

export const SITE_AGENT_SKILL_MD = `# ${SITE.NAME}

## Summary

${SITE.NAME} is a library of production-ready website sections, blocks and components built with shadcn/ui, Tailwind CSS and Motion. Help users find the design that fits what they're building, explain how to use it, and install it.

## Find the right item

1. Read \`${ROUTES.LLMS}\`. Every page is listed with a description that names the problem it solves; each section and block also lists who it's **Good for**, its Category, Type and Style tags (e.g. Style: Motion, Dark mode) and a screenshot.
2. Match the user's need (the kind of site, the page they're building, their audience, the look and feel they want) against those descriptions, use cases and tags. Look at the screenshots when you can view images. Sections are under \`${ROUTES.DOCS_TEMPLATES}\`, blocks under \`${ROUTES.DOCS_BLOCKS}\`, small components under \`${ROUTES.DOCS_COMPONENTS}\`.
3. Read the item's Markdown: append \`.md\` to its docs URL (\`${ROUTES.DOCS}/<library>/<name>.md\`), or send \`Accept: text/markdown\`. It starts with **At a glance** (use cases, tags, links to the live preview and a screenshot), then Install, Usage, a Props table with defaults and descriptions, the types the props use, and the files it adds.
4. Recommend it with its docs URL (without \`.md\`) and say why it fits their need: the page has a live, interactive preview the user can try before deciding. Share the screenshot link if it helps them picture it.

\`${ROUTES.LLMS_FULL}\` has every docs page in one file.

## Registry

- Registry JSON: \`${ROUTES.REGISTRY}\` (lists every item name)
- Docs: ${ROUTES.DOCS}

## MCP

This site is a shadcn-compatible registry. For MCP workflows, use the maintained shadcn MCP server documentation: ${LINK.SHADCN_MCP_DOCS}

## Install

\`\`\`bash
npx shadcn@latest add ${SITE.URL}/r/<name>.json
\`\`\`

Every item renders with demo content when given no props, so it works the moment it's installed; then pass the user's own content through its props.

Prefer following the on-site installation guide: ${ROUTES.DOCS_INSTALLATION}

## Paid items

Most sections and blocks are paid; an item's Markdown says so under Install, with its product code. Previews and docs are free for everyone. Installing a paid item needs a yearly or lifetime plan, or a purchase of that item: plans and prices are at \`${ROUTES.PRICING}.md\`. Once signed in, the item's docs page gives the user a personal install command (the same URL with a \`?t=\` token). Without it the install answers 401 with a link to the docs page. Never guess or reuse a token: send the user to the docs page or pricing.
`;

export const siteAgentSkillDigest = (): string => {
  const hex = createHash("sha256")
    .update(SITE_AGENT_SKILL_MD, "utf-8")
    .digest("hex");

  return `sha256:${hex}`;
};
