"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { useRef, useState } from "react";

import {
  Box,
  EASE,
  Extrude,
  FacePath,
  Rig,
  roundedRect,
  sample,
} from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
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
 * "No firewall rules", told by one object in line: a network router at
 * the true isometric angle (a low body, three paddle antennas on its back
 * edge, a row of status lights, ports and vents) with a small padlock on
 * its front. The antennas tip one after another, then the padlock's
 * shackle lifts and clicks shut. Use: blocked / empty state. Move: swings
 * about each antenna's base (in its own plane), a part sliding out of a
 * housing (cut at it), a settle. Each value is ms after it comes into view.
 *
 *    0ms   the router stands still, its padlock shut
 *  400ms   the left antenna tips 4.5° right about its base (180ms), back
 *          past straight (220ms) and settles (280ms); the middle one
 *          follows 90ms behind, 5°, the right one 90ms after that, 5.5°
 * 1020ms   the shackle slides 0.5 out of the lock (200ms, soft), holds
 *          open (120ms)
 * 1340ms   it drops home (120ms, speeding up) and clicks, a hair of
 *          rebound (120ms); the lock dips 0.12 and settles (320ms)
 * 1780ms   still: shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the router, locked.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The shackle drops home in this long.
  drop: 120,
  // It holds open this long.
  hold: 120,
  // Each antenna lags the one before it by this much.
  lag: 90,
  // The shackle slides out in this long.
  lift: 200,
  // The shackle starts to lift this long after the first antenna tips.
  lock: 620,
  // The lock's settle after the click.
  settle: 320,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // The lock dips this far as the shackle clicks home, world units.
  dip: 0.12,
  // World units the shackle slides out of the lock.
  lift: 0.5,
  // Each antenna's first tip, degrees: followers swing a little wider.
  tips: [4.5, 5, 5.5] as const,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built along the world axes, standing on z = 0: the front (lights, the
// padlock) faces +y, down left on screen; the side with the ports faces
// +x, down right.
const BODY = { d: 7, h: 4, w: 11 };
const X0 = -BODY.w / 2;
const X1 = BODY.w / 2;
const Y0 = -BODY.d / 2;
const Y1 = BODY.d / 2;
const FRONT_AT: Vec3 = [X0, Y1, BODY.h];
const SIDE_AT: Vec3 = [X1, Y1, BODY.h];
const TOP_AT: Vec3 = [X0, Y0, BODY.h];

// Three paddle antennas standing just behind the back edge, their feet
// hidden by the body. Each swings in its own plane about its foot.
const ANTENNA = { d: 0.5, foot: BODY.h - 1, top: BODY.h + 4, w: 0.75 };
const ANTENNAS = [-4, 0, 4] as const;

// On the front, in face units (u across from the left, v down from the
// top): a row of status lights at the left, a round button at the right.
const LIGHTS = { r: 0.25, u: [1, 2, 3] as const, v: 1.5 };
const BUTTON = { r: 0.375, u: 9.75, v: 1.5 };

// The padlock: a small block standing 1 proud of the front, centred on
// it, and its shackle in the middle of the block's depth, so each leg goes
// into the block's top. The block is the one brand mark.
const LOCK = { d: 1, h: 1.5, r: 0.5, w: 2.75, z: 1 };
const LOCK_TOP = LOCK.z + LOCK.h;
const LOCK_AT: Vec3 = [-LOCK.w / 2, Y1 + LOCK.d, LOCK_TOP];
const SHACKLE = { bar: 0.375, rise: 1.25, w: 2 };
const SHACKLE_Y = Y1 + LOCK.d / 2;
const KEYHOLE = { r: 0.25, tail: 0.5, v: 0.625 };

// On the side, in face units (u back from its front edge, v down): three
// network ports and a round power jack.
const PORT = { h: 0.75, r: 0.125, v: 2, w: 1 };
const PORTS = [1, 2.5, 4] as const;
const JACK = { r: 0.375, u: 5.75, v: 2.375 };

// On the top, in face units (u along x, v toward the front): a vent of
// four slots at the right.
const VENT = { h: 3, u: [6.5, 7.5, 8.5, 9.5] as const, v: 2, w: 0.5 };

// The frame fits the router at rest: the body's corners and the tops of
// the antennas.
const EXTENT: Vec3[] = [
  [X0, Y1, 0],
  [X1, Y1, 0],
  [X1, Y0, 0],
  [X0, Y1, BODY.h],
  [X0, Y0, BODY.h],
  [X1, Y0, BODY.h],
  ...ANTENNAS.flatMap((x): Vec3[] => [
    [x - ANTENNA.w / 2, Y0, ANTENNA.top],
    [x + ANTENNA.w / 2, Y0 - ANTENNA.d, ANTENNA.top],
  ]),
];
const BOUNDS = viewBounds("isometric", EXTENT);

// Seen into a port or a slot: a step darker than the darkest wall.
const HOLLOW = {
  ...LINE,
  fill: "oklch(from var(--iso-surface-right-c) calc(l - 0.12) c h)",
};

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Each antenna's swing, degrees about its foot. */
  tips: IsoTrack[];
  /** How far the shackle is out of the lock, world units (never below 0). */
  lift: IsoTrack;
  /** The lock's dip as the shackle clicks home, world units. */
  dip: IsoTrack;
}

