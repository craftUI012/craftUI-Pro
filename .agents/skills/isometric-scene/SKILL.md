---
name: isometric-scene
description: Create mathematically exact, modern isometric icons, product UI pieces and isometric scenes for craftUI's Illustrations library (the Isometric style; source in registry/isometric), at the quality bar of Stripe, Mercury, Ramp, Linear and Vercel. Use whenever the user describes a scene or object to render in isometric ("an isometric scene of a payment flow", "make an isometric cloud deploy", "draw a warehouse in isometric", "add an isometric lock icon", "isometric dashboard panel"), asks for a new isometric icon, product panel, composition, empty state or hero illustration, asks for a category of isometrics (finance, ecommerce, devtools, AI, security…), edits anything in registry/isometric (iso-core, IsoIcon, IsoStage, IsoScene, Box, Slab, Panel, Cylinder, Extrude, Face, casts), or asks about isometric projection, angles, grid, shading, shadows or the isometric docs pages.
---

# Isometric scene creation

The user gives a reference picture or describes an object. You turn it
into a drawn, animated item for craftUI's Illustrations library: built
from 3D primitives, shipped in the registry as a paid, installable React
component that follows the buyer's shadcn theme and is customised through
props. Every drawing is computed from 3D geometry; nothing is hand-drawn
in screen space.

Four styles are kept apart: **Line** (file cabinet, envelope, badge: what
people respond to now), **Classic** (the seven earlier scenes), and two
the user has named but nothing ships in, **Playful** (one try, rejected)
and **Gamified** (nothing built).
Ask the user which one before building; the "Styles" section is the menu.
The rules and the history of every style stay in this file.

## Keeping this skill

Asked for by the user on 2026-11-13:
- **Change what is there before adding.** Before writing a rule, a lesson
  or a table line, search this skill and its references for the topic. If
  it exists, edit it in place (add the date and the reason); if a new rule
  replaces an old one, rewrite the old one. Never append a second version.
- **History stays.** The dated notes on what was tried, what the user
  said and what was rejected are the record. Shorten them, never delete
  them.

## Styles: ask which one first

