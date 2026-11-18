"use client";

import type { CSSProperties } from "react";

import {
  EASE,
  Extrude,
  FacePath,
  Rig,
  hop,
  press,
  roundedRect,
  sample,
  shiftTrack,
} from "./iso-core";
import type { IsoPose, IsoTrack, Vec3 } from "./iso-core";
import { LineState, facing, onClock, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object, in line: a paper shopping bag with
 * nothing in it, and a price tag on its handle. A fine outline,
 * near-white faces, the tag the one brand mark, facing the screen, no
 * shadow. Under it, the state's own words: a heading, a line, a button.
 * Each value is ms after it comes into view.
 *
 *    0ms   the bag stands still
 *  400ms   it hops: up half a unit (200ms) and back down
 *  780ms   it lands: the near handle is squashed and springs back, the
 *          far one 70ms behind it; the tag swings out on its string
 * 1500ms   still: the handles up, the tag hanging straight
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true (or `loop`, after a 5.2s hold).
 * Reduced motion, or `active` false before any play: the bag standing,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true the hop starts this soon.
  again: 80,
  // The far handle follows the near one this much later.
  lag: 70,
  // From take-off to landing (the hop preset's own timing).
  land: 380,
  // The hop starts this long after the bag comes into view.
  start: 400,
};

/* How far things move. */
const MOVE = {
  // World units the bag leaves the floor.
  hop: 0.5,
  // How far the handles are squashed on landing, as a share of their height.
  squash: 0.24,
  // Degrees the tag swings out on landing.
  swing: 13,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The bag: built facing +y, about a centre line at x = 0, and shown
// facing the screen. It is deep, so its open top shows as a wide strip.
const BAG = { depth: 1.1, fold: 0.55, h: 5.2, r: 0.3, w: 5, z: 0.6 };
const BAG_X = -BAG.w / 2;
const BAG_TOP = BAG.z + BAG.h;
const BAG_AT: Vec3 = [BAG_X, 0, BAG_TOP];

// A handle: a flat loop standing on the bag's top edge, one on the near
// side and one on the far side. `r` rounds its two top corners.
const HANDLE = { bar: 0.26, r: 0.75, rise: 1.6, w: 2.4 };

// The tag: on a string from the foot of the near handle, hanging in
// front of the bag.
const TAG = {
  h: 1.25,
  hole: 0.1,
  r: 0.14,
  shoulder: 0.42,
  string: 0.75,
  w: 0.9,
  y: 0.08,
};
const TAG_ANCHOR: Vec3 = [
  -HANDLE.w / 2 + HANDLE.bar / 2,
  TAG.y,
  BAG_TOP - 0.02,
];

/* ───────────────────────────── Frame ──────────────────────────────────── */

// The frame fits the bag at rest: as wide as the bag, from its foot to
// the top of the far handle. The hop lifts it a little; that runs into
// the stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [BAG_X, 0, BAG.z],
  [-BAG_X, 0, BAG.z],
  [BAG_X, -BAG.depth, BAG_TOP + HANDLE.rise],
  [-BAG_X, -BAG.depth, BAG_TOP + HANDLE.rise],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  end: number;
  far: IsoTrack;
  hop: IsoTrack;
  near: IsoTrack;
  tag: IsoTrack;
}

// The beat itself, starting `t0` ms into a run: the hop, then everything
// the landing sets off.
const beat = (t0: number): Clip => {
  const land = t0 + TIMING.land;
  const near = press(MOVE.squash, land);
  return {
    end: land + 720,
    far: shiftTrack(near, TIMING.lag),
    hop: hop(MOVE.hop, t0),
    near,
    // Thrown out by the landing, then swinging home, each swing smaller.
    tag: [
      [land, 0, EASE.drop],
      [land + 150, MOVE.swing, EASE.easy],
      [land + 320, -MOVE.swing * 0.6, EASE.easy],
      [land + 480, MOVE.swing * 0.3, EASE.easy],
      [land + 610, -MOVE.swing * 0.1, EASE.easy],
      [land + 720, 0],
    ],
  };
};

// The first run waits a moment after coming into view; a play asked for
// by `active` does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/** The whole bag, off the floor and back. */
const bagPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.hop, ms))] });

/** A handle, squashed toward the bag's top edge and sprung back. */
const handlePose =
  (track: IsoTrack) =>
  (ms: number): IsoPose => ({ scale: [1, 1, r2(sample(track, ms))] });

/** The tag, swinging on its string. */
const tagPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ axis: "y", rotate: r2(sample(clip.tag, ms)) });

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

