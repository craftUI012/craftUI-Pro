"use client";

import { useId } from "react";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
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
 * "No passwords saved", told by one object in line: a key ring hanging
 * from a small wall hook, two keys and a tag on it, facing the screen.
 * It is jostled: the ring swings on the hook and the keys swing on the
 * ring, each a little later and a little wider, then everything hangs
 * still and straight. Use: empty state. Move: a swing on a pivot with
 * lagging followers. Each value is ms after the art comes into view.
 *
 *    0ms   everything hangs straight and still
 *  400ms   the ring is knocked: it swings 6° (200ms), then back through
 *          the middle 4.5°, 3°, 1.5°, 0.5°, each swing smaller and quicker
 *  470ms   the left key follows 70ms behind, 1.6× as wide (at most 11°)
 *  500ms   the tag follows 100ms behind
 *  530ms   the right key follows 130ms behind
 * 1930ms   still: hanging straight, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: hanging still.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

// The ring's swings: where each ends, in degrees, and how long it takes.
const SWINGS = [
  { deg: -6, ms: 200 },
  { deg: 4.5, ms: 300 },
  { deg: -3, ms: 270 },
  { deg: 1.5, ms: 240 },
  { deg: -0.5, ms: 210 },
  { deg: 0, ms: 180 },
] as const;

/* The hanging parts against the ring. */
const FOLLOW = {
  // How much wider than the ring they swing.
  gain: 1.6,
  // How far they lag it, ms: left key, tag, right key.
  lags: [70, 100, 130] as const,
  // The most any part leans, degrees.
  stop: 11,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0, on the front plane y = 0, the lowest key
// tip near z = 0. Every hanging part is flat (a face, one outline); only
// the wall plate has depth. Part outlines are written as [x, z] about the
// point each hangs from.

type P2 = readonly [number, number];

// The split ring: a band 0.5 wide.
const RING = { in: 1.5, mid: 1.75, out: 2, z: 5 };
const RING_C: Vec3 = [0, 0, RING.z];
// It hangs from the hook by the top of its inside edge.
const RING_PIVOT: Vec3 = [0, 0, RING.z + RING.in];

// The wall plate, the boss the hook comes out of, and the hook: a bar that
// drops behind the ring's band and turns out under it, so its rounded end
// shows inside the ring, the ring resting on it.
const PLATE = { d: 0.5, h: 1.5, r: 0.5, w: 2, z: RING.z + 4 };
const BOSS = { r: 0.375, z: PLATE.z - PLATE.h / 2 };
const HOOK = { end: RING.z + RING.in - 0.5, w: 0.5 };

// Every hole the band passes through: wide enough to leave 0.25 clear of
// the band on either side.
const HOLE = 0.5;

/** Where on the band a part hangs, by its angle round the ring. */
const hangAt = (deg: number): Vec3 => {
  const a = (deg * Math.PI) / 180;
  return [r2(RING.mid * Math.cos(a)), 0, r2(RING.z + RING.mid * Math.sin(a))];
};

// The hanging parts, left to right round the bottom of the ring: each one's
// hole, by its angle round the ring. A part swings about its own hole, so
// the hole never moves on the ring: these angles hold for every frame.
const AT = { left: 210, right: 330, tag: 270 } as const;
const HANG = {
  left: hangAt(AT.left),
  right: hangAt(AT.right),
  tag: hangAt(AT.tag),
};

/** A face path through [x, z] points about a hang point. */
const poly = (pts: readonly P2[]) =>
  `M${pts.map(([x, z]) => `${r2(x)} ${r2(-z)}`).join(" L")} Z`;

/** Points round an arc about (cx, cz), from a0 to a1 degrees. */
const arc = (
  cx: number,
  cz: number,
  r: number,
  a0: number,
  a1: number,
  n = 24
): P2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)] as P2;
  });

