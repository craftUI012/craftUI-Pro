# Product pieces: isometric UI that looks like real software

Modern software sites illustrate the **product**, not a metaphor for it. A
product piece is a floating UI panel, card or chart in isometric, with real
copy and numbers that the buyer changes through props. `IsoBalancePanel`,
`IsoRulePanel` and `IsoCard` are the references.

## Orientation: stand or lie?

| Content | Orientation | Why |
| --- | --- | --- |
| Charts, trends, anything with an "up" | **Standing** (`Panel`) | On a flat face the u axis falls 30° on screen and cancels a modest rise: growth reads as decline. |
| Big numbers, headings | Either; standing reads most upright | Standing text is sheared 30° but upright. |
| Lists, toggles, settings, forms | **Flat** (`Slab`) works well | Rows and toggles read fine lying down, and flat panels vary a scene's silhouette. |
| Cards (payment, ticket, pass) | Flat, floating | That's how cards are seen. |

In a scene, mix orientations (one standing, one or two flat) and put
standing pieces at the back.

## Anatomy

- Body: `Slab` (flat, 7 × 5.5 × 0.35, radius 0.5, floating at z = 1) or
  `Panel` (standing, 7 × 5.5, depth 0.4, bottom at z = 1). Palette
  `surface` for neutral UI; `main` for a brand-coloured card.
- `frontStyle={GLASS}` for frosted panels (they let the floor dots show
  through, which adds depth). Use it on one piece per scene, not all.
- `casts` with the raised `z`, so the panel throws an offset soft shadow.
  That shadow is the main depth cue for flat UI.
- Content is drawn in `content(w, h)` in face units; text per icon-anatomy
  "Text".

## Content props

- Every visible string and number is a prop with a realistic default:
  `label`, `amount`, `delta`, `data`, `heading`, `description`, `rules`,
  `last4`. Defaults should read like a real product: "$12,480.20",
  "+12.4%", "Round up purchases", "•••• 4242". No lorem ipsum, no "Title".
- **Never** name a content prop `title`: it's the accessible name on every
  icon, and the board passes it.
- Arrays (`data`, `rules`) state their limits in the prop comment
  ("Up to two rules fit") and slice to that limit.
- An empty string hides an optional element (`delta=""` hides the pill).

## Copy-length budgets

Geist's average glyph is about 0.58 × the font size wide. Usable width on a
7-wide panel is 5.9 (0.55 margins).

| Slot | Size | Fits about | Example |
| --- | --- | --- | --- |
| Hero number | 0.9 | 11 characters | `$12,480.20` |
| Heading (beside a 0.8 chip) | 0.5 | 16 characters | `Auto-save` |
| Label / description | 0.34–0.4 | 25–29 characters | `Runs on every payment` |
| Row label beside a toggle | 0.38 | 20 characters | `Save 10% of income` |
| Pill | 0.34 in a 1.55 pill | 6 characters | `+12.4%` |

Check every new piece with its default **and** a long value. Over-budget
copy runs off the panel; state the budget in the prop's comment.

## UI vocabulary (face units)

| Element | Build | Typical size |
| --- | --- | --- |
| Icon chip | rounded rect in `--iso-glow` + a `--iso-screen` mark | 0.8 × 0.8, radius 0.22 |
| Pill / badge | rounded rect `--iso-glow`, text `--iso-screen` 0.34 | 1.55 × 0.72, radius 0.36 |
| Toggle | pill 1.3 × 0.7 (`--iso-glow` on, `--iso-text` at 18% off) + knob r 0.27 `--iso-screen` | knob at the right when on |
| Divider | rect 0.03 tall, `--iso-text` at 14% | full width minus margins |
| Sparkline | `FacePath` in `--iso-glow`, `isoStroke(1.6, 0.22)`; area beneath at 14%; end dot r 0.2 + inner r 0.08 | 2–2.5 tall on a standing panel |
| Bars | small `Box`es on the floor, or rects on a standing panel, along x + y = const if 3D | equal gaps, one baseline |
| List row | text 0.38 + right-side control | rows every 1.25 |
| Card number | text 0.52, `--iso-on-main`, tracking 0.06 | `•••• 4242` |
| Avatar | `--iso-glow` circle r 0.35 + initials 0.3 | rows of 3 overlap by 0.2 |
| Progress | track at 14% + fill `--iso-glow`, radius = half height | 0.3 tall |

## Style notes by reference brand

- **Vercel-like:** monochrome first (neutral pieces, the tone only on
  status, nodes and progress), mono copy (`ISO_MONO`), near-black terminals
  (`--iso-console`), hairline globes, exploded stacks of clear glass with
  dashed guides. The `line` variant gives the blueprint version.
- **Clerk-like:** crisp light components (sign-in card, code input, user
  chip) with real copy, inputs with a 16% hairline border so white fields
  read on white cards, one brand button per piece.

## Category kits

Each category ships a small kit: two or three product pieces, a few
objects, one product scene, and optionally one object scene. The user's
working style is **one category at a time, one scene per category** on the
board.

| Category | Product pieces | Objects | Product scene idea | Status |
| --- | --- | --- | --- | --- |
| Finance | `IsoBalancePanel`, `IsoRulePanel`, `IsoCard` | bank, safe, coins, wallet, shield | Savings, automated: card → rules → balance | Built |
| Ecommerce | order panel, checkout summary, shipment tracker | store, house, van, shelf, conveyor, box, bag, tag, phone | Order → fulfilled → delivered | Objects built; pieces to do; objects need `casts` |
| Technology (devtools, cloud, auth) | `IsoDeployPanel`, `IsoTerminalPanel`, `IsoLayer` (edge / functions / app), `IsoSignInCard`, `IsoOtpCard`, `IsoSessionCard` | `IsoGlobe`, server, database, browser | Push to production · The request stack · Sign in, secured | Built (2026-11-02) |
| AI | prompt panel, model chip, usage chart, agent-steps list | chip/processor, sparkle | Prompt → agent steps → answer | To do |
| Security | audit log list, key card, permissions panel (sign-in, OTP and session pieces exist under Technology) | shield, lock, key | Threat blocked → audit trail | Shield built |
| Analytics | KPI panel, bar-chart panel, funnel | — | Events → dashboard → insight | To do |
| Collaboration | comment thread, avatar stack, calendar slot | — | Comment → mention → resolved | To do |

When a category starts: pick its pieces from this table, check the copy
budgets, build the pieces before the objects, and keep the scene to three
or four items.
