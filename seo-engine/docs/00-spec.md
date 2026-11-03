# SEO Page Engine — Version 1 (original spec)

> **Kept for reference. Superseded in these points by the decisions in
> [README.md](./README.md) and [01-architecture.md](./01-architecture.md):**
> the engine lives in this repo (craftUI-Pro), runs **monthly**, stores run
> data in **MongoDB** instead of git, produces **page-plan JSON** instead of
> MDX drafts (a human builds the page with AI from that JSON), and has an
> **admin dashboard** instead of a markdown report in the repo. The monthly
> report is a document generated into the dashboard that compares with the
> previous month.

## Goal

Bring more users to our Next.js website by publishing focused pages for the searches our customers actually make, on Google and through AI tools (ChatGPT, Perplexity, Claude, etc.).

Twice a month the system will:
1. Find demand: queries we already appear for, pages AI tools send people to, and searches our target customers are likely to make.
2. Decide which pages are missing or weak.
3. Draft those pages with Claude for human review.
4. Publish them, update the sitemap, and notify Google and Bing.

Success metric: growth in GSC impressions/clicks and AI-referral sessions to the new pages, measured run over run.

---

## Data sources

| Source | What we get | How |
|---|---|---|
| Google Search Console | Queries, pages, clicks, impressions, average position | Search Console API (`searchanalytics.query`) |
| PostHog | AI-referral traffic: which pages ChatGPT/Perplexity/Claude/Gemini users land on | HogQL query API, filter `$referrer` / `utm_source` |
| SERP API | Top results, "People also ask", related searches for a query | DataForSEO (or Serper) |
| Keyword volume | Monthly search volume per query | DataForSEO Keywords Data API (or Google Ads Keyword Planner API) |

Note: AI tools do not pass the user's prompt. From PostHog we only know *that* a visitor came from an AI tool and *which page* they landed on, not what they asked.

---

## How it works (pipeline)

Runs on the 1st and 15th of each month.

### Step 1 — Collect
- **GSC:** last 28 days, dimensions `query` + `page`, paginated (25k rows per request).
- **PostHog:** sessions where the referrer matches `chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com`, or `utm_source` contains one of these. Group by landing page, count sessions.
- Save raw data as JSON in `data/runs/<date>/`.

### Step 2 — Find opportunities
- **Striking distance (GSC):** queries ranking in positions 8–20 with meaningful impressions → improve the existing page or create a dedicated one.
- **No matching page (GSC):** queries with impressions where the ranking page is only loosely related.
- **AI-referred pages (PostHog):** pages that AI tools send traffic to → create related pages around the same topic.

### Step 3 — Persona search research (our own "keyword ideas")
1. Claude reads `config/personas.md` (our target customers) and generates 50–100 realistic searches.
2. Each search goes through the SERP API → top 10 results, "People also ask", related searches.
3. Expand one level: related searches and PAA questions become new queries.
4. Fetch search volume for all queries and drop those with ~zero demand.

### Step 4 — Cluster and plan
- Claude (Haiku/Sonnet) groups all queries from Steps 2–3 into **topics by search intent**: one page per intent, not one page per keyword.
- Each topic is compared against our current sitemap so we don't create duplicates.
- Output: a ranked list of page briefs (target query, related queries, intent, what top results cover, what we can add, suggested internal links).

### Step 5 — Draft
- Claude Opus writes each page from the brief **plus our real material** (product info, docs, FAQs, support answers in `content/sources/`).
- Output: MDX file with frontmatter (`title`, `description`, `slug`, `targetQuery`, `status: draft`) in `content/seo-pages/`.
- Cap per run: ~10 pages. Quality over volume (Google penalizes scaled thin content).

### Step 6 — Review and publish
- A human reviews drafts and switches `status` to `published` (via pull request).
- Next.js renders published pages; `app/sitemap.ts` includes them automatically.

### Step 7 — Notify search engines
- **Google:** `sitemaps.submit` via the Search Console API (service account with Owner access in GSC).
- **Bing / IndexNow:** POST new URLs to IndexNow (also helps ChatGPT search, which relies partly on Bing).
- Triggered after deploy.

### Step 8 — Report
- Each run writes `data/runs/<date>/report.md`: opportunities found, pages drafted, and GSC/AI-traffic performance of pages from previous runs.

---

## External libraries and services

| Package / service | Purpose |
|---|---|
| `googleapis` | Search Console API: query data and submit sitemap |
| `@anthropic-ai/sdk` | Claude API: query generation, clustering, briefs, drafts |
| PostHog HogQL API (plain `fetch`) | AI-referral queries (personal API key `phx_...`) |
| DataForSEO API (plain `fetch`) | SERP results, PAA, related searches, search volume |
| `zod` | Validate API responses and Claude's structured output |
| `gray-matter` | Read/write MDX frontmatter |
| `next-mdx-remote` (or existing MDX setup) | Render generated pages in Next.js |
| `p-limit` | Rate-limit API calls (PostHog: max 3 concurrent queries) |
| `dotenv` | Load secrets locally |
| GitHub Actions (cron) | Run the pipeline on the 1st and 15th; open a PR with drafts |
| IndexNow (plain `fetch`) | Notify Bing of new URLs |

### Credentials needed
- Google Cloud service account JSON (Search Console API enabled, added as Owner in GSC)
- PostHog personal API key + project ID
- Anthropic API key
- DataForSEO login/password
- IndexNow key (text file hosted at site root)

---

## Model and budget plan ($100 Claude credit)

| Task | Model |
|---|---|
| Generate persona searches, cluster queries | Claude Haiku / Sonnet |
| Write page briefs | Claude Sonnet |
| Write final pages | Claude Opus |

- Cap pages per run (~10) and log token usage per run in the report.
- SERP and volume lookups cost fractions of a cent each; budget a few thousand per month.

---

## Proposed folder structure

```
scripts/seo-engine/
  collect-gsc.ts
  collect-posthog.ts
  research-serp.ts
  cluster.ts
  draft.ts
  submit.ts        # sitemap + IndexNow
  run.ts           # runs the whole pipeline
config/
  personas.md
  ai-referrers.json
content/
  sources/         # real product material for Claude
  seo-pages/       # generated MDX pages
data/runs/<date>/  # raw data + report
app/sitemap.ts
```

---

## In scope (Version 1)

- GSC query collection and striking-distance / missing-page detection
- PostHog AI-referral landing-page analysis
- Persona → SERP API → PAA/related-search research with volume check
- Claude clustering, briefs, and MDX drafts
- Human review via pull request before publishing
- Automatic sitemap (`app/sitemap.ts`)
- Automatic sitemap submission to GSC + IndexNow ping
- Twice-monthly schedule and a run report

## Out of scope (Version 1)

- Publishing without human review
- Rank tracker (weekly positions)
- Content decay alerts and automatic page refreshes
- Keyword cannibalization detection
- Automatic internal linking across existing pages (V1 only suggests links in briefs)
- Competitor gap analysis
- AI visibility tracker (asking ChatGPT/Claude/Perplexity our customers' questions and checking whether we are cited)
- Backlink data or a web-wide keyword database
- A dashboard UI (V1 is scripts + reports + PRs)
- Multi-language pages
- Google Indexing API (officially only for job posting and livestream pages)

## Candidates for Version 2

AI visibility tracker, rank tracker, content decay alerts, cannibalization check, automatic internal linking, and a small admin dashboard in Next.js.
