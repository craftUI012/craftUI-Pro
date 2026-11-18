"use client";

import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";

import {
  EASE,
  Extrude,
  FacePath,
  Rig,
  Slab,
  project,
  roundedRect,
  sample,
  useRigged,
} from "./iso-core";
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
 * "No devices enrolled", told by one object in line: a desk fingerprint
 * reader at the true isometric angle (a low rounded base, a head with a
 * sloped glass pad and a fingerprint on it, a status light, a cable)
 * that scans an empty pad once. Use: empty state. Move: a bar sliding
 * across the pad (cut at its edges), a pop. Each value is ms after the
 * art comes into view.
 *
 *    0ms   the reader stands still; the scan bar waits out of sight past
 *          the pad's back edge
 *  400ms   the bar sweeps down the pad toward the front, over the print
 *          (640ms, easing in and out), and slides off its front edge
 * 1040ms   the status light pops (1.6×, 300ms): read, nothing enrolled
 * 1200ms   the bar sweeps back up the pad (480ms, easing in and out) and
 *          slides off its back edge
 * 1680ms   still: exactly as it started
 *
 * The bar is clipped to the pad: it only ever shows on the glass.
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the reader, still.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The sweep back up the pad.
  back: 480,
  // The sweep down the pad.
  down: 640,
  // The bar waits past the front edge this long.
  hold: 160,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // The status light grows this much as the scan ends.
  pop: 1.6,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built along the world axes, standing on z = 0: the front (the light)
// faces +y, the side with the cable faces +x.

// The base: a low rounded slab, half a unit proud of the head all round.
const BASE = { d: 7, h: 1, r: 1, w: 7 };
const BX0 = -BASE.w / 2;
const BX1 = BASE.w / 2;
const BY0 = -BASE.d / 2;
const BY1 = BASE.d / 2;

// The head: a wedge on the base, low at the front, high at the back, its
// top the sloped glass.
const HEAD = { back: 3, front: 1.5, inset: 0.5 };
const HX0 = BX0 + HEAD.inset;
const HX1 = BX1 - HEAD.inset;
const HY0 = BY0 + HEAD.inset;
const HY1 = BY1 - HEAD.inset;
const HZ_FRONT = BASE.h + HEAD.front;
const HZ_BACK = BASE.h + HEAD.back;

// The slope: a level top face turned about the head's front top edge. In
// its own frame it is a level face from v = 0 (the back) to v = SLOPE.len
// (the front), u across from the left.
const RISE = HZ_BACK - HZ_FRONT;
const RUN = HY1 - HY0;
const SLOPE = {
  deg: r2((Math.atan2(RISE, RUN) * 180) / Math.PI),
  len: r2(Math.hypot(RISE, RUN)),
};
const SLOPE_PIVOT: Vec3 = [0, HY1, HZ_FRONT];
// The slope's face origin (u = v = 0) before it is turned.
const SLOPE_AT: Vec3 = [HX0, r2(HY1 - SLOPE.len), HZ_FRONT];

// The glass pad on the slope, centred, and the print on it: nested
// ridges, arches over the top whose legs run down toward the front, some
// broken, the outer one an arch alone (`a` the arc's ends in degrees, v
// down; `legs` how far each end runs on toward the front, if at all).
const PAD = { h: 5, r: 0.75, w: 5 };
const PAD_U = (HX1 - HX0 - PAD.w) / 2;
const PAD_V = r2((SLOPE.len - PAD.h) / 2);
const PRINT = { u: (HX1 - HX0) / 2, v: r2(PAD_V + 2.75) };
const RIDGES = [
  { a: [180, 360], legs: [0.5, 0.5], r: 0.5 },
  { a: [180, 360], legs: [1.25, 0.75], r: 1 },
  { a: [180, 250], legs: [1.5, 0], r: 1.5 },
  { a: [290, 360], legs: [0, 1.25], r: 1.5 },
  { a: [195, 345], legs: [0, 0], r: 2 },
] as const;

// The scan bar: a strip across the pad, waiting past its back edge.
const BAR = { h: 0.5, rest: r2(PAD_V - 0.75), travel: PAD.h + 1.5 };

// The status light on the head's front wall, at the right: the one brand
// mark (face units: u across from the left, v down from the top).
const LIGHT = { r: 0.25, u: 5.25, v: 0.75 };
const LIGHT_AT: Vec3 = [HX0 + LIGHT.u, HY1, HZ_FRONT - LIGHT.v];

