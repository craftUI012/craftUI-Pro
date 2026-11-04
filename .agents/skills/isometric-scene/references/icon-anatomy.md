# Icon anatomy: how an isometric icon is built

All numbers come from [isometric-math.md](isometric-math.md). This file is
the public API (what buyers and other files may rely on) and how an icon is
put together.

## Files

```
registry/isometric/
  iso-core.tsx          projection, primitives, theme, gradients, shadows, badge, frame
  iso-scene.tsx         IsoScene + IsoSceneItem: icons on a grid, floors, links
  iso-<name>.tsx        one icon or product piece each: exports Iso<Name>
  iso-scene-<name>.tsx  a composed scene shipped as its own item (only when asked)
app/prototypes/isometric/
  page.tsx              dev-only board route (showDesignAdmin gate)
  board.tsx             ICONS + live props, light / dark / brand theme panels
  scenes.tsx            SCENES: the current category's scene compositions
```

Icons import only `./iso-core` (relative), because buyers install them into
one folder (`components/isometric/`). No npm dependencies. The only hook is
`useId` (via `useIsoId`), which works in server components.

## Public API: stable, change with care

Buyers write code against these. Renaming or removing one is a breaking
change: avoid it, or keep the old name working and note the migration.

### Frame props (`IsoIconProps`, on every icon)

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `size` | number \| string | class `size-24` | Width and height. Or size with `className`. |
| `tone` | token name \| CSS colour | `"primary"` | Main colour: primary, foreground, muted, destructive, chart-1…5, or any colour. |
| `accent` | same | = tone | Detail colour: lights, chips, screens' highlights, pills, toggles. |
| `variant` | `"ink" \| "soft" \| "duotone" \| "solid" \| "line"` | ink or soft on scenes, duotone on icons | Flat ink drawing with one even outline (the house style), soft product illustration (gradient faces, 1 px tinted outline, no shadow or glow), soft lit tint, full lit colour, or blueprint outline. |
| `strokeWidth` | number | 0.3 | Line weight. In `ink` it is a pixel weight (0.3 → 1.3 px at any size); in `duotone`/`solid` rims and hairlines in canvas units; in `line` the outline. |
| `badge` | check \| x \| alert \| plus \| number \| ReactNode | none | Status mark in the badge zone. |
| `animate` | none \| hover-lift \| float \| assemble | none | Motion; off under reduced motion. |
| `shadow` | boolean | true | Cast and contact shadows. |
| `mirror` | boolean | false | View from the other side (math §7). |
| `title` | string | none | Accessible name. Without it the icon is decorative. **Reserved:** no icon may use `title` for content. |
| `className`, `style` | | | On the wrapper. |

Content props (copy, numbers, data) are per piece; see product-pieces.md.
Internal-only frame props: `casts` (shadow shapes) and `footprint` (oval
fallback when no casts).

### CSS variable contract (`--iso-*`)

Icons use only these. Buyers may override any of them on a wrapper.

| Variable | Is | Use for |
| --- | --- | --- |
| `--iso-tone`, `--iso-accent` | resolved tone and accent | badges, links |
| `--iso-{main,accent,surface}-{top,left,right}` | **paint**: the flat face value in `ink`, a url() to this icon's face gradient otherwise | `fill` of faces and face-coloured shapes |
| `--iso-{palette}-{face}-c` | flat face colour | where a colour (not a paint) is needed |
| `--iso-edge`, `--iso-edge-w`, `--iso-vector`, `--iso-join` | the ink outline: colour, pixel width, `non-scaling-stroke`, miter | frame-managed; set `vector-effect` on every stroked path (it does not inherit) |
| `--iso-guide`, `--iso-guide-w` | construction ink, a step short of full strength, hairline width | `FloorGrid`, `WireBox`, your own guides |
| `--iso-{palette}-rim` | lit-edge colour | rims (frame-drawn) |
| `--iso-glow` | the accent at full strength | lights, chips, pills, toggles, chart lines |
| `--iso-detail` | tone toward ink | slots, vents, marks on bodies |
| `--iso-screen` | a lit display, near white in every theme | screens, labels, toggle knobs |
| `--iso-screen-ink` | dark ink | text and marks **on** `--iso-screen` |
| `--iso-text` | the theme's foreground | text on surface or glass panels |
| `--iso-console` | near black in every theme, a touch of the tone | terminal and code backgrounds (text on it: `--iso-screen`) |
| `--iso-on-main` | ink, or near-white in `solid` | text and marks on main-palette faces (card fronts) |
| `--iso-shadow`, `--iso-road`, `--iso-ink`, `--iso-card` | | shadows (unused in soft), road strips, base colours |
| `--iso-grad`, `--iso-silhouette` | gradient strength (1, soft 1.5); silhouette stroke of convex extrusions (`none` outside soft) | frame-managed |
| `--iso-stroke-width`, `--iso-contour`, `--iso-edge` | | line weights and colours (frame-managed) |

