"use client";

import { EASE, Extrude, FacePath, Rig, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LineState,
  Ring,
  disc,
  faceFill,
  facing,
  onClock,
  r2,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "No locations yet", told by one object in line: a map pin that hops on
 * its empty spot and lands. Use: empty state. Move: drop with one bounce.
 * Each value is ms after the art comes into view.
 *
 *    0ms   the pin stands on its spot
 *  400ms   it crouches: squashes 8% into its tip (120ms)
 *  520ms   it springs up 1.2 units, stretching a little (240ms)
 *  760ms   it falls back (200ms, speeding up)
 *  960ms   it lands: squashes 12%, the spot under it widens 14%
 * 1060ms   one small bounce (0.25 units), then it settles
 * 1380ms   still: standing straight on its spot, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the pin standing still.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face is the plane y = 0.

// The head: a disc of radius R, tapering to a tip TIP below its centre.
const PIN = { depth: 0.6, r: 1.6, tip: 2.8 };
const PIN_H = PIN.r + PIN.tip;
const PIN_Y = -PIN.depth / 2;

/** One circular arc as cubics (≤ 90° each), angles in degrees, v down. */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const n = Math.ceil(Math.abs(a1 - a0) / 90);
  const step = ((a1 - a0) / n) * (Math.PI / 180);
  const k = (4 / 3) * Math.tan(step / 4) * r;
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const s = (a0 * Math.PI) / 180 + i * step;
    const e = s + step;
    parts.push(
      `C${r2(cx + r * Math.cos(s) - k * Math.sin(s))} ${r2(cy + r * Math.sin(s) + k * Math.cos(s))}`,
      `${r2(cx + r * Math.cos(e) + k * Math.sin(e))} ${r2(cy + r * Math.sin(e) - k * Math.cos(e))}`,
      `${r2(cx + r * Math.cos(e))} ${r2(cy + r * Math.sin(e))}`
    );
  }
  return parts.join(" ");
};

// The outline: from the tip up the right tangent, over the top of the
// head, down to the left tangent and back to the tip. The tangents touch
// the head where the angle from its centre to the tip is acos(r / tip).
// It is convex, so the engine draws its far edge and side edges.
const TANGENT = (Math.acos(PIN.r / PIN.tip) * 180) / Math.PI;
const PIN_PATH = [
  `M${PIN.r} ${PIN_H}`,
  `L${r2(PIN.r + PIN.r * Math.sin((TANGENT * Math.PI) / 180))} ${r2(PIN.r + PIN.r * Math.cos((TANGENT * Math.PI) / 180))}`,
  arc(PIN.r, PIN.r, PIN.r, 90 - TANGENT, -270 + TANGENT),
  "Z",
].join(" ");

// The brand dot in the head, on the front face.
const DOT = { r: 0.62 };

// The spot the pin stands on: a level circle on the floor round its tip.
const SPOT = { r: 1.15 };
const SPOT_AT: Vec3 = [0, PIN_Y, 0];

// The frame fits the pin at rest, from the spot's front edge to the top of
// the head, as wide as the head. The hop runs into the stage's padding.
const EXTENT: Vec3[] = [
  [-PIN.r, 0, 0],
  [PIN.r, 0, 0],
  [-PIN.r, -PIN.depth, PIN_H],
  [PIN.r, -PIN.depth, PIN_H],
  [-SPOT.r, PIN_Y + SPOT.r, 0],
  [SPOT.r, PIN_Y - SPOT.r, 0],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Height above the spot, world units. */
  lift: IsoTrack;
  /** Height scale of the pin about its tip. */
  squash: IsoTrack;
  /** Scale of the spot. */
  spot: IsoTrack;
}

const beat = (t0: number): Clip => {
  const crouch = t0 + 120;
  const apex = crouch + 240;
  const land = apex + 200;
  const bounce = land + 100;
  const lift: IsoKey[] = [
    [t0, 0, "hold"],
    [crouch, 0, EASE.soft],
    [apex, 1.2, EASE.in],
    [land, 0, EASE.drop],
    [bounce + 90, 0.25, EASE.in],
    [bounce + 200, 0],
  ];
  const squash: IsoKey[] = [
    [t0, 1, EASE.easy],
    [crouch, 0.92, EASE.soft],
    [crouch + 120, 1.05, EASE.easy],
    [land - 20, 1, EASE.drop],
    [land + 60, 0.88, EASE.easy],
    [bounce + 60, 1.03, EASE.easy],
    [bounce + 200, 0.97, EASE.easy],
    [bounce + 320, 1],
  ];
  const spot: IsoKey[] = [
    [land - 20, 1, EASE.drop],
    [land + 60, 1.14, EASE.easy],
    [land + 280, 1],
  ];
  return { end: bounce + 320, lift, spot, squash };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const pinPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const s = r2(sample(clip.squash, ms));
    // Volume is kept: as it squashes in height it widens.
    const w = r2(1 / Math.sqrt(s));
    return {
      offset: [0, 0, r2(sample(clip.lift, ms))],
      scale: [w, w, s],
    };
  };

const spotPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.spot, ms));
    return { scale: [k, k, 1] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** The pin: its head and tip as one extrusion, the brand dot on its face. */
const Pin = () => (
  <Extrude
    at={[-PIN.r, 0, PIN_H]}
    convex
    d={PIN_PATH}
    depth={PIN.depth}
    palette="surface"
    plane="left"
  >
    <FacePath
      at={[-DOT.r, 0, PIN_H - PIN.r + DOT.r]}
      d={disc(DOT.r)}
      plane="left"
      style={faceFill("main", "left")}
    />
  </Extrude>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type MapPinProps = LineStateProps;

/**
 * Map pin: a complete "no locations yet" state with a line illustration, a
 * heading, a line of copy and a button. A map pin on its empty spot hops
 * once and lands with one bounce; the spot widens as it lands. One fine
 * outline, paper faces, the dot in the head the one brand mark, facing the
 * screen, no shadow. Pass `active` (PlayOnHover, or your own state) to
 * play it again. Follows the shadcn theme.
 */
export const MapPin = ({
  heading = "No locations yet",
  description = "Add a place and it will show up on your map.",
  actionLabel = "Add location",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: MapPinProps) => {
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
      slot="map-pin"
    >
      {/* The spot first: the pin, written after it, covers its far half. */}
      <Rig pivot={SPOT_AT} {...onClock(clock, spotPose(clip), clip.end)}>
        <Ring center={SPOT_AT} palette="surface" r={SPOT.r} />
      </Rig>
      <Rig pivot={SPOT_AT} {...onClock(clock, pinPose(clip), clip.end)}>
        <Pin />
      </Rig>
    </LineState>
  );
};

export default MapPin;
