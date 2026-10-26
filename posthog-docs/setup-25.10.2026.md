# PostHog setup for craftUI

**Set up:** 25 October 2026
**Branch:** `feat/adding-analytics` (the PostHog code is not committed yet)
**Status:** PostHog is configured, the site and the registry send events, and three dashboards are built. They stay empty until real visitors arrive, because local testing is filtered out.

This document records everything that was set up, why, and how to check or extend it. Read it before changing analytics.

**To read the dashboards** (what each chart means and where to find each answer), see **[analytics-guide.md](./analytics-guide.md)**.

---

## 1. Quick reference

| Item | Value |
| --- | --- |
| PostHog region | US Cloud |
| Organisation ID | `01a17293-fc4b-0000-e3f6-0160dbca519a` |
| Project | **craftUI** (ID `686953`) |
| Project token | In `.env` as `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`. It's public by design (it can only send events), but keep it in env vars, not in code. |
| Ingestion host | `https://us.i.posthog.com` (reached through the site's own `/relay` path) |
| App URL | `https://us.posthog.com` |
| Dashboards (all pinned) | [1 · Site usage](https://us.posthog.com/project/686953/dashboard/2257785) (`2257785`), [2 · Installs](https://us.posthog.com/project/686953/dashboard/2257786) (`2257786`), [3 · Pricing & conversion](https://us.posthog.com/project/686953/dashboard/2257063) (`2257063`) |
| Starter dashboard | [Your starter dashboard](https://us.posthog.com/project/686953/dashboard/2256976) (ID `2256976`, auto-created by PostHog, left as is) |
| SDK | `posthog-js` `^1.438.21` |
| Other analytics still running | Vercel Analytics, Vercel Speed Insights, Umami (production only) |

---

## 2. The product, as PostHog understands it

craftUI is a **freemium developer tool**: a UI library for shadcn/ui, sold to individual developers and small teams.

| Part | How it works |
| --- | --- |
| Product | Sections, blocks, illustrations and isometric art, browsed on `/` and documented on `/docs/...` |
| Delivery | A shadcn registry: users run `npx shadcn add <site>/r/<item>.json` |
| Free vs paid | Most items are free. Pro items (`meta.pro` in `registry.json`) show a paywall in their Code view instead of the source |
| Payment | Lifetime or yearly plan through **Dodo Payments** (`/api/checkout` creates the checkout; the webhook `/api/webhooks/dodo` records purchases). Replaced Polar on 25 October 2026 |
| Accounts | better-auth magic-link sign-in, with the email used at checkout |
| Audience | Developers, many of whom run ad blockers |

**The journey we measure:** visit → browse, filter and search → open a component → copy the install command or code → (Pro) see the paywall → pricing → checkout → purchase → sign in → install.

This description is saved in the project's **product description** setting. PostHog's AI features read it for context. Update it when the product changes.

---

## 3. Project settings

Changed through the PostHog MCP on 25 October 2026.

| Setting | Before | Now | Why |
| --- | --- | --- | --- |
| Name | Default project | **craftUI** | The empty default project was reused rather than creating a second one |
| Timezone | UTC | **America/New_York** | Chosen by the owner, for US customers. Daily and weekly charts roll over at midnight New York time |
| Business model | not set | **B2C** | Sold to individual developers |
| Product description | not set | See section 2 | Context for PostHog AI |
| App URLs (authorised domains) | none | `http://localhost:3000` | Lets the toolbar and heatmaps work locally. **Add the production domain at launch.** |
| Test account filters | cohort `663495` excluded | cohort `663495` excluded, **plus** event property `environment` is not `development` | Keeps local testing out of reports |
| Filter test traffic by default | not set | **on** | New insights exclude test traffic unless someone turns it off |
| Heatmaps (`heatmaps_opt_in`) | off | **on** | Click and scroll heatmaps for `/pricing`, `/` and component pages |
| Dead-click capture (`capture_dead_clicks`) | off | **on** | Finds clicks on things that look clickable but do nothing |

Left at their defaults, but worth knowing:

| Setting | Value |
| --- | --- |
| Session replay | On |
| Replay input masking | All inputs masked (`maskAllInputs: true`) |
| Replay retention | 30 days |
| Console log capture | On |
| Performance capture | On |
| Products onboarded | Product analytics, web analytics, session replay |
| Base currency | USD |
| Revenue analytics | Not configured (see section 12) |

---

## 4. Dashboards

Three dashboards, one per question the owner asked on 25 October 2026. Every chart, how to read it and every ID are in **[analytics-guide.md](./analytics-guide.md)**; this section records only how they're built.

| Dashboard | ID | Question | Charts |
| --- | --- | --- | --- |
| [1 · Site usage](https://us.posthog.com/project/686953/dashboard/2257785) | `2257785` | How do people use the whole site? | Visitors per week, Where visitors come from, Most visited pages, Most viewed components, How people move through the site (paths), Do visitors come back (retention), Filters people use, What people search for |
| [2 · Installs](https://us.posthog.com/project/686953/dashboard/2257786) | `2257786` | How many people actually install? | Installs per day, Registry fetches by client, Installs by item, Install command copied by item, Copies vs installs per week |
| [3 · Pricing & conversion](https://us.posthog.com/project/686953/dashboard/2257063) | `2257063` | Who checks pricing, from which product, which plan, where they drop off | Pricing page visitors per week, Plan chosen at checkout, Visit to checkout funnel, Where people come to pricing from, Paywall views by Pro item, Component pages that lead to pricing (funnel by page), Paywall to checkout by Pro item (funnel by item) |

Dashboard 3 is the original "craftUI journey" dashboard, renamed. Its "Filters people use" and "What people search for" charts moved to dashboard 1.

Conventions every chart follows:

- **Test traffic filtered out** (`filterTestAccounts: true`).
- **Unique visitors** (`math: "dau"`) unless a total count is the point (filters, searches, paywall views, raw registry fetches).
- **Component pages** are matched with the regex `^/docs/(templates|blocks|components|illustrations|isometric)/[^/]+` (with a trailing `$` on "Most viewed components").
- **Funnels:** ordered, 14-day window. Funnels broken down by page or item use `breakdownAttributionType: "step"` with value `0`, so each visitor counts under the value at step 1.
- **Paths chart:** `localPathCleaningFilters` strip the origin (`^https?://[^/]+`) and the query string (`\?.*$`), so routes read as paths.
- **Installs** count `registry_item_fetched` with `client` = `cli`, unique machines (section 7.5).
- **Layout:** 12-column grid, the headline chart 8 wide top left, a 4-wide companion beside it, then pairs of 6-wide charts, with funnels and paths full width. Every tile shows its description.

---

## 5. Events

### 5.1 Captured automatically by posthog-js

With `defaults: "2026-08-30"`, the SDK captures these without any code:

| Event | What it is |
| --- | --- |
| `$pageview` | Every page load and client-side navigation. Key properties: `$pathname`, `$current_url`, `$referrer` |
| `$pageleave` | Leaving a page, with time on page |
| `$autocapture` | Clicks on links, buttons and inputs |
| `$snapshot` | Session replay data |
| `$set` | Person property updates |
| `$identify` | Sent when a signed-in user is identified (section 6) |

Every event also carries the super property **`environment`** (`development` or `production`, from `NODE_ENV`). Registered in `instrumentation-client.ts`.

### 5.2 Custom events added for the journey

All four are sent through `trackEvent()` in `lib/events.ts`, so they also go to Vercel Analytics.

| Event | When it fires | Properties | Sent from |
| --- | --- | --- | --- |
| `filter_applied` | A browse filter is switched on or off | `group` (`categories`, `types` or `styles`), `value` (the filter slug), `selected` (`true` = switched on), `library` (`templates`, `blocks`, …) | `components/new-hero-section/browse/browse-filters.tsx`, in `useBrowseFilters().toggle` |
| `search_performed` | The browse search box has 2+ characters and hasn't changed for 1 second | `query` (trimmed text), `library` | `components/new-hero-section/browse/browse-shell.tsx`, an effect on `query` (constant `SEARCH_SETTLE_MS = 1000`) |
| `paywall_viewed` | The Code view opens on a Pro (locked) item in a docs preview | `item` (the registry item name, e.g. `hero-section`) | `components/preview-frame.tsx`, an effect on `locked` and `view` |
| `purchase_completed` (**server-side**) | Dodo confirms a new purchase: a lifetime payment, or a yearly subscription's first activation (not renewals, and only once per purchase) | `plan` (`lifetime`, `yearly` or `item`), `item_id`, `amount_cents`, `revenue` (major units, e.g. `249`), `currency`, `provider` `dodo` | `lib/billing/dodo-webhook.ts`. Distinct ID: the visitor's PostHog ID from checkout metadata, else the user ID, so it joins their journey |
| `checkout_started` | A plan's checkout button is clicked, before the request to `/api/checkout` | `plan` (`lifetime` or `yearly`), `price_cents` (the plan's price from `lib/billing/plans.ts`, e.g. `24900`) | `components/checkout-button.tsx`, in `handleClick` |

Details that matter:
- **`filter_applied`** is sent from the toggle function, not inside the React state update, because React can run state updates twice in development, which would double-count.
- **`search_performed`** is sent once typing settles, never per keystroke.
- **`checkout_started`** doesn't depend on the payment provider; it fires on the click. `price_cents` was added later on 25 October, because the prices in `plans.ts` are placeholders and reports need the price the visitor actually saw. Events before that have no `price_cents`.

### 5.3 Install events

| Event | When it fires | Properties | Sent from |
| --- | --- | --- | --- |
| `registry_item_fetched` (**server-side**) | A free item's `/r/<item>.json` (from `proxy.ts`), or a paid item served to a buyer (from `app/r/[file]/route.ts`) | `item`, `client` (`cli`, `browser`, `bot` or `other`, from the user agent), `user_agent` (first 200 characters), `$ip` (for the country lookup), `$process_person_profile: false`, `environment` | `proxy.ts` → `lib/posthog-server.ts` (section 7.5) |
| `registry_access_denied` (**server-side**) | A paid item requested without a valid token (`reason` `no_token`) or by a user who doesn't own it (`no_access`) | `item`, `product_id`, `client`, `reason`, `user_agent`, `$ip`, personless | `app/r/[file]/route.ts` |
| `copy_npm_command` | An install command is copied | `item` (registry item, or null), `manager` (`npm`, `pnpm`, `yarn`, `bun`), `code` (the copied text) | Preview toolbar: `components/preview-install-command.tsx`. Docs code blocks: `components/code-block-command.tsx`, which reads `item` from `/r/<item>.json` in the command |

- **The shadcn CLI fetches an item twice per `add`**, so install charts count unique installers per day, not fetches.
- **Distinct ID:** free installs use `anon_` + 24 hex characters of SHA-256(IP + user agent), personless. Paid installs use the **buyer's user ID** (from their install token) and carry `product_id`, so they land on the buyer's person.
- **Refused paid installs** are `registry_access_denied`, never `registry_item_fetched`, so the install charts only count real installs.
- **`copy_npm_command`** got `item` and `manager` on 25 October. Before that, it carried only `code`, and the preview toolbar copy wasn't tracked at all.
- `components/command-menu.tsx` also sends `copy_npm_command`, with `command` and `pm` (older property names, no `item`). `components/command-box.tsx` sends it with only `code`, but no page renders `CommandBox`.

### 5.4 Older events, now also sent to PostHog

These existed before PostHog (Vercel Analytics only). Since `trackEvent()` now sends to both, these also reach PostHog.

| Event | Sent from |
| --- | --- |
| `copy_usage_code` | `mdx-components.tsx` (via `CopyButton`) |
| `copy_primitive_code` | `components/component-source.tsx` (via `CopyButton`) |
| `open_command_menu` | `components/command-menu.tsx` |
| `click_edit_page` | `components/docs-toc-footer.tsx` |
| `click_registry_add_button` | `components/registry-add-button.tsx` |
| `copy_registry_command` | `components/registry-add-button.tsx` |
| `keyboard_shortcut_navigate` | `components/docs-keyboard-shortcuts.tsx` |

**Defined but never sent.** These names are allowed in `lib/events.ts` but nothing calls them (leftovers from the original template): `copy_usage_import_code`, `copy_theme_code`, `copy_block_code`, `copy_chunk_code`, `enable_lift_mode`, `copy_chart_code`, `copy_chart_theme`, `copy_chart_data`, `copy_color`, `set_layout`. Don't build insights on them.

---

## 6. People and identification

- **Anonymous by default.** With the 2026-08-30 defaults, PostHog creates person profiles only for identified users, so anonymous visitors are counted without filling the people list.
- **Sign-in:** `components/posthog-identify.tsx`, mounted once in `app/layout.tsx`, reads the session with `useSession()` (the same hook the navbar uses, so no extra request on browse pages). When a user is signed in, it calls `posthog.identify(user.id, { email, name })`. Their earlier anonymous browsing joins the same person.
- **Distinct ID:** the better-auth **user ID**. Any server-side event about a user should use this same ID (see section 12).
- **Sign-out:** `components/sign-out-button.tsx` calls `posthog.reset()` after `authClient.signOut()`. `PostHogIdentify` also resets if the session disappears (for example, a sign-out in another tab). The next person on the device starts anonymous.

---

## 7. Codebase integration

### 7.1 Files

| File | Change |
| --- | --- |
| `instrumentation-client.ts` (new) | Starts PostHog on the client before the app hydrates |
| `next.config.mjs` | `/relay` reverse proxy rewrites and `skipTrailingSlashRedirect: true` |
| `lib/events.ts` | `trackEvent()` sends to both Vercel Analytics and PostHog; the four journey events are added |
| `components/posthog-identify.tsx` (new) | Identifies a signed-in user and resets on sign-out |
| `app/layout.tsx` | Mounts `<PostHogIdentify />` next to `<Analytics />` |
| `components/sign-out-button.tsx` | `posthog.reset()` on sign-out |
| `components/checkout-button.tsx` | `checkout_started` with `plan` and `price_cents` |
| `components/preview-frame.tsx` | `paywall_viewed` |
| `components/new-hero-section/browse/browse-filters.tsx` | `filter_applied` |
| `components/new-hero-section/browse/browse-shell.tsx` | `search_performed` |
| `lib/posthog-server.ts` (new) | `captureServerEvent()` and `anonymousId()` for server-side events (section 7.5) |
| `proxy.ts` | Sends `registry_item_fetched` for `/r/<item>.json` (the proxy now takes `NextFetchEvent` for `waitUntil`) |
| `components/copy-button.tsx` | New `eventProperties` prop, sent with the event next to `code` |
| `components/preview-install-command.tsx` | The toolbar install copy now sends `copy_npm_command` with `item` and `manager` |
| `components/code-block-command.tsx` | Sends `item` (read from `/r/<item>.json` in the command) and `manager` with its copy event |
| `package.json`, `pnpm-lock.yaml` | `posthog-js` |
| `.env` (git-ignored), `.env.example` | PostHog env vars |

Import it as `import { posthog } from "posthog-js"`. The project's lint rules reject the default import.

### 7.2 Initialisation (`instrumentation-client.ts`)

```ts
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: "/relay",
    defaults: "2026-08-30",
    ui_host: "https://us.posthog.com",
  });
  posthog.register({ environment: process.env.NODE_ENV });
}
```

- Without a token, PostHog stays off and every `capture` is a no-op, so forks and previews without the variable don't report.
- `defaults: "2026-08-30"` is PostHog's recommended settings bundle as of that date: SPA pageviews and pageleaves, person profiles for identified users only, and so on.
- `ui_host` keeps links PostHog builds (toolbar, replay) pointing at the PostHog app instead of `/relay`.

### 7.3 Reverse proxy (`next.config.mjs`)

| Browser path | Forwarded to |
| --- | --- |
| `/relay/static/:path*` | `https://us-assets.i.posthog.com/static/:path*` |
| `/relay/array/:path*` | `https://us-assets.i.posthog.com/array/:path*` |
| `/relay/:path*` | `https://us.i.posthog.com/:path*` |

Plus `skipTrailingSlashRedirect: true`, which PostHog requires because some of its API paths end in a slash.

- **Why a proxy:** ad blockers block PostHog's own domains, and developers often run them. Requests to the site's own domain get through.
- **Why `/relay`:** PostHog advises against obvious names like `/analytics`, `/tracking` or `/posthog`, which blockers also match.
- **Side effect:** `/docs/` is no longer redirected to `/docs`. Both are served.

### 7.4 Environment variables

| Variable | Where | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | `.env` locally; **Vercel (still to do)** | The project token (`phc_…`) |
| `NEXT_PUBLIC_POSTHOG_HOST` | `.env` locally; **Vercel (still to do)** | `https://us.i.posthog.com` |

- **Browser:** sends to `/relay`; the host for the browser is fixed in `next.config.mjs`.
- **Server-side capture** (`lib/posthog-server.ts`): reads both variables at runtime, and falls back to `https://us.i.posthog.com` if `NEXT_PUBLIC_POSTHOG_HOST` is missing. Without the token, registry installs aren't recorded.

### 7.5 Server-side capture (`lib/posthog-server.ts`)

No SDK on the server. `captureServerEvent({ distinctId, event, properties })` POSTs straight to `${host}/i/v0/e/` with `fetch`:

- It adds `environment` (from `NODE_ENV`) and a timestamp.
- It does nothing without a token, and it swallows errors, so analytics never break a response.
- Callers hand it to `event.waitUntil()`, so the registry file is served without waiting for PostHog.

`anonymousId(...parts)` returns `anon_` plus the first 12 bytes of SHA-256(parts joined by `|`), in hex. The proxy calls it with the IP (first `x-forwarded-for` entry) and the user agent. The same machine and CLI version get the same ID, and no raw IP is used as an identifier.

`client` classification in `proxy.ts`, checked in this order:

| Rule | `client` |
| --- | --- |
| user agent matches `/shadcn/i` (the CLI sends `shadcn`) | `cli` |
| matches `/bot\|crawl\|spider\|slurp\|preview\|fetcher/i` | `bot` |
| contains `mozilla` | `browser` |
| anything else (curl, agents, scripts) | `other` |

To capture another server-side event (e.g. a purchase from a webhook), use `captureServerEvent` with the buyer's PostHog distinct ID, and omit `$process_person_profile: false` so it lands on their person.

---

## 8. Traffic filtering

| Traffic | How it's kept out |
| --- | --- |
| Bots and crawlers | posthog-js drops events from user agents that look like bots. Automated browsers count as bots too (see section 10) |
| Local development | Every event is tagged `environment`. The project's test filter excludes `development`, and it's on by default for insights |
| The starter test cohort | Cohort `663495`, excluded (PostHog's default test filter) |

Confirmed on 25 October: the same funnel showed 2 people with the filter off and no data with it on, because everything so far was local testing.

---

## 9. Decisions and why

| Decision | Reason |
| --- | --- |
| Reused "Default project" instead of creating a new one | It was empty, already had replay, web analytics and product analytics on, and a second project would have stayed unused |
| Timezone America/New_York | Owner's choice, for US customers |
| Next.js rewrites for the proxy, not PostHog's managed proxy | There's no live domain yet, and the managed proxy needs a subdomain on it. Revisit at launch (section 11) |
| Kept Vercel Analytics and Umami | Owner's choice. `trackEvent()` feeds Vercel and PostHog together |
| No server-side events in the first pass, then registry installs added the same day | The owner then asked "how many people actually install", which only the server can see |
| Purchases tracked from the Dodo webhook, not the browser | The success page can be skipped or faked; the signed webhook can't. Polar was never wired up for this; the owner waited for Dodo |
| Server capture with `fetch`, not `posthog-node` | One small POST per fetch, from the Next.js proxy; no SDK, batching or shutdown handling needed |
| Installs counted as unique machines per day | The shadcn CLI fetches each item twice per `add`; raw fetches would double the count |
| Installs are personless (`$process_person_profile: false`) with a hashed ID | An install isn't a site visitor; no profile, no raw IP as ID |
| `price_cents` on `checkout_started` | Prices in `plans.ts` are placeholders; reports must know the price shown at the time |
| Insights built only from events PostHog had received | Insights on guessed or never-sent event names show nothing and mislead |
| Three dashboards, one per question | The owner asked three questions (site usage, installs, pricing); each dashboard answers one, numbered in that order. The starter dashboard is left as is |
| `search_performed` waits 1 second | Avoids one event per keystroke |
| `filter_applied` records `selected` | Lets reports count switching filters on separately from switching them off |
| `paywall_viewed` fires on opening the Code view of a Pro item | That's the point where a visitor meets the paywall in the docs |

---

## 10. How it was tested, and how to test again

What was checked on 25 October 2026, in a headless browser against `pnpm dev`:

- PostHog loaded entirely through `/relay`: config, flags, the surveys and recorder scripts, events (`/relay/e/`, `/relay/i/v0/e/`) and replay (`/relay/s/`). All 20 requests returned 200, and nothing went to posthog.com directly.
- A full journey (filter, search, opening a Pro item's code, clicking a checkout plan) sent `$pageview`, `$autocapture`, `$snapshot`, `$set` and all four journey events.
- PostHog received them with the right properties:

| Event | Properties received |
| --- | --- |
| `filter_applied` | group `categories`, value `marketing`, selected `true`, library `templates` |
| `search_performed` | query `table`, library `templates` |
| `paywall_viewed` | item `hero-section` |
| `checkout_started` | plan `yearly` |

- Typecheck and lint passed. The home, docs, pricing and login pages loaded with no errors.

Later the same day, for installs and pricing:

| Check | Result |
| --- | --- |
| A real `npx shadcn add http://localhost:3000/r/<item>.json` in a throwaway app | `registry_item_fetched` with `client` `cli`, 2 fetches, 1 unique machine |
| Opening a `/r/<item>.json` URL in a browser, and with curl | `client` `browser` and `other` |
| Copy in a component page's preview toolbar | `copy_npm_command` with `item` `hero-section-02`, `manager` `pnpm` |
| Copy in a docs install code block (`/docs`) | `copy_npm_command` with `manager` `pnpm`, `item` null (the `<component>` placeholder) |
| Click "Buy lifetime" on `/pricing` | `checkout_started` with `plan` `lifetime`, `price_cents` `24900` |
| Opening `/pricing` from a component page | `$pageview` with `$prev_pageview_pathname` = that component page |
| Every new dashboard query | Runs without errors; empty with the test filter on, as expected for local data |

**The automated-browser trap.** posthog-js treats automated browsers as bots and silently drops their events. The debug log says `Event "$pageview" was not captured because the user agent looks like a bot`. Changing the user agent isn't enough; it also checks `navigator.webdriver` and the browser-brand data. For automated tests, override all three (a normal Chrome user agent, `navigator.webdriver = false`, and `navigator.userAgentData.brands` without "HeadlessChrome"), or test in a normal browser.

**Debug mode.** Add `?__posthog_debug=true` to any URL. The console then logs every event as it's sent, or why it wasn't.

**Check what PostHog received** (SQL editor, or `execute-sql` through the MCP):

```sql
SELECT event, count() AS n, max(timestamp) AS last_seen
FROM events
WHERE timestamp > now() - INTERVAL 1 HOUR
GROUP BY event
ORDER BY n DESC
```

Events take about a minute to appear.

---

## 11. Before production (open items)

1. **Add the env vars on Vercel:** `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`, for Production (and Preview if wanted). Without them PostHog stays off in production, and installs aren't recorded either.
2. **Add the real domain** to the project's app URLs (Project settings → authorised domains) once the site is live. The toolbar and heatmaps need it.
3. **Proxy cost:** proxying through Next.js counts toward Vercel data transfer and edge requests, and session replays are the heaviest part (often 1–5 MB per session). When the domain is live, consider PostHog's free [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) on a subdomain, then point `api_host` at it and remove the rewrites.
4. **Update the product description** in PostHog: it still mentions Polar; the payment provider is now Dodo Payments.
5. **Commit** the PostHog code on `feat/adding-analytics`.

---

## 12. Next iteration (not built yet)

### 12.1 Purchases and revenue

- PostHog's revenue analytics connects directly only to **Stripe**. Polar is listed as "coming soon", and Dodo Payments isn't listed ([docs](https://posthog.com/docs/revenue-analytics/payment-platforms)).
- So revenue is tracked by [capturing a revenue event](https://posthog.com/docs/revenue-analytics/capture-revenue-events) ourselves. **Built on 25 October 2026:**
  1. The checkout button sends `posthog.get_distinct_id()` to `/api/checkout`, which puts it in the Dodo checkout's metadata (`posthogDistinctId`).
  2. The Dodo webhook sends `purchase_completed` with that ID (section 5.2), once per new purchase.
- **Still to do, once the first real (test-mode) purchase has reached PostHog** (insights are only built on events PostHog has received):
  1. Set `purchase_completed` as a revenue event (Data management → Revenue), with the `revenue` property (major units) and `currency`.
  2. Add a "Purchased" step to the end of three funnels: Visit to checkout (`BEOZtxah`), Component pages that lead to pricing (`Xnt4pGwR`) and Paywall to checkout by Pro item (`5KYz4gz0`).
  3. Add a "Revenue per week" chart to dashboard 3.

### 12.2 Copy actions

`copy_npm_command` now has its own charts (dashboard 2). Once the other copy events (section 5.4) have real data, consider a combined "Copy actions" chart: `copy_registry_command`, `copy_usage_code` and `copy_primitive_code`, broken down by page.

### 12.3 Alerts and subscriptions

None set up. Good candidates once there's traffic:
- An alert if installs per day (`viKYGGEp`) drop to 0.
- An alert if checkout starts drop to 0 for a week.
- A weekly email of the three dashboards.

### 12.4 Clean-up candidates

- `components/command-menu.tsx` sends `copy_npm_command` with `command` and `pm` instead of `code`, `item` and `manager`. Align it if command-menu copies matter.
- The 10 defined-but-unused event names in `lib/events.ts` (section 5.4).

---

## 13. How to add a new event

1. Add the name to the `z.enum([...])` list in `lib/events.ts`. Use lowercase `object_action` names, like the existing ones.
2. Call `trackEvent({ name: "...", properties: { ... } })` from a client component, outside any React state update.
3. Properties must be strings, numbers, booleans or null.
4. Test with `?__posthog_debug=true` in a normal browser, then check PostHog with the SQL query in section 10.
5. Only after PostHog has received it, build insights on it, and add it to section 5 of this document.

---

## 14. Change log

| Date | Change |
| --- | --- |
| 25 Oct 2026 | Initial setup: project configured, posthog-js installed with the `/relay` proxy, identification, four journey events, development-traffic filter, the craftUI journey dashboard with four insights |
| 25 Oct 2026 (Dodo) | Polar replaced by Dodo Payments. New server event `purchase_completed` from the Dodo webhook, joined to the visitor through the PostHog ID passed in checkout metadata. Funnels get their "Purchased" step after the first real purchase arrives (section 12.1) |
| 25 Oct 2026 (paid access) | Every library item is paid unless `meta.free`. Paid installs go through `app/r/[file]/route.ts`: `registry_item_fetched` is tied to the buyer's user ID with `product_id`; refusals are the new `registry_access_denied` event |
| 25 Oct 2026 (later) | Three-question setup: <ul><li>server-side install tracking (`registry_item_fetched`)</li><li>`copy_npm_command` with `item` and `manager`</li><li>`price_cents` on `checkout_started`</li><li>heatmaps and dead-click capture on</li><li>dashboards 1 · Site usage (8 charts) and 2 · Installs (5 charts) added</li><li>craftUI journey renamed to 3 · Pricing & conversion (7 charts), its filter and search charts moved to dashboard 1</li><li>[analytics-guide.md](./analytics-guide.md) written</li></ul> |
