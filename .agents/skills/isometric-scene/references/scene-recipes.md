# Scene recipes: from a description to a composed scene

> **Shipping format (2026-11-02):** a scene is now one use case told as one
> moment, in one `IsoStage`, choreographed with a storyboard, and shipped
> as a registry item (see SKILL.md steps 6–7 and `two-step-sign-in.tsx`).
> `IsoScene` grids of separate icons (below) are still useful for layout
> thinking and static compositions, but a grid of floating pieces joined by
> lines is a diagram, not a scene.

## Connector vocabulary: one per scene, never repeated

How things travel between objects is a signature. Pick one no shipped
scene owns (SKILL.md "Shipped scenes"), and draw it from 3D like
everything else.

| Connector | What it is | Reads as | Owner |
| --- | --- | --- | --- |
| **Arc comet** | A quadratic arc in 3D through a raised peak, sampled and projected; one comet dash (pathLength 100) flies along it, with a faint dotted track while in flight | something sent through the air (a code, a push) | two-step-sign-in |
| **Rails with trailing dashes** | Grooves cut into the floor (filled rectangles in the floor's plane, padded at turns) edged by two hairline rails (mitred offsets of the polyline, projected then stroked). Packets are one dash pattern per path: tiny trailing dashes growing into a head, then a gap longer than the rail (pathLength 100); several per rail, staggered with negative animation delays; their count shows the traffic share | steady traffic, routing, splits | gradual-rollout |
| **Cable** | A thick rounded cable lying on the desk (a 3D bezier hugging z = top), with a light pulse running inside it | wired connection, sync, power | free |
| **Beam** | A vertical column of light rising from a device, fading upward, with motes drifting up | upload, publish, broadcast to the cloud | free |
| **Ripples** | Concentric ellipses expanding on a floor or face from a source (exact √3 : 1 ellipses, scale up and fade) | notification, webhook fired, alert | free |
| **Packet hop** | Small cubes hopping node to node along a path (parabolic hops in z) | queues, jobs, batches | free |
| **Continuity** | The same UI element visibly moves from one screen to the other (a card lifts off one screen and lands on the other) | handoff between devices | free |

Rules for any connector:
- Motion is caused by the story (it fires on a stage) or encodes data
  (packet count = traffic share). Never decorative looping alone.
- Its geometry follows the camera (`FacePath`, `Face`, or `projectWith`).
- It has a still state for reduced motion (packets placed along the rail,
  arc hidden).

## Two-screen desks (lessons from push-to-deploy)

- **Stagger, don't stack.** A laptop straight in front of a monitor makes
  one tall column, hides the stand, and leaves empty desk on both sides.
  Put the laptop front-left and the monitor back-right (or the mirror).
- **Prove there's no overlap before drawing.** For each screen pair,
  project the front screen's top edge and the back screen's bottom edge
  and check, along their shared screen-x range, that the front top stays
  below (larger canvas y). Write the check in the geometry comment.
- **Trim the desk to the objects.** Empty desk reads as unfinished; cut
  the side nobody uses.
- **Big screens tolerate less turn away from them.** Two large screens
  facing the same way went unreadable at −20°; −12°…35° works.
- **Keep connectors on open floor.** In gradual-rollout's first layout the
  rails ran behind the router and a server, hiding the split the scene is
  about. Put the destinations at the back with their fronts to the viewer
  and run connectors across the floor in front of them.
- **Size dash patterns for the scene, not the rail.** Patterns in
  pathLength units scale with rail length; check that the tail reads at
  the docs preview size (tiny trails vanish).
- **Lists insert, they don't swap.** A new row slides in on top and the
  older rows move down (a `motion.g` offset on the old rows).

## Choosing the moment

1. Pick a feature a real software company sells (sign-in with a code,
   instant rollback, a preview link shared with a teammate, a failed
   payment retried).
2. Find the one physical moment that shows it: a laptop and a phone on a
   desk; a browser and a terminal; a dashboard and a notification.
3. Write the storyboard as cause and effect: each stage happens *because*
   of the previous one. Nothing loops without a reason; the loop resets
   calmly after a hold of about 3 seconds.
4. Keep the cast to 2–3 objects and one surface. Real UI on their screens,
   at a size where the copy reads.

A scene is icons and product pieces placed on an isometric grid, usually
over a fading dot floor, with links showing flow. `IsoScene` lays out the
items; each item holds one icon with its own props.

## Scene types

Pick one per scene, and vary them across a category's scenes:

| Type | What it shows | Floor | Links | Reference |
| --- | --- | --- | --- | --- |
| **Product** (default for software) | 2–4 UI pieces: cards, panels, charts with real copy | dot grid | light pulses | "Savings, automated" |
| **Object** | physical metaphors: bank, safe, coins, warehouse | dot grid | light pulses, or the objects themselves | "Savings that grow" |
| **Street / system** | buildings or machines in a place | slab, or grid with a road | `road` strips, conveyors | ecommerce "Shop to doorstep" (first pass, since removed from the board) |
| **Vignette** | 1–3 items floating, no floor | none | at most one | empty states, cards |

## Decomposing a description

1. **Nouns become items.** Merge synonyms; drop context-only nouns. Prefer
   the product's own UI for each noun ("savings" → a balance panel, not a
   piggy bank) unless the scene type is Object.