There are four styles. They are kept apart, and an item is drawn in
exactly one. **Ask the user which style before planning anything**
(2026-11-13: "it will be good if we seperate these styles and ai ask for
me what style do I need"); do not infer it from the subject.

| Style | Looks like | Shadow, glow | View | Status |
| --- | --- | --- | --- | --- |
| **Line** | a fine 1 px outline, near-white faces, one small brand mark | none | faces the screen, no turning | shipped: `file-cabinet`, `open-envelope`, `id-badge`, `notepad` |
| **Classic** | the earlier scenes: flat ink faces with a 1.3 px outline, or the soft tiles with pale tinted walls | a soft cast shadow is optional in ink, none in soft; no glow | isometric angle, leans with the pointer | shipped: the seven items before 2026-11-12 |
| **Playful** | more colourful and rounded; the one look tried was rejected | not decided | not decided | nothing shipped; needs the user's own reference |
| **Gamified** | game-like | both allowed | not decided | first draft, nothing shipped |

The user on the earlier ones, the same day: "older one can stay like
this, because they are also good may be in some scene we can need that".
So nothing shipped is restyled, and Classic stays on the menu. Playful and
Gamified were named by the user ("gam cn have shadow glow playful is more
colourful rounded we cna polish these later but lets start with these
4"). Neither has a shipped item. Each will be set by its first item,
from a reference the user supplies for that style; do not guess the look.

## Style 1 · Line: one object, facing the screen

One object, drawn in line, facing the screen, with one beat of motion and
then stillness, shipped as a complete state with its heading, copy and
button. `file-cabinet` is the reference, built from the user's pin
(https://pl.pinterest.com/pin/866380047090243445/, a line-drawn cabinet
over "No data yet"); `open-envelope`, `id-badge` and `notepad` followed.
Direction from the user on 2026-11-13, after people responded to the
first three:
- **Line is one of four styles** (see "Styles"). The user first said "i
  want this type lined isometrics as of now we can extend the style later
  on", then the same day named three more and asked to be asked which one
  each time.
- **Front-faced, no turn mode.** "turn mode is not needed all i need is
  front faced". Build new Line items facing the screen, with no pointer or
  drag turning and no three-quarter option. The three shipped line items
  keep what they have (they lean with the pointer, and the file cabinet
  stands at the isometric angle like its pin): asked the same day, the
  user chose to leave shipped items as they are.

What the three settled (they were built with turning, so some of these
mention the orbit; that is how they ship today, not a pattern for new
ones):
- **Everything rests straight.** At rest every part lines up with the
  isometric axes: uprights vertical, edges along the 30° axes. The first
  `id-badge` hung askew (strap 3°, card −8°) and the first `open-envelope`
  left its document 3° off, fanned a second sheet 10° and leaned its flap
  back 28°, copying the casual tilt of the pins; the user: "make the
  isometric straight they are wrongly tilted for someone who visits our
  library" (2026-11-12). An off-axis rest pose reads as drawn wrong, not
  as relaxed. Parts may swing, wobble or tip during the beat, but they
  settle straight, and the swings stay small (the badge: 6° on its strap,
  11° of twist). Show a second sheet by offsetting it (left and up),
  never by turning it.
- **Flat things face the screen.** After the rest poses were straightened
  the user still read the envelope and the badge as tilted: "make them
  straight faced towards the screen" (2026-11-12). An object that is
  mostly one face (an envelope, a badge, a card, a document) looks turned
  away at the isometric angle, and the pins show it head-on. Both now
  default to `view="front"` (`"isometric"` keeps the three-quarter
  angle): one static outer `Rig` turns the whole object −45° about the
  vertical so its +y front points at the viewer, and stretches it √(3/2)
  in z, because the camera looks down from 35.26° and foreshortens
  heights by exactly that; the front then keeps its true proportions,
  edges run level and plumb, and thickness shows along the top edge. It
  is still an exact parallel projection, and it turns evenly either way
  with the pointer (orbit 16). `IsoStage` fits its frame to `bounds`
  without the rig, so map the bounds through the same transform
  (`facing`). Casts are axis-aligned boxes and cannot follow the turn, so
  these two have no `shadow` prop. Boxy objects stay isometric: the file
  cabinet's pin is isometric and it reads as a solid from that angle.
- **Quiet by default.** A 1 px outline (`strokeWidth` 0.23), paper walls
  (in ink the walls step 0.03 and 0.07 under the top instead of 0.06 and
  0.13, set as `--iso-surface-left-c` / `-right-c` on the stage), no
  shadow, no grid, and it plays once (`loop` off): people sit in front of
  an empty state. A click replays.
- **One small brand mark**, not a brand object: the open drawer's label
  card. Everything else is neutral; the other label is blank.
- **A part that slides out of a housing is cut, not rigged.** Painter's
  order cannot hide the half of a drawer still inside the cabinet, so each
  drawer part is a box clipped at the cabinet's front plane (`Solid`) and
  the pull distance is read from the clock. The whole object still tips
  on a `Rig`, and the cut plane tips with it.
- **Looking through an opening in a +y face:** one unit of depth is one
  unit right and one up in that face's units, so the floor and inner wall
  seen through it are two fills split by a 45° line from the opening's
  bottom-left corner.
- **Tips never cross rest.** The cabinet tips forward about its front feet
  and back about its rear feet on two nested rigs, each going up and back
  down (never negative), so no foot goes through the floor.
- **The words ship with the object.** The user asked for the pin's copy
  to come with the install (2026-11-12), so the item is the whole empty
  state: content props `heading`, `description`, `actionLabel` (an empty
  string hides each), `onAction`, and `children` to replace the button.
  The button is the shadcn `Button` (`registryDependencies: ["button"]`)
  with an in-file plus icon, and optical padding: the label's side gets
  2 px more than the icon's side (12 px and 14 px), because an icon
  carries its own white space (user, 2026-11-13, citing the
  make-interfaces-feel-better skill: "the side where icon is not there
  demand extra 1 1.3 px padding for optical alignment"). The classes are
  `has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5`;
  the last one wins over a Button that already nudges that side itself,
  as this site's does (by 1 px). The root is the centred column (`className`);
  the orbit, focus ring, in-view ref and click-to-replay stay on the
  illustration inside it (`artClassName`, `data-slot="<name>-art"`).
  Keep the copy in its own small component, or the scene function trips
  the lint complexity limit. The docs page is then just the component.
- In MDX, never put a bare line of text inside a JSX `<p>`: it becomes a
  second `<p>` and breaks hydration.
- **Reading a pin.** `curl` the pin page with a browser user agent, take
  the `og:image` address and swap `/736x/` for `/originals/`. The pins in
  this series are flat front views; rebuild the object in true isometric
  and keep the family look above rather than each pin's rendering.
- **Paper is a face, not a solid.** In `open-envelope` the sheets and the
  pocket's front leaf are `FacePath`s on one plane in front of the
  envelope's extruded body; paint order (body, sheets, leaf) does the
  hiding. Two stacked 0.3 extrusions gave three parallel edges and a dark
  band down the side.
- **Rounded extrusions get their side edges** in ink by setting
  `--iso-silhouette: var(--iso-edge, none)` on the stage (the core only
  sets it in soft). It needs `convex`, so build a notched shape from
  convex pieces: the badge's clip plate is its own plate behind the card.
- **A part that twists shares the 45° budget with the camera.** `id-badge`
  twists 11° about its strap and its orbit stops at 20°: past 45° in total
  a face goes edge-on and an extrusion draws inside out.
- **Fit the frame to the rest pose** of something that swings; the widest
  swings run into the stage's padding, which is not clipped. Fitting the
  extremes made the badge small in its frame.
- **Centre the main mass over the copy, not the whole drawing.** The
  illustration, the heading and the button share one centre line, and the
  eye puts that line through the object's body. A part that hangs off one
  side (the notepad's pencil, the envelope's badge) pulled the frame's
  middle away from the body: the first notepad sat 17 px left of its
  heading, the envelope 24 px (user, 2026-11-13: "the icons text and
  button is not vertically aligned note icon will be more on the right
  side"). Make the frame even either side of the body's middle: the
  notepad's frame reaches as far right of the pad's middle as the second
  sheet reaches left, and the pencil overhangs into the padding; the
  envelope adds the mirror image of its bounds, with a wider art box
  (`w-72`) so it keeps its size. The file cabinet has no one-sided part,
  but its frame is fitted to an uneven turning range, which left the
  drawing 6.6 px right of its heading; it slides its stage by the
  difference between the frame's middle and the resting drawing's
  (`restShift`, a CSS `translate` on the stage). Measure it: the body's
  centre (for the cabinet, the whole drawing's) should be within a pixel
  of the heading's.
- **Parts laid side by side along a slope are written from the lowest
  up.** In the front view a part's thickness shows above it, so each part
  of the notepad's pencil (cone, body, ferrule, eraser) is drawn before
  the one above it, and its top edge hides behind that one.
- **A new Line item has no turning at all** (`notepad` is the first):
  no orbit hook and no pointer handlers; the art sits in a real `<button>`
  that replays on click, or in a plain `div` when replay is off.
- **Something that starts and ends at rest needs one clip.** The badge is
  flicked from rest to rest, so a click replays the same clip; the cabinet
  and the envelope end in a different state from where they start and
  need a second clip that first undoes the beat.

## Style 2 · Classic: the earlier scenes (ink)

The look of the seven items shipped before the line objects: use-case
scenes and hero objects at the isometric angle, which lean with the
pointer. It has two renderings, ink (this section) and soft (the next);
the user keeps both and may ask for either when a scene needs it.

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
   **Second house style: `soft`** (added 2026-11-04, after Marcel
   Kargul's Chatsheet illustrations,
   https://pl.pinterest.com/pin/614319205475836245/): airy
   product-illustration tiles for SaaS, automation and AI feature
   sections. See "The soft style" below; pick it per scene, and say which.
2. **No base.** No desk, no plate. The frame crops to the subject; the
   floor is implied by shadows and a dashed construction grid
   (`FloorGrid`). Screens float a little above the floor.
3. **One lit thing.** Everything else is neutral surface; one object
   carries the brand tone. Here it is the code chip. Never spread the tone
   over every button, pill and wallpaper. **No gradient glow, ever, unless
   the user asks for it by name** (2026-11-04: "remove that completely …
   dont add any gradient glow till I mention explicitly"): no `Bloom`, no
   glow pools under objects, no blurred halos around beads, chips or
   tiles. The lit thing is lit by its colour alone. No shipped scene calls
   `Bloom` any more (removed from two-step-sign-in and gradual-rollout on
   2026-11-04); it stays in the core only as legacy API. Since 2026-11-13
   the Gamified style is the one standing exception: the user named
   shadow and glow as part of it.
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

## Style 2 · Classic, the soft rendering

The look of the Kargul / Chatsheet feature grid: white rounded tiles with
pale tinted walls, one brand tile, thin grey-blue outlines, dashed arcs
between things, and nothing under the objects: no shadow, no glow. All of it is in
`iso-core.tsx` behind `variant="soft"`; a scene only chooses it.

| Part | Soft | Ink, for contrast |
| --- | --- | --- |
| Neutral faces (`surface`) | the tone mixed 16% into the card, held at L ≥ 0.34 (dark pages keep graded walls), lit by L ∝ (1, 2, 3) with k 0.36 | the card, three flat values |
| Brand faces (`main`, `accent`) | the colour itself, k 0.24 so the wall stays brand, not navy | the tone ± flat steps |
| Gradients | the lit face gradients × 1.5 (`--iso-grad`): tops fade white to tint | none |
| Outline | every visible edge, `strokeWidth × 3.33` px (1 px at 0.3), the tone pulled 45% toward ink then 52% into the card (grey-blue on light, pale on dark), round joins | 1.3 px ink, miter |
| Rounded extrusions | `Slab`/`Panel` (`convex`) also stroke their silhouette, the convex hull of front and back outlines, so the two side edges show (`--iso-silhouette`) | not drawn |
| Shadow | none, and no glow either (the user rejected the glow pools and the bloom, 2026-11-04); `Shadows` draws nothing in soft | directional cast + contact |
| Guides | the soft outline at 75% | ink at 30% |

Composition rules that make it read like the reference:
- **Rounded tiles as the vocabulary.** `Slab` 5 × 5 × 0.8, radius 1.15,
  floating level (z 0.8) over nothing: no grid, no floor, no glow.
  Glyphs lie flat on tile tops (`FacePath` fills in `--iso-screen` with
  the outline; brand only in small marks like a flap or dots).
- **The brand tile is the lit thing**, by colour alone (no `Bloom`).
- **Labels are lit pills** standing above a tile on a dashed tether
  (`Panel`, `frontStyle` `--iso-screen`, text `--iso-screen-ink`, a round
  badge first). They rise out of the tile by scale about the tether's foot.
  Give them 3.4 units of clearance over the tile top or they cut into it.
- **Dashed floor lanes with one rounded bend** (the reference's routes,
  which the user chose over a circular arch, 2026-11-04). Lay tiles out
  like the reference: two apps sharing x (one behind the other, so on
  screen the back one sits up and right), the hub 8.5 along x to the
  right. Each lane lies flat at a fixed height low on the tiles' walls,
  runs along x from its app, turns a quarter circle (radius 1.5) and runs
  along y into the hub's near or far side; resample it evenly by length
  so ink fills at an even pace. No circles through the tiles, no lanes
  bowing up, no straight diagonals.
- **No count badges on tiles.** The user removed them as noise
  (2026-11-04): a tile shows its glyph and its name only.
- **Glyphs must not echo each other.** A ring-and-dot target next to a
  ring logo on the hub read as the same mark; status glyphs use their
  conventional forms (dashed empty circle = not started, spokes = in
  progress, clock = pending, check = done).
- **Tiles that only send or receive stay still.** The user removed the
  mail and chat tiles' hop: the event shows as the label rising, not as
  the tile jumping. Only the hub (the AI step) acts (press, sparkle turn).
- **A flat V on a top face projects to an "L".** Draw folds as filled
  shapes off a long edge (the envelope flap), not as two strokes. A check
  mark lies flat in the same frame as the tile's label, like the
  reference (short stroke down, long stroke right on screen); a tick
  solved to read upright on screen was rejected as the wrong orientation.
- **Several hues are fine when the hues are the data** (statuses,
  categories): wrap each part in `Tint` (core), which re-declares one
  palette, its gradients and the outline in that hue. Pastel tiles at
  `strength` 22, cards at 10, a near-white hub as `Tint` of the ink at 4.
  Glyphs and labels read `--iso-tint`; label text is the tint mixed 50%
  with `--iso-text` so it works in light and dark.
- **Labels face +y**, so the orbit must favour turning toward them: check
  both ends with the arrow keys and put the short side away from them.

## Style 3 · Playful (one try, rejected)

From the user, 2026-11-13: "playful is more colourful rounded". Nothing
ships in this style.

**What was tried and rejected the same day.** The notepad was first built
as Playful, after the user chose that style for it: a thick rounded
outline (2.6 px, round joins and caps), flat colour on the ink renderer
(the pencil's body in the brand, a pink eraser and lead through `accent`,
a pastel of the brand on the sheet behind), chunky parts (0.7 deep),
front-faced, with a livelier beat (a scribble while writing, a wiggle on
lift-off). The user: "no playful does not look good make it outline
style". It was rebuilt as a Line object. So a thick dark outline over
flat brand colour is not what the user means by playful.

**Before trying again:** ask the user for a picture of what playful looks
like to them. The reference for the notepad had a thick rounded line and
a pink accent, and copying that look still missed; do not infer Playful
from a reference's line weight or accent colour.

**Kept from the try (engine facts, true in any style):**
- `Tint` declares its palette's rim colour again, so clear it again
  inside the tint (`NO_RIM` on a `<g>`), or the tinted part's outline
  thins.
- In ink, round every corner and line end with `--iso-join: round` on the
  stage and round caps on strokes.

## Style 4 · Gamified (first draft)

From the user, 2026-11-13: "gam cn have shadow glow". Nothing ships in
this style yet:
- **Shadow and glow are allowed here, and only here.** This is the one
  standing exception to the no-glow rule. The tools exist: `Bloom` (kept
  in the core as legacy) and the soft cast shadows drawn from `casts`.
  Hard flat shadows stay out even here until the user asks: they were
  removed twice from the earlier scenes.
- **Engine today:** the nearest renderer is `solid` (full colour, lit
  faces) with `casts` and `Bloom`. No variant has been built for Gamified.
- **Not decided:** palette, outline or none, front-faced or angled,
  whether motion loops, the subjects (my suggestion, not yet the user's:
  coins, gems, chests, trophies, streaks, level-ups, progress filling).
  Decide these on the first item, from a pin the user supplies.

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
4. **One style per item, never mixed.** An item is drawn in one of the
   four styles (see "Styles") and every part follows it. In the engine's
   terms: `variant="ink"` draws flat faces and a
   constant pixel outline (`--iso-edge-w` with `vector-effect:
   non-scaling-stroke`; note vector-effect does not inherit, so it is set
   on every path). `variant="soft"` keeps that pixel outline (1 px, tinted
   toward the tone, round joins) over gradient faces. In `duotone` and
   `solid`, shades come from L ∝ (1, 2, 3) as gradient paints with rims
   and a faint hairline; `line` is the blueprint. A scene picks one style
   as its default and every part follows it.
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

- **Which style: Line, Classic, Playful or Gamified?** Ask the user,
  every time. For Classic, also ask ink or soft.
- Which feature, of which kind of company (auth, deploys, payments,
  analytics…)? Where will it sit (hero, feature section, bento card)?
- The one physical moment that shows it (scene-recipes "Choosing the
  moment"): 2–3 objects, one surface, real UI on their screens.
- The story as cause and effect, one line per stage.

The style is always asked. For the rest, ask only if the use case is
genuinely unclear; otherwise choose and state your choices.

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
Isometric is not a library of its own any more: on 2026-11-12 it merged
into **Illustrations** (the user: one library, one convention; a second
skill for flat illustrations comes later). The source stays in
`registry/isometric/` and installs to `components/isometric/`; everything
a visitor or the registry sees says Illustrations. The ten items from
before the merge keep their `ISO-` codes; new ones get `ILL-`.
Follow `content/docs-admin/guides/adding-a-component.mdx`:
- `registry.json` entry: `type: "registry:block"`, `meta.library:
  "illustrations"`, `categories` (e.g. `technology`), `meta.types:
  ["scenes"]`, `meta.styles` starting with `"isometric"` (the filter that
  finds these inside Illustrations), `meta.useCases`, `meta.publishedAt`, `dependencies`
  (`motion`), and **files: the scene first, then `iso-core.tsx`** (both
  targeting `components/isometric/`, imported relatively). Shipping the core
  inside the item avoids cross-item dependencies and signed-token wiring.
- Docs page `content/docs/illustrations/<name>.mdx` (title, `hideHeader`,
  a ≤155-character search description, `<ComponentPreview>` with the scene
  at `max-w-2xl`), and the name in `content/docs/illustrations/meta.json`.
- Edit `registry.json` with an editor or a careful script, then run
  `pnpm exec oxfmt registry.json` so only your entry shows in the diff.
- `pnpm registry:build` (gives the `ILL-` code; fix any "no doc comment"
  warning), then `pnpm exec oxfmt registry-paid public/r`, and keep only
  this item's built JSON.
- Open `/docs/illustrations/<name>` on the dev server
  (`lsof -iTCP -sTCP:LISTEN -P | grep node`), watch the full loop, and
  check light and dark with the site's theme toggle (switch it back).
- Check `/docs/illustrations/<name>.md` (props table, files) and the
  Illustrations tab on `/` (UI kits dropdown; the Isometric style filter
  should count it). The card screenshot is the user's step: `pnpm media`.
- If a card is missing right after adding a docs page, the home data is
  cached: it is keyed on the registry, the taxonomy and the media, not on
  the docs pages. Bump `HOME_DATA_VERSION` in
  `components/new-hero-section/data/get-home-data.ts`.

### 8. Verify, critique, fix

- Step through the loop frame by frame and zoom into each stage, in
  light and dark. The method (it is not a repo script): Playwright from
  the npx cache (`~/.npm/_npx/*/node_modules/playwright`, the version
  whose Chromium is in `~/Library/Caches/ms-playwright`),
  `page.clock.install()` before loading the docs page, wait for
  hydration, let the intro play in real time, `clock.pauseAt`, dispatch
  `pointerdown` + `pointerup` on the item to replay, then
  `clock.runFor(ms)` and screenshot each beat; for an item that turns, a
  `pointermove` at its left or right edge takes it to an end of the orbit.
  `sharp` (in the repo) tiles the frames into a contact sheet.
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

**Rendering (soft scenes)**
- [ ] Every visible edge, rounded silhouettes included, carries the 1 px
      tinted outline; tops fade white to tint, walls stay tinted in light
      and graded (not black) in dark.
- [ ] No glow anywhere: no bloom, no pools under tiles, no halo on the
      ink's bead; no shadow either.
- [ ] Brand tile walls read as the brand, not navy.

**Rendering (ink)**
- [ ] Every visible edge carries the one ink outline at 1.3 px, the same
      weight at every frame size and on every object; hard miter corners.
- [ ] Three flat values per face, top lightest, right darkest, in light
      and dark themes; no gradients, rims or hairlines outside `duotone`
      and `solid`.
- [ ] No base: the floor is shadows plus the dashed grid (`FloorGrid`).
- [ ] One lit thing: a single object in the brand tone, never bloomed;
      everything else neutral surface.
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

Hero objects (one thing, idling on a sine, no story) are allowed beside
use-case scenes: `wallet-coins` is the reference. Lessons from its three
passes: a 2D icon silhouette does not survive extrusion (Wallet01's flap
became a wall and the body a toaster); keep real proportions (a wallet's
depth is about a tenth of its width) and add the three or four surface
details the eye classifies by (stitching, a strap, a snap, a card edge).
Give a hero a product moment, not a metaphor: the card and the
currencies are what a fintech sells, the wallet only holds them. One lit
thing in the brand at full strength (the card); the body a pastel of the
brand toward white in both themes, so it stays light on dark pages. The
entrance is a real beat (pop with the settle, a lean swinging upright, the
host dipping); the idle is the only place a decorative loop is permitted,
and it must be out of phase across parts. Hidden parts must never drop
below the floor (nothing hides them there). A hero loop that repeats one
action (a coin paying in) runs on a wrapping clock, `ms % period`, so the
tracks are written once for one cycle. A rotation about x needs the right
sign to face the viewer: for a +y-facing disc, +θ tilts it up toward the
camera, −θ turns it edge-on.

Line objects have their rules at the top of this file under "Style 1 ·
Line".

One line per item. What each one does, beat by beat, is the storyboard
comment at the top of its file in `registry/isometric/`, and its props are
the doc comments there. Do not retell either here: a copy goes stale (this
table once did, and still described glows that had been removed).

| Item | Code | Kind | Style | For | How things travel |
| --- | --- | --- | --- | --- | --- |
| `two-step-sign-in` | ISO-R87FKV | use-case scene | Classic (ink) | auth, SaaS security | the code chip itself, tossed (continuity) |
| `push-to-deploy` | ISO-RPVRYG | use-case scene | Classic (ink) | hosting, CI/CD, devtools | cable with a light pulse |
| `gradual-rollout` | ISO-7PVTRP | use-case scene | Classic (ink) | feature flags, progressive delivery | light rails with trailing-dash packets |
| `wallet-coins` | ISO-A0SDZZ | hero object | Classic (ink) | fintech, banking heroes | none |
| `bank-deposit` | ISO-RJJ8GD | hero object | Classic (ink) | banking, savings, fintech heroes | arc (coins leaping through a door) |
| `workflow-trigger` | ISO-EP9ZS9 | use-case scene | Classic (soft) | workflow automation, AI agents, integrations | ink-in lanes |
| `task-status` | ISO-4E36Y0 | use-case scene | Classic (soft) | task and project tools, kanban, issue trackers | light run + border trace |
| `file-cabinet` | ISO-Z84F1M | line object | Line | empty states: no records, no files, first run | none |
| `open-envelope` | ISO-CX14WM | line object | Line | inbox full, storage limit, quota reached | none |
| `id-badge` | ISO-VJV1P7 | line object | Line | no members, empty team, invite a teammate | none |
| `notepad` | ILL-JB9DJH | line object | Line | no notes, no drafts, first entry | none |

### How each item got here

The passes each one took and what was rejected on the way. This is the
record; keep it, and add to an item's line rather than starting a new one.

- `two-step-sign-in` (2026-11-03): rebuilt as the ink benchmark: no desk,
  a screen floating over a dashed grid, the phone beside it. Its code chip
  had a bloom, removed 2026-11-04. The `screen` prop renders the buyer's
  own React UI inside the screen and follows the story; its docs page
  once had a second preview and demo for that ("your own UI inside the
  screen"), removed at the user's request the same day, the prop stayed.
  The user also rejected floor light pools under it.
- `push-to-deploy` and `gradual-rollout` (2026-11-03): reworked to the
  same ink recipe, each with a `screen` prop. The rollout's new server
  bloomed when it took traffic; removed 2026-11-04.
- `wallet-coins` (2026-11-03): third pass, after an interface-craft
  critique ("still not like a wallet"): a thin stitched wallet, the brand
  card as the one lit thing, currency coins. The user removed its hard
  shadow; it has none by default, and `shadow="soft"` is the only option.
- `bank-deposit` (2026-11-03): second pass after "too many bars, card too
  shallow": two columns (four read as bars in front of the door) and a
  thick card after Wise's with the balance on its face.
- `workflow-trigger` (2026-11-04): second pass, laid out like the Kargul
  reference. The first pass (a circular arch, a raised AI tile, bloom and
  glow pools, hopping tiles) was rejected, and the user removed the app
  tiles' hop. Hidden pills unmount, so no dot is left behind.
- `task-status` (2026-11-04): third pass, after the user's pin
  (https://pl.pinterest.com/pin/788763322284989241/). A count badge was
  tried and removed as noise; "Not started" became a dashed empty circle
  because target rings echoed the hub's logo; a tick drawn upright on
  screen was rejected for one lying flat in the label's frame.
- `file-cabinet` (2026-11-12): from the user's pin
  (https://pl.pinterest.com/pin/866380047090243445/). It first shipped as
  the illustration alone; the user asked for the words to ship with it.
- `open-envelope` (2026-11-12): from the user's pin
  (https://pl.pinterest.com/pin/449445237833966192/), with their change:
  a document comes out, not a second envelope. The first pass sat askew at
  the isometric angle; it was straightened, then turned to face the screen.
- `id-badge` (2026-11-12): from the user's pin
  (https://pl.pinterest.com/pin/449445237834064230/). The same two
  corrections as the envelope.
- `notepad` (2026-11-13): the first item with an `ILL-` code, from a
  reference image the user pasted (no link; a notepad and pencil in a
  thick rounded line with a pink accent). Asked, the user chose Playful
  and the "No notes yet" copy; the Playful build was rejected ("no
  playful does not look good make it outline style") and it was rebuilt
  as a Line object the same day, the first one with no turning. The
  "Playful" filter style added for it was removed again.

## Open problems and engine limits (as of 2026-11-13)

Tidied on 2026-11-13: finished entries went to "Closed", records moved to
"How each item got here" and to step 8, and the rest was split into what
is open and what the engine does not do. Keep it that way: when something
is fixed, move it to "Closed" with its date.

### Open

- **The pale hairline in the engine.** `Extrude`'s rim path still paints
  in the outlined variants: its width is `calc(var(--iso-rim-w) * 0.8)`
  with `--iso-rim-w: 0`, which computes to `0%`, and Chromium strokes it
  as a pale hairline over the front outline of every `Slab`, `Panel` and
  `Extrude` (found by hiding those paths at 4×). Left in the core on
  purpose (2026-11-13): fixing it there would make the Classic items'
  outlines a touch crisper, and the user wants shipped items left as they
  are. The three Line items clear the rim colours on their stage
  (`NO_RIM`); every new Line item must do the same.
- **The shell is copied into all ten items** (`useShell` or
  `useSceneShell`, `useReplayOnClick`, `stageStyle`, `turnableLabel`,
  `CustomScreen`, `Grain`). Move it into `iso-core.tsx` when the first
  Playful or Gamified item is built (agreed 2026-11-13). It touches every
  item's install file and changes nothing a visitor sees.
- **The references describe pieces that were deleted.** The icon and
  panel files from the earlier passes (the 27 unregistered
  `iso-<name>.tsx` finance, ecommerce and technology pieces, and
  `iso-scene.tsx` with `IsoScene`/`IsoSceneItem`) were deleted on
  2026-11-12 at the user's request; `registry/isometric/` holds only
  `iso-core.tsx` and the shipped items. The references still name those
  pieces (`IsoCoins`, `IsoBalancePanel`, `IsoRulePanel`, `IsoCard`, the
  `IsoScene` API, the category kits table, the worked examples): read them
  as history, and build any part an item needs inside its own file. The
  last commit that has them is `5d541d9`.

### Closed

- 2026-11-13: **`variant="line"` in the seven Classic items.** Their
  `stageStyle` passed `"--iso-contour-w": undefined`, which blanked the
  theme's value, so every contour fell back to a 1-unit stroke; and the
  blueprint's own outline was in canvas units, several times too heavy on
  a stage. Each now sets the contour to 0 and, for `line`, the pixel
  outline (`LINE_OUTLINE`, the same two variables as `file-cabinet`'s
  `BLUEPRINT`). Their default look is unchanged.
- 2026-11-13: **arrow keys on the docs site.** Turning a focused item
  with the left and right arrows also went to the previous or next docs
  page. `components/docs-keyboard-shortcuts.tsx` now ignores a key that
  something on the page already handled (`event.defaultPrevented`).
- 2026-11-12: **card screenshots.** All ten items have card media.

### Engine limits

What the engine does not do. No shipped item needs any of it; build what
a new item needs when it needs it.
- `Rig` rotations re-project geometry, but face shading (`lit`) still uses
  the unrotated normals: fine for small turns and for ink, wrong for a
  box tossed 90° in `duotone`.
- The Classic ink scenes were never checked under `variant="soft"`. Soft
  text pills use the site font; the reference's serif headings are a page
  concern, not a scene one.
- `Cylinder` and `Sphere` keep their lit rendering and seam strokes in
  ink; only `Box`, `Extrude` (Slab, Panel) and `Poly` take the ink edge.
- `mirror` flips text on faces; a `mirrorable={false}` guard isn't built.
- `Poly` faces are flat colours, not gradients.
- Panels stand upright; there is no tilted-plane primitive (a laptop
  screen leaning back would need one).
- Badges are flat HTML circles, not part of the 3D world.
- Turning was tested on desktop only; check frame times on a mid-range
  phone before relying on it there.
- Parts read the camera from React context, so every item is a client
  component (`"use client"`); a server component rendering one directly
  would fail.
- Items cannot depend on other isometric items (signed tokens on
  dependency URLs aren't wired); each ships `iso-core.tsx` inside it.