// The left key, a classic one: a round bow, a slim blade, and its bit on
// the right near the tip with one cut.
const BOW = 1;
const BLADE = 0.25;
const JOIN = (Math.acos(BLADE / BOW) * 180) / Math.PI;
const CLASSIC: P2[] = [
  ...arc(0, 0, BOW, -JOIN, 180 + JOIN, 48),
  [-BLADE, -4],
  [0.75, -4],
  [0.75, -3.5],
  [0.5, -3.5],
  [0.5, -3],
  [0.75, -3],
  [0.75, -2.5],
  [BLADE, -2.5],
];
const CLASSIC_GROOVE = { from: -1.5, to: -3.75 };

// The right key, a flat one: a rounded square head, a blade with three
// V cuts down its right edge and a pointed tip.
const FLAT_HEAD = { r: 0.5, top: 0.75, w: 1 };
const FLAT: P2[] = [
  ...arc(0.5, 0.25, FLAT_HEAD.r, 90, 0, 8),
  ...arc(0.5, -0.5, FLAT_HEAD.r, 0, -90, 8),
  [0.5, -1.25],
  [0.25, -1.625],
  [0.5, -2],
  [0.25, -2.375],
  [0.5, -2.75],
  [0.25, -3.125],
  [0.5, -3.5],
  [0, -4],
  [-0.5, -3.5],
  ...arc(-0.5, -0.5, FLAT_HEAD.r, -90, -180, 8),
  ...arc(-0.5, 0.25, FLAT_HEAD.r, 180, 90, 8),
];
const FLAT_GROOVE = { from: -1.25, to: -3.25, x: -0.125 };

// The tag (the one brand mark): a rounded tab with the hole near its top.
const TAG = { h: 2, r: 0.5, top: 0.75, w: 1.5 };

/* The ring threads every hole the same way: going round from the left key
 * to the right one, it comes up from behind the part, through the hole,
 * and over the part's face on the far side. So the whole band is painted
 * first (behind everything), and after each part the run of band from that
 * part's hole to the next one is painted again, over it. Each run starts
 * in the middle of a hole and ends inside the next hole (or in the clear
 * past the last key), always on top of the band behind, so neither of its
 * ends draws a line. Parts stack left key, tag, right key, so the band in
 * front of one part is always behind the next. */
const RUNS = {
  left: [AT.left, AT.tag],
  right: [AT.right, AT.right + 50],
  tag: [AT.tag, AT.right],
} as const;
// The wedge a run is clipped to reaches past the band and its outline.
const WEDGE = RING.out + 0.5;

// The frame fits it all at rest: the keys' outer edges, their tips, the
// plate and the strip its depth shows. Swings run into the padding.
const REACH = -HANG.left[0] + BOW;
const EXTENT: Vec3[] = [
  [-REACH, 0, 0],
  [REACH, 0, 0],
  [-REACH, -PLATE.d, PLATE.z],
  [REACH, -PLATE.d, PLATE.z],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The ring's lean about the hook, degrees. */
  swing: IsoTrack;
}

const beat = (t0: number): Clip => {
  const swing: IsoKey[] = [[t0, 0, EASE.drop]];
  let t = t0;
  for (const { deg, ms } of SWINGS) {
    t += ms;
    swing.push([t, deg, EASE.easy]);
  }
  return { end: t + Math.max(...FOLLOW.lags), swing };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const ringPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.swing, ms)),
  });

/**
 * A part hanging on the ring: where the ring was `lag` ms ago, swung
 * wider, less where the ring is now (its rig sits inside the ring's),
 * and never past the stop.
 */
