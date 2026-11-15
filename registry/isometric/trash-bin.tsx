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
  project,
  sample,
  useClock,
  useRigged,
} from "./iso-core";
import type { IsoPose, IsoTone, IsoTrack, IsoVariant, Vec3 } from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An all-clear state told by one object, in line: a round can whose lid
 * lifts to show there is nothing in it. A fine outline, near-white faces,
 * the lid's knob the one brand mark, seen from the front and a little
 * above, no shadow. Under it, the state's own words: a heading and a
 * line. Each value is ms after it comes into view.
 *
 *    0ms   the bin stands shut
 *  400ms   the lid pops up off the bin (280ms)
 *  540ms   it tips to one side, 14° (300ms); the empty bin shows under it
 *  840ms   it hangs there (320ms)
 * 1160ms   it levels (220ms) and, from 1300ms, drops back
 * 1490ms   it lands, bounces once, a tenth as high, and sits
 * 1650ms   still: shut, exactly as it started
 *
 * A click (or `loop`, after a 5.2s hold) lifts the lid again.
 * Reduced motion (or autoPlay off): the bin shut, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click the lid lifts this soon.
  again: 80,
  // The drop back onto the bin.
  drop: 190,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The lid levels again in this long.
  level: 220,
  // The lid pops up in this long.
  lift: 280,
  // How long the tipped lid hangs over the open bin.
  peek: 320,
  // The lid lifts this long after the bin comes into view.
  start: 400,
  // The lid tips in this long, starting half way through the lift.
  tip: 300,
};

