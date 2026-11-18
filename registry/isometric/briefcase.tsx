"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { useRef, useState } from "react";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
  Edge,
  ICON,
  LineState,
  faceFill,
  onClock,
  r2,
  useLineShell,
  viewBounds,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "No projects yet", told by one object in line: a briefcase, seen in
 * isometric, whose latches pop open, whose handle lifts as if to carry it,
 * and which snaps shut again with nothing to take. Use: empty state.
 * Move: two hinged pops, a lift, two snaps. Each value is ms after it
 * comes into view.
 *
 *    0ms   the briefcase stands shut, its latches down over the seam
 *  400ms   the left latch tips open about its foot, past 32° and back to
 *          24° (260ms)
 *  540ms   the right latch pops, 140ms behind
 *  760ms   the handle lifts half a unit out of its lugs (220ms), holds
 *          (200ms), drops back (140ms, speeding up), one tiny bounce
 * 1420ms   the left latch snaps shut (120ms); the right one 80ms behind
 * 1620ms   still: shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms when it comes into view,
 * 80ms each time `active` turns true.
 * Reduced motion, or `active` false before any play: the briefcase shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The handle lifts this long after the first latch starts.
  handle: 360,
  // How long the handle holds up.
  hold: 200,
  // The right latch follows the left by these.
  lagPop: 140,
  lagShut: 80,
  // The latches snap shut this long after the handle lands.
  shut: 80,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // World units the handle lifts out of its lugs.
  lift: 0.5,
  // Degrees a latch tips open, and how far it springs before it settles.
  open: 24,
  peak: 32,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Seen in isometric, standing on z = 0: 9 long along x, 3 deep along y,
// its front the +y face (down left on screen), an end the +x face.
// The lid's top corners round wider than the case's feet.
const CASE = { d: 3, foot: 0.5, h: 6, r: 1, w: 9 };
const CASE_X = -CASE.w / 2;
const FRONT_Y = CASE.d / 2;
// The seam where the lid meets the case runs round its sides here: the
// case and the lid are two solids, the case drawn first, so the seam is
// the one line where they meet.
const SEAM_Z = 4;

// The handle on top: two lug plates flat on the lid, two arms rising out
// of them and the grip across, as deep as each other.
const LUG = { d: 2, r: 0.5, w: 1.5, x: 2 };
const HANDLE = { arm: 0.5, d: 1, grip: 1, r: 0.5, reach: 1.25, w: 5.5 };
const GRIP_Z = CASE.h + HANDLE.reach;

// On the front: two latches over the seam (blocks standing half a unit
// proud, hinged at their back foot) and, between them on the lid, the
// name plate: the brand mark.
const LATCH = { d: 0.5, h: 1.5, r: 0.25, w: 1, x: 2.75, z: 3.25 };
const PLATE = { h: 0.5, w: 1.5, z: 5 };

// The frame fits the case at rest: its two ends, the low front corner's
// round, and the grip's top.
const k = CASE.foot * (1 - 2 / Math.sqrt(5));
const EXTENT: Vec3[] = [
  [CASE_X, FRONT_Y, CASE.h / 2],
  [-CASE_X, -FRONT_Y, CASE.h / 2],
  [-CASE_X - k, FRONT_Y, CASE.foot - CASE.foot / Math.sqrt(5)],
  [-HANDLE.w / 2 + HANDLE.r, -HANDLE.d / 2, GRIP_Z + HANDLE.grip],
];
const BOUNDS = viewBounds("isometric", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The handle's lift out of its lugs, world units. */
  lift: IsoTrack;
  /** Each latch's opening, degrees (never below 0). */
  latches: IsoTrack[];
}

