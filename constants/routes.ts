export const ROUTES = {
  // What craftUI is, how it works, and the FAQ (app/(app)/about). Took over
  // the old /docs introduction, which now redirects here.
  ABOUT: "/about",
  // Users, purchases and the raw MongoDB collections, for ADMIN_EMAILS only
  // (app/admin-panel-craft).
  ADMIN_PANEL: "/admin-panel-craft",
  AGENT_SKILLS_INDEX: "/.well-known/agent-skills/index.json",
  AGENT_SKILLS_SITE_SKILL: "/.well-known/agent-skills/site-skill.md",
  API_CATALOG: "/.well-known/api-catalog",
  API_STATUS: "/api/status",
  // No page yet; linked from the home page's top bar.
  BLOG: "/blog",
  // The previous home page (hero, templates, features, blocks, components).
  BUILD_LANDING_PAGES: "/build-landing-pages-ui-library",
  // Changelog entries live under content/docs/changelog (see lib/changelog.ts
  // and the RSS feed). No index page or entries yet.
  CHANGELOG: "/docs/changelog",
  // Where Dodo sends the buyer after paying (app/(app)/checkout/success).
  CHECKOUT_SUCCESS: "/checkout/success",
  COMPONENT_PREVIEW: "/preview",
  DASHBOARD: "/dashboard",
  DESIGN_ADMIN: "/design-admin",
  DOCS: "/docs",
  DOCS_ADMIN: "/docs-admin",
  DOCS_BLOCKS: "/docs/blocks",
  DOCS_COMPONENTS: "/docs/components",
  DOCS_INSTALLATION: "/docs/installation",
  DOCS_TEMPLATES: "/docs/templates",
  HOME: "/",
  LLMS: "/llms.txt",
  LLMS_FULL: "/llms-full.txt",
  LLMS_MD: "/llms.md",
  LOGIN: "/login",
  MANIFEST: "/manifest.webmanifest",
  MCP: "/mcp",
  OG: "/og",
  OPENAPI: "/openapi.json",
  PRICING: "/pricing",
  REGISTRY: "/r/registry.json",
  ROBOTS: "/robots.txt",
  RSS: "/rss.xml",
  SEO_ADMIN: "/seo-admin",
  SITEMAP: "/sitemap.xml",
  SPONSOR: "/sponsor",
  TEMPLATE_PREVIEW: "/template-preview",
} as const;
