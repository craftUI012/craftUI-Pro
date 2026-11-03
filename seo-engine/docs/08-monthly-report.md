# 08 — Monthly report

Produced by `steps/report.ts` at the end of every run, stored in
`seo_report`, shown under Reports in the dashboard, downloadable as
markdown. It answers four questions: how did we do versus last month, which
pages worked, which did not, and how much did AI engines send us.

## Period and comparison

- Period: the 28 days ending 3 days before the run (GSC data lag).
- Previous: the same window from the previous run. The first report has no
  comparison and says so.
- Pages: every `seo_page_plan` with status built and a `builtAt` before the
  period end. A page built mid-period is labelled "partial month".

## Sections

1. **Headline** (numbers table, then one paragraph)
   - Site-wide GSC: clicks, impressions, CTR, average position, number of
     queries with impressions. This month, last month, delta.
   - AI-referral sessions total, delta.
   - Pages built from plans to date; built this month.
2. **AI engines** (table): sessions by engine (ChatGPT, Perplexity, Claude,
   Gemini, Copilot, other AI) this month vs last, and the top landing pages
   per engine. This is what "AI engine mentions" means in Version 1: traffic
   that arrived from an AI engine. Checking whether the engines cite us in
   their answers is the Version 2 visibility tracker (see Phase 7).
3. **Pages from plans** (table, one row per built page): target query,
   built date, clicks, impressions, position, AI sessions, delta vs last
   month, verdict (working, early, not working). Verdict rules:
   - working: impressions up and position improved or clicks > 0
   - early: built less than 45 days ago and no verdict possible
   - not working: 45+ days, impressions flat or down and position worse
     than 20
4. **What worked** and **What did not**: Claude Sonnet writes two short
   lists from the tables, naming pages and queries, each point tied to a
   number. It also proposes one concrete next step per "not working" page
   (refresh, change target query, merge, or drop). Dry runs and the first
   run skip this section.
5. **Opportunities and plans**: counts from this run, top 5 new plans with
   score and target query, number of plans waiting for a decision.
6. **Engine health**: run duration, cost by service, caps hit, failed steps.

## Generation

- Numbers come straight from `seo_page_metric`, `seo_gsc_row`,
  `seo_ai_referral` and the previous run's rows. No model writes numbers.
- Commentary: one Claude Sonnet call with the tables as input and a strict
  output schema (`worked[]`, `didNotWork[]`, `nextSteps[]`, `summary`),
  effort medium. The rendered markdown embeds the commentary under the
  tables.
- The report is immutable once written. A re-run of the same `runId`
  overwrites it.

## Markdown layout (what the download looks like)

```
# SEO report — November 2026 (run 2026-12-01)

## Headline
| Metric | This month | Last month | Change |
...
Summary paragraph.

## AI engines
| Engine | Sessions | Last month | Change | Top landing page |
...

## Pages built from plans
| Page | Target query | Built | Clicks | Impr. | Pos. | AI sessions | Change | Verdict |
...

## What worked
- ...

## What did not
- ...

## Next steps
- ...

## New opportunities and plans
...

## Engine health
...
```
