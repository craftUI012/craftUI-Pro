"use client";

import { Box, EASE, FacePath, Rig, Slab, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
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
 * "No device connected", told by one object in line: a USB stick lying
 * flat on the desk that pushes forward as if into a port, finds nothing
 * there, and slides back. Use: blocked (not connected). Move: a slide
 * along the floor, tries and stops. Each value is ms after the art comes
 * into view.
 *
 *    0ms   the stick lies still, its plug pointing down-right
 *  400ms   it slides forward along its length, plug first (260ms, fast
 *          out, soft in)
 *  660ms   it knocks on nothing: rebounds a little and comes back to the
 *          front (180ms); the light on its top pops 45% as it tries
 *  980ms   it slides back home (300ms, soft) with a small settle (120ms)
 * 1400ms   still: lying where it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the stick at rest.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The slide back home.
  back: 300,
  // How long it rests at the front before sliding back.
  hold: 140,
  // The slide forward.
  push: 260,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // The light grows this much as the stick tries the port.
  pop: 1.45,
  // World units the stick slides forward.
  push: 1,
  // It knocks back this far off nothing.
  rebound: 0.2,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Lying on z = 0 along the x axis (down-right on screen): the plug at +x,
// the lanyard end at −x. The long wall facing the viewer is the +y side.

// The body: a slim rounded bar, its shell in two halves that meet at a
// seam half way up (the lower half is drawn first, so the seam is one line).
const BODY = { h: 1.5, len: 8, r: 0.5, w: 3 };
const BODY_X = -BODY.len / 2;
const BODY_Y = -BODY.w / 2;
const SEAM = BODY.h / 2;
const BODY_END = BODY_X + BODY.len;

// The plug: a metal USB-A shell out of the body's +x end, centred on its
// height, with two square holes on top near its tip and the dark mouth on
// its end (face units: u across the end, v down from its top edge).
const PLUG = { h: 1, len: 2.5, w: 2, z: 0.25 };
const PLUG_AT: Vec3 = [BODY_END, -PLUG.w / 2, PLUG.z];
const PLUG_TIP = BODY_END + PLUG.len;
const HOLE = { at: 0.5, size: 0.5, y: [-0.75, 0.25] as const };
// The mouth fills the end (the shell is thin); the tongue sits in its
// lower half.
const TONGUE = { u: 0.5, v: 0.5 };

// On the body's top: the lanyard hole at the back end, and the light,
// the one brand mark, near the plug.
const LANYARD = { r: 0.4, x: BODY_X + 1 };
const LIGHT = { r: 0.375, x: BODY_END - 1.5 };
const LIGHT_AT: Vec3 = [LIGHT.x, 0, BODY.h];

// The frame fits the stick at rest. The back end is rounded, so its
// corners are the points of its round edge furthest out (`round`). The
// push runs into the padding.
const round = (end: -1 | 1, side: -1 | 1, z: number): Vec3 => {
  const k = BODY.r * (1 - Math.SQRT1_2);
  return [end < 0 ? BODY_X + k : BODY_END - k, side * (BODY.w / 2 - k), z];
};
const EXTENT: Vec3[] = [
  round(-1, -1, BODY.h),
  round(-1, 1, 0),
  round(-1, 1, BODY.h),
  round(1, 1, 0),
  [PLUG_TIP, -PLUG.w / 2, PLUG.z],
  [PLUG_TIP, PLUG.w / 2, PLUG.z],
  [PLUG_TIP, -PLUG.w / 2, PLUG.z + PLUG.h],
];
const BOUNDS = viewBounds("isometric", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** How far the stick is forward of rest, world units. */
  push: IsoTrack;
  /** Scale of the light. */
  light: IsoTrack;
}

const beat = (t0: number): Clip => {
  const front = t0 + TIMING.push;
  const knocked = front + 90;
  const ready = knocked + 90;
  const leave = ready + TIMING.hold;
  const home = leave + TIMING.back;
  const push: IsoKey[] = [
    [t0, 0, EASE.snap],
    [front, MOVE.push, EASE.drop],
    [knocked, MOVE.push - MOVE.rebound, EASE.easy],
    [ready, MOVE.push, "hold"],
    [leave, MOVE.push, EASE.snap],
    [home, -0.05, EASE.easy],
    [home + 120, 0],
  ];
  const light: IsoKey[] = [
    [front - 20, 1, EASE.soft],
    [front + 140, MOVE.pop, EASE.easy],
    [front + 300, 0.94, EASE.easy],
    [front + 420, 1],
  ];
  return { end: home + 120, light, push };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const stickPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [r2(sample(clip.push, ms)), 0, 0] });

const lightPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.light, ms));
    return { scale: [k, k, 1] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const HOLLOW = faceFill("surface", "right");
const MOUTH_AT: Vec3 = [PLUG_TIP, PLUG.w / 2, PLUG.z + PLUG.h];

/** The body: two shell halves, the lanyard hole through the top one. */
const Body = () => (
  <>
    <Slab
      at={[BODY_X, BODY_Y, 0]}
      radius={BODY.r}
      size={[BODY.len, BODY.w, SEAM]}
    />
    <Slab
      at={[BODY_X, BODY_Y, SEAM]}
      radius={BODY.r}
      size={[BODY.len, BODY.w, BODY.h - SEAM]}
    />
    <FacePath
      at={[0, 0, BODY.h]}
      d={circle(LANYARD.x, 0, LANYARD.r)}
      plane="top"
      style={HOLLOW}
    />
  </>
);

/** The plug: its two holes on top, its mouth on the end. */
const Plug = () => (
  <>
    <Box at={PLUG_AT} palette="surface" size={[PLUG.len, PLUG.w, PLUG.h]} />
    {HOLE.y.map((y) => (
      <FacePath
        at={[PLUG_TIP - HOLE.at - HOLE.size, y, PLUG.z + PLUG.h]}
        d={`M0 0 H${HOLE.size} V${HOLE.size} H0 Z`}
        key={y}
        plane="top"
        style={HOLLOW}
      />
    ))}
    <FacePath
      at={MOUTH_AT}
      d={`M0 0 H${PLUG.w} V${PLUG.h} H0 Z`}
      plane="right"
      style={HOLLOW}
    />
    <FacePath
      at={MOUTH_AT}
      d={`M${TONGUE.u} ${TONGUE.v} H${PLUG.w - TONGUE.u} V${PLUG.h} H${TONGUE.u} Z`}
      plane="right"
      style={faceFill("surface", "top")}
    />
  </>
);

/** The light on the body's top, the one brand mark. */
const Light = () => (
  <FacePath
    at={[0, 0, BODY.h]}
    d={circle(LIGHT.x, 0, LIGHT.r)}
    plane="top"
    style={faceFill("main", "top")}
  />
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type UsbDriveProps = LineStateProps;

/**
 * USB drive: a complete "no device connected" state with a line
 * illustration, a heading, a line of copy and a button. A USB stick lies
 * flat on the desk, seen in isometric; it pushes forward as if into a
 * port, finds nothing, and slides back, its light popping as it tries.
 * One fine outline, paper faces, the light on its top the one brand mark,
 * no shadow. Plays when it comes into view, or each time `active` turns
 * true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const UsbDrive = ({
  heading = "No device connected",
  description = "Plug in a drive to import its files.",
  actionLabel = "Import files",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: UsbDriveProps) => {
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
      defaultArtClassName="w-60"
      icon={ICON.upload}
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
      slot="usb-drive"
      view="isometric"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, stickPose(clip), clip.end)}>
        <Body />
        <Rig pivot={LIGHT_AT} {...onClock(clock, lightPose(clip), clip.end)}>
          <Light />
        </Rig>
        <Plug />
      </Rig>
    </LineState>
  );
};

export default UsbDrive;
