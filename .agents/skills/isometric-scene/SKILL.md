---
name: isometric-scene
description: Create mathematically exact, modern isometric icons, product UI pieces and isometric scenes for craftUI's Isometric (ISO) library in registry/isometric, at the quality bar of Stripe, Mercury, Ramp, Linear and Vercel. Use whenever the user describes a scene or object to render in isometric ("an isometric scene of a payment flow", "make an isometric cloud deploy", "draw a warehouse in isometric", "add an isometric lock icon", "isometric dashboard panel"), asks for a new isometric icon, product panel, composition, empty state or hero illustration, asks for a category of isometrics (finance, ecommerce, devtools, AI, security…), edits anything in registry/isometric (iso-core, IsoIcon, IsoStage, IsoScene, Box, Slab, Panel, Cylinder, Extrude, Face, casts), or asks about isometric projection, angles, grid, shading, shadows or the isometric docs pages.
---

# Isometric scene creation

The user describes a scene in words. You turn it into a true-isometric,
choreographed scene of one real use case, built from 3D primitives, that
ships in the craftUI registry as a paid, installable React component,
follows the buyer's shadcn theme, and is customised through props. Every
drawing is computed from 3D geometry, drawn in ink (flat faces, one even
outline) and posed as solids. Nothing is hand-drawn in screen space.

## The bar

Buyers put these next to their own product, so they're judged against what
Stripe, Mercury, Ramp, Linear, Vercel and Clerk ship. The house style was
reset on 2026-11-03 to the user's own static isometrics (the GPU stack,
the modular block, the nested core) and the benchmark scene is
`two-step-sign-in`. Six things separate that from clip art, and every
decision below serves them:

1. **Ink, not light.** The default variant is `ink`: three flat values
   per face (lightest on top; a dark page gets its own graded ramp,
   0.33 / 0.27 / 0.20 on the card) and one even ink outline on every
   visible edge, 1.3 px at any frame size, hard miter corners. No
   gradients, rims or soft hairlines. Light-rendered `duotone` and `solid`
   remain as variants for buyers who want them, never the default.
2. **No base.** No desk, no plate. The frame crops to the subject; the
   floor is implied by shadows and a dashed construction grid
   (`FloorGrid`). Screens float a little above the floor.
3. **One lit thing.** Everything else is neutral surface; one object
   carries the brand tone and may bloom (`Bloom`). Here it is the code
   chip. Never spread the tone over every button, pill and wallpaper.
4. **Objects act.** The things move as solids through `Rig` (hop, toss,
   press, jolt, lift, settle), with cause and follow-through: the phone
   hops because the text lands, the screen is kicked because the chip
   hits it. UI changes on screens are secondary beats, never the only
   motion. Pop in and out with scale, never opacity.
5. **Product over metaphor.** Real UI with real copy and numbers on the
   screens, at a size that reads at card size. The `screen` prop renders
   the buyer's own React UI inside the screen and follows the story.
6. **A use case, not a diagram.** One real moment of one real product
   story, 2 to 3 objects, choreographed start to finish with a calm hold
   before the loop. Pieces on a grid joined by lines read as a diagram.

## References

| File | Read it when |
| --- | --- |
| [references/isometric-math.md](references/isometric-math.md) | Always. Projection, angles, ellipses, face mapping, ink values and light, shadows, depth order, mirroring, the rig transform, canvas and grid. Every number comes from here. |
| [references/icon-anatomy.md](references/icon-anatomy.md) | Building or changing any icon or part: the public API (props, `--iso-*` variables, camera, rig, clock, tracks and presets, guides, bloom), palettes, primitives, keylines, rendering, details, text. |
| [references/product-pieces.md](references/product-pieces.md) | Building UI for a screen, panel, card or chart, or starting a new category: orientation, copy-length budgets, UI vocabulary, category kits, brand style notes. |
| [references/scene-recipes.md](references/scene-recipes.md) | Choosing the moment and composing a scene: scene types, layout, links, line weight, art direction, plan template, worked examples. |