const beat = (t0: number): Clip => {
  const tips = MOVE.tips.map((deg, i): IsoTrack => {
    const go = t0 + TIMING.lag * i;
    return [
      [go, 0, EASE.soft],
      [go + 180, deg, EASE.easy],
      [go + 400, -deg * 0.4, EASE.easy],
      [go + 560, deg * 0.12, EASE.easy],
      [go + 680, 0],
    ];
  });
  const up = t0 + TIMING.lock;
  const open = up + TIMING.lift;
  const fall = open + TIMING.hold;
  const click = fall + TIMING.drop;
  const lift: IsoKey[] = [
    [up, 0, EASE.soft],
    [open, MOVE.lift, "hold"],
    [fall, MOVE.lift, EASE.in],
    [click, 0, EASE.drop],
    [click + 60, 0.05, EASE.in],
    [click + 120, 0],
  ];
  const dip: IsoKey[] = [
    [click, 0, EASE.drop],
    [click + 90, -MOVE.dip, EASE.easy],
    [click + 220, MOVE.dip * 0.25, EASE.easy],
    [click + TIMING.settle, 0],
  ];
  return { dip, end: click + TIMING.settle, lift, tips };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

// An antenna is a flat paddle facing +y: it turns about its own normal.
const tipPose =
  (clip: Clip, i: number) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.tips[i], ms)),
  });

const dipPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.dip, ms))] });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** One paddle antenna, round at its tip, its foot behind the body. */
const Antenna = ({ x }: { x: number }) => (
  <Extrude
    at={[x - ANTENNA.w / 2, Y0, ANTENNA.top]}
    convex
    d={roundedRect(ANTENNA.w, ANTENNA.top - ANTENNA.foot, ANTENNA.w / 2)}
    depth={ANTENNA.d}
    palette="surface"
    plane="left"
  />
);

/** The body, with the lights and button on its front, the ports on its side and the vent on its top. */
const Body = () => (
  <>
    <Box at={[X0, Y0, 0]} palette="surface" size={[BODY.w, BODY.d, BODY.h]} />
    {LIGHTS.u.map((u) => (
      <FacePath
        at={FRONT_AT}
        d={circle(u, LIGHTS.v, LIGHTS.r)}
        key={u}
        plane="left"
        style={LINE}
      />
    ))}
    <FacePath
      at={FRONT_AT}
      d={circle(BUTTON.u, BUTTON.v, BUTTON.r)}
      plane="left"
      style={LINE}
    />
    {PORTS.map((u) => (
      <FacePath
        at={SIDE_AT}
        d={roundedRect(PORT.w, PORT.h, PORT.r, u, PORT.v)}
        key={u}
        plane="right"
        style={HOLLOW}
      />
    ))}
    <FacePath
      at={SIDE_AT}
      d={circle(JACK.u, JACK.v, JACK.r)}
      plane="right"
      style={HOLLOW}
    />
    {VENT.u.map((u) => (
      <FacePath
        at={TOP_AT}
        d={roundedRect(VENT.w, VENT.h, VENT.w / 2, u, VENT.v)}
        key={u}
        plane="top"
        style={HOLLOW}
      />
    ))}
  </>
);

