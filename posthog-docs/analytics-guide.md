# craftUI analytics guide: where to find the answers in PostHog

**Written:** 25 October 2026
**For:** whoever checks how craftUI is doing, now or later
**Companion doc:** [setup-25.10.2026.md](./setup-25.10.2026.md) covers how PostHog is wired into the code. This guide covers how to *read* it.

This guide answers three questions:

1. **How do people use the whole website?**
2. **How many people actually install components?**
3. **How many people check pricing, which products lead them there, which prices they pick, and where they drop off?**

Each question has its own dashboard in PostHog, and each section below lists every chart on that dashboard: what it shows, how to read it, what the numbers mean exactly, and what to do with it.

---

## 0. Before you start

### 0.1 Where to go

| What | Link |
| --- | --- |
| PostHog (US Cloud) | https://us.posthog.com |
| Project | **craftUI** (ID `686953`). Pick it in the top-left project switcher if another project opens |
| Dashboard 1 · Site usage | https://us.posthog.com/project/686953/dashboard/2257785 |
| Dashboard 2 · Installs | https://us.posthog.com/project/686953/dashboard/2257786 |
| Dashboard 3 · Pricing & conversion | https://us.posthog.com/project/686953/dashboard/2257063 |

All three dashboards are **pinned**, so they also appear under **Dashboards** in the left sidebar. They are numbered in the order of the three questions.

### 0.2 Five things to know before reading any chart

1. **Local development traffic is excluded.** Every event carries `environment` (`development` locally, `production` on the live site). Every chart has **"Filter out internal and test users"** switched on, which drops `development`. If a chart is empty, see section 6 first.
2. **Times are New York time** (`America/New_York`). A "day" runs from midnight to midnight New York time, and weeks start on Sunday.
3. **"Unique visitors" means unique browsers, not unique humans.** One person on a laptop and a phone counts twice; clearing cookies or a private window also counts again. Signed-in users are merged across devices once they sign in.
4. **Charts cache their results.** A dashboard shows when it last calculated (top right). Click **Refresh** for fresh numbers. New events take about a minute to show up.
5. **The date range can be changed for the whole dashboard.** Use the date picker at the top of a dashboard to override every chart at once (e.g. "Last 7 days"). This doesn't save unless you click **Save**. Each chart's own default is listed below.

### 0.3 How to open any chart

Click a chart's title on the dashboard to open it full screen. From there you can:

- **Hover** a bar or point to see exact numbers.
- **Click** a bar, point or funnel step to see the list of visitors behind it, and from there **watch their session recordings**.
- Change the date range, chart type or breakdown. **Don't click Save** unless you mean to change the dashboard version; use **Save as new insight** for experiments.

---

## 1. Question 1: how do people use the whole website?

