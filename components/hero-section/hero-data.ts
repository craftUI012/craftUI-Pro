// Columns in the wall grid — used to place each tile in the reveal wave.
export const HERO_WALL_COLUMNS = 6;

// How many diagonals from the copy until a tile reaches full colour
// (see --hero-media-* tokens and `hero-media-tone` in globals.css).
export const HERO_DEPTH_SPAN = 5;

// Diagonal distance of a tile from the top-left corner, where the copy sits.
export const heroTileDiagonal = (index: number) =>
  (index % HERO_WALL_COLUMNS) + Math.floor(index / HERO_WALL_COLUMNS);

// Kit cards shown live on the wall, in grid order (6 columns × 3 rows), with
// the building blocks each one is made of — shown on hover, since the card
// already shows its own title. IDs come from the Design Admin kit
// (FINANCE_CARDS / APP_CARDS). The first diagonals sit behind the copy, so the
// most striking cards go further out.
export const HERO_CARDS_META = [
  { id: "savings-targets", uses: "Progress" },
  { id: "invite-team", uses: "Input · Select" },
  { id: "traffic-channels", uses: "Bar chart" },
  { id: "kitchen-island", uses: "Switch · Slider" },
  { id: "upcoming-payments", uses: "Calendar" },
  { id: "browser-share", uses: "Pie chart" },
  { id: "notifications", uses: "Checkbox" },
  { id: "transfer-funds", uses: "Form" },
  { id: "contribution-history", uses: "Bar chart" },
  { id: "sleep-report", uses: "Stacked bar chart" },
  { id: "recent-transactions", uses: "List" },
  { id: "goal-progress", uses: "Radial chart" },
  { id: "receiving-method", uses: "Radio group" },
  { id: "book-appointment", uses: "Toggle group" },
  { id: "power-usage", uses: "Bar chart · Progress" },
  { id: "visitors", uses: "Area chart" },
  { id: "holdings", uses: "Search · Toggle group" },
  { id: "analytics", uses: "Area chart" },
] as const;

// Class on the scene-2 reveal wrappers; HeroCopy's <noscript> fallback keeps
// them visible when JS never runs. Lives here (not in the client module) so the
// server component gets the string, not a client reference.
export const HERO_REVEAL_CLASS = "hero-reveal";

// Scene timing, in seconds.
export const HERO_TIMING = {
  // Scene 1 preview: the wall fades up to this opacity while the headline
  // holds — a hint of what's coming, not the reveal itself.
  ghostDuration: 0.6,
  ghostOpacity: 0.12,
  // Copy move from centre to top-left.
  morph: 1,
  // Subcopy + buttons rise in once the headline is underway, one after the
  // other.
  revealStagger: 0.08,
  revealStart: 0.45,
  // Scene 2 starts this long after navigation (not after hydration), so the
  // move begins at the same moment on every device — once the heading has
  // had time to be read.
  sceneStartAt: 0.9,
  // Each tile's own fade + settle.
  tileDuration: 0.8,
  // Tiles reveal one diagonal at a time, spreading out from the copy…
  tilesStagger: 0.07,
  // …starting once the copy is past its fastest point.
  tilesStart: 0.5,
  // Upper bound on waiting for the wall chunk before switching anyway.
  wallTimeout: 1.5,
} as const;

// Easing, from the animation guidelines: on-screen movement eases in and out;
// things entering ease out.
export const HERO_EASE = {
  // ease-out-quint — tiles entering.
  enter: [0.23, 1, 0.32, 1],
  // ease-in-out-cubic — the copy moving across the stage.
  move: [0.645, 0.045, 0.355, 1],
} as const;