/**
 * The shackle's outline in face units (u across from its left edge, v down
 * from the top of its arch): two legs joined by a half ring. The legs end
 * where they meet the lock's top, so lifting it `pull` units makes them
 * that much longer: it slides out of the lock, it is not lifted off it.
 */
const shacklePath = (pull: number) => {
  const { bar, rise, w } = SHACKLE;
  const outer = w / 2;
  const inner = outer - bar;
  const ko = r2(outer * ARC);
  const ki = r2(inner * ARC);
  const foot = r2(rise + pull);
  return [
    `M0 ${foot}`,
    `V${outer}`,
    `C0 ${r2(outer - ko)} ${r2(outer - ko)} 0 ${outer} 0`,
    `C${r2(outer + ko)} 0 ${w} ${r2(outer - ko)} ${w} ${outer}`,
    `V${foot}`,
    `H${r2(w - bar)}`,
    `V${outer}`,
    `C${r2(w - bar)} ${r2(outer - ki)} ${r2(outer + ki)} ${bar} ${outer} ${bar}`,
    `C${r2(outer - ki)} ${bar} ${bar} ${r2(outer - ki)} ${bar} ${outer}`,
    `V${foot}`,
    "Z",
  ].join(" ");
};

/** The padlock: its block (the brand mark) with a keyhole, and the shackle `pull` out of it. */
const Padlock = ({ pull }: { pull: number }) => (
  <>
    <Extrude
      at={LOCK_AT}
      convex
      d={roundedRect(LOCK.w, LOCK.h, LOCK.r)}
      depth={LOCK.d}
      palette="main"
      plane="left"
    >
      <FacePath
        at={LOCK_AT}
        d={`${circle(LOCK.w / 2, KEYHOLE.v, KEYHOLE.r)} M${LOCK.w / 2} ${KEYHOLE.v + KEYHOLE.r} V${KEYHOLE.v + KEYHOLE.r + KEYHOLE.tail}`}
        plane="left"
        style={LINE}
      />
    </Extrude>
    <FacePath
      at={[-SHACKLE.w / 2, SHACKLE_Y, LOCK_TOP + SHACKLE.rise + pull]}
      d={shacklePath(pull)}
      plane="left"
      style={faceFill("surface", "left")}
    />
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** How far the shackle is out of the lock, re-rendered only when it changes. */
const usePull = (clock: MotionValue<number> | undefined, clip: Clip) => {
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

export type RouterProps = LineStateProps;

/**
 * Router: a complete "no firewall rules" state with a line illustration,
 * a heading, a line of copy and a button. A network router at the true
 * isometric angle (three paddle antennas, status lights, network ports, a
 * vent) with a small padlock on its front: the antennas tip one after
 * another, then the padlock's shackle lifts and clicks shut. One fine
 * outline, paper faces, the padlock the one brand mark, no shadow. Plays
 * when it comes into view, or each time `active` turns true (PlayOnHover,
 * or your own state). Follows the shadcn theme.
 */
export const Router = ({
  heading = "No firewall rules",
  description = "Add a rule to control which traffic can reach your servers.",
  actionLabel = "Add rule",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: RouterProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const pull = usePull(clock, clip);
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
      slot="router"
      view="isometric"
    >
      {/* Back to front: the antennas, the body over their feet, then the
          padlock standing proud of the front. */}
      {ANTENNAS.map((x, i) => (
        <Rig
          key={x}
          pivot={[x, Y0 - ANTENNA.d / 2, ANTENNA.foot]}
          {...onClock(clock, tipPose(clip, i), clip.end)}
        >
          <Antenna x={x} />
        </Rig>
      ))}
      <Body />
      <Rig pivot={[0, 0, 0]} {...onClock(clock, dipPose(clip), clip.end)}>
        <Padlock pull={pull} />
      </Rig>
    </LineState>
  );
};

export default Router;