**Dashboard:** [1 · Site usage](https://us.posthog.com/project/686953/dashboard/2257785)

| # | Chart | Answers | Default range |
| --- | --- | --- | --- |
| 1.1 | Visitors per week | Is traffic growing? | Last 90 days, weekly |
| 1.2 | Where visitors come from | Which sites send traffic? | Last 30 days |
| 1.3 | Most visited pages | Which pages get looked at? | Last 30 days |
| 1.4 | Most viewed components | Which products in the library interest people? | Last 30 days |
| 1.5 | How people move through the site | What do people click through, step by step? | Last 30 days |
| 1.6 | Do visitors come back | Do people return after their first visit? | Last 60 days, weekly |
| 1.7 | Filters people use | What do people narrow the browse page by? | Last 30 days |
| 1.8 | What people search for | What do people type into search? | Last 30 days |

### 1.1 Visitors per week

[Open chart](https://us.posthog.com/project/686953/insights/WKp2F9XJ) · line chart

- **Metric:** unique visitors who viewed at least one page that week (`$pageview`, "unique users" maths).
- **How to read:** one point per week. The latest week is incomplete until Saturday ends, so it usually looks lower; ignore its dip.
- **Use it for:** growth over time, and checking whether a launch, tweet or newsletter moved traffic. Add an **annotation** (click the chart's x-axis at the date → "Add annotation") when you do something notable, so you remember why a spike happened.

### 1.2 Where visitors come from

[Open chart](https://us.posthog.com/project/686953/insights/Y7hEdC9m) · horizontal bars

- **Metric:** unique visitors, broken down by `$referring_domain` (the site the visitor came from).
- **How to read:** one bar per source, biggest first.
  - `$direct` means no referrer: typed the URL, a bookmark, a link in an app (Slack, Discord, email clients), or a privacy browser that strips referrers.
  - `www.google.com` and similar are search engines.
  - `github.com`, `x.com`, `reddit.com` and so on are links people shared.
- **Use it for:** knowing which channels are worth more effort.
- **Deeper:** for UTM-tagged campaign links (`?utm_source=…`), use **Web analytics** (section 5.1), which groups by UTM source and campaign.

### 1.3 Most visited pages

[Open chart](https://us.posthog.com/project/686953/insights/1QFjsWZl) · table

- **Metric:** unique visitors per page path (`$pathname`), top 25.
- **How to read:**
  - The table has one row per page and a column per day, plus a total.
  - Sort by the total column.
  - Paths look like `/`, `/pricing`, `/docs/templates/hero-section`.
- **Use it for:** the overall shape of interest: homepage vs docs vs pricing.

### 1.4 Most viewed components

[Open chart](https://us.posthog.com/project/686953/insights/rWDHT8Jf) · horizontal bars

- **Metric:**
  - Unique visitors per **component page**: any path matching `^/docs/(templates|blocks|components|illustrations|isometric)/<item>`, top 25.
  - This counts every library at once.
- **How to read:** each bar is one product, for example `/docs/templates/hero-section-02`. The path tells you the library (`templates`, `blocks`, …) and the item.
- **Use it for:**
  - **"Which product are people checking across the full library?"**
  - Compare with installs (section 2.3). A page that's viewed a lot but rarely installed has a problem: a weak preview, a confusing install, or it's Pro.
- **To see one library only:** open the chart → edit the filter on the series → change the regex to, for example, `^/docs/blocks/`.

### 1.5 How people move through the site

[Open chart](https://us.posthog.com/project/686953/insights/pau9WDOO) · paths diagram

- **Metric:** the most common page-to-page routes within a visit, up to 5 steps, based on page views. Full URLs are cleaned to paths, and query strings (`?…`) are stripped.
- **How to read:**
  - Each column is a step.
  - The thickness of a line is how many visitors took that route.
  - A line ending in a dropout marker means visitors left after that page.
- **Use it for:** finding the common journeys, such as homepage → component → pricing, and the dead ends.
- **Useful tweaks** (open the chart, change, don't save):
  - **Start point = `/pricing`**: what people do *after* pricing. This is where pricing drop-off goes.
  - **End point = `/pricing`**: how people *arrive* at pricing.
  - **Start point = a component page**: what people do after looking at one product.

### 1.6 Do visitors come back

[Open chart](https://us.posthog.com/project/686953/insights/GbgWiK8n) · retention table

- **Metric:**
  - Of the visitors whose **first ever** page view fell in a given week, the share who viewed a page again in each following week.
  - "Week 0" is always 100%.
- **How to read:**
  - Each row is a group of new visitors (a cohort); each column is weeks since their first visit.
  - Read across a row to see how one group fades.
  - Read down a column, for example Week 1, to see if retention improves over time.
- **Benchmarks:** for a component library, people often come back when they need another component. Week-1 retention of 10–20% is healthy for developer docs. Higher means people rely on it.
- **Caveat:** cookie clearing and device changes make returning visitors look new, so true retention is somewhat higher than shown.

### 1.7 Filters people use

[Open chart](https://us.posthog.com/project/686953/insights/TmvEUeix) · horizontal bars

- **Metric:** how many times each browse filter was **switched on** (`filter_applied` where `selected` = `true`), by filter value (`marketing`, `hero`, `dashboard`, …). This is a total count, not unique visitors.
- **How to read:** the most-used filters show what people are looking for when they browse.
- **Use it for:** deciding which categories to build more of, and which filter chips to show first.
- **Other properties on the event:**
  - `group`: `categories`, `types` or `styles`.
  - `library`: which library tab they were on.
  - Open the chart and change the breakdown to either one to slice it.

### 1.8 What people search for

[Open chart](https://us.posthog.com/project/686953/insights/lZVWC6RR) · table

- **Metric:**
  - How many times each search term was entered in the browse search box (`search_performed`, by `query`).
  - A search is recorded once typing stops for 1 second and only for 2+ characters, so it's whole words, not keystrokes.
- **How to read:** the terms people actually want. Look for terms that return nothing on the site, because those are missing products.
- **Use it for:** the product roadmap. "pricing table" searched 30 times with no pricing-table block is a strong signal.

---

## 2. Question 2: how many people actually install?

**Dashboard:** [2 · Installs](https://us.posthog.com/project/686953/dashboard/2257786)

### 2.0 What counts as an install (read this once)

An install is when someone runs `npx shadcn add <site>/r/<item>.json` (or the pnpm, yarn or bun version). The browser never sees that, so it is recorded **on the server**:

- Every request for `/r/<item>.json` sends a `registry_item_fetched` event from `proxy.ts`. `registry.json`, the index, is skipped.
- Each request is labelled with `client`, worked out from the user agent:

| `client` | Means |
| --- | --- |
| `cli` | The shadcn CLI. **This is a real install.** |
| `browser` | Someone opened the JSON file in a browser tab |
| `bot` | A crawler or link preview (Slack, X, search engines) |
| `other` | Scripts: curl, AI agents, other tools |

- **Paid items** (every item unless marked free) are served only to buyers, by `app/r/[file]/route.ts`. A granted install is recorded with the **buyer's user ID**, so you can see who installed what (open the event in **Activity**, or break down by person). A refused attempt (no plan, or no install token) is a separate event, `registry_access_denied`, and never counts as an install. To see how often people try to install without paying: **Activity** → event `registry_access_denied`, or a new Trends insight on it broken down by `item` or `reason`.
- **One install fetches the file twice.** The shadcn CLI downloads the item twice in one `add`. So install charts count **unique machines per day** (PostHog's "unique users" maths on an anonymous machine ID), not raw requests. A machine ID is a hash of IP address plus user agent. No raw IP is stored as the ID, and no person profile is created.
- **What this means in practice:**
  - The same machine installing 3 items in a day = 3 in "Installs by item", but 1 in "Installs per day".
  - Two developers behind the same office network with the same CLI version merge into one machine. Installs are a slight **under**count, never an overcount.
  - Installing the same item again the next day counts again (new day).
  - CI pipelines that run `shadcn add` would count as installs. Unlikely for now.

### 2.1 Installs per day

[Open chart](https://us.posthog.com/project/686953/insights/viKYGGEp) · line chart · last 30 days

- **Metric:** unique machines that ran `shadcn add` for any craftUI item, per day (`registry_item_fetched` where `client` = `cli`, unique).
- **Use it for:** **the headline install number.** For a weekly number, open the chart and change the interval to Week.
- **Total over a period:** switch the chart type to "Number" to get one total. Note that it counts unique machines over the whole period, so it is less than the sum of the days.

### 2.2 Registry fetches by client

[Open chart](https://us.posthog.com/project/686953/insights/2VsscufQ) · horizontal bars · last 30 days

- **Metric:** **every** registry request (total count, not unique), split by `client`.
- **How to read:**
  - `cli` should be about **2×** the install number, because of the double fetch.
  - A large `bot` or `other` bar means crawlers or agents read the registry. That's fine, and it's excluded from installs.
- **Use it for:** a sanity check. If `cli` suddenly drops to zero while page views are normal, the registry or the tracking broke.

### 2.3 Installs by item

[Open chart](https://us.posthog.com/project/686953/insights/iO8yeCzZ) · horizontal bars · last 30 days

- **Metric:** unique machines that installed each item (`item` = the registry name, such as `hero-section-02`), top 25.
- **Use it for:**
  - **The most installed products.**
  - Compare with "Most viewed components" (1.4). For each product, installs ÷ unique viewers is roughly its **view-to-install rate**.
- **Note:**
  - Installing one item can pull in other craftUI items it depends on, if it declares them as registry dependencies. Those show up as installs too.
  - Pro items can't normally be installed without access, so expect them to be low here.

### 2.4 Install command copied by item

[Open chart](https://us.posthog.com/project/686953/insights/7A2D1N9C) · horizontal bars · last 30 days

- **Metric:**
  - Unique visitors who clicked **copy** on an install command, by `item`.
  - This is `copy_npm_command`, sent from the install command in a component's preview toolbar and from install code blocks in the docs.
- **Use it for:** **intent to install**, which happens in the browser, before the terminal.
- **The `item` value:**
  - Comes from the preview toolbar's item name, or from `/r/<item>.json` in the copied command.
  - Shows as **null** for copies made before 25 October 2026, or for commands that aren't a registry install, such as the `<component>` placeholder on the docs index.
- **Other properties:**
  - `manager`: `npm`, `pnpm`, `yarn` or `bun`. Break down by it to see which package manager your users prefer.
  - `code`: the exact text copied.

### 2.5 Copies vs installs per week

[Open chart](https://us.posthog.com/project/686953/insights/4LLKeeFK) · grouped bars · last 90 days, weekly

- **Metric:** two series side by side: visitors who **copied** an install command, and machines that **installed**.
- **How to read:**
  - **Installs < copies:** some people copy but don't run it, or run it later.
  - **Installs > copies:** people type the command themselves, use an AI agent or the shadcn MCP, or reuse an old command. Normal for a developer audience.
- **Use it for:** spotting a broken install flow. Copies steady but installs falling = something fails in the terminal.

### 2.6 Questions this dashboard doesn't answer (and where to look)

| Question | Where |
| --- | --- |
| Did the install *succeed*? | Not knowable: the CLI doesn't report back. A fetch is the best signal |
| Who installed (which person)? | Not tracked, on purpose. Installs are anonymous |
| Which country installs come from? | Open 2.1 → breakdown → `GeoIP Country` (`$geoip_country_name`). The server sends the IP for the country lookup only |
| Raw list of recent installs | **Activity** (left sidebar) → filter event `registry_item_fetched` |

---

## 3. Question 3: who checks pricing, for which product, which price, and where do they drop off?

**Dashboard:** [3 · Pricing & conversion](https://us.posthog.com/project/686953/dashboard/2257063)

**Important:** the funnel currently **ends at "Started checkout"** (clicking a buy button). Completed purchases aren't tracked yet. That's planned with the switch to Dodo Payments (section 7). Until then, "conversion" on this dashboard means "clicked buy", not "paid".

### 3.0 The buying journey being measured

```
visit the site
   └─ view a component page            (any library)
        └─ (Pro item) open Code → paywall   paywall_viewed  { item }
             └─ view /pricing               $pageview  /pricing  { $prev_pageview_pathname }
                  └─ click a buy button     checkout_started  { plan, price_cents }
                       └─ pay               (not tracked yet: Dodo)
```

Current plans and prices (`lib/billing/plans.ts`, marked as placeholders in the code):

| `plan` value | Name | Price | `price_cents` |
| --- | --- | --- | --- |
| `lifetime` | Lifetime all-access | $249 one-off | `24900` |
| `yearly` | Yearly all-access | $129 per year | `12900` |

When prices change, `price_cents` on `checkout_started` changes with them (from 25 October 2026), so old and new prices can be compared. Also add an **annotation** on the date of the change.

### 3.1 Pricing page visitors per week

[Open chart](https://us.posthog.com/project/686953/insights/BXLBJddQ) · bars · last 90 days, weekly

- **Metric:** unique visitors who opened `/pricing` that week.
- **Use it for:** **"How many people check pricing?"** Compare with 1.1. Pricing visitors ÷ all visitors = the share of traffic with buying interest.

### 3.2 Plan chosen at checkout

[Open chart](https://us.posthog.com/project/686953/insights/zhASDBb0) · pie · last 30 days

- **Metric:** unique visitors who clicked a buy button, by `plan` (`lifetime` / `yearly`).
- **Use it for:**
  - **"Which price do people pick?"**
  - A heavy lean towards one plan tells you about price sensitivity. Lifetime-heavy means people avoid subscriptions; yearly-heavy means lifetime may feel expensive.
- **To compare price points after a change:** open the chart → change the breakdown to `price_cents`.

### 3.3 Visit to checkout funnel

[Open chart](https://us.posthog.com/project/686953/insights/BEOZtxah) · funnel · last 30 days, 14-day window

| Step | Event |
| --- | --- |
| 1. Visited the site | any `$pageview` |
| 2. Viewed pricing | `$pageview` on `/pricing` |
| 3. Started checkout | `checkout_started` |

- **How to read:**
  - Each bar is the number of visitors who reached that step.
  - The percentage under each step is conversion from step 1.
  - The grey part of each bar is **drop-off**: people who did the previous step but not this one within 14 days.
- **Where they drop off:**
  - **Step 1 → 2:** most visitors never look at pricing. Normal for a mostly-free library.
  - **Step 2 → 3:** saw prices but didn't click buy. **This is the price/offer drop-off.**
- **To see who dropped off:**
  - Click the grey drop-off part of step 3 → **"View dropped-off people"** or **"Watch recordings"**.
  - Watch a few pricing sessions to see what they read and where they hesitated.
- **Other views:** switch the funnel view to "Conversion over time" to see whether the pricing → checkout rate improves after you change prices or copy, or to "Time to convert" to see how long people take.

### 3.4 Where people come to pricing from

[Open chart](https://us.posthog.com/project/686953/insights/i3oTfTC6) · horizontal bars · last 30 days

- **Metric:**
  - Unique pricing visitors, by `$prev_pageview_pathname`: the page they were on **right before** `/pricing`.
  - Empty or `null` means pricing was the first page of their visit: a direct link, a bookmark or search.
- **How to read:**
  - The navbar link shows up as whichever page they were on.
  - A **component page** at the top (for example `/docs/templates/hero-section`) means that product sends people to pricing.
- **Use it for:** **"Which products lead people to check prices?"**

### 3.5 Paywall views by Pro item

[Open chart](https://us.posthog.com/project/686953/insights/6Z6iH2bt) · horizontal bars · last 30 days

- **Metric:** how many times the Pro paywall was shown, by `item`. It shows when a visitor opens the **Code** view on a Pro (locked) item. This is a total count.
- **Use it for:**
  - **Which Pro products create the most buying interest.**
  - High paywall views on an item = people want its code. That's the item to feature in marketing.

### 3.6 Component pages that lead to pricing

[Open chart](https://us.posthog.com/project/686953/insights/Xnt4pGwR) · funnel with breakdown · last 30 days, 14-day window

| Step | Event |
| --- | --- |
| 1. Viewed a component page | `$pageview` whose path matches `^/docs/(templates|blocks|components|illustrations|isometric)/…` |
| 2. Viewed pricing | `$pageview` on `/pricing` |
| 3. Started checkout | `checkout_started` |

- **Broken down by** the component page path **at step 1**. Technically, breakdown attribution is "step 1", so each visitor is counted under the component page that started their funnel.
- **How to read:**
  - One coloured funnel per product.
  - Compare each product's step 1 → 2 rate (sends people to pricing) and its step 2 → 3 rate (those people then click buy).
- **Use it for:** **"Which product are people checking across the full library, and where do they drop off?"**, per product.
  - **High step 1, low 1 → 2:** lots of interest, but it doesn't make people think of buying (fine for free items).
  - **High 1 → 2, low 2 → 3:** the product creates interest, but the price or offer loses them.
- **Caveat:**
  - A visitor who saw 5 products is counted under the product that started their funnel, not all 5.
  - Click a product's row → **Watch recordings** to see real sessions.

### 3.7 Paywall to checkout by Pro item

[Open chart](https://us.posthog.com/project/686953/insights/5KYz4gz0) · funnel with breakdown · last 30 days, 14-day window

| Step | Event |
| --- | --- |
| 1. Hit the Pro paywall | `paywall_viewed` |
| 2. Viewed pricing | `$pageview` on `/pricing` |
| 3. Started checkout | `checkout_started` |

- **Broken down by** `item`, the Pro item whose paywall started the funnel.
- **Use it for:**
  - **The Pro conversion funnel per product:** of the people who wanted a Pro item's code, how many looked at prices and how many clicked buy.
  - The item with the best paywall → checkout rate is your best "hook" product.
- **Drop-off between step 1 and 2:** the paywall itself isn't convincing people to look at prices. Check the paywall copy and its link to pricing.

### 3.8 Answering "where do they drop off" end to end

Use the charts together:

1. **3.6** shows which products start the journey and how each one converts.
2. **3.3** shows the overall step where most people leave.
3. **1.5 with start point `/pricing`** shows where people go *instead* of checkout after seeing prices: back to docs, home, or they leave.
4. **Session recordings** of people who reached pricing but didn't start checkout show *why*. See section 5.2 for the exact filter.

---

## 4. Glossary: every metric used

| Term | Exact meaning in these dashboards |
| --- | --- |
| **Unique visitors / unique users** ("dau" maths in PostHog) | Distinct browser IDs in each interval. On bar, pie, table and number charts, unique over the **whole date range** |
| **Total count** | Every event, including repeats by the same visitor |
| **Unique machines** (installs) | Distinct anonymous IDs, each a hash of IP address plus user agent, from server-side registry fetches |
| **Funnel conversion %** | Visitors who completed a step ÷ visitors who started step 1, within the conversion window |
| **Drop-off** | Visitors who completed the previous step but not this one within the window |
| **Conversion window** | 14 days: the time from step 1 in which later steps must happen to count |
| **Ordered funnel** | Steps must happen in order; other events in between are allowed |
| **Breakdown** | Splitting a chart into one series or bar per value of a property |
| **Breakdown attribution: step 1** | In funnels, the breakdown value is taken from the event at step 1 |
| **Retention: first time** | Cohorts are based on each visitor's very first page view |
| **Test traffic filter** | Removes events where `environment` = `development`, plus PostHog's default test cohort |
| **`$pathname`** | The page path without domain or query string, e.g. `/docs/blocks/team-invites` |
| **`$prev_pageview_pathname`** | The path of the page viewed just before this one, in the same visit |
| **`$referring_domain`** | The domain of the site that linked to this visit; `$direct` = none |

### 4.1 Event dictionary (what each event means)

| Event | When | Key properties |
| --- | --- | --- |
| `$pageview` | Any page load or in-app navigation | `$pathname`, `$prev_pageview_pathname`, `$referring_domain`, `$current_url` |
| `$pageleave` | Leaving a page | time on page |
| `$autocapture` | Clicks on links, buttons, inputs | element text and selector |
| `filter_applied` | A browse filter is toggled | `group`, `value`, `selected`, `library` |
| `search_performed` | Browse search settles (1 s, 2+ chars) | `query`, `library` |
| `copy_npm_command` | An install command is copied | `item`, `manager`, `code` |
| `paywall_viewed` | Code view opened on a Pro item | `item` |
| `checkout_started` | Buy button clicked | `plan`, `price_cents` |
| `registry_item_fetched` | Server: `/r/<item>.json` served (free item, or a paid item to its buyer) | `item`, `client`, `user_agent`, `product_id` (paid) |
| `registry_access_denied` | Server: a paid item refused | `item`, `product_id`, `reason` (`no_token`, `no_access`), `client` |

---

## 5. Beyond the dashboards

### 5.1 Web analytics (quick traffic overview)

**Left sidebar → Web analytics.** A ready-made traffic page with no setup:

- Visitors, page views, sessions, session duration and bounce rate, with comparison to the previous period.
- Top pages, entry pages and exit pages. Exit pages show where visits end.
- Channels, referrers and UTM sources and campaigns.
- Countries, devices, browsers and operating systems.

Turn on **"Filter out internal and test users"** at the top if it isn't already. Use this for a daily glance; use the dashboards for the three questions.

### 5.2 Session replay (watch what people actually do)

**Left sidebar → Session replay.** Every visit is recorded, with all text inputs masked, and kept for 30 days.

Useful filters (click **Filters** → add the event or property):

| To watch… | Filter |
| --- | --- |
| People who looked at pricing but didn't buy | Event `$pageview` with `$pathname` = `/pricing`, **and** did *not* perform `checkout_started` |
| People who hit a Pro paywall | Event `paywall_viewed` (optionally `item` = a specific item) |
| People who searched | Event `search_performed` |
| People frustrated by something | **Rage clicks** or **dead clicks** (see 5.4) |

Any funnel step also has **"Watch recordings"** on its menu, which opens exactly those visitors' sessions.

### 5.3 Heatmaps (where people click and scroll on a page)

Heatmaps are switched on for the project. Two ways to see them:

- **Left sidebar → Heatmaps:** enter a page URL to see click, rage-click and scroll-depth heatmaps for it.
- **Toolbar on the live site:**
  1. Go to **Toolbar** in the left sidebar and click **Launch** next to the site's URL.
  2. On the site, open the PostHog toolbar → **Heatmap**.
  3. You'll see clicks drawn over the real page.
  - The site's URL must be in the project's **authorised URLs**. Currently only `http://localhost:3000` is listed; **add the production domain at launch**.

Best pages to check: `/pricing` (do people read the plan details, and how far do they scroll?), `/` (which cards get clicked), and the top component pages.

### 5.4 Dead clicks and rage clicks

Switched on for the project:

- **Dead click:** a click on something that looks clickable but did nothing.
- **Rage click:** several fast clicks in the same spot, usually frustration.

Find them in **Heatmaps** (rage-click mode), as filters in **Session replay**, and as events (`$dead_click`, `$rageclick`) in **Activity**.

### 5.5 Asking your own question

- **Product analytics → New insight:** pick Trends, Funnel, Retention, Paths and so on, and build from the events in 4.1.
- **SQL:** **Left sidebar → SQL editor.** For example, installs per item in the last 7 days:

```sql
SELECT properties.item AS item, count(DISTINCT distinct_id) AS machines
FROM events
WHERE event = 'registry_item_fetched'
  AND properties.client = 'cli'
  AND properties.environment != 'development'
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY item
ORDER BY machines DESC
```

- **PostHog AI:** the chat in PostHog can build charts from a plain question, for example "which component pages lead to pricing this month". It knows craftUI from the project's product description.

---

## 6. When something looks wrong

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| **Every chart is empty** | The production site isn't sending: the env vars aren't on Vercel | Vercel → Project → Settings → Environment Variables: add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` for Production, then redeploy |
| Charts empty, but you just tested locally | Local traffic is `development` and filtered out | Expected. Toggle "Filter out internal and test users" off in an opened chart to see test data |
| Install charts empty but page views fine | Registry tracking not reaching PostHog | Check **Activity** for `registry_item_fetched`. The proxy needs `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` at runtime on the server too |
| Installs look like half of what you expected | You're comparing with raw fetches | Each install fetches twice; use the `cli` unique-machine charts |
| `item` shows "null" in copy charts | Copies made before 25 Oct 2026, or not a registry command | Expected |
| A sudden spike in `bot` / `other` fetches | Crawlers or AI agents reading the registry | Harmless; they're excluded from installs |
| The latest week looks like a drop | The week isn't finished | Ignore the last point until Saturday ends (New York time) |
| Numbers differ from Vercel Analytics or Umami | Different tools count differently (bots, ad blockers, sessions) | Normal. PostHog goes through the `/relay` proxy, so ad blockers drop fewer events; expect PostHog to be higher |
| Numbers seem stale | Cached results | Click **Refresh** on the dashboard |

---

## 7. What isn't tracked yet

| Gap | Plan |
| --- | --- |
| **Purchases in the funnels and revenue charts** | `purchase_completed` is now sent by the Dodo webhook (25 Oct 2026), joined to the buyer's journey. Once the first test purchase reaches PostHog: add a 4th "Purchased" step to funnels 3.3, 3.6 and 3.7, set it as a revenue event (Data management → Revenue), and add a revenue chart. Until then, find purchases in **Activity** → event `purchase_completed`. Details in the setup doc, section 12.1 |
| Successful installs (vs fetches) | Not possible: the shadcn CLI doesn't report back |
| Which plan card was *looked at* (vs clicked) | Use heatmaps on `/pricing` (5.3) |
| Alerts | None yet. Good first ones once there's traffic: installs per day drop to 0, or checkout started drops to 0 for a week |

---

## 8. Weekly routine (10 minutes)

1. **Dashboard 1:** visitors this week vs last (1.1), top components (1.4), new search terms (1.8).
2. **Dashboard 2:** installs this week (2.1), top installed items (2.3), copies vs installs gap (2.5).
3. **Dashboard 3:** pricing visitors (3.1), visit → checkout rate (3.3), top component pages leading to pricing (3.6).
4. **Watch 3 recordings** of people who reached pricing and didn't buy (5.2).
5. **Write one line** of what you learned and one thing to try. Add an annotation in PostHog when you ship that change.

---

## 9. Reference: every chart and ID

| Dashboard | Chart | Short ID | Insight ID | Tile ID |
| --- | --- | --- | --- | --- |
| 1 · Site usage (`2257785`) | Visitors per week | `WKp2F9XJ` | `13272714` | `14212880` |
| | Where visitors come from | `Y7hEdC9m` | `13272728` | `14212894` |
| | Most visited pages | `1QFjsWZl` | `13272720` | `14212886` |
| | Most viewed components | `rWDHT8Jf` | `13272725` | `14212892` |
| | How people move through the site | `pau9WDOO` | `13272735` | `14212901` |
| | Do visitors come back | `GbgWiK8n` | `13272744` | `14212909` |
| | Filters people use | `TmvEUeix` | `13266195` | `14212954` |
| | What people search for | `lZVWC6RR` | `13266196` | `14212955` |
| 2 · Installs (`2257786`) | Installs per day | `viKYGGEp` | `13272798` | `14212956` |
| | Registry fetches by client | `2VsscufQ` | `13272812` | `14212976` |
| | Installs by item | `iO8yeCzZ` | `13272799` | `14212957` |
| | Install command copied by item | `7A2D1N9C` | `13272801` | `14212958` |
| | Copies vs installs per week | `4LLKeeFK` | `13272802` | `14212959` |
| 3 · Pricing & conversion (`2257063`) | Pricing page visitors per week | `BXLBJddQ` | `13272821` | `14212995` |
| | Plan chosen at checkout | `zhASDBb0` | `13272825` | `14212999` |
| | Visit to checkout funnel | `BEOZtxah` | `13266193` | `14203040` |
| | Where people come to pricing from | `i3oTfTC6` | `13272822` | `14212996` |
| | Paywall views by Pro item | `6Z6iH2bt` | `13266194` | `14203041` |
| | Component pages that lead to pricing | `Xnt4pGwR` | `13272823` | `14212997` |
| | Paywall to checkout by Pro item | `5KYz4gz0` | `13272824` | `14212998` |

Any chart opens at `https://us.posthog.com/project/686953/insights/<short ID>`.