### Camera and orbit (stage scenes)

| API | What it is |
| --- | --- |
| `IsoCamera` | `{ pivot: [x, y], yaw }` (degrees). `HOME_CAMERA` is yaw 0. |
| `IsoStage` `camera`, `orbit` | The viewpoint, and the range (number or `[min, max]`) the frame is fitted to. |
| `useIsoOrbit({ mode, orbit, pivot, reduced })` | Returns `camera` and `orbitProps` (pointer, keyboard, cursor, `touch-action: pan-y`, `tabIndex`). Spring k 180, c 24; arrow keys step 10°; Home/Escape return. |
| `projectWith(camera, p)` | World → canvas through a camera, for paths a scene draws itself. |
| `IsoRotate`, `IsoOrbit` | Prop types for scenes: `"drag" \| "pointer" \| "off"`; `number \| [min, max]`. |
| `IsoCamera.model` | An `IsoModel` (3 × 3 linear part + translation) applied before the camera. Set by `Rig`, never by hand. |

Primitives read the camera from context, so they turn with the stage and
need no extra props. Outside a stage they use the home view.

### Rig, clock, tracks (objects that act)

| API | What it is |
| --- | --- |
| `Rig({ pivot, rotate, axis, scale, offset, clock, pose })` | Poses its children as one solid: `p' = pivot + R·S·(p − pivot) + offset`, in world units before projection, so it stays exact isometric at every yaw. Rigs nest. With `clock` and `pose(ms)` the pose is sampled every frame and re-rendered only when it changes. |
| `IsoPose` | `{ rotate?: deg, axis?: "x" \| "y" \| "z", scale?: number \| [sx, sy, sz], offset?: [x, y, z] }`. |
| `useRigged()` | Where a world point lands after the rigs around a part, for paths a scene projects itself. |
| `useClock(running, restart)` | Milliseconds since `running` became true or `restart` changed, as a motion value. One per scene, restarted with every story cycle. |
| `IsoTrack`, `sample(track, ms)` | Keys `[ms, value, ease?]`; `ease` is an `IsoEase` (cubic bezier), `"hold"`, or none (linear). Held before the first and after the last key. |
| `EASE` | `drop` (lands softly), `easy` (sways, every half swing), `in` (slams), `snap` (slot to slot), `soft` (pops). Name them, never invent numbers in a scene. |
| `settle(to, start, pace, from)` | The baked spring: overshoot 1.42, swings halving, ≈ 900 ms to rest. |
| `hop(height, start)` | Rises, slams through rest, rebounds twice. z offset. |
| `toss(deg, start)` | Winds back, whips past, settles. Degrees about a hinge. |
| `press(depth, start)` | Pushed into its base, back, pops proud, settles. z scale. |
| `jolt(travel, start, hold)` | Kicked along a direction with the settle, held, eased home. |
| `lift(height, start, hold)` | Up and held, then dropped back with one bounce. |
| `shiftTrack`, `scaleTrack` | Followers: the same preset 60 to 120 ms later, 0.6 to 1.4 of the travel. |

Rules: pivot where the thing would hinge or stand; the beat is caused by
the beat before; at least one part lags; pop in and out with scale, never
opacity; action in the first half of the loop, a still hold after it.

### Guides and bloom

| API | What it is |
| --- | --- |
| `FloorGrid({ at, size, step, z, dash })` | Dashed hairline grid on a horizontal plane, in the guide ink. The implied floor of every scene. |
| `WireBox({ at, size, dash })` | The twelve edges of a box, for a construction frame around a subject. |
| `VertexDots({ points, r })` | Ink dots on the vertices a viewer reads a shape by. |
| `Tint({ color, palette, strength })` | Re-colours one palette (default `surface`) for the parts inside it: re-declares its face values, paints, its own face gradients and (in soft) the outline, and exposes `--iso-tint`. CSS variables resolve where declared, so overriding `--iso-tone` on a child does nothing; use this. In soft, surface = colour `strength`% into the card. In ink, surfaces stay the card: tint `accent`. |
| `Bloom({ at, size, color, strength })` | Two blurred passes of a box's six-point silhouette behind it. **Legacy: do not use in new scenes** unless the user explicitly asks for a glow (rule since 2026-11-04); kept for the older ink scenes that call it. |