## Non-negotiable rules

1. **True isometric only.** Axes at 30° to horizontal, 120° apart, equal
   scale. Never the 2:1 "game isometric" dimetric projection (26.565°).
2. **Geometry first.** Place primitives (`Box`, `Slab`, `Panel`, `Poly`,
   `Cylinder`, `Sphere`, `Extrude`, `Face`…) in world units. Never write a
   projected screen path by hand. A missing shape becomes a new primitive
   in `iso-core.tsx`, computed from 3D, with its formula cited.
3. **One grid.** Primitive positions and sizes are multiples of 0.5 world
   units; face details may use 0.25. Single icons fit the 8 × 8 × 8
   reference cube; stage scenes set their own bounds.
4. **Ink by default.** `variant="ink"` draws flat faces and a constant
   pixel outline (`--iso-edge-w` with `vector-effect: non-scaling-stroke`;
   note vector-effect does not inherit, so it is set on every path). In
   `duotone` and `solid`, shades come from L ∝ (1, 2, 3) as gradient
   paints with rims and a faint hairline; `line` is the blueprint.
5. **Everything solid declares its shadow shape** (`casts`), so shadows
   fall along the light from the real shape, onto the floor or onto a
   raised surface (`ground`).
6. **Theme from tokens.** Colours come only from the buyer's shadcn
   variables through the `--iso-*` contract (see icon-anatomy). No raw hex
   or oklch outside the core.
7. **Strokes after projection, one line weight.** Detail strokes are
   `isoStroke(k)` multiples of `strokeWidth`.
8. **Props, not forks.** Look (tone, accent, variant, strokeWidth) and
   content (names, codes, copy, data) are props with doc comments. Never
   name a content prop `title`: it's the accessible name.
9. **Self-contained and installable.** A shipped item carries everything
   it imports (`iso-core.tsx` goes inside the item). npm dependencies only
   where needed (`motion` for choreography).
10. **Repo rules apply:** [[section-build-rules]] (SVG in TSX, Tailwind
    classes in the file, no separate CSS), plain `sm/md/lg/xl`
    breakpoints, no container queries, rem not px in Tailwind arbitrary
    values, and never run `ultracite fix` on `.mdx` files.

## Workflow: from a sentence to a shipped scene

### 1. Check the core

Open `registry/isometric/iso-core.tsx` and confirm it matches the math
reference: `project` uses `S·(x − y)·√3/2` and `S·((x + y)/2 − z)` with
S = 1.25; `IsoDefs` gradients, `casts` shadows and `IsoStage` exist. If it
has drifted (or still has the first pilot's 2:1 constants:
`K = Math.sqrt(1.25)`, viewBox `-40 -56 80 80`), fix the core first. Tell
the user, because existing items will change.

### 2. Choose the use case and the moment

- Which feature, of which kind of company (auth, deploys, payments,
  analytics…)? Where will it sit (hero, feature section, bento card)?
