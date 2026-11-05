# Look: ground, frame and scale

The look is the first thing a scroller judges, before they read a word. Every reel in the benchmarks that passed 3k likes puts the product on a ground with depth, sized to fill the frame. Ours sat in a white window on a white page: correct, but it read as a screenshot. This file decides the ground, the frame around the component and how big it is.

Status: **Built** in the video page (`reels/video/reel.tsx`, grounds in `reels/video/ground.ts`) except **Dusk** (needs licensed photo plates) and the **Phone** frame, which are Planned. The director chooses a look in every plan; Studio's Look dropdown can override the ground; the probe samples the palette.

## The ground

The ground is everything behind the component. It is never the same flat colour as the component's own background: the product needs an edge.

| Ground | Looks like | Use it for | Benchmark |
|---|---|---|---|
| **Aurora** | A slow, soft mesh of 2 or 3 colours drifting (period 8s or more) | Calm, premium features: motion, typography, focus | @theordrori (AppsFlyer) |
| **Glow** | A dark ground with one coloured light pooled behind the product, not around it | Dark-theme components, dashboards, anything with an accent | @simo.dsgn (Spotify) |
| **Ink** | A deep brand colour (navy, forest, aubergine) with a faint vertical gradient | Data, tables, dashboards, devtools | @_code_and_chill_ |
| **Paper** | A warm off-white with real grain, never pure white | Editorial, testimonials, cards, light-theme components | @quanhoang.ux |
| **Dusk** | A licensed photographic plate (sky, field, forest), softly out of focus | Hero sections, galleries, image-led components | @avi_vashishta29, @motionbyjawad, @anmoldoesmotion |
| **Auto** | Built from the component's own palette (see below) | The default | — |

### Auto: a ground from the component's palette

The probe screenshots the component (`scripts/lib/probe.mjs`). From that frame, take the two or three most-used colours that aren't near-white or near-black, plus the accent from the component's tokens. Build:

- a light component → **Paper** tinted 4% toward its dominant hue, or **Aurora** from its two strongest hues at low saturation;
- a dark component → **Ink** in its darkest hue, or **Glow** with its accent as the light.

So a testimonial with warm portraits gets a warm paper, a green dashboard a forest ink, the dock gallery's orange chair and teal walls a teal-and-amber aurora. Every component gets a ground that belongs to it.

### Ground rules

- **Contrast at the edge.** The component's outer edge differs from the ground by at least 8% in lightness, or the frame carries a shadow that draws the edge.
- **One light, behind.** A Glow sits behind the product's centre, never as a halo around the window, never as rays or bloom (the user's standing rule: no glow pools or halos unless asked by name; the video ground is the one place they asked).
- **The ground moves slower than anything else.** Aurora and Glow drift over 8s or more; a ground that moves fast steals the eye from the feature.
- **Photos are licensed and generic:** sky, water, plants, texture. Never a place or object that belongs to another brand. Blur them a little, as if out of focus behind the product.
- **One ground per video** unless a scene changes theme; then the ground changes with it, behind the same dip.
- **Captions sit on the ground, never on the component,** and pass contrast on it.

## The frame

| Frame | Looks like | Use it for | Status |
|---|---|---|---|
| **Browser** | A stageshow `Window` with real chrome | Full pages, heroes, navigation, anything where "it's a website" matters | Built |
| **Card** | No chrome: the component itself, radius 22, a soft layered shadow | Sections, blocks, cards, testimonials, pricing: most components | Built (the default) |
| **Phone** | A stageshow `Phone` | Mobile-first components, or the width scene's destination | Planned |
| **Bleed** | The component fills the frame edge to edge, no frame at all | Big visual components: galleries, globes, illustrations, heroes with art | Built |

The director picks one frame per video; the width scene may move from Browser or Card to Phone.

## Scale: fill the frame

The single biggest fault in our first videos: the component filled under half the frame, with a dead band inside the window.

- **Crop to content** (Built). The page measures the component's content box in the preview (the union of its visible leaf elements, via `checkVisibility`) before frame 0 and at each width change, and frames that plus a 20px margin. Never show empty page below the component.
- **Fill the width.** The framed component fills 80 to 90% of the frame's width (Bleed: 100%), centred.
- **Height follows.** Up to the media box (`PAGE.media`, 900 of the 1920 output px, above the value row and the bottom safe zone); a tall component is cropped with the fade crop at its foot (Built), a short one is centred in the media box, never pinned to its top.
- **Bigger beats complete.** A cropped component at full width reads better on a phone than a whole page shrunk.
- **Think 4:5.** Keep the caption and the component inside the central 4:5 area (1080 × 1350 of the 1080 × 1920 frame) so the same render can be cropped for the feed grid (`references/growth.md`).
