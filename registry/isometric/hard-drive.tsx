"use client";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LINE,
  LineState,
  circle,
  disc,
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
 * "No backups yet", told by one object in line: an open hard drive whose
 * read arm swings out over the platter, finds nothing to read, and goes
 * back to park. Use: empty state. Move: a swing on a pivot. Each value is
 * ms after it comes into view, or after `active` turns true.
 *
 *    0ms   the drive stands upright; the arm parked, straight up from
 *          its pivot by the magnet, its head on the platter's right edge
 *  400ms   the arm swings in across the platter, 18° (380ms): its head
 *          crosses the data ring and stops just short of the clamp; the
 *          clamp gives a sixth of a turn as it goes (360ms)
 *  780ms   it eases back 2° and hovers over the platter (420ms)
 * 1200ms   it swings home (300ms, speeding up), knocks its stop and comes
 *          off it 2°, then settles parked (200ms)
 * 1700ms   still: the arm parked, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms when it comes into view,
 * 80ms each time `active` turns true.
 * Reduced motion, or `active` false before any play: the drive with its
 * arm parked.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // Where it hovers, degrees.
  hover: -16,
  // The clamp's turn, degrees: a sixth, which lands its six screws straight.
  hub: 60,
  // How far it comes off its stop when it lands home, degrees.
  knock: -2,
  // Degrees the arm swings out (negative turns it left, over the platter).
  out: -18,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face of the drive is the plane
// y = 0. Only the body has depth (a clear top strip); everything on its
// face is flush, so every part draws as one line (line-style.md, "Clean
// lines"). Positions are world x (across) and z (up) on that face.

// The drive: an upright rounded slab.
const BODY = { depth: 1, h: 7.5, r: 0.75, w: 6 };
const BODY_AT: Vec3 = [-BODY.w / 2, 0, BODY.h];

/** A point on the drive's face. */
const on = (x: number, z: number): Vec3 => [x, 0, z];

// The platter, high in the body, and one ring where its data runs out.
const PLATTER = { r: 2.25, ring: 1.5, x: 0, z: 4.75 };

// The clamp that holds the platter to the spindle: six screws round the
// spindle cap, every ring a clear 0.25 from the next. It is what turns.
const CLAMP = { holes: 6, pitch: 0.625, r: 1, screw: 0.125, spindle: 0.25 };
const CLAMP_AT = on(PLATTER.x, PLATTER.z);

// Screw heads in three corners, each a ring with a slot across it. The
// fourth corner holds the actuator. They sit on the centres of the body's
// corner arcs, so each one keeps a clear 0.5 from the edge.
const SCREW = { r: 0.25 };
const SCREWS = [
  [-2.25, 0.75],
  [-2.25, 6.75],
  [2.25, 6.75],
] as const;

// The actuator: the arm turns on a bearing set in the voice-coil magnet
// plate, which fills the corner (its lower right corner concentric with
// the body's) and is held by two screws on its free side. Every edge keeps
// a clear 0.25 from the bearing.
const PIVOT = on(2, 1.25);
const BEARING = { pin: 0.2, r: 0.5 };
const MAGNET = { h: 2, r: 0.5, w: 2, x: 0.75, z: 2.25 };
const MAGNET_SCREWS = [
  [1.125, 0.75],
  [1.125, 1.75],
] as const;
const MAGNET_SCREW = { r: 0.125 };

// The read arm: a straight plate from its bearing to the head (straight
// sides stay one clean line at rest). Parked, it stands straight up with
// its head on the platter's right edge. Face units about the pivot, v
// down: the arm runs up to v = -len.
const ARM = { half: 0.25, len: 2.75 };
// The head at the arm's end: the one brand mark.
const HEAD = { h: 0.75, r: 0.125, w: 0.75 };

// The arm's outline, its foot hidden under the bearing.
const ARM_PATH = `M${-ARM.half} 0 V${-ARM.len} H${ARM.half} V0 Z`;

// A label in the free lower left corner, with two printed lines.
const LABEL = { h: 1.25, r: 0.25, w: 2, x: -1.75, z: 1.75 };
const LABEL_LINES = [
  { len: 1.25, z: 1.25 },
  { len: 0.75, z: 1 },
] as const;
const LABEL_INSET = 0.375;

// The frame fits the drive at rest: its front face and the top strip its
// depth shows. The arm stays inside the face.
const EXTENT: Vec3[] = [
  [-BODY.w / 2, 0, 0],
  [BODY.w / 2, 0, 0],
  [-BODY.w / 2, -BODY.depth, BODY.h],
  [BODY.w / 2, -BODY.depth, BODY.h],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The arm's turn about its pivot, degrees (never above 0: parked is its stop). */
  arm: IsoTrack;
  /** The clamp's turn, degrees clockwise. */
  hub: IsoTrack;
}

const beat = (t0: number): Clip => {
  const out = t0 + 380;
  const back = out + 420;
  const home = back + 300;
  const arm: IsoKey[] = [
    [t0, 0, EASE.snap],
    [out, MOVE.out, EASE.easy],
    [out + 140, MOVE.hover, "hold"],
    [back, MOVE.hover, EASE.in],
    [home, 0, EASE.easy],
    [home + 90, MOVE.knock, EASE.easy],
    [home + 200, 0],
  ];
  const hub: IsoKey[] = [
    [t0 + 40, 0, EASE.snap],
    [t0 + 400, MOVE.hub],
  ];
  return { arm, end: home + 200, hub };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const armPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.arm, ms)),
  });

const hubPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    // A sixth of a turn lands the screws where they started: hold it as 0.
    rotate: r2(sample(clip.hub, ms) % MOVE.hub),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** A ring outline centred on a point of the face. */
const Round = ({ at, r }: { at: Vec3; r: number }) => (
  <FacePath at={at} d={circle(0, 0, r)} plane="left" style={LINE} />
);

/** A screw head: a ring with a level slot across it, ending on the ring. */
const Screw = ({ at, r }: { at: Vec3; r: number }) => (
  <>
    <Round at={at} r={r} />
    <FacePath at={at} d={`M${-r} 0 H${r}`} plane="left" style={LINE} />
  </>
);

/** The platter and the ring where its data runs out. */
const Platter = () => (
  <>
    <FacePath
      at={[PLATTER.x - PLATTER.r, 0, PLATTER.z + PLATTER.r]}
      d={disc(PLATTER.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <Round at={on(PLATTER.x, PLATTER.z)} r={PLATTER.ring} />
  </>
);

/** The clamp on the spindle, its six screws turning with it. */
const Clamp = ({ turn }: { turn: ReturnType<typeof onClock> }) => (
  <>
    <FacePath
      at={CLAMP_AT}
      d={circle(0, 0, CLAMP.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <Rig pivot={CLAMP_AT} {...turn}>
      {Array.from({ length: CLAMP.holes }, (_, i) => {
        const a = (i / CLAMP.holes) * Math.PI * 2;
        return (
          <Round
            at={[
              r2(CLAMP_AT[0] + CLAMP.pitch * Math.sin(a)),
              0,
              r2(CLAMP_AT[2] + CLAMP.pitch * Math.cos(a)),
            ]}
            key={a}
            r={CLAMP.screw}
          />
        );
      })}
    </Rig>
    <Round at={CLAMP_AT} r={CLAMP.spindle} />
  </>
);

/** The label and its two printed lines. */
const Label = () => (
  <>
    <FacePath
      at={on(LABEL.x, LABEL.z)}
      d={roundedRect(LABEL.w, LABEL.h, LABEL.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    {LABEL_LINES.map(({ len, z }) => (
      <FacePath
        at={on(LABEL.x + LABEL_INSET, z)}
        d={`M0 0 H${len}`}
        key={z}
        plane="left"
        style={LINE}
      />
    ))}
  </>
);

/** The magnet plate behind the pivot, and its screw. */
const Magnet = () => (
  <>
    <FacePath
      at={on(MAGNET.x, MAGNET.z)}
      d={roundedRect(MAGNET.w, MAGNET.h, MAGNET.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    {MAGNET_SCREWS.map(([x, z]) => (
      <Screw at={on(x, z)} key={`${x},${z}`} r={MAGNET_SCREW.r} />
    ))}
  </>
);

/** The read arm and its head, then the bearing it turns on over its foot. */
const Arm = ({ swing }: { swing: ReturnType<typeof onClock> }) => (
  <>
    <Rig pivot={PIVOT} {...swing}>
      <FacePath
        at={PIVOT}
        d={ARM_PATH}
        plane="left"
        style={faceFill("surface", "top")}
      />
      <FacePath
        at={PIVOT}
        d={roundedRect(
          HEAD.w,
          HEAD.h,
          HEAD.r,
          -HEAD.w / 2,
          -ARM.len - HEAD.h / 2
        )}
        plane="left"
        style={faceFill("main", "left")}
      />
    </Rig>
    <FacePath
      at={PIVOT}
      d={circle(0, 0, BEARING.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <Round at={PIVOT} r={BEARING.pin} />
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type HardDriveProps = LineStateProps;

/**
 * Hard drive: a complete "no backups yet" state with a line illustration,
 * a heading, a line of copy and a button. An open hard drive standing
 * upright: its read arm swings out over the platter as the clamp gives a
 * small turn, hovers, and swings back to park by its magnet. One fine
 * outline, paper faces, the arm's head the one brand mark, facing the
 * screen, no shadow. Plays when it comes into view, or each time `active`
 * turns true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const HardDrive = ({
  heading = "No backups yet",
  description = "Back up your workspace and your copies will be listed here.",
  actionLabel = "Back up now",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: HardDriveProps) => {
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
      icon={ICON.refresh}
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
      slot="hard-drive"
      view="front"
    >
      <Extrude
        at={BODY_AT}
        convex
        d={roundedRect(BODY.w, BODY.h, BODY.r)}
        depth={BODY.depth}
        palette="surface"
        plane="left"
      >
        {SCREWS.map(([x, z]) => (
          <Screw at={on(x, z)} key={`${x},${z}`} r={SCREW.r} />
        ))}
        <Label />
        <Platter />
        <Clamp turn={onClock(clock, hubPose(clip), clip.end)} />
        <Magnet />
        <Arm swing={onClock(clock, armPose(clip), clip.end)} />
      </Extrude>
    </LineState>
  );
};

export default HardDrive;
