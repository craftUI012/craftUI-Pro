/* ─────────────────────────────────────────────────────────
 * SURFACES: shadows for elevation, never a 1px ring or border.
 *
 *   lift    soft depth (light); in dark the surface colour lifts it
 *   button  outline buttons: a small contact shadow, no ring
 *
 * A transparent 1px border sits under each, so forced-colors mode (which
 * drops box-shadow) still draws an edge.
 * ───────────────────────────────────────────────────────── */

export const LIFT =
  "border border-transparent shadow-[0_1px_2px_0_oklch(0_0_0/0.05),0_2px_8px_-2px_oklch(0_0_0/0.08),0_8px_24px_-8px_oklch(0_0_0/0.08)] dark:shadow-none";

export const RING_BUTTON =
  "border border-transparent shadow-[0_1px_2px_0_oklch(0_0_0/0.1),0_1px_3px_0_oklch(0_0_0/0.06)] hover:shadow-[0_1px_2px_0_oklch(0_0_0/0.12),0_2px_6px_-1px_oklch(0_0_0/0.1)] dark:border-transparent dark:shadow-none dark:hover:shadow-none";