// The cable: a round stub out of the base's right side, toward the back.
const CABLE = { len: 1.5, r: 0.25, y: -1.5, z: 0.5 };

// The frame fits the reader at rest. The base is rounded, so its corners
// are the points of its round edges furthest out (`round`).
const round = (sx: -1 | 1, sy: -1 | 1, z: number): Vec3 => {
  const k = BASE.r * (1 - Math.SQRT1_2);
  return [sx < 0 ? BX0 + k : BX1 - k, sy < 0 ? BY0 + k : BY1 - k, z];
};
const EXTENT: Vec3[] = [
  round(-1, 1, 0),
  round(-1, 1, BASE.h),
  round(1, 1, 0),
  round(1, -1, 0),
  round(1, -1, BASE.h),
  round(-1, -1, BASE.h),
  [HX0, HY0, HZ_BACK],
  [HX1, HY0, HZ_BACK],
  [BX1 + CABLE.len, CABLE.y + CABLE.r, CABLE.z - CABLE.r],
  [BX1 + CABLE.len, CABLE.y - CABLE.r, CABLE.z + CABLE.r],
];
const BOUNDS = viewBounds("isometric", EXTENT);

// Glass: a step under the paper of the slope it sits in.
const GLASS = faceFill("surface", "right");

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** How far the bar has come down the pad from rest, world units. */
  scan: IsoTrack;
  /** Scale of the status light. */
  light: IsoTrack;
}

const beat = (t0: number): Clip => {
  const front = t0 + TIMING.down;
  const leave = front + TIMING.hold;
  const home = leave + TIMING.back;
  const scan: IsoKey[] = [
    [t0, 0, EASE.easy],
    [front, BAR.travel, "hold"],
    [leave, BAR.travel, EASE.easy],
    [home, 0],
  ];
  const light: IsoKey[] = [
    [front - 20, 1, EASE.soft],
    [front + 140, MOVE.pop, EASE.easy],
    [front + 300, 1],
  ];
  return { end: home, light, scan };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const barPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [0, r2(sample(clip.scan, ms)), 0],
  });

const lightPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.light, ms));
    return { scale: [k, 1, k] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** A flat polygon through world points, sent through the rigs around it. */
const Quad = ({
  points,
  style,
}: {
  points: readonly Vec3[];
  style: CSSProperties;
}) => {
  const rigged = useRigged();
  const d = `M${points.map((p) => project(rigged(p)).join(",")).join(" L")} Z`;
  return <path d={d} style={style} />;
};

/** An arc as cubic face-path segments (degrees, v down), no move-to. */
const arc = (cu: number, cv: number, r: number, a0: number, a1: number) => {
  const n = Math.ceil(Math.abs(a1 - a0) / 90);
  const step = ((a1 - a0) / n) * (Math.PI / 180);
  const k = (4 / 3) * Math.tan(step / 4);
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (a0 * Math.PI) / 180 + i * step;
    const b = a + step;
    const p0 = [cu + r * Math.cos(a), cv + r * Math.sin(a)];
    const p3 = [cu + r * Math.cos(b), cv + r * Math.sin(b)];
    const p1 = [p0[0] - k * r * Math.sin(a), p0[1] + k * r * Math.cos(a)];
    const p2 = [p3[0] + k * r * Math.sin(b), p3[1] - k * r * Math.cos(b)];
    parts.push(
      `C${r2(p1[0])} ${r2(p1[1])} ${r2(p2[0])} ${r2(p2[1])} ${r2(p3[0])} ${r2(p3[1])}`
    );
  }
  return parts.join(" ");
};

/** A point on a ridge's arch. */
const onArch = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [r2(PRINT.u + r * Math.cos(a)), r2(PRINT.v + r * Math.sin(a))];
};

/** One ridge of the print: up its left leg, over the arch, down its right. */
const ridge = (
  r: number,
  [a0, a1]: readonly [number, number],
  [l0, l1]: readonly [number, number]
) => {
  const [u0, v0] = onArch(r, a0);
  const [u1, v1] = onArch(r, a1);
  return [
    l0 ? `M${u0} ${r2(v0 + l0)} L${u0} ${v0}` : `M${u0} ${v0}`,
    arc(PRINT.u, PRINT.v, r, a0, a1),
    l1 ? `L${u1} ${r2(v1 + l1)}` : "",
  ].join(" ");
};

