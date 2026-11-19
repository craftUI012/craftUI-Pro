/* ─────────────────────────────────────────────────────────
 * SURFACES: shadows for elevation, not borders.
 *
 *   ring    light: a 1px ring, a little lift, soft depth (three layers)
 *           dark:  one white ring (depth shadows vanish on dark)
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

export const RING =
  "border border-transparent shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_1px_2px_-1px_oklch(0_0_0/0.06),0_2px_4px_0_oklch(0_0_0/0.04)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1)]";

// Hover for pressable rings (outline buttons): one step stronger.
export const RING_HOVER =
  "hover:shadow-[0_0_0_1px_oklch(0_0_0/0.1),0_1px_2px_-1px_oklch(0_0_0/0.08),0_2px_4px_0_oklch(0_0_0/0.06)] dark:hover:shadow-[0_0_0_1px_oklch(1_0_0/0.15)]";

export const FLOAT =
  "border border-transparent shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_4px_8px_-2px_oklch(0_0_0/0.08),0_12px_24px_-4px_oklch(0_0_0/0.12)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1),0_12px_24px_-4px_oklch(0_0_0/0.5)]";

export const PHOTO_INSET =
  "pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_oklch(0_0_0/0.1),inset_0_1px_3px_oklch(0_0_0/0.12)] dark:shadow-[inset_0_0_0_1px_oklch(1_0_0/0.1),inset_0_1px_3px_oklch(0_0_0/0.4)]";

// A list row: its own ringed card on the card colour (in dark mode the
// card colour, not a shadow, is what lifts it off the page).
export const CARD = `${RING} bg-card rounded-lg`;

// Outline buttons: the ring and its hover. shadcn's outline variant adds a
// dark-mode border, so it's cleared here too.
export const RING_BUTTON = `${RING} ${RING_HOVER} dark:border-transparent`;
