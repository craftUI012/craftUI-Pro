# Showcase

A showcase proves the component is engineered better than the one the viewer would build or buy elsewhere, and makes them want it now. It shows the design-engineering decisions most people never notice but always feel, **one feature per scene**: the real component does the thing, big and centred on a ground with depth, the camera pushes into it, a short caption on top says why it matters, a stageshow mark shows exactly where it happens, and the video ends with one ask.

The bar is the benchmark reels in `references/benchmark.md`, the strongest with 12k likes. A showcase ships when it scores 9 or higher against them on every criterion of the rubric, the look and sound included. No rule guarantees likes; meeting the bar the best reels set is what this file is for.

The test for the whole video: in the first second a scroller stops; with the sound off a developer can name each technique and a founder can say why their landing page would be better with it; at the end they know exactly what to comment.

## The process

Run these steps in order, every time. Studio runs steps 1 to 6 when you click **Plan with director** with the Showcase type.

1. **Read the metadata** (`SKILL.md`, Component metadata). Use cases set who the captions speak to; `styles` are claims the features must prove.
2. **Probe the real interactions.** Headless Chrome opens `/preview/<item>` at the video's viewport, finds every element that reacts to input (React handlers on the DOM node, native controls), groups look-alikes (a rail of tiles is one group), then tries hover, click, a cursor glide across, a drag and the source's keys, each on a fresh page, and measures what changed on screen next to what changes on its own. Interactions are where the best features usually live; the probe is how they're found, because a source scan only sees literal aria-labels. (`scripts/lib/probe.mjs`; Studio's Features tab shows what it tried.)
3. **Ask Interface Craft for the feature list.** Interface Craft (Josh Puckett's skill, installed at `~/.claude/skills/interface-craft`) lists the engineering beauty in the component: its Design Critique guide run in reverse (what it gets right that a typical component doesn't) and its Storyboard Animation guide to write each motion as a timeline of real values. The method, the card each feature gets and what it must prove are in `references/feature-audit.md`. Interface Craft also returns a do-not-claim list: weaknesses the video never features.
4. **Choose the look.** The ground (Auto from the component's palette by default), the frame (Card for most components, Browser for pages, Bleed for big visual components) and the scale (crop to content, fill the width). `references/look.md`.
5. **Pick the features and write the scenes.** Strongest first (visibility × rarity), as many as the length allows, each once, never two from the same lens in a row when it can be avoided. One scene per feature: its trigger, the push-in on its focus element, a short caption on top. `references/camera.md` sets the pace.
6. **Write the hook and the close.** A hook that builds in by 1.0s with the product moving by 0.3s, a comparison scene when the component has real variants, one ask on the end card, the series signature. `references/growth.md`.
7. **Film and mix.** The recorder films the page; the sound is mixed in afterwards, with a second export with interface sounds only, for trending audio. `references/sound.md`.
8. **Score** against the benchmarks. Below 9 on any criterion, fix the lowest and film again.

In Studio the feature list is the **Features** tab: each feature's observation, storyboard, evidence and trigger, the scene that shows it, what the probe tried, and what is never claimed.

## The master rule: why it converts

Every scene answers one question for each audience, in this order:

1. **What it does** (the technique, true in the source): "Each line enters 40ms after the last."
2. **What a visitor feels** (the perception): "The quote reads itself."
3. **Why that converts** (the mechanism, never a number): "Visitors finish reading. A testimonial nobody finishes sells nothing."

The eyebrow carries 1, the caption carries 2, and 3 is what the scene order and the end card add up to. The benefit table in `references/feature-audit.md` maps techniques to perceptions; use its language, then make it specific to this component. Never claim a percentage, a study or a customer result.

## Scenes

| Scene | Job | Length (15s video) |
|---|---|---|
| **Hook** | Stop the scroll: a finished, beautiful frame, the hook building in by 1.0s, the product moving by 0.3s | 1.2 to 1.8s |
| **Feature** (one per feature) | Its trigger, the motion, the push-in, the focus mark, a hold | 2.5 to 3.5s |
| **Comparison** (when real variants exist) | Two real variants, and the question | 2.5s |
| **Install** (45s only) | The one command, typed | 2.5s |
| **End** | The sting, craftUI, the tagline, the ask | 2 to 2.5s, looping back to the hook |

Lengths for 30s and 45s are in `references/camera.md`, Pace. 15s is the default; the most-liked benchmarks ran 11 to 20s.

### Layout of a feature scene

The same layout every scene, so the viewer knows where to look by the second one:

- **Caption on top,** on the ground, inside the safe zone: the eyebrow and one or two short lines.
- **The component, big and centred** in its frame on the ground: 80 to 90% of the width, up to the media box's height, cropped to content (`references/look.md`).
- **The mark on the motion:** the ring on the element that moves, its value in the label row under the frame.
- **The handle** small in the top-right corner; nothing else on screen.
- **Everything that matters inside the central 4:5 area,** so the same render crops for the feed.

### Inside a feature scene

1. **Title** (0 to 0.3s). The caption arrives, wide shot, the component still or in its idle motion.
2. **Cause** (by 0.5s). The trigger starts the motion: a click, a hover, the cursor gliding across a row, a drag, a key, the window narrowing, or nothing for motion that runs on its own. The cursor always travels; it never jumps, because pointer-driven components react to the path. Where the component draws its own cursor, the stage cursor steps aside so viewers see the component's.
3. **Push in** with the cause, onto the focus element, over 600 to 800ms (`references/camera.md`). Skip it for width and theme scenes.
4. **Proof.** The ring draws on over the part that moved, with its value from the storyboard ("×1.32 under the pointer", "blur 4px → 0"). A 0.25× replay only for motion under 400ms, labelled, at most once per video.
5. **Hold** (0.8 to 1.5s). The result and the ring hold still to be read; the camera pulls back with the next scene's title.

One mark per scene. If a feature needs two marks to read, it is two features or a weak one.

### Order

- **The hook shows the signature interaction;** scene 1 names it.
- **Strongest visible feature first,** then alternate a developer-heavy feature with a founder-heavy one.
- **Never two features from the same lens in a row** when it can be avoided.
- **Comparison, width and theme come last,** just before the end: the most universal claims lead into the ask.

### Count by length

| Length | Feature scenes |
|---|---|
| 15s | 2 or 3 |
| 30s | 4 to 6 |
| 45s | 6 to 8, then Install |

Fewer, better features beat a full count.

## The hook

The first frame is also the thumbnail: the component finished and full, on its ground, never mid-change. The hook words build in one at a time, 70 to 90ms apart, and the product moves by 0.3s.

Hooks that fit a showcase, in order of preference (`references/growth.md`):

- **Question the scenes answer:** "Why does this gallery feel expensive?"
- **Choice:** "Light or dark? Comment which." Only with a real comparison scene.
- **Bold claim about the craft:** "Every photo here is on a spring."
- **Stop doing:** "Stop shipping carousels that just slide." Only when the component's feature really is the alternative.

A before and after needs a real "before". Never build a worse version to beat.

## Captions: short and crisp

- **Eyebrow:** the feature's name, the technique in developer words, at most 40 characters: `Direction-aware exit`.
- **Caption:** what the visitor feels, in founder words, at most 6 words over 1 or 2 lines, readable in one second: "It knows which way you went."
- **The hook builds in word by word;** feature captions rise in as a block.
- **No numbers in the caption.** The value lives on the mark.
- Sentence case. No emoji, hashtags, exclamation marks or hype words.
- The caption changes with the scene's title beat, never during its motion.

## The look

`references/look.md` in full. In short: the ground is never the component's own flat colour (Auto builds it from the component's palette), the frame suits the component (Card by default), and the component fills the frame. One light, behind the product, never a halo. The ground moves slower than anything else.