/** The base and the cable out of its right side. */
const Base = () => (
  <>
    <Slab at={[BX0, BY0, 0]} radius={BASE.r} size={[BASE.w, BASE.d, BASE.h]} />
    <Extrude
      at={[BX1 + CABLE.len, CABLE.y + CABLE.r, CABLE.z + CABLE.r]}
      convex
      d={disc(CABLE.r)}
      depth={CABLE.len}
      palette="surface"
      plane="right"
    />
  </>
);

/** The head's two walls you see and its sloped top. */
const Head = () => (
  <>
    <Quad
      points={[
        [HX0, HY1, BASE.h],
        [HX1, HY1, BASE.h],
        [HX1, HY1, HZ_FRONT],
        [HX0, HY1, HZ_FRONT],
      ]}
      style={faceFill("surface", "left")}
    />
    <Quad
      points={[
        [HX1, HY1, BASE.h],
        [HX1, HY0, BASE.h],
        [HX1, HY0, HZ_BACK],
        [HX1, HY1, HZ_FRONT],
      ]}
      style={faceFill("surface", "right")}
    />
    <Quad
      points={[
        [HX0, HY1, HZ_FRONT],
        [HX1, HY1, HZ_FRONT],
        [HX1, HY0, HZ_BACK],
        [HX0, HY0, HZ_BACK],
      ]}
      style={faceFill("surface", "top")}
    />
  </>
);

const PAD_PATH = roundedRect(PAD.w, PAD.h, PAD.r, PAD_U, PAD_V);

/**
 * The glass pad on the slope (drawn level, turned by the rig around it):
 * the glass, the scan bar clipped to it, the print, then the pad's edge
 * again over the bar's cut ends.
 */
const Pad = ({ clipId, bar }: { clipId: string; bar: ReactNode }) => (
  <>
    <clipPath id={clipId}>
      <FacePath at={SLOPE_AT} d={PAD_PATH} plane="top" />
    </clipPath>
    <FacePath at={SLOPE_AT} d={PAD_PATH} plane="top" style={GLASS} />
    <g clipPath={`url(#${clipId})`}>{bar}</g>
    {RIDGES.map(({ a, legs, r }) => (
      <FacePath
        at={SLOPE_AT}
        d={ridge(r, a, legs)}
        key={`${r}-${a[0]}`}
        plane="top"
        style={LINE}
      />
    ))}
    <FacePath at={SLOPE_AT} d={PAD_PATH} plane="top" style={LINE} />
  </>
);

/** The scan bar, across the pad at rest, past its back edge. */
const Bar = () => (
  <FacePath
    at={SLOPE_AT}
    d={`M${PAD_U - 0.5} ${BAR.rest} H${PAD_U + PAD.w + 0.5} V${BAR.rest + BAR.h} H${PAD_U - 0.5} Z`}
    plane="top"
    style={faceFill("surface", "top")}
  />
);

/** The status light on the head's front wall, the one brand mark. */
const Light = () => (
  <FacePath
    at={[HX0, HY1, HZ_FRONT]}
    d={circle(LIGHT.u, LIGHT.v, LIGHT.r)}
    plane="left"
    style={faceFill("main", "left")}
  />
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type FingerprintScannerProps = LineStateProps;

/**
 * Fingerprint scanner: a complete "no devices enrolled" state with a line
 * illustration, a heading, a line of copy and a button. A desk fingerprint
 * reader at the true isometric angle (a low rounded base, a head with a
 * sloped glass pad carrying a fingerprint, a status light, a cable): a
 * scan bar sweeps down the empty pad, the light pops, and the bar sweeps
 * back. One fine outline, paper faces, the status light the one brand
 * mark, no shadow. Plays when it comes into view, or each time `active`
 * turns true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const FingerprintScanner = ({
  heading = "No devices enrolled",
  description = "Add a device to sign in with your fingerprint.",
  actionLabel = "Add device",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: FingerprintScannerProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const clipId = `${useId().replaceAll(":", "")}-pad`;
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
      slot="fingerprint-scanner"
      view="isometric"
    >
      {/* Back to front: the base and its cable, the head, the pad on its
          slope, then the status light. */}
      <Base />
      <Head />
      <Rig axis="x" pivot={SLOPE_PIVOT} rotate={-SLOPE.deg}>
        <Pad
          bar={
            <Rig pivot={[0, 0, 0]} {...onClock(clock, barPose(clip), clip.end)}>
              <Bar />
            </Rig>
          }
          clipId={clipId}
        />
      </Rig>
      <Rig pivot={LIGHT_AT} {...onClock(clock, lightPose(clip), clip.end)}>
        <Light />
      </Rig>
    </LineState>
  );
};

export default FingerprintScanner;
