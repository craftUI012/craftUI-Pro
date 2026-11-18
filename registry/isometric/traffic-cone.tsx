"use client";

import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";

import { EASE, Rig, Slab, project, sample, useRigged } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import { LineState, facing, onClock, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A blocked state told by one object, in line: a traffic cone on its
 * square foot, knocked and rocking back to rest. A fine outline,
 * near-white faces, the cone's one band the brand mark, facing the
 * screen, no shadow. Under it, the state's own words: a heading, a line,
 * a button. Each value is ms after the art comes into view.
 *
 *    0ms   the cone stands still
 *  400ms   it is knocked: it tips onto its right edge, 9° (230ms)
 *  630ms   it falls back (240ms) and carries over onto its left edge
 *  870ms   4.2° the other way, and back; each swing smaller and quicker
 * 1360ms   1.8° right, 0.6° left
 * 1470ms   still: upright, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true (or with `loop`, after a 5.2s hold).
 * Reduced motion, or `active` false before any play: the cone upright,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true the knock lands this soon.
  again: 80,
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

// The first run waits a moment after coming into view; a play asked for by
// `active` does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

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

// The cone's own outline, always joined round (the kit's LINE follows
// ink's miter joins), so its 72-point rings draw exactly as before.
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

/* ───────────────────────────── Copy ───────────────────────────────────── */

// The button is built here, not by LineState: its arrow turns round in
// right-to-left layouts, which the kit's icon does not. Same classes as
// the kit's button. Optical padding: an icon carries its own white space,
// so the label's side gets 2px more than the icon's (12px and 14px).
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

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type TrafficConeProps = LineStateProps;

/**
 * Traffic cone: a complete page-not-found state ("Page not found") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * cone on its square foot, seen from the front and a little above; it is
 * knocked, rocks from one edge of its foot to the other, each swing
 * smaller, and stands still. One fine outline, near-white faces, no
 * shadow; the cone's band carries the brand, like the button under it.
 * It plays when it comes into view, or each time `active` turns true
 * (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const TrafficCone = ({
  heading = "Page not found",
  description = "The page you are looking for was moved, renamed or never existed.",
  actionLabel = "Back to home",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: TrafficConeProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const back = actionLabel ? (
    <Button className={BUTTON} onClick={rest.onAction}>
      <BackIcon />
      {actionLabel}
    </Button>
  ) : null;
  return (
    <LineState
      bounds={BOUNDS}
      props={{
        actionLabel,
        description,
        heading,
        strokeWidth,
        tone,
        variant,
        ...rest,
        children: rest.children ?? back,
      }}
      shell={shell}
      slot="traffic-cone"
    >
      {/* Two leans, one about each edge of the foot; only one is ever off zero. */}
      <Rig
        pivot={[-HALF, 0, 0]}
        {...onClock(clock, leanPose(clip.left, -1), clip.end)}
      >
        <Rig
          pivot={[HALF, 0, 0]}
          {...onClock(clock, leanPose(clip.right, 1), clip.end)}
        >
          <Slab
            at={[-HALF, -HALF, 0]}
            palette="surface"
            radius={PLATE.r}
            size={[PLATE.w, PLATE.w, PLATE.h]}
          />
          <Cone />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default TrafficCone;
