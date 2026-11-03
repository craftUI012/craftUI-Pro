# 03 — SDKs, APIs, quotas and costs

Versions are the latest on npm as of 2026-11-03.

## Packages to add (all dev dependencies; nothing ships to the browser)

| Package | Version | Used for |
|---|---|---|
| `googleapis` | 189.0.0 | Search Console: `searchanalytics.query`, `sites.list`, `sitemaps.submit` (pipeline and dashboard submit action) |
| `@anthropic-ai/sdk` | 1.4.0 | Claude: persona queries, clustering, page plans, report commentary |
| `p-limit` | 7.3.3 | Concurrency caps (PostHog 3, DataForSEO 5, Claude 2) |
| `tsx` | 4.23.15 | Run the pipeline without a build step |

Already in the repo and reused: `zod`, `mongodb`, `date-fns`. The dashboard
submit action runs on Vercel, so `googleapis` must be a regular dependency
if it is imported from a server action; otherwise keep it dev-only.

PostHog, DataForSEO, IndexNow and the GitHub dispatch call use `fetch`.

## Google Search Console API

- Auth: `google.auth.GoogleAuth` with the service account JSON and scope
  `https://www.googleapis.com/auth/webmasters`.
- Client: `google.searchconsole({ version: "v1", auth })`.
- Query: `searchanalytics.query({ siteUrl: "sc-domain:craftui.space", requestBody: { startDate, endDate, dimensions: ["query", "page"], type: "web", rowLimit: 25000, startRow, dataState: "final" } })`, loop while a page returns 25,000 rows. A second pull with `dimensions: ["page"]` gives per-page totals for the report.
- Window: `endDate = today - 3`, `startDate = endDate - 27`.
- Submit: `sitemaps.submit({ siteUrl, feedpath: "https://www.craftui.space/sitemap.xml" })`.
- Quotas: about 1,200 queries per minute per site, 40,000 per day per project. A run uses well under 100.
- Cost: free.

## PostHog HogQL

- `POST https://us.posthog.com/api/projects/{id}/query/` with
  `Authorization: Bearer phx_...` and body
  `{ "query": { "kind": "HogQLQuery", "query": "<sql>" } }`.
- AI referrals, 28 days:
  ```sql
  SELECT properties.$pathname AS landing_page,
         properties.$referring_domain AS referrer,
         count(DISTINCT properties.$session_id) AS sessions
  FROM events
  WHERE event = '$pageview'
    AND timestamp > now() - INTERVAL 28 DAY
    AND properties.environment = 'production'
    AND (properties.$referring_domain IN (<domains>)
         OR lower(toString(properties.utm_source)) IN (<utm sources>))
  GROUP BY landing_page, referrer
  ORDER BY sessions DESC
  LIMIT 500
  ```
  The `environment` filter matches what `instrumentation-client.ts`
  registers, so local and preview traffic is excluded. Domains and utm
  sources come from `config/ai-referrers.json`.
- Limits: roughly 120 query requests per hour; keep concurrency at 3.
- Cost: included in the plan.

## DataForSEO

- Base `https://api.dataforseo.com/v3`, sandbox `https://sandbox.dataforseo.com/v3`.
- Auth: `Authorization: Basic base64(login:password)`.
- SERP: `POST /serp/google/organic/live/advanced`, body
  `[{ keyword, location_code: 2840, language_code: "en", device: "desktop", depth: 10 }]`.
  Items of type `organic`, `people_also_ask`, `related_searches`. Check
  `tasks[].status_code === 20000`.
- Volume: `POST /keywords_data/google_ads/search_volume/live`, body
  `[{ keywords: [...≤1000], location_code, language_code }]`.
- Rate: generous (2,000 calls per minute); we use 5 concurrent.
- Cost: a live SERP page is a fraction of a cent; volume is a few cents per
  task of up to 1,000 keywords. A run with 400 SERP lookups and 1,000 volume
  checks is about $1 to $2. Confirm on https://dataforseo.com/pricing.
- Caching: responses are written to the run's temp folder (then the
  artifact) and reused when a step is re-run for the same `runId`.

## Anthropic Claude API

| Role | Model | Input $/M | Output $/M |
|---|---|---|---|
| Persona queries, clustering | `claude-haiku-5-5` | $0.10 | $0.50 |
| Page plans, report commentary | `claude-sonnet-5-5` | $2.00 | $10.00 |

- Structured output via `output_config.format` with the zod-derived JSON
  schema and `messages.parse()`. No prefill.
- Adaptive thinking is on by default; `output_config.effort` `low` for
  Haiku tasks, `medium` for plans and commentary.
- Prompt caching on the persona file and the source material.
- Rough cost per run (10 plans): Haiku work under $0.05, 10 plans about
  $0.60, report commentary about $0.05. **Under $1 per run.** Twelve runs a
  year fit comfortably inside the $100 credit, which is why dropping Opus
  drafting from Version 1 matters.

## IndexNow

- `POST https://api.indexnow.org/indexnow`, JSON
  `{ host: "www.craftui.space", key, keyLocation: "https://www.craftui.space/<key>.txt", urlList: [...] }`.
- `200`/`202` accepted, `403` key file not verified, `422` URL not on host.
- Free.

## GitHub Actions

- Workflow dispatch from the dashboard:
  `POST https://api.github.com/repos/craftUI012/craftUI-Pro/actions/workflows/seo-engine.yml/dispatches`
  with `{ ref: "main", inputs: { dry_run: "true" | "false" } }` and the
  fine-grained token.
- Schedule: `cron: "17 5 1 * *"` (05:17 UTC on the 1st; off the hour to
  avoid queue delays).
- Artifact: `actions/upload-artifact@v4`, `retention-days: 180`, always
  runs (`if: always()`).
- Failure issue: `actions/github-script` creating an issue labelled
  `seo-engine` with the failing step and resume command.