2. **Verbs between nouns become links**, directed source → target.
3. **Pick the subject**: what the page is about. It becomes the hero.
4. **Cap the count:** card or empty state 1–3, feature 3–5, hero 4–6.

## Layout rules

- **Coordinates:** column = world x (down-right on screen), row = world y
  (down-left). Cell (0, 0) is the back corner. Fractions are allowed
  everywhere.
- **Tall at the back.** Standing panels, towers and buildings go at low
  col + row; flat panels, cards and small things in front. Otherwise tall
  things hide flat ones.
- **Hero by size and place:** the subject is the largest item (`scale`
  1.2–1.35) and either front-centre or the tall anchor at the back.
  Supporting items 0.75–1.1; small story details 0.28–0.5.
- **Real relative scale.** A parcel next to a house is about 0.28; a bag at
  a shop door about 0.3; a wallet next to a bank about 0.45.
- **No dead floor.** Use fractional `rows`/`cols` (2.6 × 1.8) or pull the
  cluster together. Bounds fit the items, not the grid, so spacing is what
  you see.
- **Overlap only on purpose:** a card tucked behind a panel's corner is
  depth; a panel hiding another panel's content is a bug.
- **Links:** along grid lines with one turn, on the floor, ending under the
  item they connect. If a link detours past an item, flip `bend`.
