// Items in the components strip, in order. `id` points at a kit card from the
// Design Admin kit (FINANCE_CARDS / APP_CARDS) as a placeholder until the real
// UI components land; `name` is the caption under the tile.
export const STRIP_COMPONENTS = [
  { id: "notifications", name: "Checkbox list" },
  { id: "receiving-method", name: "Radio cards" },
  { id: "book-appointment", name: "Time slot picker" },
  { id: "kitchen-island", name: "Sliders and switches" },
  { id: "invite-team", name: "Invite form" },
  { id: "savings-targets", name: "Progress targets" },
  { id: "browser-share", name: "Pie chart" },
  { id: "power-usage", name: "Bar chart" },
  { id: "account-access", name: "Sign-in form" },
  { id: "social-links", name: "Link inputs" },
] as const;

export type StripComponentId = (typeof STRIP_COMPONENTS)[number]["id"];

// Tile sizes (rem). Collapsed tiles show a scaled-down preview; an expanded
// tile shows the component at its real 22rem width.
export const STRIP_SIZES = {
  cardWidth: 22,
  collapsed: { height: 12, width: 14 },
  expanded: { height: 22, width: 24 },
  // Height the strip reserves: the tallest (expanded) tile plus its caption
  // and the minor gap between them, so opening a tile never pushes the page
  // below it down. Collapsed tiles sit at the bottom of this band.
  rowHeight: 22 + 0.75 + 1,
} as const;

// Motion settings for the strip, in one place.
export const STRIP_MOTION = {
  // How far past either end the strip stretches while dragged (0–1).
  dragElastic: 0.18,
  // Inertia after release: power sets the throw distance, timeConstant the
  // glide; the bounce values shape the spring back from an overshoot.
  dragTransition: {
    bounceDamping: 32,
    bounceStiffness: 320,
    power: 0.28,
    timeConstant: 320,
  },
  // Expand / collapse, and sliding a tile into view.
  spring: { bounce: 0, duration: 0.45, type: "spring" },
  // Wheel/trackpad overscroll resistance past either end.
  wheelResistance: 0.3,
  // Settle back after the wheel goes quiet (ms).
  wheelSettleMs: 120,
} as const;