const PAPER_FILL = "var(--iso-surface-left)";

// A handle's outline (u across from its left edge, v down from its top):
// up one leg, across the top and down the other, then back inside it.
const HANDLE_PATH = (() => {
  const { bar, r, rise, w } = HANDLE;
  const inner = Math.max(r - bar, 0.12);
  return [
    `M0 ${rise}`,
    `V${r}`,
    `Q0 0 ${r} 0`,
    `H${r2(w - r)}`,
    `Q${w} 0 ${w} ${r}`,
    `V${rise}`,
    `H${r2(w - bar)}`,
    `V${r2(bar + inner)}`,
    `Q${r2(w - bar)} ${bar} ${r2(w - bar - inner)} ${bar}`,
    `H${r2(bar + inner)}`,
    `Q${bar} ${bar} ${bar} ${r2(bar + inner)}`,
    `V${rise}`,
    "Z",
  ].join(" ");
})();

/** One handle, standing on the bag's top edge at depth `y`. Paper is a face, not a solid. */
const Handle = ({ y }: { y: number }) => (
  <FacePath
    at={[-HANDLE.w / 2, y, BAG_TOP + HANDLE.rise]}
    d={HANDLE_PATH}
    plane="left"
    style={{ ...LINE, fill: PAPER_FILL }}
  />
);

/** The bag: its open top shows as the strip along its top edge; one fold across the front. */
const Bag = () => (
  <>
    <Extrude
      at={BAG_AT}
      convex
      d={roundedRect(BAG.w, BAG.h, BAG.r)}
      depth={BAG.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={BAG_AT}
      d={`M0 ${BAG.fold} H${BAG.w}`}
      plane="left"
      style={LINE}
    />
  </>
);

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

// The tag's outline, its point at the origin: two shoulders, straight
// sides and a rounded foot.
const TAG_PATH = (() => {
  const { h, r, shoulder, w } = TAG;
  const half = w / 2;
  return [
    "M0 0",
    `L${half} ${shoulder}`,
    `V${r2(h - r)}`,
    `Q${half} ${h} ${r2(half - r)} ${h}`,
    `H${r2(r - half)}`,
    `Q${-half} ${h} ${-half} ${r2(h - r)}`,
    `V${shoulder}`,
    "Z",
  ].join(" ");
})();

/** The tag and its string: the one brand mark. */
const Tag = () => {
  const [x, y, z] = TAG_ANCHOR;
  const top: Vec3 = [x, y, z - TAG.string];
  return (
    <>
      <FacePath
        at={TAG_ANCHOR}
        d={`M0 0 V${TAG.string}`}
        plane="left"
        style={LINE}
      />
      <FacePath
        at={top}
        d={TAG_PATH}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-main-left)" }}
      />
      <FacePath
        at={top}
        d={circle(0, TAG.shoulder, TAG.hole)}
        plane="left"
        style={{ ...LINE, fill: PAPER_FILL }}
      />
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type ShoppingBagProps = LineStateProps;

/**
 * Shopping bag: a complete empty-cart state ("Your cart is empty") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * paper bag with nothing in it; it hops, and on landing its two handles
 * are squashed and spring back, one a beat after the other, while the
 * price tag swings on its string. One fine outline, near-white faces, no
 * shadow, facing the screen; the tag carries the brand, like the button
 * under it. It plays when it comes into view; pass `active` (PlayOnHover,
 * or your own state) to play it each time `active` turns true. Follows
 * the shadcn theme.
 */
export const ShoppingBag = ({
  heading = "Your cart is empty",
  description = "Add a few things and they will show up here.",
  actionLabel = "Browse products",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ShoppingBagProps) => {
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
      defaultArtClassName="w-44"
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
      slot="shopping-bag"
    >
      <Rig pivot={[0, 0, BAG.z]} {...onClock(clock, bagPose(clip), INTRO.end)}>
        {/* The far handle, the bag in front of it, then the near handle and the tag. */}
        <Rig
          pivot={[0, -BAG.depth, BAG_TOP]}
          {...onClock(clock, handlePose(clip.far), INTRO.end)}
        >
          <Handle y={-BAG.depth} />
        </Rig>
        <Bag />
        <Rig
          pivot={[0, 0, BAG_TOP]}
          {...onClock(clock, handlePose(clip.near), INTRO.end)}
        >
          <Handle y={0} />
        </Rig>
        <Rig pivot={TAG_ANCHOR} {...onClock(clock, tagPose(clip), INTRO.end)}>
          <Tag />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default ShoppingBag;
