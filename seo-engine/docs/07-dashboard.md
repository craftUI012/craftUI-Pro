# 07 — Admin dashboard (SEO section)

Lives under the existing admin panel at `/admin-panel-craft/seo`. Same
guard (`requireAdminPage()`), same layout and nav (`AdminNav` gets an "SEO"
entry), same UI kit (`components/ui/*`, Card, Table, Badge). Server
components read through `lib/seo-engine/*`; mutations are server actions in
`app/admin-panel-craft/seo/actions.ts`.

Route constant: `ROUTES.SEO_ENGINE = "/admin-panel-craft/seo"`.

## Pages

### Overview — `/admin-panel-craft/seo`

- KPI tiles, this month vs last month with delta and arrow: GSC clicks,
  GSC impressions, average position, AI-referral sessions, pages built from
  plans, plans waiting for a decision.
- Last run card: run date, mode (dry/full), status, duration, cost by
  service, link to run detail. If a run is in progress, a step list with live
  status (page refreshes on an interval).
- "Run now" button (server action → GitHub workflow dispatch; disabled while
  a run is in progress). Dry-run checkbox next to it.
- Latest report: title, three-line summary, link.
- Top 5 proposed plans by score with Accept / Reject inline.

### Runs — `/admin-panel-craft/seo/runs` and `/runs/[runId]`

- List: runId, mode, status, started, duration, cost, counts (queries,
  topics, plans), artifact link (GitHub Actions run URL stored on the run).
- Detail: steps table with timings and errors; usage table (Claude tokens
  by model, DataForSEO calls, GSC calls, PostHog queries, estimated cost);
  caps hit; the resume command when failed.

### Opportunities — `/admin-panel-craft/seo/opportunities`

- Filter by run and kind (striking distance, no matching page, AI-referred).
- Table: query, page, impressions, clicks, position, sessions, score.
- Purpose: see what GSC and PostHog say before the engine's own research
  adds to it. Mostly empty in the first months given the traffic baseline.

### Plans — `/admin-panel-craft/seo/plans` and `/plans/[planId]`

- List with tabs by status: Proposed, Accepted, Built, Rejected. Columns:
  title, target query, intent, total volume, score, run, decision date.
- Detail:
  - Header: title, route suggestion, status badge, score with breakdown.
  - Demand panel: target and related queries with volumes, intent, evidence.
  - SERP panel: top results with "covers" notes, PAA, related searches,
    weakness.
  - Plan panel: angle, gaps, outline, FAQ, internal links, CTA, sources,
    writing notes.
  - JSON panel: the full plan, pretty-printed, with **Copy JSON** and
    **Download .plan.json** buttons, plus a **Copy build prompt** button that
    copies the instruction from 06-page-plan-schema.md with the JSON inlined.
  - Actions: Accept, Reject (reason required), Mark built (live URL
    required; validates the URL is on the site and returns 200), and after
    built: **Submit to search engines** (GSC sitemap submit + IndexNow for
    that URL; shows the responses).
  - Metrics panel (built plans only): per-run clicks, impressions, position,
    AI sessions since built.

### Reports — `/admin-panel-craft/seo/reports` and `/reports/[reportId]`

- List: period, run, created, headline deltas.
- Detail: the monthly document (08-monthly-report.md) rendered from
  markdown with the KPI table, AI-engine table, pages table and commentary.
  **Download .md** button.

### Settings (read-only) — `/admin-panel-craft/seo/settings`

- Shows the effective `config/engine.json`, the persona file's first lines,
  the list of source files, and a service check (last `check.ts` result
  stored on the latest run). Editing stays in git; this page only tells you
  what the next run will use.

## Server actions

| Action | Input | Effect |
|---|---|---|
| `decidePlan` | planId, status (accepted/rejected), reason? | updates `seo_page_plan.status` and `decision` |
| `markPlanBuilt` | planId, url | checks URL host and reachability, sets status built, `builtUrl`, `builtAt` |
| `submitUrl` | planId | GSC `sitemaps.submit` for the site sitemap + IndexNow POST for `builtUrl`; stores responses on the plan |
| `triggerRun` | dryRun: boolean | GitHub API `POST /repos/{owner}/{repo}/actions/workflows/seo-engine.yml/dispatches`; refuses if a run is in progress |

All actions re-check `requireAdmin` themselves, like `actions.ts` in the
admin panel does today.

## Environment the dashboard needs on Vercel

`MONGODB_URI` (exists), `GOOGLE_SERVICE_ACCOUNT_JSON`, `GSC_PROPERTY`,
`INDEXNOW_KEY`, `SEO_GITHUB_TOKEN` (fine-grained, this repo, Actions:
read and write, for the Run now button). The dashboard never needs the
DataForSEO, PostHog or Anthropic keys.
