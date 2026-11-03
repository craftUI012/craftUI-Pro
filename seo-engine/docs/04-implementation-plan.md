# 04 — Implementation plan

Six phases plus an optional seventh. Each ends with something you can open
in the dashboard. No Claude spend until Phase 2, no DataForSEO spend until a
human has reviewed the first dry run.

## Phase 0 — Scaffold, database, access check

1. Add dev dependencies (googleapis, @anthropic-ai/sdk, p-limit, tsx) and
   package scripts `seo:check`, `seo:run`.
2. `seo-engine/pipeline/lib/env.ts`: zod-validated env; loads `.env` locally.
3. `seo-engine/db/schema.ts` and `db/collections.ts`: every `seo_*`
   document type and index, following `lib/db/index.ts` conventions.
4. `seo-engine/config/engine.json`, `ai-referrers.json`, `personas.md`
   template.
5. `seo-engine/pipeline/check.ts`: one call per service (GSC `sites.list`,
   PostHog count, DataForSEO balance, Anthropic short message, MongoDB
   ping, sitemap fetch); stores the result on a `seo_run` with mode `check`.
6. `.github/workflows/seo-engine.yml` with `workflow_dispatch` only.
7. Dashboard skeleton: `ROUTES.SEO_ENGINE`, AdminNav entry, Overview page
   showing the latest `seo_run` (so the check result is visible) and the
   Settings page.
8. Make `pnpm check` and `pnpm typecheck` pass with the new code.

Done when: `pnpm seo:check` is green locally and from Actions, and the
Overview page shows that run.

## Phase 1 — Collect, opportunities, runs in the dashboard (dry run)

1. `lib/run-context.ts`, `lib/usage.ts`: run document lifecycle, step
   timings, cost accounting.
2. `lib/gsc.ts` + `steps/collect-gsc.ts` → `seo_gsc_row`.
3. `lib/posthog.ts` + `steps/collect-posthog.ts` → `seo_ai_referral`, with
   engine classification from `ai-referrers.json`.
4. `lib/sitemap.ts`: fetch and parse the live sitemap.
5. `steps/find-opportunities.ts` → `seo_opportunity` (striking distance,
   no matching page, AI-referred) with thresholds from `engine.json`.
6. `run.ts` with `--date`, `--from`, `--only`, `--dry-run`.
7. Workflow: artifact upload, failure issue.
8. Dashboard: Runs list and detail, Opportunities page, Overview KPI tiles
   (single month, no comparison yet).

Done when: a manual dry run from Actions shows up in the dashboard with
rows in every table, and you have looked at the opportunities and adjusted
thresholds in `engine.json`.

## Phase 2 — Persona research

1. `lib/claude.ts`: client, model map, usage accounting, `structured()`
   helper (`messages.parse()` with one retry).
2. `steps/research-serp.ts`: Claude Haiku turns `personas.md` into 50 to
   100 queries; DataForSEO SERP for each; one level of PAA and related
   expansion; volume for every unique query; drop below the minimum volume.
   → `seo_query`, raw SERP into the artifact. Caps enforced.
3. Dashboard: a Queries tab under Opportunities (source tags, volume,
   competition), and research counts plus DataForSEO cost on the run.

Done when: a sandbox run completes under the caps, then one real run
produces volumes you spot-check by hand.

## Phase 3 — Cluster and page plans

1. `steps/cluster.ts`: Claude Haiku groups queries into intent topics;
   chunked at 300 queries with a merge pass; duplicate check against the
   sitemap, accepted and built plans, and rejected topics → `seo_topic`
   with rank.
2. `steps/plan-pages.ts`: Claude Sonnet writes a page plan per top topic,
   validated against the schema in 06-page-plan-schema.md; `componentRefs`
   resolved against `registry.json` → `seo_page_plan` (proposed).
3. Dashboard: Plans list with status tabs, plan detail with the four
   panels, Copy JSON, Download, Copy build prompt, Accept and Reject.

Done when: you read one run's plans and would build at least half of them.
If not, prompts and scoring weights are tuned before moving on.

## Phase 4 — Build loop, measurement and submission

1. First page built from a plan by you with AI. This creates the
   `seoPages` fumadocs collection, the route, and the sitemap extension
   (described in 06-page-plan-schema.md). The engine's part is the Mark
   built action.
2. `markPlanBuilt` and `submitUrl` server actions (GSC sitemap submit +
   IndexNow), with `public/<INDEXNOW_KEY>.txt` added.
3. `steps/measure-pages.ts` → `seo_page_metric` for every built plan.
4. Dashboard: metrics panel on built plans.

Done when: a built page shows metrics in its plan after the next run and
the submit action reports success from both Google and IndexNow.

## Phase 5 — Monthly report and schedule

1. `steps/report.ts`: KPIs this month vs last, AI engines table, pages
   table with verdicts, Claude Sonnet commentary (worked, did not work,
   next steps), engine health → `seo_report`.
2. Dashboard: Reports list and detail with Download .md; Overview tiles
   gain deltas and the latest report summary.
3. Enable the monthly cron; `triggerRun` action and Run now button.
4. `docs/09-runbook.md`: local run, resume a step, change thresholds,
   rotate keys, what to check when numbers look wrong.

Done when: two consecutive monthly runs complete unattended and the second
report compares against the first.

## Phase 6 — Hardening (as needed)

- Replace the fine-grained tokens with a GitHub App.
- Cache persona queries across runs when `personas.md` is unchanged.
- Tune verdict rules and scoring weights from real reports.

## Phase 7 — Optional, Version 2 candidates

- **AI visibility tracker:** ask ChatGPT, Perplexity, Claude and Gemini a
  sample of persona questions each month and record whether craftui.space
  is cited. This is what turns "AI engine mentions" from traffic counts
  into citation counts.
- Claude Opus drafting of full MDX from a plan, opened as a PR.
- Content decay alerts and refresh suggestions for built pages.

## What I need from you per phase

| Phase | Needed before starting |
|---|---|
| 0 | Service account JSON, PostHog key and project ID, DataForSEO login, Anthropic key, `MONGODB_URI` as a GitHub secret |
| 1 | Nothing more |
| 2 | `seo-engine/config/personas.md` written; target market confirmed |
| 3 | Route prefix decision (`/guides/` or `/blog/`) |
| 4 | IndexNow key file added; Google and IndexNow variables on Vercel |
| 5 | Fine-grained token for workflow dispatch on Vercel |
