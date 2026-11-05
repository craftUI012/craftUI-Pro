# Feature audit

The audit finds the decisions in a component worth a scene. It reads the source through three lenses, writes a card for every candidate, and keeps only points that are true, visible at phone size and rarer than a typical template.

## 0. Start from the metadata

Read the item's metadata first (`SKILL.md`, Component metadata). Write down its use cases, styles, types and free or paid. Every style is a claim the audit must find proof for in the source; a style with no proof goes on the do-not-claim list.

## 1. Inventory the source

Read the whole component file. List every:

- motion value: durations, delays, staggers, easings, springs (`bounce`, `stiffness`, `damping`), `variants`, `AnimatePresence` modes, `custom` direction props, `layout` / `layoutId`;
- CSS motion: `transition-*` properties and durations, `active:` / `hover:` / `focus-visible:` states, `@keyframes`, `will-change`;
- measuring: refs that measure text or layout, `ResizeObserver`, `useLayoutEffect`;
- input: keyboard handlers, drag, swipe, focus handling, `aria-*`, `prefers-reduced-motion` / `useReducedMotion`;
- polish details: radii on nested surfaces, shadows, `tabular-nums`, `text-wrap`, image outlines, hit areas;
- responsive and theme behavior: breakpoint classes, what changes per breakpoint, theme tokens versus hard-coded colors.

Record the file and line for each.

## 2. Read it through three lenses

| Lens | Skill | Asks |
|---|---|---|
| Motion | `web-animation-design` (Emil Kowalski) | Is each easing right for its job (ease-out for enter, ease-in-out for movement)? Durations in range for the element? Exits faster than enters? Paired elements share timing? Direction and origin aware? Interruptible? Reduced motion handled? |
| Polish | `make-interfaces-feel-better` | Which of its 16 principles does the component get right: concentric radius, optical alignment, shadows over borders, split and stagger, subtle exits, icon cross-fade with blur, tabular numbers, balanced wrapping, scale on press, no animation on load, specific transition properties, hit areas? |
| Critic | `interface-craft` (Josh Puckett), `design-critique.md` | Seen at phone size, is it visible? Would the most exacting designer agree it is a strength? Does anything in the same component contradict it? |

The motion and polish lenses find candidates. The critic decides. A point the critic rejects is never filmed, however good it sounds.

The lenses also find faults. Faults go on the do-not-claim list: never feature a point the component itself contradicts (a "precise motion" scene on a button with `transition-all`), and never show a fault in close-up.

## 3. Write a card for every candidate

```
point:       Measured line stagger
family:      stagger
evidence:    registry/sections/testimonials-section-03.tsx:102 LINE_STAGGER 0.04; :404-417 measures real wrapped lines
proof:       click Next; the four quote lines enter 40ms apart, each one a real wrapped line
mark:        stagger ticks beside the lines, labeled "40ms"
eyebrow:     01 · Measured line stagger
caption:     The quote reads itself
why:         visitors finish the testimonial instead of skimming it
visibility:  5   (seen at 1× on a phone without a mark? 1 no, 5 obviously)
rarity:      4   (would a typical template have it? 1 always, 5 almost never)
truth:       pass
critic:      pass
```

## 4. Choose

1. Drop every card that fails truth or the critic.
2. Rank by visibility × rarity.
3. Keep at most one point per family, top down, until the count for the length is met (`types/showcase.md`, Count by length).
4. If a strong point needs 0.25× to be seen, its visibility is scored at 0.25× with a mark, and it goes after a point that reads at 1×.
5. Write the do-not-claim list beside the plan.

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