## The focus marks

SVG marks are drawn in the video page, measured from the real element every frame, so they stay attached while it moves and reflows (`references/focus-overlays.md`):

- **The mark points; the component stays the hero.** One accent, a 2px ring, no glows, no spotlights, no dimming the rest of the frame.
- **The mark arrives with its cause** and holds through the result; on a group (a rail of tiles) it rides on the member under the pointer.
- **Label with the real value** from the feature's storyboard, in tabular numerals, under the frame.

## Transitions

- **Between feature scenes: continuity.** The component stays; the camera pulls back and pushes into the next feature.
- **When the frame or theme changes:** a short dip (the media box fades out and back), on the music's beat when there is music.
- **Nothing decorative.** No wipes for their own sake, spins, zoom blurs, glitches, shakes or whooshes.

## Theme and width scenes

When Interface Craft lists them, they film the real component, never a mock:

- **Width** (`resize`): the window is dragged from desktop to 390 and the component reflows live, with the width pill showing the real width.
- **Theme** (`theme`): the same state in the other theme, its ground changing with it.
- Either can be a **comparison scene**: both side by side, with the question in the caption.

## The end

- **The sting** (0.5s): the craftUI mark settling into place, the same every video.
- **craftUI, the tagline** (one sentence, at most 60 characters, specific to what the video proved) and **the ask**: "Comment CRAFT for the code" (or "Link in bio" until the comment automation exists). Free or paid as the registry says; never "free" for a paid item.
- **Hold 2 to 2.5s,** then fade back to the hook's first frame so the reel loops.

## Sound

`references/sound.md`. A music bed by mood with scene changes on its beats, quiet interface sounds on clicks, sweeps and opens, and always a second export with interface sounds only, for adding a trending sound in the app. The captions still carry everything for muted viewers.

## Done means

- Every feature scene comes from Interface Craft's list, with the probe's proof and the source's evidence, and nothing on the do-not-claim list appears.
- The first second: a finished frame, the hook built by 1.0s, motion by 0.3s.
- The ground isn't flat, the component fills the frame, and each feature has its push-in and its ring on the right element in every sampled frame.
- Every caption is at most 6 words; everything that matters sits inside the 4:5 area.
- One ask, on screen for 2.5s; the reel loops.
- Both exports exist (bed, and interface sounds only).
- The score in `references/benchmark.md` is 9 or higher on every criterion, judged next to the benchmark reels.
