# Feature audit

The audit lists the design-engineering decisions in a component that are worth a scene. **Interface Craft does the listing.** The director never invents features; it only picks from this list and gives each one a scene.

In Studio this runs automatically for every showcase (`lib/studio/features.ts`): Claude gets Interface Craft's `design-critique.md` and `storyboard-animation.md` from `~/.claude/skills/interface-craft` (or `INTERFACE_CRAFT_DIR`), the component's metadata and its whole source, and returns the list below. Run by hand in Claude Code, follow the same steps with the `interface-craft` skill loaded.

## 0. Start from the metadata

Read the item's metadata first (`SKILL.md`, Component metadata): use cases, styles, types, free or paid. Every style is a claim the list must find proof for in the source; a style with no proof goes on the do-not-claim list.

## 1. Inventory the source

Read the whole component file and note every:

- motion value: durations, delays, staggers, easings, springs (`bounce`, `stiffness`, `damping`), `variants`, `AnimatePresence` modes, `custom` direction props, `layout` / `layoutId`;
- CSS motion: `transition-*` properties and durations, `active:` / `hover:` / `focus-visible:` states, `@keyframes`, `will-change`;
- measuring: refs that measure text or layout, `ResizeObserver`, `useLayoutEffect`;
- input: keyboard handlers, drag, swipe, focus handling, `aria-*`, `prefers-reduced-motion` / `useReducedMotion`;
- polish details: radii on nested surfaces, shadows, `tabular-nums`, `text-wrap`, image outlines, hit areas;
- responsive and theme behaviour: breakpoint classes, what changes per breakpoint, theme tokens versus hard-coded colours.

Record the file and line for each.

## 1b. Probe the interactions for real

Before Interface Craft looks, the probe (`scripts/lib/probe.mjs`, run by Studio) tries the component's interactions in headless Chrome and reports, per group of look-alike elements (G1, G2…): its handlers, its cursor, and what each of hover, click, sweep (the cursor gliding across the row), drag and the source's keys did. For example, on the Dock gallery: sweep across the section makes three tiles scale 1.32×; a click opens a tile to 2.79×; Escape does nothing while no tile is open. Idle motion is measured first, so drift isn't mistaken for a response.

