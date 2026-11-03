# 05 — Site findings (what the engine builds on)

Read on 2026-11-03 from this repo.

| Item | Value |
|---|---|
| Live site | https://www.craftui.space |
| Framework | Next.js 16.2.4, App Router, pnpm, oxlint + oxfmt via ultracite, lefthook |
| MDX | fumadocs-mdx 14 + fumadocs-core 16; collections in `source.config.ts` (`docs`, `docsAdmin`) |
| Content | `content/docs/` (components 8, blocks 8, templates 16, isometric 5, root 2 MDX files) |
| Sitemap | `app/sitemap.ts`: home, pricing, about, build-landing-pages, sponsor, plus indexable docs pages. No `lastModified` by design. |
| Robots | `app/robots.txt/route.ts`: disallows admin, docs-admin, design-admin, seo-admin, preview, template-preview, dashboard, api, prototypes |
| Site URL | `NEXT_PUBLIC_SITE_URL` → `SITE.URL` in `constants/site.ts` |
| Routes | `constants/routes.ts`; `/blog` reserved, no page yet |
| Metadata | `seo/metadata.ts` → `createPageMetadata()`; `seo/json-ld.tsx` |
| Database | MongoDB Atlas via `lib/db/index.ts` (one client, lazy indexes, `db` export); documents typed in `lib/db/schema.ts` |
| Admin panel | `app/admin-panel-craft/*`, guard `requireAdminPage()` from `lib/admin/session.ts`, emails from `ADMIN_EMAILS`, read layer `lib/admin/data.ts`, nav `components/admin-panel/admin-nav.tsx` |
| Auth | better-auth, magic link, MongoDB adapter |
| PostHog | US cloud, `instrumentation-client.ts`, events via `/relay`, `$pageview` on every navigation with 2026-08-30 defaults; `lib/posthog-server.ts` for server captures |
| Existing SEO admin | `/seo-admin`, dev-only audit and text editor for docs pages. Separate from the engine; could later link to the engine dashboard. |
| Scripts | `scripts/*.mjs`, `tsconfig.scripts.json` includes `scripts/**` only; the engine adds `seo-engine/**` to it or ships its own tsconfig |
| CI | `.github/workflows/ci.yml`: `pnpm check`, typecheck, build on PRs and main. No deploy workflow; Vercel deploys on push. |
| Registry | `registry.json` lists component/block names; page plans reference these in `componentRefs` |

## What the engine adds to this repo

- `seo-engine/` (pipeline, db, config, sources, docs, .env.example)
- `app/admin-panel-craft/seo/**` and `components/admin-panel/seo/**`
- `lib/seo-engine/**` (dashboard read layer)
- `ROUTES.SEO_ENGINE` and an AdminNav entry
- `.github/workflows/seo-engine.yml`
- Dev dependencies: googleapis, @anthropic-ai/sdk, p-limit, tsx (zod and
  mongodb already present)
- Later, when the first page is built: a `seoPages` fumadocs collection,
  the `/guides/[slug]` route, a sitemap extension. These are part of page
  building, not of the engine, and are described in 06-page-plan-schema.md.

## Network note for the Claude session used for planning

The cloud container could not reach `www.craftui.space` (network policy),
so the live sitemap was not fetched during planning. The engine runs in
GitHub Actions or locally, where this does not apply.
