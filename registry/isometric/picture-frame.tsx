"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { useId, useState } from "react";

import { EASE, Extrude, FacePath, roundedRect, sample } from "./iso-core";
import type { IsoTrack, Vec3 } from "./iso-core";
import { LineState, facing, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object, in line: a picture frame hung on a
 * nail, holding the picture every empty image slot shows: two hills and
 * a sun. A fine outline, near-white faces, the sun the one brand mark,
 * facing the screen, no shadow. Under it, the state's own words: a
 * heading, a line, a button. Each value is ms after it comes into view.
 *
 *    0ms   two hills in the frame; the sun is down behind them
 *  400ms   the sun rises over the far hill (700ms), a little past its
 *          place
 * 1100ms   it eases back down to where it stays (200ms)
 * 1300ms   still: the sun up
 *
 * One way: the resting pose is the sun up. Each play after the first
 * (`active` turning true, or `loop` after a 5.2s hold) sets the sun
 * (300ms), waits a moment (120ms) and raises it again.
 * Reduced motion, or `active` false before any play: the sun up, nothing
 * moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The sun eases back to its place in this long.
  rest: 200,
  // The sun climbs in this long.
  rise: 700,
  // Before a replay: the sun sets in this long, then waits a moment.
  set: [300, 120] as const,
  // The sun starts to rise this long after the frame comes into view.
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The frame: built facing +y, about a centre line at x = 0, and shown
// facing the screen.
const FRAME = { depth: 0.4, h: 5, r: 0.5, w: 6.4, z: 0.9 };
const FRAME_X = -FRAME.w / 2;
const FRAME_TOP = FRAME.z + FRAME.h;
const FRAME_AT: Vec3 = [FRAME_X, 0, FRAME_TOP];

// The picture: set in from the frame's edge by the width of its moulding.
const MOULDING = 0.55;
const PICTURE = {
  h: FRAME.h - MOULDING * 2,
  r: 0.22,
  w: FRAME.w - MOULDING * 2,
};
const PICTURE_AT: Vec3 = [FRAME_X + MOULDING, 0, FRAME_TOP - MOULDING];
const PICTURE_PATH = roundedRect(PICTURE.w, PICTURE.h, PICTURE.r);

// What is in it (u across, v down from the picture's top edge): the far
// hill, the near hill in front of it, and the sun. The hills run past the
// picture's edges and are cut off by it.
const FAR_HILL = `M2.5 ${PICTURE.h} L3.85 2.6 Q4.1 2.38 4.35 2.6 L5.7 ${PICTURE.h} Z`;
const NEAR_HILL = `M-0.3 ${PICTURE.h} L1.75 1.85 Q2.05 1.55 2.35 1.85 L4.4 ${PICTURE.h} Z`;
// The sun: where across the picture it is, its height when up, and when
// down behind the far hill; how far past its place it climbs.
const SUN = { down: 3.5, over: 0.14, r: 0.52, u: 3.95, up: 1.15 };

// The wire it hangs by: from the back of the frame's top edge, either
// side of the middle, up to a nail.
const WIRE = { nail: 0.13, reach: 1.7, rise: 0.95 };
const NAIL_Z = FRAME_TOP + WIRE.rise;

/* ───────────────────────────── Frame ──────────────────────────────────── */

// The frame fits the picture frame and its nail.
const EXTENT: Vec3[] = [
  [FRAME_X, 0, FRAME.z],
  [-FRAME_X, 0, FRAME.z],
  [FRAME_X, -FRAME.depth, NAIL_Z + WIRE.nail],
  [-FRAME_X, -FRAME.depth, NAIL_Z + WIRE.nail],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: the sun's height in the picture, and when it is at rest. */
interface Clip {
  end: number;
  sun: IsoTrack;
}

// The beat itself, starting `t0` ms into a run.
const beat = (t0: number): Clip => {
  const top = t0 + TIMING.rise;
  return {
    end: top + TIMING.rest,
    sun: [
      [t0, SUN.down, EASE.drop],
      [top, SUN.up - SUN.over, EASE.easy],
      [top + TIMING.rest, SUN.up],
    ],
  };
};

// The first run: the sun down, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: the sun sets first.
const NEXT = beat(TIMING.set[0] + TIMING.set[1]);
const AGAIN: Clip = {
  ...NEXT,
  sun: [[0, SUN.up, EASE.in], [TIMING.set[0], SUN.down, "hold"], ...NEXT.sun],
};

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

/** The nail and the wire, behind the frame: drawn first, so the frame covers the wire's ends. */
const Wire = () => (
  <>
    <FacePath
      at={[0, -FRAME.depth, NAIL_Z]}
      d={`M${-WIRE.reach} ${WIRE.rise} L0 0 L${WIRE.reach} ${WIRE.rise}`}
      plane="left"
      style={LINE}
    />
    <FacePath
      at={[0, -FRAME.depth, NAIL_Z]}
      d={circle(0, 0, WIRE.nail)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-ink)" }}
    />
  </>
);

/**
 * The picture, cut to its rounded opening: paper, the sun, the far hill
 * and the near hill, written back to front so each hides the one behind
 * it. `sun` is the sun's height. The opening's outline goes on last, over
 * the cut ends of the hills.
 */
const Picture = ({ sun }: { sun: number }) => {
  const id = `picture-${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
  const hill: CSSProperties = { ...LINE, fill: "var(--iso-surface-left)" };
  return (
    <>
      <clipPath id={id}>
        <FacePath at={PICTURE_AT} d={PICTURE_PATH} plane="left" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <FacePath
          at={PICTURE_AT}
          d={PICTURE_PATH}
          plane="left"
          style={{ fill: "var(--iso-surface-top)", stroke: "none" }}
        />
        <FacePath
          at={PICTURE_AT}
          d={circle(SUN.u, sun, SUN.r)}
          plane="left"
          style={{ ...LINE, fill: "var(--iso-main-left)" }}
        />
        <FacePath at={PICTURE_AT} d={FAR_HILL} plane="left" style={hill} />
        <FacePath at={PICTURE_AT} d={NEAR_HILL} plane="left" style={hill} />
      </g>
      <FacePath at={PICTURE_AT} d={PICTURE_PATH} plane="left" style={LINE} />
    </>
  );
};

/* ───────────────────────────── Clock ──────────────────────────────────── */

/**
 * The sun's height, re-rendered only when it changes. Each clip starts from
 * its own first frame: held at rest nothing was drawn, so the first play
 * must not show a frame of a clip that never ran.
 */
const useSun = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const read = (ms: number) => r2(sample(clip.sun, ms));
  const [sun, setSun] = useState(() => ({ clip, value: read(0) }));
  if (sun.clip !== clip) {
    setSun({ clip, value: read(0) });
  }
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    setSun((prev) =>
      prev.clip === clip && prev.value === next ? prev : { clip, value: next }
    );
  });
  return clock ? sun.value : SUN.up;
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type PictureFrameProps = LineStateProps;

// The arrow on the button: up, for an upload.
const UPLOAD = "M12 19V5M6 11l6-6 6 6";

/**
 * Picture frame: a complete no-images state ("No images yet") with a line
 * illustration, a heading, a line of copy and a button, all props. A
 * frame hung on a nail, holding the picture an empty image slot always
 * shows: two hills, and a sun that rises over the far one and settles.
 * One fine outline, near-white faces, no shadow, facing the screen; the
 * sun carries the brand, like the button under it. It plays when it comes
 * into view; pass `active` (PlayOnHover, or your own state) to play it
 * each time `active` turns true. Follows the shadcn theme.
 */
export const PictureFrame = ({
  heading = "No images yet",
  description = "Upload your first image and it will show up here.",
  actionLabel = "Upload image",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: PictureFrameProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const sun = useSun(shell.clock, shell.clip);
  return (
    <LineState
      bounds={BOUNDS}
      defaultArtClassName="w-56"
      icon={UPLOAD}
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
      slot="picture-frame"
    >
      <Wire />
      <Extrude
        at={FRAME_AT}
        convex
        d={roundedRect(FRAME.w, FRAME.h, FRAME.r)}
        depth={FRAME.depth}
        palette="surface"
        plane="left"
      />
      <Picture sun={sun} />
    </LineState>
  );
};

export default PictureFrame;