Every interaction the probe reports as RESPONDS gets a hard look as a feature. A feature's trigger must be one the probe saw work: its target is the probe group (`G2`), which Studio turns into the storyboard's selector. With no probe (it failed or there's no dev server), triggers fall back to the source's literal aria-labels and keys.

## 2. Ask Interface Craft: Design Critique in reverse

Design Critique finds what is wrong. Here the same method finds what the component gets **right** that most components don't:

1. **Step 0, Context:** what this is, who it's for, the emotional context. **Step 1, First impressions:** one paragraph.
2. **Walk the lenses:** visual design, interface design, consistency and conventions, user context, plus the component's motion.
3. **Use its frameworks:** *Noticing* (count, measure, name the values), *Industry Standards* (name the typical template behaviour the feature beats) and *Uncommon Care* (the micro-interactions, transitions and edge cases where the designer went further).
4. **Use its voice:** specific, decisive, quantitative. No hedging, no praise padding.
5. **Write each motion with Storyboard Animation:** one line per stage, ms after the trigger, values with →, staggers in parentheses:

   ```
      0ms   Next pressed; old lines exit to +20px, blur 0 → 4px (140ms, easeIn)
    140ms   new lines enter from −20px, blur 4px → 0, opacity 0 → 1 (220ms, easeOut)
            each line 40ms after the one above
   ```

6. **List what is weak** as do-not-claim, with the evidence, so the video never features it (a "precise press" scene on a button with `transition-all`).

`web-animation-design` and `make-interfaces-feel-better` are the vocabulary for naming motion and polish values correctly (easing per job, exits faster than enters, stagger, concentric radius, tabular numbers). They check the wording; they don't add features Interface Craft didn't list.

## 3. A card for every feature

Interface Craft returns 3 to 8 features, strongest first. Each one:

```
name:         Measured line stagger              (the eyebrow; developer words, ≤ 40 characters)
lens:         motion                             (which critique lens found it)
observation:  Four quote lines, each a real wrapped line, enter 40ms apart
storyboard:     0ms  Next pressed … / 140ms  line 1 enters … (+40ms each)
evidence:     registry/sections/testimonials-section-03.tsx:102 LINE_STAGGER 0.04; :404-417 measures real wrapped lines
impact:       the quote reads itself, top to bottom, instead of popping in as a block
trigger:      click G3                           (click | hover | sweep | drag on a probe group; key; resize | theme | idle)
caption:      The quote reads itself             (founder words, ≤ 6 words, no numbers)
visibility:   5   (clear at phone size? 1 no, 5 obviously)
rarity:       4   (would a typical template have it? 1 always, 5 almost never)
```

A feature must be:

- **true:** proved by the source, with the lines and values in its evidence;
- **visible:** it shows on screen when its trigger runs, at phone size, in the real component;
- **one thing:** one decision, so one scene can show it;
- **filmable:** its trigger is one the recorder can perform. A click or hover needs an aria-label the source really has, a key needs a handler for it, a theme needs the `dark-mode` style. Motion that only plays once on page load can't be filmed yet and is left out. Studio drops any feature that fails this and says why.

## 4. The director picks and writes scenes

1. Take the features in order (visibility × rarity), as many as the length allows (`types/showcase.md`, Count by length), each once.
2. Avoid two from the same lens in a row.
3. Give each its scene: the trigger, the motion centred, the eyebrow (its name), the caption (its caption, sharpened, ≤ 6 words over 1 or 2 lines) and the hold.
4. Never feature anything on the do-not-claim list.

## Families

| Family | Includes |
|---|---|
| Easing | Curve choice per job, custom cubic-beziers, springs with bounce 0 |
| Timing | Durations, exits faster than enters, paired timing |
| Stagger | Split and staggered enters, reading-order delays |
| Direction | Direction-aware enter and exit, origin-aware scale, drag momentum |
| Focus | Blur in and out, opacity with scale, icon cross-fades |
| Measure | Real line measuring, auto height, layout animation, no layout shift |
| Feedback | Press scale, hover and focus states, hit areas |
| Input | Keyboard, swipe, drag, focus management |
| Surface | Concentric radius, shadows, outlines, optical alignment |
| Type | Balanced wrapping, tabular numbers, rag |
| Adapt | Breakpoints, reflow, theme tokens, reduced motion |

## Benefit language

Start from these perceptions, then make them specific to the component. The right column is the reasoning behind the scene order and the end card, not a caption to print.

| Technique | A visitor feels | Why it converts |
|---|---|---|
| Fast ease-out feedback | It's instant | Responsive pages get clicked more; slow ones read as broken |
| Stagger in reading order | It reads itself | The message gets finished, not skimmed |
| Direction-aware motion | It knows where I came from | Navigation never confuses |
| Exit faster than enter | It's never in my way | No waiting between actions |
| Blur to sharp | It settles into focus | Reads as premium, like a product with a design team |
| Measured line breaks | It looks hand-set | Credibility at first glance |
| Concentric radius, shadows | It looks precise | The brand looks finished |
| Tabular numbers | Numbers don't jitter | Data looks trustworthy |
| Spring, bounce 0 | Feels physical, not floaty | Interaction feels expensive |
| Keyboard support | Works without a mouse | Nobody is shut out |
| Reduced motion | It respects me | No visitor leaves feeling sick |
| Real reflow | One component, every screen | No extra build for mobile |
| Theme tokens | Dark mode for free | Ships both without extra work |

## Worked example: testimonials-section-03

Metadata (`registry.json`, SEC-8R0ZYM): templates library, testimonials, styles `minimal`, `dark-mode`, `motion`; use cases "High-impact SaaS landing pages", "Executive and enterprise software websites", "Founders and product leadership case studies". So the captions speak to credibility with enterprise buyers, at least one point proves `motion`, and the adapt scene must show dark mode.

Source: `registry/sections/testimonials-section-03.tsx`.

| Point | Family | Evidence | Mark | Eyebrow / caption |
|---|---|---|---|---|
| Measured line stagger | Stagger | `:102` 40ms stagger; `:404-417` invisible measuring copy finds the real wrapped lines | Stagger ticks, "40ms" | 01 · Measured line stagger / The quote reads itself |
| Direction-aware slide | Direction | `:110-133` enter from `-direction × 20px`, exit to `+direction × 20px` | Direction arrows on Next, then Previous | 02 · Direction-aware / It knows which way you went |
| Blur to sharp | Focus | `:113` and `:118` blur 4px → 0 with opacity | Push-in on one line, 0.25× replay, "blur 4px → 0" | 03 · Focus pull / Every quote settles into focus |
| Exit before enter | Timing | `:103` exit 140ms against `:101` enter 220ms, `mode="wait"` at `:418` | Two timing bars, 140 and 220 | 04 · Exit 140ms, enter 220ms / Never makes you wait |
| Keyboard | Input | `:215-222` ArrowLeft and ArrowRight | Keycaps | Folded into scene 2 when the length is short |
| Re-measures on resize | Adapt | `:306-311` ResizeObserver re-measures the lines | Width pill during the drag | Adapt / Lines re-break at every width |

Do not claim: precise press feedback (`:538` and `:550` use `transition-all` and `active:scale-95`, below the 0.96 the polish lens asks for), and easing as a point (exits use `easeIn`).