/* The lid's moves. */
const MOVE = {
  // World units the lid rises off the bin.
  lift: 0.95,
  // Degrees it tips to one side while it is up.
  tip: -14,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The bin: a round can, a little wider at its mouth than at its foot,
// standing on the origin. Radii at the foot and the mouth, its height,
// and how far in from each end the band round it runs.
const BIN = { band: 0.45, foot: 1.95, h: 4.5, mouth: 2.3 };

// The lid: a flat disc a little wider than the mouth, with a raised
// middle, as a metal can's lid has.
const LID = { h: 0.3, r: 2.55 };
const LID_TOP = BIN.h + LID.h;
const CROWN = { h: 0.22, r: 1.7 };
const CROWN_TOP = LID_TOP + CROWN.h;

// The knob on the lid.
const KNOB = { h: 0.34, r: 0.55 };
const KNOB_TOP = CROWN_TOP + KNOB.h;

// The ribs pressed into the can's side, between the two bands: where
// round it each one runs, in degrees (90 faces the viewer), and how far
// short of each band it stops.
const RIBS = { at: [38, 64, 90, 116, 142] as const, inset: 0.3 };

// Points round each ring. A ring is a circle in a level plane, so on the
// page it is an exact ellipse; 72 points draw it smooth at this size.
const ROUND = 72;

/** The points of a level circle of radius `r` at height `z`, about the bin's axis. */
const ring = (r: number, z: number): Vec3[] =>
  Array.from({ length: ROUND }, (_, i): Vec3 => {
    const a = (2 * Math.PI * i) / ROUND;
    return [r * Math.cos(a), r * Math.sin(a), z];
  });

/** The bin's radius at a height. */
const binRadius = (z: number) =>
  BIN.foot + ((BIN.mouth - BIN.foot) * z) / BIN.h;

/* ───────────────────────────── The view ───────────────────────────────── */

/**
 * Facing the screen. The whole object is turned 45° about the vertical
 * and stretched √(3/2) in height, because the isometric camera looks down
 * from 35.26° and foreshortens heights by exactly that much. The result
 * is the bin seen from the front and 30° above: one exact parallel
 * projection of a solid.
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

// The frame fits the bin shut: as wide as the lid, from the front of the
// foot to the back of the knob. The lifted lid rises above that; it runs
// into the stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [-LID.r, BIN.foot, 0],
  [LID.r, BIN.foot, 0],
  [-LID.r, -KNOB.r, KNOB_TOP],
  [LID.r, -KNOB.r, KNOB_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: the lid's rise and tip, and when it is at rest. */
interface Clip {
  end: number;
  lift: IsoTrack;
  tip: IsoTrack;
}

// The beat itself, starting `t0` ms into a run.
const beat = (t0: number): Clip => {
  const up = t0 + TIMING.lift;
  const tipped = t0 + TIMING.lift / 2 + TIMING.tip;
  const level = tipped + TIMING.peek;
  const fall = level + TIMING.level - 80;
  const down = fall + TIMING.drop;
  return {
    end: down + 160,
    lift: [
      [t0, 0, EASE.soft],
      [up, MOVE.lift, "hold"],
      [fall, MOVE.lift, EASE.in],
      [down, 0, EASE.drop],
      [down + 80, MOVE.lift * 0.1, EASE.in],
      [down + 160, 0],
    ],
    tip: [
      [t0 + TIMING.lift / 2, 0, EASE.easy],
      [tipped, MOVE.tip, "hold"],
      [level, MOVE.tip, EASE.easy],
      [level + TIMING.level, 0],
    ],
  };
};

// The first run waits a moment after coming into view; a click does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The lid: lifted off the bin and tipped about the middle of its underside. */
const lidPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    offset: [0, 0, r2(sample(clip.lift, ms))],
    rotate: r2(sample(clip.tip, ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinecap: "round",
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

// What each part is painted with: walls take the front value, level faces
// the top one, the inside of the bin the darker wall value, and the knob
// the brand.
const WALL = "var(--iso-surface-left)";
const LEVEL = "var(--iso-surface-top)";
const INSIDE = "var(--iso-surface-right)";
const BRAND_WALL = "var(--iso-main-left)";
const BRAND_LEVEL = "var(--iso-main-top)";

interface Part {
  d: string;
  fill: string;
  key: string;
}

/**
 * Slices of a round solid, drawn from real rings. A slice between two
 * level circles is convex, so its outline on the page is the convex hull
 * of its two rings, wherever a rig has put them; a level face is its ring
 * itself. Painted from the foot up, each slice covers the far half of the
 * ring it stands on, which leaves exactly the edges a viewer sees.
 */
const useSlices = () => {
  const rigged = useRigged();
  const flat = (points: readonly Vec3[]) =>
    points.map((p) => project(rigged(p)));
  return {
    edge: (a: Vec3, b: Vec3) =>
      `M${project(rigged(a)).join(",")} L${project(rigged(b)).join(",")}`,
    face: (points: readonly Vec3[]) => closed(flat(points)),
    wall: (a: readonly Vec3[], b: readonly Vec3[]) =>
      closed(hull([...flat(a), ...flat(b)])),
  };
};

const Parts = ({ parts }: { parts: readonly Part[] }) => (
  <>
    {parts.map(({ d, fill, key }) => (
      <path d={d} key={key} style={{ ...LINE, fill }} />
    ))}
  </>
);

/**
 * The bin: its side in three slices, so the edge between two slices draws
 * a band round it near the foot and near the mouth; the open mouth (the
 * far inside wall is all a viewer sees of the inside from here: the bin
 * is deeper than the view reaches); and the ribs down the side that faces
 * the viewer.
 */
const Bin = () => {
  const { edge, face, wall } = useSlices();
  const ribs = RIBS.at
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const at = (z: number): Vec3 => [
        binRadius(z) * Math.cos(a),
        binRadius(z) * Math.sin(a),
        z,
      ];
      const from = BIN.band + RIBS.inset;
      return edge(at(from), at(BIN.h - from));
    })
    .join(" ");
  const levels = [0, BIN.band, BIN.h - BIN.band, BIN.h];
  const side = levels.slice(1).map((z, i) => ({
    d: wall(ring(binRadius(levels[i]), levels[i]), ring(binRadius(z), z)),
    fill: WALL,
    key: `side-${z}`,
  }));
  return (
    <>
      <Parts
        parts={[
          ...side,
          { d: face(ring(BIN.mouth, BIN.h)), fill: INSIDE, key: "mouth" },
        ]}
      />
      <path d={ribs} style={LINE} />
    </>
  );
};

/** The lid and its knob, the one brand mark. */
const Lid = () => {
  const { face, wall } = useSlices();
  return (
    <Parts
      parts={[
        {
          d: wall(ring(LID.r, BIN.h), ring(LID.r, LID_TOP)),
          fill: WALL,
          key: "lid",
        },
        { d: face(ring(LID.r, LID_TOP)), fill: LEVEL, key: "lid-top" },
        {
          d: wall(ring(CROWN.r, LID_TOP), ring(CROWN.r, CROWN_TOP)),
          fill: WALL,
          key: "crown",
        },
        { d: face(ring(CROWN.r, CROWN_TOP)), fill: LEVEL, key: "crown-top" },
        {
          d: wall(ring(KNOB.r, CROWN_TOP), ring(KNOB.r, KNOB_TOP)),
          fill: BRAND_WALL,
          key: "knob",
        },
        { d: face(ring(KNOB.r, KNOB_TOP)), fill: BRAND_LEVEL, key: "knob-top" },
      ]}
    />
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

/**
 * The state's own words, under the bin: the heading, a line of copy, and
 * the actions (a button when it is given a label, or whatever is passed
 * in). An empty bin asks nothing of anyone, so by default there is no
 * button.
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
    <Button className="rounded-full" onClick={onAction} variant="secondary">
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

export interface TrashBinProps {
  /** Heading under the bin, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of an optional button, up to about 20 characters. Empty by default: an empty bin needs no action. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the lid's knob; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The lid lifts to show the empty bin when it scrolls into view. Off shows the bin shut and nothing moving. */
  autoPlay?: boolean;
  /** Lift the lid again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the bin lifts the lid again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the bin is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-48`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Trash bin: a complete empty-trash state ("Trash is empty") with a line
 * illustration, a heading and a line of copy, all props, and a button if
 * you give it a label. A round bin seen from the front and a little
 * above; its lid pops up, tips to one side to show there is nothing
 * inside, levels and drops back. One fine outline, near-white faces, no
 * shadow; the lid's knob carries the brand. Click the bin to lift the lid
 * again. Follows the shadcn theme.
 */
export const TrashBin = ({
  heading = "Trash is empty",
  description = "Items you delete will show up here.",
  actionLabel = "",
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
}: TrashBinProps) => {
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
        <Bin />
        <Rig pivot={[0, 0, BIN.h]} {...rigged(clock, lidPose(clip))}>
          <Lid />
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
      data-slot="trash-bin"
    >
      <div
        className={cn("w-48 max-w-full", artClassName)}
        data-slot="trash-bin-art"
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

export default TrashBin;
