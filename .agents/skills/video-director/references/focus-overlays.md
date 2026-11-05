# Focus marks

A focus mark shows exactly where the motion happens and what its value is. Each mark is an SVG layer in the shot page (`reels/shoot/`), built from a stageshow kit part (`reels/kit`) and following stageshow's `references/annotations.md`: one relationship per line, fine strokes, measured ends, the product left visible.

## How marks stay attached

- **Measure the real element** inside the component's iframe, every frame. The shot runs on the virtual clock, so a `requestAnimationFrame` loop in the shot page samples each filmed frame exactly. Map iframe coordinates to the stage with the viewport's scale (`stageRect()` in `reels/video/reel.tsx`), and look the element up again every frame: components often replace it when their motion starts.
- **Never aim at a destination.** A mark follows the element as it is drawn, not where it will end up (stageshow, Attach to what is drawn).
- **Targets** use the spec's target syntax (`aria:`, `text:`, `css:`). A `css:` target picks the first visible match. A mark whose target matches nothing is left out of the scene (a console warning), never drawn in the wrong place.

## The marks

| Mark | Proves | Built from | Looks like | Built |
|---|---|---|---|---|
| **Ring** | "This is the thing", and the default mark for every feature | Measured SVG rect (`reels/video/reel.tsx`) | An accent ring 8px outside the element, drawn on with the cause and re-measured every frame (the element is looked up again each frame, since components replace it), with its value in an accent pill under the window | Built |
| **Leader** | A value on one element: a duration, a blur, a radius | `Connector` with a label | A fine line from a small label outside the window to 4 to 6px short of the element, ending in a dot | Planned |
| **Stagger ticks** | A stagger and its interval | `Connector` dots on a rail | A short vertical rail beside the elements, one tick lighting as each one lands, labeled with the interval | Planned |
| **Timing bars** | Exit against enter, paired timing | `Meter` | Two thin bars at the durations' proportions with a playhead on the clock, labeled in ms | Planned |
| **Easing curve** | A curve choice or a spring | `bezier` from `ease.ts` | A small satellite card straddling the window's edge, with the curve and a dot riding it in sync with the motion | Planned |
| **Direction** | Direction-aware enter and exit | `Connector` with `arrow` | A short arrow along the travel, appearing with the motion, pointing the way it went | Planned |
| **Radius** | Concentric radius | SVG arcs | Arcs on the outer and inner corner, labeled "24 = 16 + 8" | Planned |
| **Keycaps** | Keyboard support | Keycaps from `a.key` | The pressed keys on screen as they press | Built |
| **Width pill** | Real reflow | Shot page | The live width under the dragged edge | Built |
| **Slow-mo chip** | That a replay is slowed | `Chip` | `0.25×` in the window's top corner for the length of the replay | Planned |
| **Push-in** | A detail too small at phone size | `Camera` | The view pushes in on the focus and back out, edges feathered | Planned |

## Choosing a mark

- Use the mark in the table row for the point's family (`feature-audit.md`, Families). If two fit, take the one with fewer lines.
- One mark per scene; the keycaps or width pill may sit beside it when they are the cause.
- A number on a mark is the real value from the source, in tabular numerals, with its unit in its own box (stageshow `Count`).
- Labels sit outside the window, in the margin facing the element, never over the component's content.

## Style

- One accent for marks across the whole video, from the craftUI palette; quiet ink for labels.
- 1.5px strokes at this scale; labels in Geist at the caption track's eyebrow size or smaller.
- No glows, halos, spotlights, vignettes or dimming of the rest of the frame.
- Marks draw on with their cause and clear with the next scene's cause.
