# SEO Engine — planning docs

The SEO Engine finds the searches craftUI's customers make, decides which
pages are missing, and hands you a **page plan as JSON** for each one. You
build the page from that JSON with AI. Once a month it also writes a report
on what improved since the previous month, what worked, what did not, and how
much traffic AI engines sent.

Everything lives in this repo under `seo-engine/` (pipeline, config, sources,
docs) plus a section of the existing admin panel. Run data lives in MongoDB,
never in git.

| File | What it covers |
|---|---|
| [00-spec.md](./00-spec.md) | The original spec, with a note on what changed. |
| [01-architecture.md](./01-architecture.md) | Single-repo layout, data flow, MongoDB collections, run lifecycle. |
| [02-service-setup.md](./02-service-setup.md) | Exact procedures for Google, PostHog, DataForSEO, Anthropic, IndexNow, GitHub and Vercel settings. |
| [03-sdks-and-apis.md](./03-sdks-and-apis.md) | Packages, endpoints, quotas, costs. |
| [04-implementation-plan.md](./04-implementation-plan.md) | Phases with acceptance criteria. |
| [05-site-findings.md](./05-site-findings.md) | What this repo already has that the engine builds on. |
| [06-page-plan-schema.md](./06-page-plan-schema.md) | The JSON contract for a page plan. This is the engine's main output. |
| [07-dashboard.md](./07-dashboard.md) | The admin-panel SEO dashboard, page by page. |
| [08-monthly-report.md](./08-monthly-report.md) | What the monthly comparison document contains and how it is produced. |
| [../.env.example](../.env.example) | Every variable the engine and dashboard read. |

## Known values

- Site: https://www.craftui.space. Next.js 16.2, fumadocs-mdx, MongoDB Atlas,
  better-auth, admin panel at `/admin-panel-craft` for `ADMIN_EMAILS`.
- Search Console property: `sc-domain:craftui.space` (Domain property).
- Search traffic baseline (28 days to 2026-11-03): 16 clicks, 82 impressions,
  top queries are brand terms. GSC-based opportunities will be thin at first;
  persona research carries early demand discovery.
- PostHog: US cloud, pageviews with referrer and utm properties captured.
- Target market for search data: United States, English (to confirm).

## Decisions made

1. **Single repo.** Engine code, config, sources and docs live in
   `seo-engine/`. Dashboard routes live under `app/admin-panel-craft/seo/`.
2. **Run data stays out of git.** Every run writes to MongoDB collections
   prefixed `seo_`. Raw API responses are also uploaded as a GitHub Actions
   artifact for debugging. Nothing under `seo-engine/` changes during a run.
3. **Output is page-plan JSON, not drafted pages.** The engine stops at a
   reviewed, ranked plan per page. A human builds the route with AI from the
   JSON and marks the plan as built in the dashboard. No Claude Opus drafting
   in Version 1.
4. **Monthly cadence.** One run on the 1st of each month, plus a "Run now"
   button in the dashboard.
5. **Monthly report is a generated document** in the dashboard: this month vs
   last month on GSC, AI-referral traffic by engine, per-page results for
   pages built from plans, and Claude's written commentary on what worked.
6. **First run is a dry run** against the DataForSEO sandbox with no Claude
   calls beyond a connectivity check. Real spend starts after a human reviews
   the first run in the dashboard.
7. **Models:** Claude Haiku 5.5 for persona queries and clustering, Claude
   Sonnet 5.5 for page plans and the monthly report commentary.

## Open questions

- Route prefix for new pages: `/guides/<slug>` or `/blog/<slug>`. Affects the
  `routeSuggestion` field in page plans and the sitemap filter.
- Target market: United States and English unless told otherwise.
