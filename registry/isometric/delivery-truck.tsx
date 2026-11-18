"use client";

import type { CSSProperties } from "react";

import {
  EASE,
  Extrude,
  Face,
  FacePath,
  Rig,
  roundedRect,
  sample,
} from "./iso-core";
import type { IsoPose, IsoTrack, Vec3 } from "./iso-core";
import { ICON, LineState, facing, onClock, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object, in line: a delivery truck with
 * nothing to deliver, seen from its side. A fine outline, near-white
 * faces, the label on its box the one brand mark, facing the screen, no
 * shadow. Under it, the state's own words: a heading, a line, a button.
 * Each value is ms after it comes into view.
 *
 *    0ms   the truck waits a little way back
 *  400ms   it rolls forward, wheels turning, and slows to a stop (700ms)
 *  960ms   braking tips its nose down 2° about the front wheel (160ms)
 * 1120ms   it rocks back past level, forward a touch, and sits
 * 1600ms   still: parked
 *
 * One way: the resting pose is the truck parked. Each play after the
 * first (`active` turning true, or `loop` after a 5.2s hold) backs it up
 * (420ms), waits a moment (140ms) and brings it forward again.
 * Reduced motion, or `active` false before any play: the truck parked,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // Before a replay: the truck backs up in this long, then waits a moment.
  back: [420, 140] as const,
  // The nose starts down this long before the truck stops.
  brake: 140,
  // The roll forward.
  roll: 700,
  // The truck sets off this long after it comes into view.
  start: 400,
};

/* How far things move. */
const MOVE = {
  // Degrees the nose dips on braking, and the two swings after it.
  pitch: [2, -0.8, 0.25] as const,
  // World units the truck waits back from where it parks.
  roll: -1.1,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The truck is built facing +y, its cab to the right, and shown facing
// the screen. Its wheels stand on the floor at this height.
const FLOOR = 0.5;

// The wheels: a tyre and a hub with one slot across it, so a turn shows.
// Each is a flat face a little in front of the body: front-on, a round
// solid this thin drew its tread as two lines a pixel apart.
const WHEEL = {
  at: [-1.9, 2.15] as const,
  hub: 0.3,
  r: 0.72,
  y: 0.16,
};
const AXLE = FLOOR + WHEEL.r;

// The deck: the rail's top edge, where the box and the cab stand.
const DECK = 1.6;
const DEPTH = 1;

// The box: where its left edge is, its size, and the label on its side
// (u across from its left edge, v down from its top).
const BOX = { h: 3.4, r: 0.35, w: 4.25, x: -3.44 };
const BOX_AT: Vec3 = [BOX.x, 0, DECK + BOX.h];
const LABEL = { h: 1, r: 0.14, u: 0.6, v: 0.62, w: 1.5 };

// The cab: a little way in front of the box, a block with a raked
// windscreen meeting its nose at a corner (a curve into the upright drew
// the top strip as a tapering double line), the window
// in its upper half, a door handle and a headlight.
const CAB = { h: 2.55, r: 0.3, w: 2.3, x: 1.09 };

// The chassis: one low rail under the box and the cab, its ends tucked
// behind the wheels, so the box's back and the cab's nose overhang it.
// (Ends at the box's back and the cab's nose crowded their rounded
// corners into a notch of short doubled lines.)
const RAIL = { h: 0.34, r: 0.12, w: 5, x: -2.5 };
const CAB_AT: Vec3 = [CAB.x, 0, DECK + CAB.h];
const CAB_PATH = [
  `M0 ${CAB.h}`,
  `V${CAB.r}`,
  `Q0 0 ${CAB.r} 0`,
  `H${CAB.w - 1.15}`,
  `Q${CAB.w - 0.5} 0 ${CAB.w - 0.28} 0.95`,
  `L${CAB.w} 1.65`,
  `V${CAB.h - CAB.r}`,
  `Q${CAB.w} ${CAB.h} ${CAB.w - CAB.r} ${CAB.h}`,
  "Z",
].join(" ");
const WINDOW_PATH = [
  "M0.5 0.42",
  `H${CAB.w - 1.2}`,
  `Q${CAB.w - 0.72} 0.42 ${CAB.w - 0.55} 1`,
  `L${CAB.w - 0.48} 1.28`,
  "H0.5",
  "Z",
].join(" ");

/* ───────────────────────────── Frame ──────────────────────────────────── */

// The frame fits the truck parked: from the floor to the top of its box.
// Waiting to roll in, it stands a little further left; that runs into the
// stage's padding, which is not clipped.
const NOSE = CAB.x + CAB.w;
const EXTENT: Vec3[] = [
  [BOX.x, WHEEL.y, FLOOR],
  [NOSE, WHEEL.y, FLOOR],
  [BOX.x, -DEPTH, DECK + BOX.h],
  [NOSE, -DEPTH, DECK + BOX.h],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: where the truck is, its pitch, and when it is at rest. */
interface Clip {
  end: number;
  // Degrees the body tips about the front wheel, nose down positive.
  pitch: IsoTrack;
  // World units along the road, 0 where it parks.
  roll: IsoTrack;
}

// The beat itself, starting `t0` ms into a run. The roll eases away and
// eases to a stop; the body's weight arrives a moment after the wheels
// have slowed, tips the nose down, and rocks itself level.
const beat = (t0: number): Clip => {
  const stop = t0 + TIMING.roll;
  const dip = stop - TIMING.brake;
  const [down, back, forth] = MOVE.pitch;
  return {
    end: dip + 640,
    pitch: [
      [dip, 0, EASE.easy],
      [dip + 160, down, EASE.easy],
      [dip + 360, back, EASE.easy],
      [dip + 520, forth, EASE.easy],
      [dip + 640, 0],
    ],
    roll: [
      [t0, MOVE.roll, EASE.easy],
      [stop, 0],
    ],
  };
};

// The first run: the truck waiting back, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: the truck backs up first.
const NEXT = beat(TIMING.back[0] + TIMING.back[1]);
const AGAIN: Clip = {
  ...NEXT,
  roll: [[0, 0, EASE.easy], [TIMING.back[0], MOVE.roll, "hold"], ...NEXT.roll],
};

/** The whole truck, along the road. */
const truckPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [r2(sample(clip.roll, ms)), 0, 0] });

