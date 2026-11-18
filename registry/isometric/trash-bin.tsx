"use client";

import type { CSSProperties } from "react";

import { EASE, Rig, project, sample, useRigged } from "./iso-core";
import type { IsoPose, IsoTrack, Vec3 } from "./iso-core";
import { LineState, facing, onClock, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An all-clear state told by one object, in line: a round can whose lid
 * lifts to show there is nothing in it. A fine outline, near-white faces,
 * the lid's knob the one brand mark, seen from the front and a little
 * above, no shadow. Under it, the state's own words: a heading and a
 * line. Each value is ms after the art comes into view.
 *
 *    0ms   the bin stands shut
 *  400ms   the lid pops up off the bin (280ms)
 *  540ms   it tips to one side, 14° (300ms); the empty bin shows under it
 *  840ms   it hangs there (320ms)
 * 1160ms   it levels (220ms) and, from 1300ms, drops back
 * 1490ms   it lands, bounces once, a tenth as high, and sits
 * 1650ms   still: shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true (or with `loop`, after a 5.2s hold).
 * Reduced motion, or `active` false before any play: the bin shut,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true the lid lifts this soon.
  again: 80,
  // The drop back onto the bin.
  drop: 190,
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

// The first run waits a moment after coming into view; a play asked for by
// `active` does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/** The lid: lifted off the bin and tipped about the middle of its underside. */
const lidPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    offset: [0, 0, r2(sample(clip.lift, ms))],
    rotate: r2(sample(clip.tip, ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The bin's own outline, always joined round (the kit's LINE follows
// ink's miter joins), so its 72-point rings draw exactly as before.
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

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface TrashBinProps extends LineStateProps {
  /** Label of an optional button, up to about 20 characters. Empty by default: an empty bin needs no action. */
  actionLabel?: string;
}

/**
 * Trash bin: a complete empty-trash state ("Trash is empty") with a line
 * illustration, a heading and a line of copy, all props, and a button if
 * you give it a label. A round bin seen from the front and a little
 * above; its lid pops up, tips to one side to show there is nothing
 * inside, levels and drops back. One fine outline, near-white faces, no
 * shadow; the lid's knob carries the brand. It plays when it comes into
 * view, or each time `active` turns true (PlayOnHover, or your own
 * state). Follows the shadcn theme.
 */
export const TrashBin = ({
  heading = "Trash is empty",
  description = "Items you delete will show up here.",
  actionLabel = "",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: TrashBinProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  return (
    <LineState
      bounds={BOUNDS}
      buttonVariant="secondary"
      props={{
        actionLabel,
        description,
        heading,
        strokeWidth,
        tone,
        variant,
        ...rest,
      }}
      shell={shell}
      slot="trash-bin"
    >
      <Bin />
      <Rig pivot={[0, 0, BIN.h]} {...onClock(clock, lidPose(clip), clip.end)}>
        <Lid />
      </Rig>
    </LineState>
  );
};

export default TrashBin;
