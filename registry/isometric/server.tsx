"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { Box, EASE, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LINE,
  LineState,
  circle,
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
 * "No servers connected", told by one object in line: a server tower,
 * seen in isometric, whose three units slide out of their bays in turn
 * and back, and then its status light pops on. Use: empty state. Move:
 * parts sliding out of a housing (cut at its face) in a stagger, then a
 * pop. Each value is ms after the art comes into view.
 *
 *    0ms   the tower stands shut, three units flush with its front
 *  400ms   the top unit slides out 1.5 units toward the viewer (260ms,
 *          fast out, soft in), the middle 110ms behind, the bottom
 *          110ms behind that
 *  660ms   each hangs out, empty (240ms)
 *  900ms   each slides back in turn (200ms, speeding up), knocks flush
 *          and bounces out a hair (120ms)
 * 1440ms   as the last one is home, the status light on the top unit
 *          pops 60% and settles (440ms)
 * 1880ms   still: the tower shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the tower shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // Each unit slides back in this long.
  back: 200,
  // How long each unit hangs out.
  hang: 240,
  // Each unit slides out this long.
  out: 260,
  // How far each unit lags the one above it.
  stagger: 110,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // The status light grows this much as it comes on.
  pop: 1.6,
  // World units a unit slides out of its bay.
  pull: 1.5,
  // It bounces this far back out as it knocks flush.
  rebound: 0.1,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Seen in isometric, standing on z = 0: its front is the +y face (down
// left on screen), its side the +x face (down right), with the vents.

// Four short feet under the housing.
const FOOT = { h: 0.5, inset: 0.5, w: 1 };
// The housing: 6 wide (x), 5 deep (y), 10 tall, on its feet.
const HOUSING = { d: 5, h: 10, w: 6 };
const HOUSING_AT: Vec3 = [-HOUSING.w / 2, -HOUSING.d / 2, FOOT.h];
const FRONT_Y = HOUSING_AT[1] + HOUSING.d;
const SIDE_X = HOUSING_AT[0] + HOUSING.w;
const TOP_Z = FOOT.h + HOUSING.h;

// Three units in the front, flush with it at rest, bottom first. A unit
// is drawn only from the housing's front forward: what is still inside is
// hidden by it, so sliding out it grows from that face (cut, never
// floated).
const FRAME = { bottom: 0.5, rail: 0.5, stile: 0.5 };
const UNIT = { h: 2.5, w: HOUSING.w - FRAME.stile * 2 };
const UNIT_X = HOUSING_AT[0] + FRAME.stile;
const UNITS = [0, 1, 2] as const;
const footOf = (i: number) => FOOT.h + FRAME.bottom + i * (UNIT.h + FRAME.rail);

// On a unit's front, in face units from its top-left corner (v down): the
// drive slot, and two small round lights at the right.
const SLOT = { h: 0.5, u: 0.5, v: 1, w: 2 };
const LIGHTS = { r: 0.25, u: [3.25, 4.25] as const, v: 1.25 };
// The top unit's second light is the one brand mark; the others are blank.
const LIT = 2;

// The vents on the side: a column of slots under the top, in face units
// (u back along the side from its front edge, v down from its top).
const VENT = { count: 6, h: 0.5, step: 1, u: 1, v: 1.5, w: 3 };

// The frame fits the tower at rest: the housing's corners and the front
// foot's corner, the lowest point on screen.
const EXTENT: Vec3[] = [
  [HOUSING_AT[0], FRONT_Y, FOOT.h],
  [HOUSING_AT[0], HOUSING_AT[1], TOP_Z],
  [SIDE_X, HOUSING_AT[1], FOOT.h],
  [SIDE_X - FOOT.inset, FRONT_Y - FOOT.inset, 0],
];
const BOUNDS = viewBounds("isometric", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** How far each unit is out of its bay, world units (never below 0). */
  pulls: IsoTrack[];
  /** Scale of the status light. */
  light: IsoTrack;
}

const beat = (t0: number): Clip => {
  // The top unit goes first, then the ones under it.
  const pulls = UNITS.map((i): IsoTrack => {
    const go = t0 + TIMING.stagger * (UNITS.length - 1 - i);
    const out = go + TIMING.out;
    const back = out + TIMING.hang;
    const home = back + TIMING.back;
    return [
      [go, 0, EASE.snap],
      [out, MOVE.pull, "hold"],
      [back, MOVE.pull, EASE.in],
      [home, 0, EASE.drop],
      [home + 60, MOVE.rebound, EASE.in],
      [home + 120, 0],
    ];
  });
  // The light pops on once the last unit is home.
  const on =
    t0 +
    TIMING.stagger * (UNITS.length - 1) +
    TIMING.out +
    TIMING.hang +
    TIMING.back +
    120;
  const light: IsoKey[] = [
    [on, 1, EASE.soft],
    [on + 160, MOVE.pop, EASE.easy],
    [on + 320, 0.9, EASE.easy],
    [on + 440, 1],
  ];
  return { end: on + 440, light, pulls };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const lightPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.light, ms));
    return { scale: [k, 1, k] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const HOLLOW = faceFill("surface", "right");

/** The feet, the housing and the vents on its side. */
const Housing = () => {
  const [x, y] = HOUSING_AT;
  const feet = [
    [x + FOOT.inset, y + FOOT.inset],
    [SIDE_X - FOOT.inset - FOOT.w, y + FOOT.inset],
    [x + FOOT.inset, FRONT_Y - FOOT.inset - FOOT.w],
    [SIDE_X - FOOT.inset - FOOT.w, FRONT_Y - FOOT.inset - FOOT.w],
  ] as const;
  return (
    <>
      {feet.map(([fx, fy]) => (
        <Box
          at={[fx, fy, 0]}
          key={`${fx},${fy}`}
          palette="surface"
          size={[FOOT.w, FOOT.w, FOOT.h]}
        />
      ))}
      <Box
        at={HOUSING_AT}
        palette="surface"
        size={[HOUSING.w, HOUSING.d, HOUSING.h]}
      />
      {Array.from({ length: VENT.count }, (_, k) => (
        <FacePath
          at={[SIDE_X, FRONT_Y, TOP_Z]}
          d={roundedRect(
            VENT.w,
            VENT.h,
            VENT.h / 2,
            VENT.u,
            VENT.v + k * VENT.step
          )}
          key={k}
          plane="right"
          style={LINE}
        />
      ))}
    </>
  );
};

/**
 * One unit, `pull` out of its bay: a box from the housing's front to its
 * own front (only its face when it is flush), then the drive slot and the
 * lights on that front. `light` replaces the second light (the brand one).
 */
const Unit = ({
  i,
  pull,
  light,
}: {
  i: number;
  pull: number;
  light?: ReactNode;
}) => {
  const z = footOf(i);
  const front: Vec3 = [UNIT_X, FRONT_Y + pull, z + UNIT.h];
  return (
    <>
      {pull > 0.02 ? (
        <Box
          at={[UNIT_X, FRONT_Y, z]}
          palette="surface"
          size={[UNIT.w, pull, UNIT.h]}
        />
      ) : (
        <FacePath
          at={front}
          d={`M0 0 H${UNIT.w} V${UNIT.h} H0 Z`}
          plane="left"
          style={faceFill("surface", "left")}
        />
      )}
      <FacePath
        at={front}
        d={roundedRect(SLOT.w, SLOT.h, SLOT.h / 2, SLOT.u, SLOT.v)}
        plane="left"
        style={HOLLOW}
      />
      <FacePath
        at={front}
        d={circle(LIGHTS.u[0], LIGHTS.v, LIGHTS.r)}
        plane="left"
        style={LINE}
      />
      {light ?? (
        <FacePath
          at={front}
          d={circle(LIGHTS.u[1], LIGHTS.v, LIGHTS.r)}
          plane="left"
          style={LINE}
        />
      )}
    </>
  );
};

/** The status light on the top unit, the one brand mark. */
const LIGHT_AT: Vec3 = [
  UNIT_X + LIGHTS.u[1],
  FRONT_Y,
  footOf(LIT) + UNIT.h - LIGHTS.v,
];
const Light = () => (
  <FacePath
    at={[UNIT_X, FRONT_Y, footOf(LIT) + UNIT.h]}
    d={circle(LIGHTS.u[1], LIGHTS.v, LIGHTS.r)}
    plane="left"
    style={faceFill("main", "left")}
  />
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

const SHUT = UNITS.map(() => 0);

/** How far each unit is out, re-rendered only when one changes. */
const usePulls = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const [value, setValue] = useState(SHUT);
  const last = useRef(SHUT.join(","));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = clip.pulls.map((track) => r2(sample(track, ms)));
    const key = next.join(",");
    if (key !== last.current) {
      last.current = key;
      setValue(next);
    }
  });
  return clock ? value : SHUT;
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type ServerProps = LineStateProps;

