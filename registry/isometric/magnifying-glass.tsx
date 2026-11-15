"use client";

import { useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  Extrude,
  Face,
  FacePath,
  IsoStage,
  Rig,
  roundedRect,
  sample,
  useClock,
} from "./iso-core";
import type { IsoPose, IsoTone, IsoTrack, IsoVariant, Vec3 } from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A nothing-found state told by one object, in line: a magnifying glass
 * that looks over a card of rows and comes to rest. Whatever is under the
 * glass shows enlarged. A fine outline, near-white faces, the collar of
 * the handle the one brand mark, facing the screen, no shadow. Under it,
 * the state's own words: a heading, a line, a button. Each value is ms
 * after it comes into view.
 *
 *    0ms   the glass rests over the left of the first row
 *  400ms   it sweeps along the first row (520ms)
 *  920ms   it comes back across and down to the second (440ms)
 * 1360ms   it sweeps out to the right of the third and stops (500ms)
 * 1860ms   still: the glass at the lower right, its handle off the card
 *
 * A click (or `loop`, after a 5.2s hold) takes the glass back to the
 * first row and looks again.
 * Reduced motion (or autoPlay off): the glass at rest, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click: how long the trip back to the first row takes.
  back: 380,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The search starts this long after the card comes into view.
  start: 400,
  // Milliseconds for each of the three sweeps.
  sweep: [520, 440, 500] as const,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The card: built facing +y, about a centre line at x = 0, and shown
// facing the screen.
const CARD = { depth: 0.3, h: 5.2, r: 0.7, w: 6.4, z: 1.5 };
const CARD_X = -CARD.w / 2;
const CARD_TOP = CARD.z + CARD.h;
const CARD_AT: Vec3 = [CARD_X, 0, CARD_TOP];

// The rows on it (u across, v down from its top edge): a square and two
// bars each, as a list of results is laid out.
const ROWS = [1.25, 2.6, 3.95] as const;
const THUMB = { r: 0.22, size: 0.9, u: 0.75 };
const BAR = { h: 0.2, u: 2.05 };
const BARS = [
  { dv: -0.21, len: 3.1 },
  { dv: 0.22, len: 2 },
] as const;

/** Everything drawn on the card, as rounded rectangles. */
interface Mark {
  h: number;
  rx: number;
  w: number;
  x: number;
  y: number;
}
const MARKS: Mark[] = ROWS.flatMap((v) => [
  {
    h: THUMB.size,
    rx: THUMB.r,
    w: THUMB.size,
    x: THUMB.u,
    y: v - THUMB.size / 2,
  },
  ...BARS.map(({ dv, len }) => ({
    h: BAR.h,
    rx: BAR.h / 2,
    w: len,
    x: BAR.u,
    y: v + dv - BAR.h / 2,
  })),
]);

// In the front view, one unit toward the viewer shows as 1/√3 of a unit
// down the page (see "The view").
const SINK = 1 / Math.sqrt(3);

// The glass: a ring held in front of the card (`y`), its outer radius,
// the width of its band and its thickness, and how much what is under it
// is enlarged.
const GLASS = { band: 0.3, depth: 0.35, r: 1.45, y: 0.55, zoom: 1.5 };
const HOLE = GLASS.r - GLASS.band;
// How far up the page the back of the ring shows above its front.
const RISE = GLASS.depth * SINK;

// The handle, built pointing along +x from the ring and turned down to
// the right: a collar where it meets the ring, then the grip.
const HANDLE = {
  angle: 45,
  collar: { len: 0.6, w: 0.84 },
  depth: 0.3,
  grip: { len: 2, w: 0.62 },
  tuck: 0.12,
};
const HANDLE_Y = GLASS.y - (GLASS.depth - HANDLE.depth) / 2;

type P2 = readonly [number, number];

// Where the glass looks, as the place its middle shows on the card (u, v):
// the left of the first row, its right, the left of the second, and its
// resting place at the lower right. The ring never leaves the card; only
// the handle does.
const REST: P2 = [4.3, 3.35];
const STOPS: readonly P2[] = [[1.9, 1.95], [4.4, 1.95], [2.2, 3.2], REST];

/**
 * The ring's middle in the world, for the place it shows on the card. It
 * hangs in front of the card, and a point nearer the viewer shows lower
 * on the page, so it is raised by that much to show where it should.
 */
const glassAt = ([u, v]: P2): Vec3 => [
  CARD_X + u,
  GLASS.y,
  CARD_TOP - v + GLASS.y * SINK,
];

/* ───────────────────────────── The view ───────────────────────────────── */

/**
 * Facing the screen. The object is built facing +y, which the isometric
 * camera sees at an angle. The whole of it is turned 45° about the
 * vertical, so its front points straight at the viewer and its edges run
 * level and plumb; and it is stretched √(3/2) in height, because that
 * camera looks down from 35.26° and foreshortens heights by exactly that
 * much, so the front keeps its true proportions. It is still one exact
 * parallel projection of a solid: its thickness shows along its top edges.
 */
