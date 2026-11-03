# Isometric math: the spec every drawing follows

Source: Wikipedia, "Isometric projection" (https://en.wikipedia.org/wiki/Isometric_projection).
Isometric means "equal measure": an axonometric projection in which the three
axes appear equally foreshortened and **120° apart**. A cube seen this way
outlines a **regular hexagon**.

## 1. Constants

| Name | Exact | Value | Use |
| --- | --- | --- | --- |
| cos 30° | √3/2 | 0.8660254 | horizontal reach of an x or y step |
| sin 30° | 1/2 | 0.5 | vertical drop of an x or y step |
| tilt angle | arcsin(1/√3) = arctan(1/√2) | 35.26439° | second rotation (the camera's tilt) |
| turn angle | 45° | 45° | first rotation about the vertical axis |
| projection scale | √(2/3) | 0.8164966 | true projection foreshortening (not used, see §2) |
| ellipse major | √(3/2) | 1.2247449 | × circle radius, drawing scale |
| ellipse minor | 1/√2 | 0.7071068 | × circle radius, drawing scale |
| ellipse ratio | √3 | 1.7320508 | major ÷ minor, on every face |
| **forbidden** | arctan(1/2) | 26.56505° | 2:1 "game isometric" (dimetric). Never use it. |

## 2. Derivation, then the formula we use

Wikipedia's derivation: turn the world 45° about the vertical axis, tilt it
by arcsin(1/√3) about the horizontal axis, then project orthographically:

```
c = (1/√6) · [ √3   0  −√3 ]
             [ −1   2   −1 ] · a          b = [1 0 0; 0 1 0; 0 0 0] · c
             [ √2  √2   √2 ]
```

Every axis then lands at length √(2/3). That uniform factor only changes
size, never shape, and the icon's viewBox normalises size anyway. So we use
**isometric drawing scale** (1:1 along each axis), the standard drafting
convention.

### Our axes

World: **x runs right-down, y runs left-down, z runs up.** Screen: SVG,
y pointing down. Canvas scale **S = 1.25** canvas units per world unit
(see §8).

```
sx = S · (x − y) · √3/2
sy = S · ((x + y) / 2 − z)
```

| World step | Screen direction | Angle from horizontal | Length |
| --- | --- | --- | --- |
| +1 x | S·(+0.8660, +0.5) | 30° down to the right | S |
| +1 y | S·(−0.8660, +0.5) | 30° down to the left | S |
| +1 z | S·(0, −1) | straight up | S |

The three axes are 120° apart and equal in length. A cube of edge e becomes a
regular hexagon **e·√3 wide and 2e tall** (times S).

Round projected coordinates to 0.01 canvas units, and only at output.

## 3. Visible faces and how they map

Viewer direction (toward the viewer): **V = (1, 1, 1)**. Visible faces of an
axis-aligned box are the ones whose normal points toward V: **top (+z),
left wall (+y), right wall (+x).** Bottom and the −x, −y walls are never
drawn.

To draw flat 2D content (labels, screens, slots, glyphs) on a face, map face
coordinates (u across, v down or toward the viewer) to the screen:

| Face | Plane | u maps to | v maps to | SVG `matrix(a b c d e f)` |
| --- | --- | --- | --- | --- |
| Top | z = const | +x → S(0.8660, 0.5) | +y → S(−0.8660, 0.5) | a=0.866S b=0.5S c=−0.866S d=0.5S |
| Left wall | y = const, faces +y | +x → S(0.8660, 0.5) | −z → S(0, 1) | a=0.866S b=0.5S c=0 d=S |
| Right wall | x = const, faces +x | −y → S(0.8660, −0.5) | −z → S(0, 1) | a=0.866S b=−0.5S c=0 d=S |

`e, f` = the projected face origin, the corner where u = v = 0. For a box at
(x, y, z) with size (w, d, h): top (x, y, z+h), the back corner; left wall
(x, y+d, z+h), its top-left corner on screen; right wall (x+w, y+d, z+h),
its top-left corner on screen.

All three faces scale area by the same **S²·√3/2**. That equality is what
makes isometric look balanced. The 2:1 pilot gave the top 1.0 and the walls
1.118.

**Angles drawn on a face are not preserved.** Only lengths parallel to the
axes are true. A 45° line on a face is not 45° on screen.

**Strokes:** use the matrix to place *points*, then stroke in screen space,
so lines keep one weight. Fill-only details (no stroke) may use the matrix
directly.

## 4. Circles

A circle of world radius r on any face becomes an ellipse with

- semi-major **S·r·√(3/2) ≈ 1.5309·r** and semi-minor **S·r/√2 ≈ 0.8839·r** (S = 1.25)
- ratio √3 : 1 on every face

| Face | Major axis direction on screen | SVG |
| --- | --- | --- |
| Top | horizontal | `<ellipse rx ry>` |
| Left wall | 60° from horizontal, down to the right | `rotate(60)` about the centre |
| Right wall | 60° from horizontal, up to the right | `rotate(-60)` about the centre |

Ellipse centre = the projected circle centre.

**Upright cylinder** (axis z, centre (cx, cy), base z, height h, radius r):
top ellipse centred at project(cx, cy, z+h); the silhouette is the two
vertical lines at sx ± rx, from the top ellipse down to the bottom ellipse,
closed by the bottom ellipse's front half.

## 5. Light and shading

One light for everything: **L = (1, 2, 3) / √14**, coming from the upper
left. Face brightness is Lambert's n · L:

| Face | Normal n | n · L |
| --- | --- | --- |
| Top | (0, 0, 1) | 3/√14 = 0.8018 |
| Left wall | (0, 1, 0) | 2/√14 = 0.5345 |
| Right wall | (1, 0, 0) | 1/√14 = 0.2673 |

Top and right sit exactly ±0.2673 either side of the left wall. So the
**left wall is the base color** and the others step the oklch lightness:

```
ΔL(face) = k · (n·L − 0.5345)       → top +0.2673k, left 0, right −0.2673k
```

| Variant | k | Top | Right | Base colour |
| --- | --- | --- | --- | --- |
| duotone | 0.33 | +0.088 | −0.088 | tone mixed 28% into `--card` (surface: ink 6%) |
| solid | 0.40 | +0.107 | −0.107 | the tone itself (surface: ink 12% into card) |
| line | 0 | flat | flat | `--card`; accents keep a duotone tint |

In CSS: `oklch(from <base> clamp(0, calc(l + ΔL), 1) c h)`. Steps are added
to lightness rather than mixed toward white or black, so contrast between
faces is the same in light and dark themes.

Any other face (a slope, a cylinder side) uses the same formula with its
own normal. For a cylinder side the normal at angle θ is (cos θ, sin θ, 0),
so n · L = (cos θ + 2 sin θ)/√14. The two-tone split at the silhouette
centre (θ = 45°) gives the left half the left-wall shade and the right half
the right-wall shade. A smooth gradient across the side, using this
formula, is also allowed.

### Gradients (light falloff across a face)

Each visible face is a linear gradient (objectBoundingBox) around its flat
Lambert colour, with lightness offsets × k:

| Face | Direction | Start | End | Reads as |
| --- | --- | --- | --- | --- |
| Left wall | (0, 0) → (0.3, 1) | +0.07k | −0.16k | lit at the top, darker at the base |
| Right wall | (0, 0) → (0.3, 1) | +0.02k | −0.20k | darkest face, deepening to the ground |
| Top | (0.3, 0) → (0.7, 1) | +0.10k | −0.05k | brightest at the back |

In `line`, k = 0, so gradients collapse to flat card.

### Edges

- **Seams:** every face is also stroked in its own paint (0.05 canvas
  units), so neighbouring faces meet without a hairline gap.
- **Rim:** the top face's two front edges are stroked lighter
  (top colour + 0.12 lightness), width 0.75 × `strokeWidth`. This is the
  highlight a real edge catches from an upper-left light.
- **Silhouette:** the object's outer hexagon gets a faint hairline
  (tone mixed toward ink, about 38% opacity, width 0.6 × `strokeWidth`) so
  pale objects still read on pale pages. No line is ever drawn between two
  faces of the same solid outside the `line` variant.

### Shadows

Light travels along −L, so a point (x, y, z) lands on the ground at
**(x − z/3, y − 2z/3, 0)**. With the light in front of the viewer, shadows
fall back and to the right (screen up-right), mostly behind the object.

- **Cast shadow:** for each declared `cast` (a box [x, y, w, d, h] or a
  disc [cx, cy, r, h], raised to z), project its footprint at its bottom
  and top heights, take the convex hull (monotone chain), project, fill
  with `--iso-shadow`, blur (σ 0.55 canvas units), 75% opacity.
- **Contact shadow:** for parts that touch the ground (z < 0.6), the exact
  footprint, blurred less (σ 0.22). This is what grounds an object.
- Shadows only darken: soft on light pages, nearly invisible on dark ones,
  which is correct.

## 6. Depth order

The distance toward the viewer is **x + y + z**. Paint from far to near.

For axis-aligned boxes A and B that overlap on screen, A is behind B (paint
A first) when, on at least one axis, A ends where B begins or earlier:
`A.max_x ≤ B.min_x` or `A.max_y ≤ B.min_y` or `A.max_z ≤ B.min_z`. Sort
parts with this test (a topological sort). Comparing centre sums
(x + y + z) is enough for stacks and side-by-side parts.

Inside an icon, write parts in far-to-near order. `Part order` (the order
of the assemble animation) is separate: it usually runs bottom to top.

In scenes, cells sort by **col + row** (+ height for stacked items).

## 7. Mirroring

The other viewpoints are the 8 octants Wikipedia mentions. Swapping x and y
in the world negates sx and leaves sy unchanged. So **mirror = a
horizontal flip of the drawing**, plus two corrections that keep the light
at the upper left:

- the light's x and y components swap (`--iso-lx` ↔ `--iso-ly`), so the
  face now on the right gets the darker shade;
- shadows are **recomputed** from casts with x and y swapped, never
  flipped (a flipped shadow would point toward the light).

Text or asymmetric glyphs on faces read backwards when mirrored. A
`mirrorable={false}` guard isn't built yet (see Known gaps).

## 7b. Turning the view (orbit)

The camera can orbit the scene about a vertical axis through a pivot by a
yaw angle. Mathematically the world is turned by −yaw about the pivot,
then projected with the formula of §2:

```
(x, y) → pivot + R(−yaw) · ((x, y) − pivot),   z unchanged
```

- Only yaw 0 is true isometric. Every other yaw is still an exact parallel
  projection (a dimetric or trimetric view), so nothing is faked.
- The light stays fixed in the world: face shades and shadows don't change
  as the camera turns, which is what happens when you walk around a lit
  object. Shadows are computed in the world and projected like any shape.
- Face axes (§3) become the projections of the turned world directions; a
  circle on a face is drawn as a unit circle through that matrix, so it
  stays exact at any yaw. Horizontal circles (cylinder tops) keep their
  ellipse; only their centres move.
- Keep |yaw| < 45°: at 45° a wall goes edge-on and other faces would come
  into view (the engine caps each side at 40°). Within that range the same
  three faces stay visible and authored depth order holds for objects
  separated along x or y.
- Fit the frame to every angle in the range, so the scene never changes
  size as it turns.

## 8. Canvas and grid

- **viewBox `-12 -17 24 24`**, a 24-unit canvas like Lucide. Icons are
  shown far larger than Lucide's 24px, so the default `strokeWidth` is
  **0.3** canvas units (≈1.4px at 112px). In `duotone` and `solid` it sets
  rim and hairline weight; in `line` it is the outline.
- **S = 1.25** canvas units per world unit.
- **Reference cube:** world x, y ∈ [−4, 4], z ∈ [0, 8]. On screen that is
  sx ∈ [−8.66, 8.66] and sy ∈ [−15, 5]: a hexagon 17.32 wide and 20 tall,
  with ground centre (0, 0, 0) at canvas point (12, 17) from the top left.
- **Grid:** world coordinates are multiples of **0.5** (= 0.625 canvas
  units).
- **Badge zone:** the top-right 6 × 6 canvas units (x 6…12, y −17…−11).
  It only grazes the hexagon's upper-right edge, which runs from (0, −15) to
  (8.66, −10).
- **Scenes:** cell pitch **10 world units** (cube 8 + gap 2). The default
  floor is a dot grid on z = 0 (a dot every 2 units, opacity fading with
  (1 − t)^1.5 from the middle, clipped to the scene's bounds). The
  optional slab is 1 unit thick below z = 0 and extends half a pitch beyond
  the outer cells. Links run along grid lines at z = 0.
- **Text on faces:** on-screen size ≈ font size (face units) × 1.25 ×
  (rendered icon width in px ÷ 24). In a scene, the rendered width already
  includes the item's `scale`. Keep text at 9px or more at the smallest size
  the piece is meant for.

## 9. Known limits

- Parallel projection has no perspective, so size never signals distance.
- Heights can be ambiguous (the Penrose-stairs effect). Contact shadows,
  cast shadows and the fixed light remove that.
- A line drawn on a flat (top) face loses its rise: the face's u axis falls
  30° on screen, which outweighs a modest rise. Charts go on standing
  faces.
- 30° lines don't fall on whole pixels (tan 30° ≈ 0.577). Fine for vector
  icons; at very small sizes keep strokes at least 1 canvas unit.