### Palettes

| Palette | Base | Use for |
| --- | --- | --- |
| `main` | tone | the subject's body, card fronts, roofs |
| `accent` | accent | a second body: back card, tape, lid, highlighted part |
| `surface` | foreground, faint | neutral hardware, panels, plinths, stone |

## How rendering works (so you don't fight it)

- **Soft (scenes):** lit face gradients (paints are url()s, as in
  duotone) with the gradients × 1.5, plus the outline on every visible
  edge like ink (`--iso-edge` tinted, 1 px, round joins). `Extrude` with
  `convex` (Slab, Panel) strokes its silhouette in `--iso-silhouette`
  (set only by soft). Soft draws no shadow and no glow (`Shadows`
  returns nothing for it); `IsoStage` and `IsoIcon` pass the variant
  through.
- **Ink (scenes):** each face is one flat value (math §5, ink table) and
  every visible edge is stroked once in `--iso-edge` at `--iso-edge-w`
  (a pixel width held constant by `vector-effect: non-scaling-stroke`)
  with miter joins. `Box`, `Extrude` (so `Slab`, `Panel`) and `Poly` do
  this themselves; the back outline of an extrusion is the ink too.
  `Cylinder` and `Sphere` still render lit (backlog).
- **Lit (icons, `duotone`/`solid`):** each `<svg>` gets its own `IsoDefs`:
  nine face gradients (3 palettes × 3 faces) and the blur filters, with
  ids from `useIsoId`; the paint variables point at them, so `fill:
  var(--iso-main-left)` paints a lit gradient. Bodies draw seams, rims and
  the silhouette hairline themselves.
