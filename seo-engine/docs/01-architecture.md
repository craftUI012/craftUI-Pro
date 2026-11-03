# 01 — Architecture

## One repo, three parts

```
craftUI-Pro
├── seo-engine/                      # dedicated folder: everything that is not a route
│   ├── pipeline/                    # the monthly run (TypeScript, run with tsx)
│   │   ├── run.ts                   # orchestrates steps; --date --from --only --dry-run
│   │   ├── check.ts                 # pings every service once
│   │   ├── steps/
│   │   │   ├── collect-gsc.ts
│   │   │   ├── collect-posthog.ts
│   │   │   ├── find-opportunities.ts
│   │   │   ├── research-serp.ts
│   │   │   ├── cluster.ts
│   │   │   ├── plan-pages.ts        # writes page-plan JSON (06-page-plan-schema.md)
│   │   │   ├── measure-pages.ts     # performance of pages built from earlier plans
│   │   │   └── report.ts            # the monthly comparison document (08-monthly-report.md)
│   │   └── lib/
│   │       ├── env.ts  run-context.ts  gsc.ts  posthog.ts  dataforseo.ts
│   │       ├── claude.ts  sitemap.ts  usage.ts
│   ├── db/                          # MongoDB access shared by pipeline and dashboard
│   │   ├── collections.ts           # typed collections + indexes (seo_*)
│   │   └── schema.ts                # zod schemas = TS types for every document
│   ├── config/
│   │   ├── engine.json              # site, locale, thresholds, caps
│   │   ├── personas.md              # written by a human
│   │   └── ai-referrers.json
│   ├── sources/                     # real product material for Claude (public repo: write accordingly)
│   ├── docs/                        # these files
│   └── .env.example
├── app/admin-panel-craft/seo/       # dashboard routes (07-dashboard.md)
│   ├── page.tsx                     # overview
│   ├── runs/[runId]/page.tsx
│   ├── opportunities/page.tsx
│   ├── plans/page.tsx  plans/[planId]/page.tsx
│   ├── reports/page.tsx  reports/[reportId]/page.tsx
│   └── actions.ts                   # mark plan accepted/rejected/built, trigger run, submit URLs
├── components/admin-panel/seo/      # dashboard components
├── lib/seo-engine/                  # dashboard read layer (queries over seo_* collections)
└── .github/workflows/seo-engine.yml # cron monthly + workflow_dispatch
```

The pipeline imports from `seo-engine/db` and the dashboard imports from
`lib/seo-engine` which imports the same `seo-engine/db`. One schema, two
readers. The pipeline never imports from `app/` or `components/`.

The existing `seo/` folder (metadata helpers, JSON-LD) is untouched and
unrelated; the new folder is named `seo-engine/` to keep them apart.

## Where things run

| Part | Runs where | Needs |
|---|---|---|
| Pipeline | GitHub Actions in this repo (monthly cron, manual dispatch) or locally with `pnpm seo:run` | all API secrets + `MONGODB_URI` |
| Dashboard | Vercel, inside the admin panel, server components + server actions | `MONGODB_URI` (already set), plus Google and IndexNow secrets for the submit action, plus a GitHub token for the "Run now" button |
| Page building | A human with AI, from the page plan JSON | nothing from the engine |

The pipeline is not a Vercel route because a run takes minutes and calls
hundreds of external APIs; Actions is the right place for that.

## Data flow per run

| # | Step | Reads | Writes (MongoDB) |
|---|---|---|---|
| 0 | run start | config | `seo_run` (status: running, steps: []) |
| 1 | collect-gsc | GSC 28-day window, query+page and page-only | `seo_gsc_row` (one per query+page), `seo_run.totals.gsc` |
| 2 | collect-posthog | AI-referral pageviews grouped by landing page and engine | `seo_ai_referral` |
| 3 | find-opportunities | steps 1 and 2, live sitemap | `seo_opportunity` |
| 4 | research-serp | personas.md → Claude Haiku → DataForSEO SERP + volume | `seo_query` (every query with source tags and volume), raw SERP into the artifact |
| 5 | cluster | `seo_query` + opportunities + sitemap + existing plans | `seo_topic` |
| 6 | plan-pages | top topics → Claude Sonnet | `seo_page_plan` (status: proposed) |
| 7 | measure-pages | plans with status built + their URLs → GSC + PostHog | `seo_page_metric` (one per page per run) |
| 8 | report | everything above + previous run → Claude Sonnet commentary | `seo_report` |
| 9 | run end | | `seo_run` (status: done, usage, cost) |

A dry run executes 1 to 5 and 7 to 9 with DataForSEO pointed at the sandbox
and skips Claude in steps 4, 6 and 8 (step 4 uses a fixed sample query list
from `config/engine.json`, step 8 writes the numbers without commentary).

