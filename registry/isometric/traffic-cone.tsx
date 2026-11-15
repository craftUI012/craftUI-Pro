"use client";

import { useInView, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  IsoStage,
  Rig,
  Slab,
  project,
  sample,
  useClock,
  useRigged,
} from "./iso-core";
import type {
  IsoKey,
  IsoPose,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A blocked state told by one object, in line: a traffic cone on its
 * square foot, knocked and rocking back to rest. A fine outline,
 * near-white faces, the cone's one band the brand mark, facing the
 * screen, no shadow. Under it, the state's own words: a heading, a line,
 * a button. Each value is ms after it comes into view.
 *
 *    0ms   the cone stands still
 *  400ms   it is knocked: it tips onto its right edge, 9° (230ms)
 *  630ms   it falls back (240ms) and carries over onto its left edge
 *  870ms   4.2° the other way, and back; each swing smaller and quicker
 * 1360ms   1.8° right, 0.6° left
 * 1470ms   still: upright, exactly as it started
 *
 * A click (or `loop`, after a 5.2s hold) knocks it again.
 * Reduced motion (or autoPlay off): the cone upright, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click the knock lands this soon.
  again: 80,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The knock lands this long after the cone comes into view.
  start: 400,
};

// The rocking: each swing tips the cone onto one edge of its foot and lets
// it fall back, the next one onto the other edge. Degrees, and the ms up
// and down; the first tips it to the right.
const SWINGS = [
  { deg: 9, down: 240, up: 230 },
  { deg: 4.2, down: 150, up: 140 },
  { deg: 1.8, down: 110, up: 90 },
  { deg: 0.6, down: 60, up: 50 },
] as const;

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The foot: a square plate with rounded corners, centred on the origin.
const PLATE = { h: 0.3, r: 0.7, w: 5.6 };
const HALF = PLATE.w / 2;

// The collar where the cone meets the plate: a low ring, a little wider at
// its foot than at its top.
const COLLAR = { h: 0.3, r0: 2.25, r1: 2.12 };
const COLLAR_TOP = PLATE.h + COLLAR.h;

// The cone itself, from the collar up: its radius at the foot and at the
// cut-off top, its height, and where along that height the band sits.
const CONE = { band: [0.37, 0.59] as const, foot: 1.72, h: 5.3, top: 0.48 };
const CONE_TOP = COLLAR_TOP + CONE.h;

// Points round each ring of the cone. A ring is a circle in a level plane,
// so on the page it is an exact ellipse; 72 points draw it smooth at this
// size.
const ROUND = 72;

/** The points of a level circle of radius `r` at height `z`, about the cone's axis. */
const ring = (r: number, z: number): Vec3[] =>
  Array.from({ length: ROUND }, (_, i): Vec3 => {
    const a = (2 * Math.PI * i) / ROUND;
    return [r * Math.cos(a), r * Math.sin(a), z];
  });

/** The cone's ring a share `t` of the way up it. */
const coneRing = (t: number) =>
  ring(CONE.foot + (CONE.top - CONE.foot) * t, COLLAR_TOP + CONE.h * t);

/* ───────────────────────────── The view ───────────────────────────────── */

/**
 * Facing the screen. The isometric camera sees a square foot corner on;
 * the whole object is turned 45° about the vertical, so the foot's front
 * edge runs level across the page, and it is stretched √(3/2) in height,
 * because that camera looks down from 35.26° and foreshortens heights by
 * exactly that much. The result is the cone seen from the front and 30°
 * above: one exact parallel projection of a solid.
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

// The frame fits the cone at rest: the plate's width, from its front edge
// to the back of the cone's top. Rocking lifts one edge; that runs into
// the stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [-HALF, HALF, 0],
  [HALF, HALF, 0],
  [-HALF, -CONE.top, CONE_TOP],
  [HALF, -CONE.top, CONE_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: the lean onto each edge in degrees, and when it is at rest. */
interface Clip {
  end: number;
  left: IsoTrack;
  right: IsoTrack;
}

// The beat itself, starting `t0` ms into a run. A swing rises fast and
// slows to its top, then falls faster and faster, as a tipped thing does;
// the two edges take turns, so neither lean ever goes below zero and the
// foot never passes through the floor.
const beat = (t0: number): Clip => {
  const left: IsoKey[] = [];
  const right: IsoKey[] = [];
  let t = t0;
  for (const [i, swing] of SWINGS.entries()) {
    const track = i % 2 === 0 ? right : left;
    track.push(
      [t, 0, EASE.drop],
      [t + swing.up, swing.deg, EASE.in],
      [t + swing.up + swing.down, 0, "hold"]
    );
    t += swing.up + swing.down;
  }
  return { end: t, left, right };
};