/**
 * Server: a complete "no servers connected" state with a line
 * illustration, a heading, a line of copy and a button. A server tower
 * seen in isometric, its side vented; its three units slide out of their
 * bays in turn and back in, then the status light on the top unit pops
 * on. One fine outline, paper faces, the status light the one brand mark,
 * no shadow. Plays when it comes into view, or each time `active` turns
 * true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const Server = ({
  heading = "No servers connected",
  description = "Add a server to see its health and usage here.",
  actionLabel = "Add server",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ServerProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const pulls = usePulls(clock, clip);
  return (
    <LineState
      bounds={BOUNDS}
      defaultArtClassName="w-40"
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
      slot="server"
      view="isometric"
    >
      <Housing />
      {/* Bottom first: a unit out of its bay stands over the one below. */}
      {UNITS.map((i) => (
        <Unit
          i={i}
          key={i}
          light={
            i === LIT ? (
              <Rig
                pivot={[LIGHT_AT[0], LIGHT_AT[1] + pulls[i], LIGHT_AT[2]]}
                {...onClock(clock, lightPose(clip), clip.end)}
              >
                <Rig offset={[0, pulls[i], 0]} pivot={[0, 0, 0]}>
                  <Light />
                </Rig>
              </Rig>
            ) : null
          }
          pull={pulls[i]}
        />
      ))}
    </LineState>
  );
};

export default Server;