- The one physical moment that shows it (scene-recipes "Choosing the
  moment"): 2–3 objects, one surface, real UI on their screens.
- The story as cause and effect, one line per stage.

Ask only if the use case is genuinely unclear. Otherwise choose and state
your choices.

### 3. Take stock

List `registry/isometric/`. Reuse parts that fit; new reusable parts go in
`iso-<name>.tsx`. Name things after the real object, never the scene.

### 4. Plan

Write the cast and layout in world units (surface, each object's position
and size, which is tall and goes at the back), the screen copy with its
length budget, and the storyboard (stage, time, what changes, why).

### 5. Specify parts in world units

For each object: primitives, positions, sizes, palettes, face content, and
its `casts`. For each screen: orientation (standing reads most upright;
charts must stand), content slots and props.

### 6. Build (use-case scenes are the shipping format)

- A use-case scene is **one client component** in
  `registry/isometric/<use-case>.tsx` (`"use client"`), drawn in a single
  `IsoStage` (one SVG: one coordinate space, a `base` such as a desk, shadows
  on the base's top via `ground`). Reference: `two-step-sign-in.tsx`.
- Choreograph it with the `interface-craft` storyboard pattern: the ASCII
  storyboard at the top, a `TIMING` object, config objects per element, one
  `stage` integer, one effect with all timers, `useInView` to start,
  `useReducedMotion` to show the end state, `autoPlay` and `loop` props.
  (Lint wants sorted keys and no comments after code: put each comment on
  the line above; the storyboard keeps the time order readable.)
- **Motion and SVG:** `motion` treats `x`/`y` on SVG elements as
  transforms, which escape a face's matrix. Never put `x`/`y` on a
  `motion.*` element inside `Face`/`Slab`/`Panel` content. Animate wrapper
  `motion.g` groups (opacity, offsets in face units) and keep shapes as
  plain SVG; colour changes can be CSS transitions.
- **Rig the objects.** Wrap each thing that acts in `Rig` with a pivot
  where it would hinge or stand, and a `pose(ms)` built from the verb
  presets (`hop`, `toss`, `press`, `jolt`, `lift`, `settle`) sampled on
  the scene's `useClock(running, cycle)`. Followers take the same preset
  shifted 60 to 120 ms (`shiftTrack`) and scaled 0.6 to 1.4
  (`scaleTrack`). At least one part lags. Rigs nest. Anything a scene
  projects itself inside a rig goes through `useRigged()`.
- **Pick a connector nobody else uses.** How something travels between
  objects (a code to a laptop, a push to a monitor, traffic to a server)
  is part of each scene's identity. Choose one from the connector
  vocabulary in scene-recipes that no shipped scene owns, or invent a new
  one, and record it in the Shipped scenes table. Never reuse the arc
  comet (owned by two-step-sign-in) or rails (owned by gradual-rollout).
- **Let the viewer turn it.** Every scene takes `rotate` ("drag" default,
  "pointer", "off") and `orbit` (degrees, or `[min, max]`): call
  `useIsoOrbit({ mode, orbit, pivot, reduced })`, pass its `camera` and the
  orbit to `IsoStage`, spread its `orbitProps` on the wrapper (focusable
  group with a "drag or use arrow keys" label). Pivot = the middle of the
  base. Pick an uneven range when a screen faces one way: turning toward it
  reads better, away soon goes edge-on (two-step-sign-in uses [-20, 35]).
  Anything a scene projects itself (an arc, a path) goes through
  `projectWith(camera, p)`.
- Content (names, codes, copy) and look (tone, accent, variant,
  strokeWidth) are props with doc comments; the registry build turns them
  into the AI-agent docs. A default that is a named constant shows up as
  "built-in demo content" there, so state the value in the comment.
- Reusable parts go in `registry/isometric/iso-<name>.tsx` only when a
  scene needs them; new geometry goes in `iso-core.tsx` with its formula
  cited.

### 7. Register it and see it on its docs page

There is no prototype board; the docs page is where a scene is checked.
Follow `content/docs-admin/guides/adding-a-component.mdx`:
- `registry.json` entry: `type: "registry:block"`, `meta.library:
  "isometric"`, `categories` (e.g. `technology`), `meta.types: ["scenes"]`,
  `meta.styles`, `meta.useCases`, `meta.publishedAt`, `dependencies`
  (`motion`), and **files: the scene first, then `iso-core.tsx`** (both
  targeting `components/isometric/`, imported relatively). Shipping the core
  inside the item avoids cross-item dependencies and signed-token wiring.
- Docs page `content/docs/isometric/<name>.mdx` (title, `hideHeader`, a
  ≤155-character search description, `<ComponentPreview>` with the scene at
  `max-w-2xl`), and the name in `content/docs/isometric/meta.json`.
- Edit `registry.json` with an editor or a careful script, then run
  `pnpm exec oxfmt registry.json` so only your entry shows in the diff.
- `pnpm registry:build` (gives the `ISO-` code; fix any "no doc comment"
  warning), then `pnpm exec oxfmt registry-paid public/r`, and keep only
  this item's built JSON.
- Open `/docs/isometric/<name>` on the dev server
  (`lsof -iTCP -sTCP:LISTEN -P | grep node`), watch the full loop, and
  check light and dark with the site's theme toggle (switch it back).
- Check `/docs/isometric/<name>.md` (props table, files) and the Isometric
  tab on `/`. The card screenshot is the user's step: `pnpm media`.

### 8. Verify, critique, fix

- Screenshot the docs page several times across the loop (Claude in
  Chrome) and zoom into each stage, in light and dark.
- **Critique against the bar** before reporting: is it one moment of a
  real use case? Would it sit next to Vercel's or Clerk's feature
  sections? Check focal point, copy realism and size, overlap, value range,
  shadow shape, dead space, and whether each motion beat is caused by the
  previous one. Fix what fails. (The `interface-craft` design critique is
  the method.)
- `pnpm exec tsc --noEmit`
- `pnpm exec oxfmt registry/isometric`
- `pnpm exec ultracite check registry/isometric` (`ultracite fix` is safe
  on these `.tsx` files, never on `.mdx`)
- Report the use case and storyboard, what you fixed after looking, what
  still falls short, and the screenshot paths.

### 9. Commit only when asked

Commit the scene, `iso-core.tsx`, `registry.json` (with its new code),
the docs page and meta, `registry-paid/<name>.json`, `public/r/registry.json`
and `content/agent-reference.json` together, following
[[registry-browse-metadata-rule]] and [[git-merge-workflow]].

## Quality checks

**Story and motion**
- [ ] The connector is one no other shipped scene uses.
- [ ] One real use case, one moment, 2–3 objects on one surface.
- [ ] Every beat is caused by the one before; a calm hold before the loop.
- [ ] Reduced motion (and `autoPlay={false}`) shows the end state.
- [ ] Starts when in view; stops and resets when out of view.

**Turning**
- [ ] Drag turns it and it springs home; arrow keys hold, Home resets;
      touch scrolls the page vertically.
- [ ] At both ends of the orbit, screen copy stays readable and nothing
      swaps depth order (check with the arrow keys and zoom).
- [ ] The frame doesn't change size while turning; frames stay near 60fps
      (median ≈16.7ms measured on desktop for two-step-sign-in).

**Geometry**
- [ ] Axis edges sit at exactly ±30° or 90°; circles are √3 : 1 ellipses
      (horizontal on tops, ±60° on walls).
- [ ] Positions on the 0.5 grid; depth order right (far to near,
      x + y + z); tall things at the back.

**Rendering (ink)**
- [ ] Every visible edge carries the one ink outline at 1.3 px, the same
      weight at every frame size and on every object; hard miter corners.
- [ ] Three flat values per face, top lightest, right darkest, in light
      and dark themes; no gradients, rims or hairlines outside `duotone`
      and `solid`.
- [ ] No base: the floor is shadows plus the dashed grid (`FloorGrid`).
- [ ] One lit thing: a single object in the brand tone, bloomed if it
      helps; everything else neutral surface.
- [ ] Objects act through `Rig` on named presets; every beat is caused by
      the one before, something lags, nothing pops with opacity.
- [ ] Shadow shapes declared; shadows fall away from the light, onto the
      right surface.
- [ ] Detail strokes use `isoStroke(k)`.

**Colour and text**
- [ ] Only `--iso-*` variables outside the core.
- [ ] Text on lit screens `--iso-screen-ink`, on panels `--iso-text`, on
      main-palette faces `--iso-on-main`, on consoles `--iso-screen`;
      numbers tabular.
- [ ] Copy fits its budget with the default and a long value; inputs on
      white cards have a hairline border.

**Props and access**
- [ ] Every prop works and has a doc comment; no prop is named `title`
      except the accessible name.
- [ ] Decorative by default; with `title` it reads as an image.

## Shipped scenes

| Scene | Code | Use case | Connector | Story |
| --- | --- | --- | --- | --- |
| `two-step-sign-in` | ISO-R87FKV | auth, SaaS security | continuity (code chip, tossed) | **The benchmark (ink, 2026-11-03):** no desk; a 12.5 × 6.6 screen floats over a dashed floor grid, phone beside it; the phone hops as the text lands; the code pops up (scale) as a lit chip with a bloom and is tossed on a lifted, tilting arc into the input; the screen is kicked back and settles; the boxes press in as digits land; brand-tinted shadows; leans with the pointer (−18°…30°), click replays; `screen` prop renders the buyer's own React UI (foreignObject, 40 px/unit) and follows the story (`SignInScreenState`) |
| `push-to-deploy` | ISO-RPVRYG | hosting, CI/CD, devtools | cable with a light pulse | **Ink (2026-11-03):** no desk; 12.5 × 6.6 dashboard floats over the grid, a dark terminal tile lies beside it; `git push` types → the tile presses in on enter → a pulse runs down the cable → the dashboard is kicked back and settles as the new deployment slides in, builds, turns Ready with a preview → terminal prints "✓ Live"; leans with the pointer (−12°…30°), click replays; `screen` prop (`DeployScreenState`) |
| `gradual-rollout` | ISO-7PVTRP | feature flags, progressive delivery | light rails with trailing-dash packets | **Ink (2026-11-03):** no plate; 12 × 6.2 console floats at the back left over the grid, rails are brand light tracks on the floor; console moves a new version 10% → 50% → 100%: v2 hops, turns brand and blooms (the one lit thing), the router presses as it re-splits, v1 sinks as its rail goes quiet, packets shift → "Rolled out" kicks the console back; leans with the pointer (−15°…30°), click replays; `screen` prop (`RolloutScreenState`) |

## Known gaps (backlog, as of 2026-11-03)

Close these when the work touches them, and update this list:
- The docs pages show one preview each; the "your own UI inside the
  screen" section and its demo were removed at the user's request
  (2026-11-03). The `screen` prop itself still ships.
- Pull the shared shell (`useSceneShell`, `useReplayOnClick`,
  `stageStyle`, `CustomScreen`, `Grain`), copied in each scene, into
  `iso-core.tsx`. The user rejected floor light pools (2026-11-03).
- A frame-check script (headless render of six points of each loop into
  a contact sheet, seam and bounds checks) is planned, not built.
- `Rig` rotations re-project geometry but face shading (`lit`) still uses
  the unrotated normals; fine for small turns and for `ink`, wrong for a
  box tossed 90° in `duotone`.
- Ink: `Cylinder` and `Sphere` keep their lit rendering and seam strokes;
  only `Box`, `Extrude` (Slab, Panel) and `Poly` take the ink edge.
- Nine ecommerce icons (store, house, van, shelf, conveyor, box, bag, tag,
  phone) have no `casts` yet; they fall back to a soft oval. Also not
  re-checked after the rendering upgrade.
- The icon and panel files from the earlier passes (finance, ecommerce,
  technology pieces, `iso-scene.tsx`) sit in `registry/isometric/` but are
  not registered. Use or delete them as scenes need them.
- `two-step-sign-in`, `push-to-deploy` and `gradual-rollout` have no card
  screenshots yet (`pnpm media`).
- `mirror` flips text on faces; a `mirrorable={false}` guard isn't built.
- `Poly` faces are flat colours, not gradients.
- Panels stand upright; there is no tilted-plane primitive yet (a laptop
  screen leaning back would need one).
- Badges are flat HTML circles, not part of the 3D world.
- Turning is tested on desktop only; check frame times on a mid-range
  phone before relying on it there.
- Isometric parts read the camera from React context, so they render
  inside client components (every scene is `"use client"`). A server
  component rendering an icon directly would fail.
- Registry wiring for items that depend on other isometric items (signed
  tokens on dependency URLs) isn't built; scenes avoid it by shipping
  `iso-core.tsx` inside the item.