- **Colour:** brand tone on the subject (and the scene's links); supporting
  items `tone="muted"` with the brand as `accent`, so their chips, pills
  and lights still carry the brand. No more than two tones in a scene.
- **Motion:** link pulses by default; at most one floating item; `assemble`
  for things that build (coins, stacks). Everything stops under reduced
  motion.

## IsoScene API

| Piece | Props | Notes |
| --- | --- | --- |
| `IsoScene` | `cols`, `rows` (fractions), `links`, `floor` (`"grid"` default, `"slab"`, `"none"`), `tone`, `variant`, `strokeWidth` | Bounds fit the items' hexagons; floor dots are clipped to them. |
| `IsoSceneItem` | `x`, `y` (fractions), `z` (world units up), `scale`, `height` | Stack with `z` = lower item's height × its scale. Nearer items (x + y + z) paint on top. `height` (default 8) is how tall the item draws in its own units; set ~1–1.5 on flat panels and plates so the scene doesn't reserve empty space above them. |
| `links` | `{ from, to, style, bend }` | `"flow"` (default look): a faint track with one pulse of light travelling source → target, staggered per link. `"road"`: a 4-unit strip with a centre line. `bend: "y"` turns rows-first. |

### Line weight

`strokeWidth` on `IsoScene` (default 0.3, canvas units of a full-size cell)
sets every line: floor, links (road line 0.85×, flow track 0.9×, pulse
1.7×) and every icon. `IsoSceneItem` hands each icon `strokeWidth ÷ scale`,
so a 0.3-scale parcel draws the same on-screen line as a full-size house.
Pass `strokeWidth` to `IsoScene` only, never to icons inside it (an icon
with its own `strokeWidth` skips the correction). Check it: `--iso-stroke-
width × (svg width ÷ 24)` gives the same px for every item.

## Art direction: designed, not generated

The rules that turned "AI slop" into product-grade scenes:

1. **Product over metaphor.** Show the software doing its job, with real
   copy and numbers.
2. **One subject.** Largest, in the brand tone; everything else muted.
3. **Small story details beat more objects.** A parcel on the doorstep,
   goods in a window, a card tucked behind the rules panel.
4. **Let things be the link** where they can: a conveyor, a road, a card
   tapping a phone. Pulses for the rest; never dashed lines everywhere.
5. **Open space, not a diorama.** Dot grid by default; a slab only when the
   place is the point.
6. **Charts stand up; tall things go to the back.**
7. **Badges only on objects that fill their box.** On flat or small items
   the badge floats far away; leave it off.
8. **Vary the staging** across a category (product, object, vignette).
9. **Look before you report.** Screenshot, zoom, critique against Stripe
   and Linear, fix, then report.

## Plan table template

```
Scene: <one line story>
Category · type · placement: <finance · product · feature>
Floor: grid <cols> × <rows>          Subject: <item>

| Item (x, y, z) | Thing | Icon / piece | New? | Scale | Props | Notes |
| -------------- | ----- | ------------ | ---- | ----- | ----- | ----- |
Links: (a,b) → (c,d) [bend], …
```

## Worked examples

### Finance · product · feature: "Savings, automated" (built)

```
Floor: grid 2.6 × 1.8          Subject: balance panel
| Item          | Thing         | Piece           | Scale | Props                  |
| (1.7, 0)      | savings chart | IsoBalancePanel | 1.3   | muted, accent = brand  |
| (0, 0.55)     | card payment  | IsoCard         | 0.9   | brand                  |
| (0.85, 1)     | auto-save     | IsoRulePanel    | 1.1   | muted, glass           |
Links: (0,0.55) → (0.85,1) → (1.7,0)
```

The balance panel stands (it has a chart) and sits at the back; the rules
panel lies flat in front; the card is tucked to the left.

### Finance · object · feature: "Savings that grow" (built)

```
Floor: grid 3 × 1.7            Subject: coins
| (0, 0)    | bank   | IsoBank   | 1    | muted                       |
| (1, 0.8)  | coins  | IsoCoins  | 1    | brand, animate="assemble"   |
| (2, 0)    | safe   | IsoSafe   | 0.85 | brand                       |
| (0.1, 1)  | wallet | IsoWallet | 0.45 | muted                       |
Links: (0,0) → (1,0.8) → (2,0)
```

Coin stacks run along x + y = const so they read as bars.

### Technology · product · hero: "Push to production" (built)

```
Floor: grid 3 × 1.6            Subject: deploy panel
| (1.1, 0)        | deploy status | IsoDeployPanel (standing) | 1.25 | brand  |
| (0, 0.75) h1.5  | terminal      | IsoTerminalPanel (flat)   | 1    | muted  |
| (2.3, 0.75)     | edge network  | IsoGlobe                  | 0.9  | muted  |
Links: (0,0.75) → (1.1,0); (1.1,0) → (2.3,0.75) bend y
```

The globe first sat at (2.15, 0.55) and covered the panel's values. Keep
round objects clear of standing panels' lower corners.

### Technology · system · feature: "The request stack" (built)

```
Floor: grid 2 × 1.5            Subject: the stack
| (1, 0.15) z 0    h1 | edge network | IsoLayer kind="edge"            | 1.05 |
| (1, 0.15) z 5.5  h1 | functions    | IsoLayer kind="functions", stem | 1.05 |
| (1, 0.15) z 11   h1 | your app     | IsoLayer kind="app", stem, brand | 1.05 |
| (0, 0.9)            | browser      | IsoBrowser                      | 0.6  |
Links: (0,0.9) → (1,0.15)
```

Upper layers pass `shadow={false}` (their shadow would land on their own
level). `stem` = gap ÷ scale so the dashed guides reach the plate below.
Labels sit on each plate's front edge; the back corner is covered by the
plate above.

### Technology · product · feature: "Sign in, secured" (built)

```
Floor: grid 2.4 × 1.6          Subject: sign-in card
| (1, 0)              | sign-in  | IsoSignInCard (standing) | 1.25 | brand |
| (0.15, 0.6) h1.5    | OTP code | IsoOtpCard (flat)        | 1.05 | muted |
| (1.45, 0.95) h1.5   | session  | IsoSessionCard (flat)    | 1    | muted |
Links: (1,0) → (0.15,0.6) bend y; (0.15,0.6) → (1.45,0.95)
```

### Empty state · vignette: "No transactions yet" (plan)

```
Floor: none                     Subject: card
| (0, 0) | card | IsoCard | 1 | variant="line", animate="float" |
```

One item, one calm motion, no links.

## When the description is vague

Choose and state it in the plan table. Ask only if you can't tell what the
scene is *about*, or where it will be used and that changes the size a lot.