const beat = (t0: number): Clip => {
  const up = t0 + TIMING.handle;
  const drop = up + 220 + TIMING.hold;
  const landed = drop + 140;
  const lift: IsoKey[] = [
    [up, 0, EASE.soft],
    [up + 220, MOVE.lift, "hold"],
    [drop, MOVE.lift, EASE.in],
    [landed, 0, EASE.drop],
    [landed + 60, 0.06, EASE.in],
    [landed + 120, 0],
  ];
  const shut = landed + 120 + TIMING.shut;
  const latches = [0, 1].map((i): IsoTrack => {
    const go = t0 + TIMING.lagPop * i;
    const snap = shut + TIMING.lagShut * i;
    return [
      [go, 0, EASE.soft],
      [go + 160, MOVE.peak, EASE.easy],
      [go + 260, MOVE.open, "hold"],
      [snap, MOVE.open, EASE.in],
      [snap + 120, 0],
    ];
  });
  return { end: shut + TIMING.lagShut + 120, latches, lift };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

// Tipping the top toward the viewer (+y) is a negative turn about x.
const latchPose =
  (clip: Clip, i: number) =>
  (ms: number): IsoPose => ({
    axis: "x",
    rotate: r2(-sample(clip.latches[i], ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// Where the near corner's line meets the line along the end wall's foot
// (the tangent to the foot's round, seen at 45° round it): 2 − √2 of its
// radius up.
const CORNER_FOOT = r2(CASE.foot * (2 - Math.SQRT2));

/** The case below the seam, in face units from its top-left corner. */
const lowerPath = (() => {
  const { foot: r, w } = CASE;
  const h = SEAM_Z;
  const q = r2(r * ARC);
  return [
    "M0 0",
    `H${w}`,
    `V${h - r}`,
    `C${w} ${h - r + q} ${w - r + q} ${h} ${w - r} ${h}`,
    `H${r}`,
    `C${r - q} ${h} 0 ${h - r + q} 0 ${h - r}`,
    "Z",
  ].join(" ");
})();

/** The lid above the seam, in face units from its top-left corner. */
const upperPath = (() => {
  const { r, w } = CASE;
  const h = CASE.h - SEAM_Z;
  const q = r2(r * ARC);
  return [
    `M${r} 0`,
    `H${w - r}`,
    `C${w - r + q} 0 ${w} ${r - q} ${w} ${r}`,
    `V${h}`,
    "H0",
    `V${r}`,
    `C0 ${r - q} ${r - q} 0 ${r} 0`,
    "Z",
  ].join(" ");
})();

/** The case and its lid, the name plate on the lid. */
const Body = () => (
  <>
    <Extrude
      at={[CASE_X, FRONT_Y, SEAM_Z]}
      convex
      d={lowerPath}
      depth={CASE.d}
      palette="surface"
      plane="left"
    />
    <Extrude
      at={[CASE_X, FRONT_Y, CASE.h]}
      convex
      d={upperPath}
      depth={CASE.d}
      palette="surface"
      plane="left"
    />
    {/* The near corner, case and lid as one line across the seam, run
        down to where the foot's round meets its tangent along the end. */}
    <Edge
      points={[
        [-CASE_X, FRONT_Y, CORNER_FOOT],
        [-CASE_X, FRONT_Y, CASE.h - CASE.r],
      ]}
    />
    <FacePath
      at={[-PLATE.w / 2, FRONT_Y, PLATE.z + PLATE.h]}
      d={roundedRect(PLATE.w, PLATE.h, PLATE.h / 2)}
      plane="left"
      style={faceFill("main", "left")}
    />
  </>
);

/** The lug plates, flat on the lid. */
const Lugs = () => (
  <>
    {[-LUG.x, LUG.x].map((x) => (
      <FacePath
        at={[x - LUG.w / 2, -LUG.d / 2, CASE.h]}
        d={roundedRect(LUG.w, LUG.d, LUG.r)}
        key={x}
        plane="top"
        style={faceFill("surface", "top")}
      />
    ))}
  </>
);

/**
 * The handle, `lift` out of its lugs: the arms run from the lugs' tops to
 * the grip, so lifting makes them longer (they slide out of the lid, they
 * don't float over it), then the grip across them.
 */
const Handle = ({ lift }: { lift: number }) => {
  const grip = r2(GRIP_Z + lift);
  const arm = r2(grip - CASE.h);
  return (
    <>
      {[-LUG.x, LUG.x].map((x) => (
        <Extrude
          at={[x - HANDLE.arm / 2, HANDLE.d / 2, grip]}
          convex
          d={`M0 0 H${HANDLE.arm} V${arm} H0 Z`}
          depth={HANDLE.d}
          key={x}
          palette="surface"
          plane="left"
        />
      ))}
      <Extrude
        at={[-HANDLE.w / 2, HANDLE.d / 2, r2(grip + HANDLE.grip)]}
        convex
        d={roundedRect(HANDLE.w, HANDLE.grip, HANDLE.r)}
        depth={HANDLE.d}
        palette="surface"
        plane="left"
      />
    </>
  );
};

/** A latch: a block over the seam, hinged at its back foot. */
const Latch = ({ x }: { x: number }) => (
  <Extrude
    at={[x - LATCH.w / 2, FRONT_Y + LATCH.d, LATCH.z + LATCH.h]}
    convex
    d={roundedRect(LATCH.w, LATCH.h, LATCH.r)}
    depth={LATCH.d}
    palette="surface"
    plane="left"
  />
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** How far the handle is lifted, re-rendered only when it changes. */
const useLift = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const [value, setValue] = useState(0);
  const last = useRef(0);
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = r2(sample(clip.lift, ms));
    if (next !== last.current) {
      last.current = next;
      setValue(next);
    }
  });
  return clock ? value : 0;
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type BriefcaseProps = LineStateProps;

/**
 * Briefcase: a complete "no projects yet" state with a line illustration,
 * a heading, a line of copy and a button. A briefcase seen in isometric,
 * its lid seam running round its sides: its two latches pop open one
 * after the other, the handle lifts out of its lugs and drops back, and
 * the latches snap shut. One fine outline, paper faces, the name plate on
 * the lid the one brand mark, no shadow. Plays when it comes into view,
 * or each time `active` turns true (PlayOnHover, or your own state).
 * Follows the shadcn theme.
 */
export const Briefcase = ({
  heading = "No projects yet",
  description = "Start a project and your team's work will gather here.",
  actionLabel = "New project",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: BriefcaseProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const lift = useLift(clock, clip);
  return (
    <LineState
      bounds={BOUNDS}
      defaultArtClassName="w-48"
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
      slot="briefcase"
      view="isometric"
    >
      <Body />
      <Lugs />
      <Handle lift={lift} />
      {[-LATCH.x, LATCH.x].map((x, i) => (
        <Rig
          axis="x"
          key={x}
          pivot={[x, FRONT_Y, LATCH.z]}
          {...onClock(clock, latchPose(clip, i), clip.end)}
        >
          <Latch x={x} />
        </Rig>
      ))}
    </LineState>
  );
};

export default Briefcase;