Each step records `{ name, startedAt, finishedAt, status, error?, counts }`
into `seo_run.steps`. A failed run keeps everything written so far; re-running
with `--date <same> --from <step>` continues.

## MongoDB collections

All prefixed `seo_` so they sit apart from users, purchases and resources.
Indexes are declared in `seo-engine/db/collections.ts` and created on first
use, the same way `lib/db/index.ts` does for the existing collections.

| Collection | Key fields | Notes |
|---|---|---|
| `seo_run` | `runId` (YYYY-MM-DD), `status`, `mode` (dry/full), `startedAt`, `finishedAt`, `steps[]`, `usage` (tokens, API calls, cost by service), `totals` | one per run; unique on `runId` |
| `seo_gsc_row` | `runId`, `query`, `page`, `clicks`, `impressions`, `ctr`, `position` | ~thousands per run; index `(runId, impressions desc)` |
| `seo_ai_referral` | `runId`, `landingPage`, `engine` (chatgpt, perplexity, claude, gemini, copilot, other), `sessions` | index `(runId, sessions desc)` |
| `seo_opportunity` | `runId`, `kind` (striking-distance, no-matching-page, ai-referred), `query`, `page`, `evidence`, `score` | |
| `seo_query` | `runId`, `query`, `sources[]` (gsc, posthog, persona, paa, related), `monthlyVolume`, `competition`, `serpRef` | unique on `(runId, query)` |
| `seo_topic` | `runId`, `name`, `intent`, `primaryQuery`, `queries[]`, `totalVolume`, `existingUrl?`, `score`, `rank` | |
| `seo_page_plan` | `planId`, `runId`, `topicId`, `status` (proposed, accepted, rejected, built), `builtUrl?`, `builtAt?`, `plan` (the JSON in 06-page-plan-schema.md) | status changes come from the dashboard |
| `seo_page_metric` | `runId`, `planId`, `url`, `gsc` {clicks, impressions, position}, `aiSessions` {by engine}, `window` | one row per built page per run |
| `seo_report` | `reportId`, `runId`, `previousRunId?`, `period`, `kpis` (this vs previous), `pages[]`, `aiEngines[]`, `commentary` (markdown), `createdAt` | the monthly document |

Raw API responses (GSC pages, SERP JSON, volume JSON) are not stored in
MongoDB. The workflow zips the run's temp folder and uploads it as an
artifact named `seo-run-<runId>` for 180 days.

## Page plan lifecycle

```
proposed ──(dashboard: Accept)──▶ accepted ──(human builds page with AI, dashboard: Mark built + URL)──▶ built
    │                                                                                                   │
    └──(dashboard: Reject, with reason)──▶ rejected                            next runs: measure-pages ◀┘
```

- `proposed`: written by the engine. Visible in the dashboard with the JSON,
  the evidence and a Copy JSON / Download button.
- `accepted`: you intend to build it. Stays in the queue.
- `built`: you entered the live URL. The submit action can push the sitemap to
  Google and the URL to IndexNow right then. From the next run on, the page
  gets a `seo_page_metric` row and appears in the monthly report.
- `rejected`: kept with a reason so the next run's clustering does not
  propose the same topic again (rejected topics are passed to Claude as
  "already declined").

Duplicate protection in step 5 uses three lists: live sitemap URLs, plans
with status accepted or built, and rejected topics.

## Run lifecycle in GitHub Actions

1. Cron fires at 05:17 UTC on the 1st, or the dashboard's Run now button
   calls the workflow dispatch API, or a human runs it from the Actions tab.
2. Job checks out the repo, installs with pnpm, writes the Google service
   account JSON secret to a temp file, runs `pnpm seo:run`.
3. The run writes to MongoDB as it goes. The dashboard shows progress from
   `seo_run.steps`.
4. On exit (success or failure) the job uploads the temp folder as an
   artifact. Nothing is committed.
5. On failure the job also opens a GitHub issue with the failing step and
   the resume command.

## Guardrails

- Caps from `config/engine.json`: SERP lookups per run, plans per run,
  total Claude tokens per run. A hit cap stops the run with status
  `stopped-cap` and the dashboard says which cap.
- Every Claude call uses structured output validated against the zod schema
  in `seo-engine/db/schema.ts`, one retry on schema failure.
- `seo-engine/sources/` and `config/personas.md` are public, since the repo
  is public. Write them as marketing-safe product descriptions; nothing
  confidential goes in there.
- The dashboard is behind `requireAdminPage()` like the rest of the admin
  panel, never indexed, disallowed in robots.txt already.