const FRONT = { stretch: Math.sqrt(1.5), turn: -45 };
const VIEW_POSE: IsoPose = {
  axis: "z",
  rotate: FRONT.turn,
  scale: [1, 1, FRONT.stretch],
};

/** Where a point of the object lands once it faces the screen. */
const facing = ([x, y, z]: Vec3): Vec3 => [
  (x + y) * Math.SQRT1_2,
  (y - x) * Math.SQRT1_2,
  z * FRONT.stretch,
];

// The frame is centred on the card, the mass the eye lines up with the
// heading under it: as wide as the card, from the foot of the resting
// handle to the card's top. The handle overhangs on the right; that runs
// into the stage's padding, which is not clipped.
const HANDLE_REACH =
  (GLASS.r + HANDLE.collar.len + HANDLE.grip.len + HANDLE.grip.w / 2) *
  Math.SQRT1_2;
const FOOT = CARD_TOP - REST[1] - HANDLE_REACH;
const EXTENT: Vec3[] = [
  [CARD_X, 0, FOOT],
  [-CARD_X, 0, FOOT],
  [CARD_X, -CARD.depth, CARD_TOP],
  [-CARD_X, -CARD.depth, CARD_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: where the glass looks, and when it is at rest. */
interface Clip {
  end: number;
  u: IsoTrack;
  v: IsoTrack;
}

// The beat itself, starting `t0` ms into a run: three sweeps from stop to
// stop, each easing away and easing in.
const beat = (t0: number): Clip => {
  let t = t0;
  const times = [
    t0,
    ...TIMING.sweep.map((ms) => {
      t += ms;
      return t;
    }),
  ];
  const track = (i: 0 | 1): IsoTrack =>
    STOPS.map((stop, n) => [times[n], stop[i], EASE.easy] as const);
  return { end: t, u: track(0), v: track(1) };
};

// The first run: the glass waits over the first row, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: the glass goes back to
// the first row, then the beat again.
const NEXT = beat(TIMING.back);
const AGAIN: Clip = {
  ...NEXT,
  u: [[0, REST[0], EASE.easy], ...NEXT.u],
  v: [[0, REST[1], EASE.easy], ...NEXT.v],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

// A quarter circle as a cubic: the handle length for a unit radius.
const ARC = 0.5523;

/** A circle of radius `r` about (cx, cy), as a path. */
const circle = (cx: number, cy: number, r: number) => {
  const k = r * ARC;
  const p = (x: number, y: number) => `${r2(cx + x)} ${r2(cy + y)}`;
  return [
    `M${p(0, -r)}`,
    `C${p(k, -r)} ${p(r, -k)} ${p(r, 0)}`,
    `C${p(r, k)} ${p(k, r)} ${p(0, r)}`,
    `C${p(-k, r)} ${p(-r, k)} ${p(-r, 0)}`,
    `C${p(-r, -k)} ${p(-k, -r)} ${p(0, -r)}`,
    "Z",
  ].join(" ");
};

// The ring's outline in its own box (the box's corner at the origin): the
// outer circle and the hole.
const RING_HOLE = circle(GLASS.r, GLASS.r, HOLE);
const RING = `${circle(GLASS.r, GLASS.r, GLASS.r)} ${RING_HOLE}`;

const MARK_FILL = { fill: "var(--iso-ink)", opacity: 0.16 };

const Marks = ({ marks }: { marks: readonly Mark[] }) => (
  <g {...MARK_FILL}>
    {marks.map((mark) => (
      <rect
        height={r2(mark.h)}
        key={`${mark.x},${mark.y}`}
        rx={r2(mark.rx)}
        width={r2(mark.w)}
        x={r2(mark.x)}
        y={r2(mark.y)}
      />
    ))}
  </g>
);

/** The card and the rows on it. */
const Card = () => (
  <>
    <Extrude
      at={CARD_AT}
      convex
      d={roundedRect(CARD.w, CARD.h, CARD.r)}
      depth={CARD.depth}
      palette="surface"
      plane="left"
    />
    <Face at={CARD_AT} plane="left">
      <Marks marks={MARKS} />
    </Face>
  </>
);

/**
 * What shows through the glass, drawn on the card where the glass is: a
 * clear disc, and on it the card's rows enlarged about the middle of the
 * opening. A viewer above a thick ring sees through the part of its hole
 * that the back of the ring leaves open, which is the hole a little
 * higher up the page; the ring, drawn after this, covers the rest.
 */
const Lens = ({ at: [u, v] }: { at: P2 }) => {
  const id = `lens-${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
  const cv = v - RISE;
  const mid = v - RISE / 2;
  const grow = (n: number, about: number) => about + (n - about) * GLASS.zoom;
  const enlarged = MARKS.map((mark) => ({
    h: mark.h * GLASS.zoom,
    rx: mark.rx * GLASS.zoom,
    w: mark.w * GLASS.zoom,
    x: grow(mark.x, u),
    y: grow(mark.y, mid),
  }));
  return (
    <Face at={CARD_AT} plane="left">
      <clipPath id={id}>
        <circle cx={u} cy={r2(cv)} r={HOLE} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <circle cx={u} cy={r2(cv)} fill="var(--iso-surface-top-c)" r={HOLE} />
        <Marks marks={enlarged} />
      </g>
    </Face>
  );
};

/**
 * The handle: the grip, then the collar, the one brand mark. Written from
 * the far end in: turned down to the right, each part's top edge hides
 * behind the next one up.
 */
const Handle = ({ centre: [x, , z] }: { centre: Vec3 }) => {
  const { collar, grip, tuck } = HANDLE;
  const gripFrom = GLASS.r + collar.len - tuck;
  const len = grip.len + tuck;
  const half = grip.w / 2;
  return (
    <>
      <Extrude
        at={[x + gripFrom, HANDLE_Y, z + half]}
        convex
        d={`M0 0 H${r2(len - half)} Q${len} 0 ${len} ${half} Q${len} ${grip.w} ${r2(len - half)} ${grip.w} H0 Z`}
        depth={HANDLE.depth}
        palette="surface"
        plane="left"
      />
      <Extrude
        at={[x + GLASS.r - tuck, HANDLE_Y, z + collar.w / 2]}
        convex
        d={roundedRect(collar.len + tuck, collar.w, 0.14)}
        depth={HANDLE.depth}
        palette="main"
        plane="left"
      />
    </>
  );
};

/**
 * The ring. Its hole makes it more than a convex outline, so after the
 * extrusion the hole is drawn again on the back plane and the front face
 * is painted once more over it: what is left showing is the near inside
 * wall of the ring, edged, as it looks from above.
 */
const Ring = ({ centre: [x, , z] }: { centre: Vec3 }) => {
  const at: Vec3 = [x - GLASS.r, GLASS.y, z + GLASS.r];
  return (
    <>
      <Extrude
        at={at}
        convex
        d={RING}
        depth={GLASS.depth}
        fillRule="evenodd"
        palette="surface"
        plane="left"
      />
      <FacePath
        at={[at[0], GLASS.y - GLASS.depth, at[2]]}
        d={RING_HOLE}
        plane="left"
        style={LINE}
      />
      <FacePath
        at={at}
        d={RING}
        fillRule="evenodd"
        plane="left"
        style={{ ...LINE, fill: "var(--iso-surface-left)" }}
      />
    </>
  );
};

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** Where the glass looks, re-rendered only when it changes. */
const useLook = (clock: MotionValue<number> | undefined, clip: Clip): P2 => {
  const idle = useMotionValue(0);
  const read = (ms: number): P2 => [
    r2(sample(clip.u, ms)),
    r2(sample(clip.v, ms)),
  ];
  const [value, setValue] = useState<P2>(() => read(0));
  const last = useRef(value.join(","));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next.join(",") !== last.current) {
      last.current = next.join(",");
      setValue(next);
    }
  });
  return clock ? value : REST;
};

/* ───────────────────────────── Shell ──────────────────────────────────── */

// Whether the visitor asked for less motion. It is read through a store
// and not in the first render: the server cannot know it, so the first
// render in the browser has to answer "no" as the server did, and switch
// once the page has taken over. Reading it straight away makes the two
// disagree, and React reports a failed hydration.
const REDUCE = "(prefers-reduced-motion: reduce)";
const watchReduce = (notify: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const useReduced = () =>
  useSyncExternalStore(
    watchReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false
  );

/** In view, reduced motion, the clock and its clip, and the replay. */
const useShell = ({
  autoPlay,
  loop,
  replayOnClick,
}: {
  autoPlay: boolean;
  loop: boolean;
  replayOnClick: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReduced();
  const still = reduced || !autoPlay;
  // Run 0 is the intro; every run after it starts from the glass at rest.
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const clip = run === 0 ? INTRO : AGAIN;
  // One new run per finished run, however many frames or clicks ask.
  const asked = useRef(-1);
  const again = () => {
    if (asked.current !== run) {
      asked.current = run;
      setRun((n) => n + 1);
    }
  };
  useMotionValueEvent(clock, "change", (ms) => {
    if (loop && !still && ms >= clip.end + TIMING.hold) {
      again();
    }
  });
  const canReplay = replayOnClick && !still;
  const replay = () => {
    if (canReplay && clock.get() >= clip.end) {
      again();
    }
  };
  return { canReplay, clip, clock: still ? undefined : clock, ref, replay };
};

// In ink the walls step down half as far as the house ramp (0.03 and 0.07
// under the top, not 0.06 and 0.13): a blocked state is a quiet line
// drawing on the page, with only a whisper of form.
const PAPER: Record<string, string> = {
  "--iso-surface-left-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.03) c h)",
  "--iso-surface-right-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.07) c h)",
};

// The blueprint (`line`) drawn at this size: its outline held at the same
// pixel weight as ink instead of a canvas-unit one, which would be three
// times too heavy on a stage this small. Faces stay the page's colour.
const BLUEPRINT: Record<string, string> = {
  "--iso-edge-w": "calc(var(--iso-stroke-width) * 4.33px)",
  "--iso-vector": "non-scaling-stroke",
};

// The engine's rim highlight has no width in the outlined variants, yet it
// still paints a pale hairline over the front outline of every extrusion
// (seen at 4× in Chromium). Clear its colour so the outline keeps its
// full weight.
const NO_RIM: Record<string, string> = {
  "--iso-accent-rim": "transparent",
  "--iso-main-rim": "transparent",
  "--iso-surface-rim": "transparent",
};

/**
 * Stage overrides: no hairline contour (every edge already carries the
 * outline), the paper walls in ink, the pixel outline in the blueprint,
 * and the outline on the side edges of rounded parts.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* ───────────────────────────── Copy ───────────────────────────────────── */

// Optical padding: an icon carries its own white space, so the label's
// side gets 2px more than the icon's side (12px and 14px) or the label
// looks pushed against the edge. The second class wins over a Button that
// already nudges this side itself.
const BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/** The cross on the button. */
const ClearIcon = () => (
  <svg
    aria-hidden="true"
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * The state's own words, under the card: the heading, a line of copy, and
 * the actions (the built-in button, or whatever is passed in).
 */
const Copy = ({
  heading,
  description,
  actionLabel,
  onAction,
  children,
}: {
  heading: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  children?: ReactNode;
}) => {
  const button = actionLabel ? (
    <Button className={BUTTON} onClick={onAction}>
      <ClearIcon />
      {actionLabel}
    </Button>
  ) : null;
  const actions = children ?? button;
  return (
    <>
      {heading ? (
        <p className="mt-3 text-xl font-medium tracking-tight text-foreground">
          {heading}
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-balance text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="mt-6">{actions}</div> : null}
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface MagnifyingGlassProps {
  /** Heading under the card, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the collar of the glass's handle; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The glass looks over the rows when the card scrolls into view. Off shows it at rest and nothing moving. */
  autoPlay?: boolean;
  /** Look again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the card sends the glass over the rows again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the drawing is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-56`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Magnifying glass: a complete no-results state ("No results found")
 * with a line illustration, a heading, a line of copy and a button, all
 * props. A card of three placeholder rows and a magnifying glass that
 * sweeps along the first, back across the second and out to the right of
 * the third, where it rests; the rows under the glass show enlarged. One
 * fine outline, near-white faces, no shadow, facing the screen; the
 * handle's collar carries the brand, like the button under it. Click the
 * card to look again. Follows the shadcn theme.
 */
export const MagnifyingGlass = ({
  heading = "No results found",
  description = "Try a different search, or clear your filters to see everything.",
  actionLabel = "Clear filters",
  onAction,
  children,
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  autoPlay = true,
  loop = false,
  replayOnClick = true,
  title,
  artClassName,
  className,
}: MagnifyingGlassProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const look = useLook(clock, clip);
  const centre = glassAt(look);
  const art = (
    <IsoStage
      bounds={BOUNDS}
      shadow={false}
      strokeWidth={strokeWidth}
      style={stageStyle(variant)}
      title={title}
      tone={tone}
      variant={variant}
    >
      {/* Everything stands in one rig that turns it to face the screen. */}
      <Rig pivot={[0, 0, 0]} {...VIEW_POSE}>
        <Card />
        <Lens at={look} />
        <Rig axis="y" pivot={centre} rotate={HANDLE.angle}>
          <Handle centre={centre} />
        </Rig>
        <Ring centre={centre} />
      </Rig>
    </IsoStage>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="magnifying-glass"
    >
      <div
        className={cn("w-56 max-w-full", artClassName)}
        data-slot="magnifying-glass-art"
        ref={ref}
      >
        {canReplay ? (
          <button
            aria-label={`${title ?? "Illustration"}. Press to play it again.`}
            className="block w-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={replay}
            type="button"
          >
            {art}
          </button>
        ) : (
          art
        )}
      </div>
      <Copy
        actionLabel={actionLabel}
        description={description}
        heading={heading}
        onAction={onAction}
      >
        {children}
      </Copy>
    </div>
  );
};

export default MagnifyingGlass;
