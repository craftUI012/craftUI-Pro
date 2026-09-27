import { SHOWCASE_BLOCKS } from "@/components/hero-blocks/blocks-data";
import COMPONENT_FEATURES from "@/components/hero-UI-components/component-features.json";

// Items in the components strip, in order. Each is one primitive from
// components/ui shown at real size; `name` must match the labels in the
// blocks section's `uses` lists, which is how "Used in" is worked out.
// `tokens` are the globals.css variables the component actually reads
// (checked against its classes), minus the `--` prefix; the Tokens overlay
// shows their live values, and `color` ones get a swatch.
export const STRIP_COMPONENTS = [
  {
    description: "Primary and secondary actions",
    id: "button",
    name: "Button",
    tokens: [
      { color: true, name: "primary" },
      { color: true, name: "primary-foreground" },
      { name: "button-primary-shadow" },
      { name: "button-secondary-shadow" },
      { name: "radius" },
    ],
  },
  {
    description: "Single-line text entry",
    id: "input",
    name: "Input",
    tokens: [
      { color: true, name: "input" },
      { color: true, name: "ring" },
      { color: true, name: "muted-foreground" },
      { name: "radius" },
      { name: "card-label-md" },
      { name: "card-label-weight" },
    ],
  },
  {
    description: "Pick one option from a list",
    id: "select",
    name: "Select",
    tokens: [
      { color: true, name: "input" },
      { color: true, name: "ring" },
      { color: true, name: "muted-foreground" },
      { name: "radius" },
      { name: "card-label-md" },
      { name: "card-label-weight" },
    ],
  },
  {
    description: "Turn a setting on or off",
    id: "switch",
    name: "Switch",
    tokens: [
      { color: true, name: "primary" },
      { color: true, name: "input" },
      { color: true, name: "background" },
      { color: true, name: "ring" },
      { name: "card-label-md" },
      { name: "card-label-weight" },
    ],
  },
  {
    description: "Set a value along a range",
    id: "slider",
    name: "Slider",
    tokens: [
      { color: true, name: "primary" },
      { color: true, name: "muted" },
      { color: true, name: "ring" },
      { name: "card-label-md" },
      { name: "card-label-weight" },
    ],
  },
  {
    description: "Switch between related views",
    id: "toggle-group",
    name: "Toggle group",
    tokens: [
      { color: true, name: "accent" },
      { color: true, name: "accent-foreground" },
      { name: "surface-border" },
      { name: "radius" },
    ],
  },
  {
    description: "Choose any number of options",
    id: "checkbox",
    name: "Checkbox",
    tokens: [
      { color: true, name: "primary" },
      { color: true, name: "primary-foreground" },
      { color: true, name: "input" },
      { color: true, name: "ring" },
      { name: "card-label-md" },
      { name: "card-label-weight" },
    ],
  },
  {
    description: "Choose exactly one option",
    id: "radio-group",
    name: "Radio group",
    tokens: [
      { color: true, name: "primary" },
      { color: true, name: "input" },
      { color: true, name: "ring" },
      { name: "card-label-md" },
      { name: "card-label-weight" },
    ],
  },
  {
    description: "Show how far along a goal is",
    id: "progress",
    name: "Progress",
    tokens: [
      { color: true, name: "primary" },
      { color: true, name: "muted-foreground" },
      { name: "card-label-md" },
      { name: "card-label-weight" },
    ],
  },
  {
    description: "Compare values over time",
    id: "bar-chart",
    name: "Bar chart",
    tokens: [
      { color: true, name: "chart-2" },
      { color: true, name: "muted-foreground" },
    ],
  },
] as const;

export type StripComponent = (typeof STRIP_COMPONENTS)[number];

// Titles of the showcase blocks that use a component, from the blocks
// section's own data, so the two sections can't disagree.
export const usedInBlocks = (name: string) =>
  SHOWCASE_BLOCKS.filter((block) =>
    (block.uses as readonly string[]).includes(name)
  ).map((block) => block.title);

// Key features for a component's panel (at most 3), from
// component-features.json. Each is checked against the component's source;
// when the real components ship as registry items, this moves to each item's
// `meta.features` in registry.json.
export const featuresFor = (id: string): string[] =>
  (COMPONENT_FEATURES as Record<string, string[]>)[id]?.slice(0, 3) ?? [];

// Tile sizes (rem). Every tile keeps one height, so from sm up opening one
// never changes the row's height: an open tile grows sideways to show its
// details panel. Phones stack the panel under it instead (strip-tile.tsx).
export const STRIP_SIZES = {
  collapsed: { height: 15, width: 14 },
  // Capped to the screen on phones (see strip-tile.tsx).
  expandedWidth: 32,
  // Real width of the component inside a tile.
  pieceWidth: 12,
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
  // Expand / collapse (drives each tile's open progress), and sliding the row.
  spring: { bounce: 0, duration: 0.45, type: "spring" },
  // Wheel/trackpad overscroll resistance past either end.
  wheelResistance: 0.3,
  // Settle back after the wheel goes quiet (ms).
  wheelSettleMs: 120,
} as const;

/* ─────────────────────────────────────────────────────────
 * OPEN STORYBOARD — one spring drives each tile's progress p (0 → 1,
 * STRIP_MOTION.spring); everything below is mapped from p, so closing
 * mid-open reverses from wherever it is.
 *
 *  p 0   → 1    tile width grows (layout; neighbours slide)
 *  p 0   → 1    component scale .98 → 1           easeInOutSine
 *  p .35 → 1    panel fades in, x 8px → 0         easeOutSine / easeOutCubic
 *  p .5  → 1    panel rows rise in, one after another (step .12)  easeOutSine
 * ───────────────────────────────────────────────────────── */
export const STRIP_OPEN = {
  // Panel opacity and slide share this range of p.
  panel: [0.35, 1],
  // How far the panel slides in from (px).
  panelShift: 8,
  // Component scale when closed (scales to 1 when open).
  pieceScale: 0.98,
  // Row i fades over [start + i * step, 1], rising rowShift px.
  rowShift: 4,
  rows: { start: 0.5, step: 0.12 },
} as const;
