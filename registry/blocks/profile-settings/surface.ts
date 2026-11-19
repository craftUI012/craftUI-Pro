/* ─────────────────────────────────────────────────────────
 * SURFACES: shadows for elevation, not borders.
 *
 *   lift    surfaces: soft depth only, no ring (light); card colour (dark)
 *   ring    form fields only: a faint 1px ring so a field can be found
 *   float   the save bar: the same ring with a deeper lift, it hovers
 *   photo   an inset ring and a soft inner shadow, so the photo's edge
 *           reads crisply on any page colour (pure black / white, never
 *           a tint, which would fringe the image)
 *
 * Every ring keeps a transparent 1px border underneath: forced-colors
 * mode drops box-shadow and paints that border instead, and the box stays
 * the size the border gave it. Error and focus borders still colour it.
 * No dividers anywhere: rows are grouped by space, and a list is a stack
 * of ringed cards (CARD), 8px apart, so every edge is a shadow, never a
 * rule.
 * ───────────────────────────────────────────────────────── */

// Surfaces (cards, panels, frames): depth only, NO 1px ring. A ring reads
// as a border, and the user wants no lines. Light: three soft layers
// (contact, lift, ambient). Dark: depth shadows vanish on dark, so the
// card colour (lighter than the page) lifts it instead: no shadow at all.
export const LIFT =
  "border border-transparent shadow-[0_1px_2px_0_oklch(0_0_0/0.05),0_2px_8px_-2px_oklch(0_0_0/0.08),0_8px_24px_-8px_oklch(0_0_0/0.08)] dark:shadow-none";

// Form fields (inputs, textareas, checkboxes, radios, code boxes) keep a
// faint 1px ring: a field needs a visible boundary to be found.
export const RING =
  "border border-transparent shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_1px_2px_-1px_oklch(0_0_0/0.06),0_2px_4px_0_oklch(0_0_0/0.04)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1)]";

export const FLOAT =
  "border border-transparent shadow-[0_2px_4px_-1px_oklch(0_0_0/0.06),0_8px_16px_-4px_oklch(0_0_0/0.1),0_16px_32px_-8px_oklch(0_0_0/0.14)] dark:shadow-[0_12px_24px_-4px_oklch(0_0_0/0.5)]";

export const PHOTO_INSET =
  "pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_oklch(0_0_0/0.1),inset_0_1px_3px_oklch(0_0_0/0.12)] dark:shadow-[inset_0_0_0_1px_oklch(1_0_0/0.1),inset_0_1px_3px_oklch(0_0_0/0.4)]";

// A list row: its own lifted card on the card colour.
export const CARD = `${LIFT} bg-card rounded-lg`;

// Outline buttons: a small contact shadow, no ring (light); in dark the
// outline variant's own fill (bg-input/30) shapes it. shadcn's outline
// border is cleared in both themes.
export const RING_BUTTON =
  "border border-transparent shadow-[0_1px_2px_0_oklch(0_0_0/0.1),0_1px_3px_0_oklch(0_0_0/0.06)] hover:shadow-[0_1px_2px_0_oklch(0_0_0/0.12),0_2px_6px_-1px_oklch(0_0_0/0.1)] dark:border-transparent dark:shadow-none dark:hover:shadow-none";