- Never add your own outlines to bodies in any variant; never hard-code a
  gradient or filter id (`Bloom` reads the stage's id from context).
- The frame draws shadows from `casts` before the body; nothing else draws
  shadows.

## Primitives (all in world units)

| Primitive | Inputs | Draws |
| --- | --- | --- |
| `Box` | `at`, `size [w,d,h]`, `palette`, `top/left/right` render functions | Three lit faces, rim and hairline. Detail functions get face size in world units (fill-only). |
| `Slab` | `at`, `size [w,d,h]`, `radius`, `palette`, `frontStyle`, `content` | A rounded slab lying flat: cards, flat panels, trays. `content(w, d)` draws on the top. |
| `Panel` | `at` (top-left of the front face), `size [w,h]`, `depth`, `radius`, `palette`, `frontStyle`, `content` | A rounded panel standing upright, facing +y: charts, settings, screens. |
| `Poly` | `points` (world), `palette` | Any flat polygon: roofs, awnings, windshields, gables, slopes. Normal by Newell's method, shade from the light. List only faces the viewer sees. |
| `Cylinder` | `center`, `radius`, `height`, `palette`, `top` | Upright cylinder: two-tone side, top ellipse, rim on the front arc. |
| `Extrude` | `plane`, `at`, `d`, `depth`, `palette`, `fillRule`, `frontStyle`, children | Any flat outline given thickness: shields, tags (holes via `evenodd`), locks, coins, clouds, rounded panels. |
| `Face` | `plane`, `at`, children | Fill-only 2D content and `<text>` in a plane. |
| `FacePath` | `plane`, `at`, `d`, SVG props | A face path projected point by point, then stroked: handles, strings, check marks, chart lines. |
| `FaceEllipse` | `plane`, `center`, `r` | An exact circle on a face: wheels, dials, lights, dots. |
| `faceOrigin(at, size, plane)` | | A box face's u = v = 0 corner, for `Face`/`FacePath`. |
| `roundedRect(w, h, r)` | | Rounded-rectangle path with cubic corners. |
| `mapPath(plane, at, d)` | | Projection behind `FacePath` (absolute M L H V C Q Z only, no arcs). |
| `isoStroke(k, floor?)` | | Detail stroke width = k × `strokeWidth`, with a floor. |
| `Sphere` | `center`, `radius`, `palette`, `latitudes`, `meridians`, `nodes` | A wireframe globe: outline circle of radius S·r·√(3/2), rings sampled in 3D with the far half faint, lit `[lat, lon]` nodes (hidden ones skipped). |
| `GLASS` | | `frontStyle` for frosted, see-through panels. |
| `CLEAR_GLASS` | | Clearer glass for stacked layers, so the layer below shows through. |
| `ISO_MONO` | | The site's monospace (`--font-mono`) for code, URLs, routes, terminals. |
| `Part` | `order` | One stage of the assemble animation. |

Missing a shape? Add a primitive to `iso-core.tsx` that computes it from
3D and cites its formula (cone, sphere cap, rounded box, ramp…). Never draw
a screen outline by hand. Arcs aren't supported by `mapPath`; use cubic
curves (as `roundedRect` does).

## Shadow shapes: `casts`

Every icon passes `casts` to `IsoIcon`: the solid parts as
`{ box: [x, y, w, d, h], z? }` or `{ disc: [cx, cy, r, h], z? }`. Two to
four rough shapes are enough. Shadows read from the silhouette, not the
detail. Raised parts (floating cards, panels) set `z` so their shadow lands
offset and soft.

## Keylines: start from one of these

All centred, inside the reference cube x, y ∈ [−4, 4], z ∈ [0, 8].

| Keyline | Size | Typical use |
| --- | --- | --- |
| Cube | 6 × 6 × 6 | box, package, crate, safe |
| Tower | 5 × 5 × 8 | server rack, building, tall device |
| Slab | 7 × 7 × 2 | tray, plinth, laptop base |
| Panel (object) | 7 × 1 × 6 | browser window, monitor, sign |
| Cylinder | r 3, h 6 | database, coin stack, cup |
| Extrusion | outline 6 × 7, depth 1, on a 7 × 4 × 1 plinth | shield, lock, pin, cloud |
| **UI panel, flat** | 7 × 5.5 × 0.35, floating at z = 1, radius 0.5 | rules, lists, settings |
| **UI panel, standing** | 7 wide × 5.5 tall × 0.4 deep, bottom at z = 1 | charts, balances, dashboards |
| **Card** | 6.5 × 4.25 × 0.25, radius 0.45, floating | payment cards, tickets, passes |

Product keylines float (z ≈ 0.5–1.6) so their cast shadow separates them
from the floor, which is the main depth cue for flat UI.

## Text

- SVG `<text>` inside `Face` or a `Slab`/`Panel` `content`, so it lies in
  the plane. Always set `fill`; `Face` already sets `stroke="none"`.
- Sizes (face units): labels 0.34–0.42, body 0.38, headings 0.5, hero
  numbers 0.9. Weights 500–600. Numbers get
  `style={{ fontVariantNumeric: "tabular-nums" }}`.
- Colour by surface: lit screen → `--iso-screen-ink`; panel or glass →
  `--iso-text` (muted lines at opacity 0.55); card front → `--iso-on-main`;
  on a glow pill → `--iso-screen`.
- Fonts are inherited from the site (Geist on craftUI); never load fonts.

## Details on faces

- Through the `Box` render functions, `Slab`/`Panel` `content`, or `Face`,
  so they share the face's slant. 0.5-unit margins from edges.
- Lights: small circles in `--iso-glow`, one bright and one at 45%.
- Slots and fake text lines on hardware: rounded rects in `--iso-detail`
  at 30–55%. On product panels, use **real text** instead of bars.
- Screens and labels: `--iso-screen` with `--iso-screen-ink` on top.
- About three kinds of detail per face at most; icons must read at 32px.
- Stroked details: `FacePath` with `style={{ strokeWidth: isoStroke(k) }}`,
  never a fixed number. Current multiples: bag handles 1.35, shield check
  1.65, tag string 0.85, conveyor chevrons 1, chart lines 1.6, trend
  arrows 1.4.

## Rows meant to be compared (bars, stacks, a lineup)

Lay them along **x + y = constant**, not along an axis. Along that line
screen x changes and depth doesn't, so items share one baseline and never
overlap. A trend line or arrow over the row lives in the vertical plane
through that line; build its points (arrowhead included) in 3D and project
them. `IsoCoins` is the reference.

## Anatomy of a new icon file

1. A comment: what the object is, what each face shows, any non-obvious
   geometry decision (why it stands, why the row is diagonal).
2. Named constants in world units (`AT`, `SIZE`, `CASTS`).
3. Small internal components for repeated parts.
4. `export const IsoX = ({ ...contentProps, ...props }: IsoIconProps & {…})
   => <IsoIcon casts={CASTS} {...props}>…</IsoIcon>`.
5. Parts written far to near, each in `Part` with an assemble order.

Repo lint style: arrow-function components, `import type` on its own line,
sorted object keys, no nested ternaries, no inline comments after code,
`interface` over `type` for object shapes.

## Per-icon checklist

- duotone, solid and line read clearly in light, dark and brand themes.
- accent ≠ tone shows a clear second colour (try primary with `#16a34a`).
- The shadow matches the silhouette and moves correctly under `mirror`.
- Badges never cover the key detail; `hover-lift` lifts the body while the
  shadow stays; `assemble` builds bottom-up in a believable order.