const followPose =
  (clip: Clip, lag: number) =>
  (ms: number): IsoPose => {
    const own = FOLLOW.gain * sample(clip.swing, ms - lag);
    const held = Math.max(-FOLLOW.stop, Math.min(FOLLOW.stop, own));
    return { axis: "y", rotate: r2(held - sample(clip.swing, ms)) };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const PAPER = { ...faceFill("surface", "top"), fillRule: "evenodd" } as const;

/** The wall plate, the hook bar and the boss it comes out of. */
const Plate = () => (
  <Extrude
    at={[-PLATE.w / 2, 0, PLATE.z]}
    convex
    d={roundedRect(PLATE.w, PLATE.h, PLATE.r)}
    depth={PLATE.d}
    palette="surface"
    plane="left"
  />
);

const Hook = () => (
  <>
    <FacePath
      at={[0, 0, BOSS.z]}
      d={roundedRect(HOOK.w, BOSS.z - HOOK.end, HOOK.w / 2, -HOOK.w / 2, 0)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <FacePath
      at={[0, 0, BOSS.z]}
      d={circle(0, 0, BOSS.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
  </>
);

/** The ring's band. */
const Band = () => (
  <FacePath
    at={RING_C}
    d={`${circle(0, 0, RING.out)} ${circle(0, 0, RING.in)}`}
    plane="left"
    style={PAPER}
  />
);

/**
 * A run of the band, painted over the part before it: the same band,
 * clipped to the wedge between two angles, so it lands exactly on the band
 * behind and its cut ends never show.
 */
const BandRun = ({
  id,
  run: [from, to],
}: {
  id: string;
  run: readonly [number, number];
}) => (
  <>
    <clipPath id={id}>
      <FacePath
        at={RING_C}
        d={poly([[0, 0], ...arc(0, 0, WEDGE, from, to, 12)])}
        plane="left"
      />
    </clipPath>
    <g clipPath={`url(#${id})`}>
      <Band />
    </g>
  </>
);

/** A hanging part: its outline and hole, and a groove line if it has one. */
const Part = ({
  at,
  outline,
  groove,
  brand = false,
}: {
  at: Vec3;
  outline: string;
  groove?: string;
  brand?: boolean;
}) => (
  <>
    <FacePath
      at={at}
      d={`${outline} ${circle(0, 0, HOLE)}`}
      plane="left"
      style={
        brand
          ? { ...LINE, fill: "var(--iso-main-left)", fillRule: "evenodd" }
          : PAPER
      }
    />
    {groove ? <FacePath at={at} d={groove} plane="left" style={LINE} /> : null}
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type KeyringProps = LineStateProps;

/**
 * Keyring: a complete "no passwords saved" state with a line
 * illustration, a heading, a line of copy and a button. A key ring
 * hanging from a small wall hook, facing the screen, with a classic key,
 * a flat key and a tag on it: it is jostled, the ring swings on the hook
 * and the keys swing on the ring a moment later, then all hang still and
 * straight. One fine outline, paper faces, the tag the one brand mark, no
 * shadow. Plays when it comes into view, or each time `active` turns true
 * (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const Keyring = ({
  heading = "No passwords saved",
  description = "Save a password and it will be filled in for you.",
  actionLabel = "Add password",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: KeyringProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const [lagLeft, lagTag, lagRight] = FOLLOW.lags;
  const uid = useId().replaceAll(":", "");
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
      slot="keyring"
      view="front"
    >
      <Plate />
      <Hook />
      <Rig pivot={RING_PIVOT} {...onClock(clock, ringPose(clip), clip.end)}>
        <Band />
        <Rig
          pivot={HANG.left}
          {...onClock(clock, followPose(clip, lagLeft), clip.end)}
        >
          <Part
            at={HANG.left}
            groove={`M0 ${-CLASSIC_GROOVE.from} V${-CLASSIC_GROOVE.to}`}
            outline={poly(CLASSIC)}
          />
        </Rig>
        <BandRun id={`${uid}-left`} run={RUNS.left} />
        <Rig
          pivot={HANG.tag}
          {...onClock(clock, followPose(clip, lagTag), clip.end)}
        >
          <Part
            at={HANG.tag}
            brand
            outline={roundedRect(TAG.w, TAG.h, TAG.r, -TAG.w / 2, -TAG.top)}
          />
        </Rig>
        <BandRun id={`${uid}-tag`} run={RUNS.tag} />
        <Rig
          pivot={HANG.right}
          {...onClock(clock, followPose(clip, lagRight), clip.end)}
        >
          <Part
            at={HANG.right}
            groove={`M${FLAT_GROOVE.x} ${-FLAT_GROOVE.from} V${-FLAT_GROOVE.to}`}
            outline={poly(FLAT)}
          />
        </Rig>
        <BandRun id={`${uid}-right`} run={RUNS.right} />
      </Rig>
    </LineState>
  );
};

export default Keyring;