/**
 * A wheel, turned by the road that has passed under it. About the depth
 * axis a positive turn is clockwise on the page, which is the way a wheel
 * turns when the truck rolls to the right.
 */
const wheelPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    // Counted from where it parks, so the slot rests exactly upright.
    rotate: Math.round(((sample(clip.roll, ms) / WHEEL.r) * 180) / Math.PI),
  });

/** The body, tipped about the front wheel. */
const bodyPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.pitch, ms)),
  });

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

const GLASS_FILL = "var(--iso-surface-top)";

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

/** The rail everything stands on. Written first: its top edge hides behind the box and the cab. */
const Rail = () => (
  <Extrude
    at={[RAIL.x, 0, DECK]}
    convex
    d={roundedRect(RAIL.w, RAIL.h, RAIL.r)}
    depth={DEPTH}
    palette="surface"
    plane="left"
  />
);

/** The box, and the label on its side: the one brand mark. */
const Cargo = () => (
  <>
    <Extrude
      at={BOX_AT}
      convex
      d={roundedRect(BOX.w, BOX.h, BOX.r)}
      depth={DEPTH}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={BOX_AT}
      d={roundedRect(LABEL.w, LABEL.h, LABEL.r, LABEL.u, LABEL.v)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-main-left)" }}
    />
    <Face at={BOX_AT} plane="left">
      <g fill="var(--iso-on-main)" opacity={0.85}>
        <rect
          height={0.13}
          rx={0.065}
          width={0.88}
          x={LABEL.u + 0.28}
          y={LABEL.v + 0.28}
        />
        <rect
          height={0.13}
          rx={0.065}
          width={0.56}
          x={LABEL.u + 0.28}
          y={LABEL.v + 0.58}
        />
      </g>
    </Face>
  </>
);

/** The cab: its window, a door handle and a headlight. */
const Cab = () => (
  <>
    <Extrude
      at={CAB_AT}
      convex
      d={CAB_PATH}
      depth={DEPTH}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={CAB_AT}
      d={WINDOW_PATH}
      plane="left"
      style={{ ...LINE, fill: GLASS_FILL }}
    />
    <Face at={CAB_AT} plane="left">
      <g fill="var(--iso-ink)" opacity={0.3}>
        <rect height={0.12} rx={0.06} width={0.42} x={0.55} y={1.62} />
        <rect height={0.34} rx={0.08} width={0.18} x={CAB.w - 0.3} y={1.9} />
      </g>
    </Face>
  </>
);

/** One wheel, about its axle at `x`: the tyre, the hub, and the slot across the hub. */
const Wheel = ({ x }: { x: number }) => {
  const at: Vec3 = [x - WHEEL.r, WHEEL.y, AXLE + WHEEL.r];
  return (
    <>
      <FacePath
        at={at}
        d={circle(WHEEL.r, WHEEL.r, WHEEL.r)}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-surface-left)" }}
      />
      <FacePath
        at={at}
        d={circle(WHEEL.r, WHEEL.r, WHEEL.hub)}
        plane="left"
        style={{ ...LINE, fill: GLASS_FILL }}
      />
      <FacePath
        at={at}
        d={`M${WHEEL.r} ${r2(WHEEL.r - WHEEL.hub * 0.45)} V${r2(WHEEL.r + WHEEL.hub * 0.45)}`}
        plane="left"
        strokeLinecap="round"
        style={LINE}
      />
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type DeliveryTruckProps = LineStateProps;

/**
 * Delivery truck: a complete no-orders state ("No orders yet") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * delivery truck seen from its side; it rolls forward, wheels turning,
 * brakes with its nose dipping, rocks level and sits parked. One fine
 * outline, near-white faces, no shadow, facing the screen; the label on
 * its box carries the brand, like the button under it. It plays when it
 * comes into view; pass `active` (PlayOnHover, or your own state) to play
 * it each time `active` turns true. Follows the shadcn theme.
 */
export const DeliveryTruck = ({
  heading = "No orders yet",
  description = "When someone places an order, it will show up here.",
  actionLabel = "Create order",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: DeliveryTruckProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const [rear, front] = WHEEL.at;
  return (
    <LineState
      bounds={BOUNDS}
      defaultArtClassName="w-56"
      icon={ICON.plus}
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
      slot="delivery-truck"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, truckPose(clip), INTRO.end)}>
        <Rig
          pivot={[front, 0, AXLE]}
          {...onClock(clock, bodyPose(clip), INTRO.end)}
        >
          <Rail />
          <Cargo />
          <Cab />
        </Rig>
        {[rear, front].map((x) => (
          <Rig
            key={x}
            pivot={[x, 0, AXLE]}
            {...onClock(clock, wheelPose(clip), INTRO.end)}
          >
            <Wheel x={x} />
          </Rig>
        ))}
      </Rig>
    </LineState>
  );
};

export default DeliveryTruck;
