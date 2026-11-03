# 06 — Page plan JSON

The engine's main output. One document per proposed page, stored in
`seo_page_plan.plan`, shown in the dashboard, and copied or downloaded as a
file named `<slug>.plan.json`. Built to be pasted into an AI session together
with a short instruction ("build this page in craftUI-Pro following the
plan") so the page can be created without re-deriving the research.

The zod schema in `seo-engine/db/schema.ts` is the source of truth; this is
the human-readable version.

```jsonc
{
  "schemaVersion": 1,
  "planId": "2026-12-01-shadcn-pricing-section",
  "runId": "2026-12-01",
  "status": "proposed",                       // proposed | accepted | rejected | built

  // Where and what
  "slug": "shadcn-pricing-section",
  "routeSuggestion": "/guides/shadcn-pricing-section",
  "pageType": "guide",                         // guide | comparison | listicle | landing | faq
  "title": "shadcn/ui pricing section: 7 production-ready patterns",  // ≤ 60 chars target
  "metaDescription": "...",                    // ≤ 155 chars
  "h1": "...",

  // Demand
  "targetQuery": "shadcn pricing section",
  "relatedQueries": ["shadcn pricing table", "tailwind pricing component", "..."],
  "intent": "commercial",                      // informational | commercial | transactional | navigational
  "monthlyVolume": { "target": 480, "related": 1900, "total": 2380 },
  "evidence": {
    "gsc": { "impressions": 12, "clicks": 0, "position": 23.4, "page": null },   // null if we don't rank
    "aiReferrals": { "sessions": 0, "landingPages": [] },
    "persona": "Indie SaaS founder shipping a landing page this week"
  },

  // What the SERP looks like
  "serp": {
    "fetchedAt": "2026-12-01",
    "topResults": [
      { "rank": 1, "url": "...", "title": "...", "domain": "...", "covers": "one-line summary of what it offers" }
    ],
    "peopleAlsoAsk": ["...", "..."],
    "relatedSearches": ["...", "..."],
    "weakness": "Top results are generic Tailwind snippets; none show a shadcn-native, animated section with real copy."
  },

  // What our page should be
  "angle": "The one-sentence reason this page beats the top results.",
  "gaps": ["What the top results miss, one per line"],
  "outline": [
    { "heading": "H2 text", "points": ["what to cover", "..."], "componentRefs": ["pricing-01", "pricing-03"] }
  ],
  "faq": [{ "question": "...", "answer": "short answer the page should give" }],
  "internalLinks": [{ "url": "/docs/blocks/pricing", "anchor": "pricing blocks" }],
  "cta": { "text": "Browse pricing blocks", "url": "/docs/blocks/pricing" },
  "structuredData": ["Article", "FAQPage"],   // JSON-LD types to emit (seo/json-ld.tsx)
  "sources": ["seo-engine/sources/blocks.md", "content/docs/blocks/pricing.mdx"],
  "writingNotes": "Tone, length (e.g. 900–1400 words), code sample expectations, what not to claim.",

  // Why it ranked where it did
  "score": 0.82,
  "scoreBreakdown": { "volume": 0.6, "gscEvidence": 0.1, "aiEvidence": 0.0, "serpWeakness": 0.9, "fit": 0.9 },

  // Human decisions (set by the dashboard, not the engine)
  "decision": { "by": "nil@craftui.space", "at": "2026-12-03T10:21:00Z", "reason": null },
  "builtUrl": null,
  "builtAt": null
}
```

## Field rules

- `slug`, `routeSuggestion`, `title`, `metaDescription` must be unique across
  all non-rejected plans and absent from the live sitemap.
- `componentRefs` point at registry item names in `registry.json` so the
  page can embed real craftUI blocks. The engine fills these from the
  registry; the planner only proposes them when relevant.
- `sources` must list at least one file. The dashboard flags a plan with
  empty sources.
- `monthlyVolume.total` is the sum over target plus related, deduplicated.
- `score` is in `[0, 1]`; the breakdown weights live in `config/engine.json`.

## Using a plan to build a page

Suggested instruction to give an AI session in this repo:

> Build the page described in the attached plan JSON. Create it as an entry
> in the `seoPages` fumadocs collection (`content/seo-pages/<slug>.mdx`) with
> frontmatter from `title`, `metaDescription`, `targetQuery`, `intent`,
> `planId`, `status: published`. Follow `outline`, answer every `faq`, embed
> the registry items in `componentRefs`, link every `internalLinks` entry,
> end with the `cta`, emit the `structuredData` types. Use only facts found in
> `sources`. Run `pnpm check` and `pnpm typecheck`.

Then mark the plan as built in the dashboard with the live URL.
