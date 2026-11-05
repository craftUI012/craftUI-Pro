# Showcase

A showcase proves the component is engineered better than the one the viewer would build or buy elsewhere. It shows the motion and polish decisions most people never notice but always feel, one decision per scene: the real component does the thing, a stageshow mark shows exactly where and how, and a caption says why it matters.

The test for the whole video: with the sound off, a developer can name each technique, and a founder can say why their landing page would be better with it.

## The master rule: why it converts

Every scene answers one question for each audience, in this order:

1. **What it does** (the technique, true in the source): "Each line enters 40ms after the last."
2. **What a visitor feels** (the perception): "The quote reads itself."
3. **Why that converts** (the mechanism, never a number): "Visitors finish reading. A testimonial nobody finishes sells nothing."

The eyebrow carries 1, the caption carries 2, and 3 is what the scene order and the end card add up to. The benefit table in `references/feature-audit.md` maps techniques to perceptions; use its language, then make it specific to this component. Never claim a percentage, a study or a customer result.

## Before planning

1. Read the component's metadata (`SKILL.md`, Component metadata): its use cases set who the captions speak to, and its `styles` are claims the points must prove.
2. Run the feature audit (`references/feature-audit.md`) and keep its candidate cards. The plan only uses points that passed it.
3. Look at the component at 1:1 in both themes and at 390 and 1280 wide (`/preview/<item>`). Know its best frame: that is the hook frame and the poster.
4. Read stageshow's `references/motion.md` (Story, Pace and easing, Scrolling and the camera) and `references/annotations.md`. The scenes follow them.

## Scenes

A showcase is a chain of scenes, each with one job.

| Scene | Job | Length |
|---|---|---|
| **Hook** | Stop the scroll: the component's best frame with the hook caption on frame 1, its signature motion starting by 0.3s | 1.5 to 2.5s |
| **Point** | One technique: cause, motion, the focus mark that proves it, a hold | 3 to 5s |
| **Adapt** | The same component across theme and width, filmed for real | 3 to 5s |
| **Install** | The one command, typed (optional) | 2 to 3s |
| **End** | craftUI, the tagline, where to get it | 2.5 to 3.5s |

### Inside a point scene

Each point scene runs the same five beats, so the viewer learns the rhythm by the second one:

1. **Title** (0 to 0.4s). The eyebrow and caption arrive while the component is still.
2. **Cause** (by 0.5s). A cursor click, a key or a hover starts the motion. No motion without a seen cause.
3. **Real time.** The motion plays at 1× first, always.
4. **Proof.** The focus mark draws on over the part that moved, with its value ("40ms", "blur 4px → 0"). For motion under about 400ms whose detail can't be seen at 1×, replay it once at 0.25× with a `0.25×` chip on screen and the mark tracking it. The virtual clock films slow motion frame-exact, so it is the same motion slowed, never a re-timed one.
5. **Hold** (0.8 to 1.2s). The result and its mark hold still to be read. The mark clears when the next scene's cause begins, never by fading on its own.

One mark per scene. If a point needs two marks to read, it is two points or a weak point.

### Order

- **Scene 1 explains the hook.** The hook shows the signature motion; the first point names it.
- **Strongest visible point first,** then alternate a developer-heavy point with a founder-heavy one.
- **Never two points from one family in a row** (two easing points, two stagger points). The families are in `references/feature-audit.md`.
- **Adapt comes last before the close,** because "every theme, every width" is the most universal claim and leads into "get it".

### Count by length

| Length | Scenes |
|---|---|
| 15s | Hook, 2 points, End |
| 30s | Hook, 4 points, Adapt, End |
| 45s | Hook, 5 or 6 points, Adapt, Install, End |

Fewer, better points beat a full count. If the audit found three strong points, a 30s plan uses three and holds longer.

## The hook

The first frame is also the thumbnail: the component finished and full, not mid-change, with the hook caption already on screen. The motion starts by 0.3s.

Hooks that fit a showcase, in order of preference:

- **Question the scenes answer:** "Why does this carousel feel expensive?" Every point is then an answer.
- **Bold claim about the craft:** "Every line here is timed."
- **Stop doing:** "Stop shipping testimonials that just fade." Only when the component's point really is the alternative.

A before and after needs a real "before". Don't build a worse version to beat; propose it first (see `CHANGELOG.md`).

## Captions

- **Eyebrow:** the scene number and the technique, in developer words: `02 · Direction-aware exit`.
- **Caption:** the perception, in founder words, at most 8 words, readable in one second: "It knows which way you went."
- The value lives on the mark ("140ms"), not in the caption. A caption with a number in it is usually the mark's job.
- The caption changes with the scene's title beat, never during its motion.

## The focus marks

SVG marks are drawn by stageshow parts in the shot page, measured from the real element on every frame, so they stay attached while it moves and reflows. The vocabulary, and which mark proves which technique, is in `references/focus-overlays.md`. Rules that apply to all of them:

- **The mark points; the component stays the hero.** One quiet ink, one accent for the relationship, 1.5px lines at this scale, no glows, no spotlights, no dimming the rest of the frame.
- **The mark arrives with its cause** and holds through the result.
- **Label with the real value** from the source, in tabular numerals.
- **Push in only when the detail is too small** to read at phone size (stageshow `Camera`, one push-in per scene, the cursor still while the view moves).

## Transitions

- **Between point scenes on the same frame: continuity.** The component stays where it is; only the caption, the cause and the mark change. The story advances; the shot doesn't cut.
- **When the frame changes** (another theme, another width, a push-in level, the terminal): a 10-frame crossfade on the beat.
- **Nothing decorative.** No wipes for their own sake, spins, zoom blurs, glitches, shakes or whooshes. A transition is invisible or it explains something.

## Theme and device

The adapt scene films the real component, never a mock:

- **Width:** the stageshow window is dragged by its edge from desktop to 390, and the component reflows live under the cursor, with the width pill showing the real width. Say what reflows, from the source ("lines re-measure as it narrows").
- **Theme:** the same state filmed in light and in dark on the same frames, then joined by a vertical split that travels across the frame, so both themes are the same moment. The split is the one transition allowed to be seen, because it is the proof.
- **Phone:** when the component has a phone layout worth seeing, cut to the stageshow `Phone` with the same state. Prefer the width drag: it proves the reflow instead of asserting it.

## Frame

The component sits in a stageshow browser `Window` (or `Phone`) following stageshow's framing rules: it fills the clip's width with one gutter, no plate behind it, real chrome. The director picks the opening theme, the one the component looks best in; the video's own chrome follows it, and the window's theme follows the scene. Light and dark is never a brief choice: when the component's styles include `dark-mode`, the other theme is always shown (see Theme and device). Never leave an empty band between the caption and the window.

## The end

- The craftUI mark and name, the tagline (one sentence, at most 60 characters, specific to what the video proved), and the site address.
- One action: "Copy it into your project" with the host. Free or paid as the registry says; never "free" for a paid item.
- Hold 2.5s or more. The last frame is a still worth pausing on.

## Done means

- Every point has its audit card, its source line and a mark that lands on the right element in every sampled frame.
- The score in `references/benchmark.md` is 9 or higher overall with no criterion under 8, judged next to the benchmark videos.
- The contact sheet at the shown size has no stageshow film line left (`references/rehearse.md` in stageshow).