// The first run waits a moment after coming into view; a click does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A lean about one edge of the foot. Turning about the depth axis by a
 * positive angle drops whatever is to the right of the pivot, so the left
 * edge takes the negative turn (the right side lifts) and the right edge
 * the positive one.
 */
const leanPose =
  (track: IsoTrack, sign: -1 | 1) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sign * sample(track, ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "round",
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

type P2 = readonly [number, number];

// Andrew's monotone chain: the convex hull of points on the page.
const cross = (o: P2, a: P2, b: P2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const hull = (points: readonly P2[]): P2[] => {
  const sorted = points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: readonly P2[]) => {
    const out: P2[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        cross(out.at(-2) as P2, out.at(-1) as P2, p) <= 0
      ) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half(sorted.toReversed())];
};

const closed = (points: readonly P2[]) =>
  `M${points.map(([x, y]) => `${x},${y}`).join(" L")} Z`;

// What each part of the cone is painted with: walls take the front value,
// level faces the top one, and the band the brand.
const WALL = "var(--iso-surface-left)";
const LEVEL = "var(--iso-surface-top)";
const BRAND = "var(--iso-main-left)";

/**
 * The cone and its collar, drawn from real rings. Every part is a slice
 * of a round solid between two level circles; a slice is convex, so its
 * outline on the page is the convex hull of its two rings, wherever the
 * rocking has put them. Painted from the foot up, each slice covers the
 * far half of the ring it stands on, which leaves exactly the edges a
 * viewer sees: the near half of every ring, the two sides, and the whole
 * of the cut-off top.
 */
const Cone = () => {
  const rigged = useRigged();
  const flat = (points: readonly Vec3[]) =>
    points.map((p) => project(rigged(p)));
  const slice = (a: readonly Vec3[], b: readonly Vec3[]) =>
    closed(hull([...flat(a), ...flat(b)]));
  const [from, to] = CONE.band;
  const parts: { d: string; fill: string; key: string }[] = [
    {
      d: slice(ring(COLLAR.r0, PLATE.h), ring(COLLAR.r1, COLLAR_TOP)),
      fill: WALL,
      key: "collar",
    },
    {
      d: closed(flat(ring(COLLAR.r1, COLLAR_TOP))),
      fill: LEVEL,
      key: "collar-top",
    },
    { d: slice(coneRing(0), coneRing(from)), fill: WALL, key: "lower" },
    { d: slice(coneRing(from), coneRing(to)), fill: BRAND, key: "band" },
    { d: slice(coneRing(to), coneRing(1)), fill: WALL, key: "upper" },
    { d: closed(flat(coneRing(1))), fill: LEVEL, key: "top" },
  ];
  return (
    <>
      {parts.map(({ d, fill, key }) => (
        <path d={d} key={key} style={{ ...LINE, fill }} />
      ))}
    </>
  );
};

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** Rig props: animated on the clock, or the resting pose held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(INTRO.end));

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
  // Run 0 waits a moment after coming into view; later runs start at once.
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

/** The arrow on the button: it points back, so it turns round in right-to-left layouts. */
const BackIcon = () => (
  <svg
    aria-hidden="true"
    className="rtl:-scale-x-100"
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

/**
 * The state's own words, under the cone: the heading, a line of copy, and
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
      <BackIcon />
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

export interface TrafficConeProps {
  /** Heading under the cone, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the cone's band; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The cone is knocked and rocks to rest when it scrolls into view. Off shows it upright and nothing moving. */
  autoPlay?: boolean;
  /** Knock it again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the cone knocks it again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the cone is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-48`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Traffic cone: a complete page-not-found state ("Page not found") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * cone on its square foot, seen from the front and a little above; it is
 * knocked, rocks from one edge of its foot to the other, each swing
 * smaller, and stands still. One fine outline, near-white faces, no
 * shadow; the cone's band carries the brand, like the button under it.
 * Click the cone to knock it again. Follows the shadcn theme.
 */
export const TrafficCone = ({
  heading = "Page not found",
  description = "The page you are looking for was moved, renamed or never existed.",
  actionLabel = "Back to home",
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
}: TrafficConeProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
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
        {/* Two leans, one about each edge of the foot; only one is ever off zero. */}
        <Rig pivot={[-HALF, 0, 0]} {...rigged(clock, leanPose(clip.left, -1))}>
          <Rig pivot={[HALF, 0, 0]} {...rigged(clock, leanPose(clip.right, 1))}>
            <Slab
              at={[-HALF, -HALF, 0]}
              palette="surface"
              radius={PLATE.r}
              size={[PLATE.w, PLATE.w, PLATE.h]}
            />
            <Cone />
          </Rig>
        </Rig>
      </Rig>
    </IsoStage>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="traffic-cone"
    >
      <div
        className={cn("w-48 max-w-full", artClassName)}
        data-slot="traffic-cone-art"
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

export default TrafficCone;
