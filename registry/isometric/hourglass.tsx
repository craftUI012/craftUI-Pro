"use client";

import type { MotionValue } from "motion/react";
import { useEffect, useState } from "react";

import { EASE, FacePath, Rig, project, sample, useRigged } from "./iso-core";
import type { IsoKey, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LINE,
  LineState,
  Ring,
  Slice,
  faceFill,
  facing,
  r2,
  ring,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "Nothing here yet", told by one object in line: an hourglass that is
 * turned over and runs. Use: waiting. Move: a half turn, then the sand
 * runs down. Each value is ms after the art comes into view.
 *
 *    0ms   the hourglass stands still, the sand piled in the lower bulb
 *  400ms   it is picked up 0.5 units (240ms) and turned over clockwise
 *          about its middle (600ms), 5° past, back, straight
 *  760ms   past the side, the sand slides down to the neck (300ms)
 * 1000ms   it is set down; it squashes 3% as it lands
 * 1250ms   the sand runs: a thin stream falls from the neck (100ms), the
 *          top bulb empties as the pile grows under it (1100ms)
 * 2350ms   the last grain leaves the neck and the stream drops away
 * 2450ms   still: sand piled in the lower bulb, exactly as it started
 *
 * Rest to rest (the glass is the same both ways up), so one clip built
 * twice: 400ms wait in view, 80ms when `active` turns true.
 * Reduced motion, or `active` false before any play: the hourglass
 * standing still.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built standing on z = 0 about the vertical axis x = y = 0.

// Two end plates the glass stands between, and two posts between the
// plates in the plane y = 0. No collar: a thin ring stepped between the
// plate and the glass drew its rims a pixel beside theirs.
const PLATE = { h: 0.5, r: 2.5 };
const H = 7;
const MID = H / 2;
const POST = { r: 0.25, x: 2 };

// The glass between the plates, a body of revolution. Each bulb starts
// at a plate 1.25 wide, swells to 1.5 just above it, and narrows to a
// 0.25 neck in the middle. `half` is its radius and slope at a distance
// from the nearer plate; two cubic Hermite spans, smooth where they meet.
const GLASS = {
  belly: 1.5,
  bellyAt: 0.75,
  flare: 0.75,
  foot: 1.25,
  from: PLATE.h,
  neck: 0.25,
  to: H - PLATE.h,
};
const REACH = MID - GLASS.from;

type Profile = (z: number) => readonly [w: number, slope: number];

/** One cubic Hermite span from (a, p0, slope m0) to (b, p1, slope m1). */
const hermite = (
  x: number,
  [a, b]: readonly [number, number],
  [p0, p1]: readonly [number, number],
  [m0, m1]: readonly [number, number]
) => {
  const d = b - a;
  const t = (x - a) / d;
  const t2 = t * t;
  const t3 = t2 * t;
  const w =
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * d * m0 +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * d * m1;
  const slope =
    ((6 * t2 - 6 * t) * p0 +
      (3 * t2 - 4 * t + 1) * d * m0 +
      (-6 * t2 + 6 * t) * p1 +
      (3 * t2 - 2 * t) * d * m1) /
    d;
  return [w, slope] as const;
};

const half = (h: number) =>
  h < GLASS.bellyAt
    ? hermite(
        h,
        [0, GLASS.bellyAt],
        [GLASS.foot, GLASS.belly],
        [GLASS.flare, 0]
      )
    : hermite(h, [GLASS.bellyAt, REACH], [GLASS.belly, GLASS.neck], [0, 0]);

/** The glass's radius and slope (dw/dz) at a height. */
const glass: Profile = (z) => {
  if (z <= MID) {
    return half(z - GLASS.from);
  }
  const [w, slope] = half(GLASS.to - z);
  return [w, -slope];
};

// The glass has a wall: the sand fills the bore inside it, one wall in
// from the outline and up from each end. Without it the sand's edge and
// its level ring met the glass's outline along the same curve and drew one
// thick, doubled line.
const WALL = 0.25;
const BORE = { from: GLASS.from + WALL, to: GLASS.to - WALL };
// The narrowest the bore gets, at the neck (the stream's half width).
const THROAT = 0.0625;

/** The bore's radius and slope at a height. */
const bore: Profile = (z) => {
  const [w, slope] = glass(z);
  return w - WALL > THROAT ? [w - WALL, slope] : [THROAT, 0];
};

// Volume under the bore from its foot, tabled, so the sand's levels can
// be found from how much of it is where.
const STEPS = 240;
const DZ = (BORE.to - BORE.from) / STEPS;
const CUM: number[] = [0];
for (let i = 1; i <= STEPS; i += 1) {
  const [a] = bore(BORE.from + (i - 1) * DZ);
  const [b] = bore(BORE.from + i * DZ);
  CUM.push(CUM[i - 1] + (Math.PI * DZ * (a * a + b * b)) / 2);
}
const volumeTo = (z: number) => {
  const f = Math.min(STEPS, Math.max(0, (z - BORE.from) / DZ));
  const i = Math.min(STEPS - 1, Math.floor(f));
  return CUM[i] + (CUM[i + 1] - CUM[i]) * (f - i);
};
/** The height below which the bore holds `v`. */
const levelOf = (v: number) => {
  let lo = BORE.from;
  let hi = BORE.to;
  for (let i = 0; i < 30; i += 1) {
    const m = (lo + hi) / 2;
    if (volumeTo(m) < v) {
      lo = m;
    } else {
      hi = m;
    }
  }
  return (lo + hi) / 2;
};

// The sand: piled in the lower bulb up to LEVEL, with a cone on top.
const SAND = { level: 1.5, mound: 1.25, stream: 0.125 };
const SAND_V = volumeTo(SAND.level);
const TOTAL_V = volumeTo(BORE.to);
// Once the glass is over, the same sand sits on the neck of the top bulb.
const SLID = levelOf(volumeTo(MID) - SAND_V);

// The frame fits the hourglass standing: both plates, front to back.
const EXTENT: Vec3[] = [
  [-PLATE.r, 0, 0],
  [PLATE.r, 0, 0],
  [0, PLATE.r, 0],
  [0, -PLATE.r, H],
  [-PLATE.r, 0, H],
  [PLATE.r, 0, H],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Lift off the floor, world units. */
  lift: IsoTrack;
  /** Height scale about the floor as it lands. */
  squash: IsoTrack;
  /** Degrees, clockwise, about the middle (in the front plane). */
  turn: IsoTrack;
  /** 0 → 1: the sand slides from the cap to the neck once it is over. */
  slide: IsoTrack;
  /** 0 → 1: how much sand has run into the lower bulb. */
  flow: IsoTrack;
  /** 0 → 1: the stream's falling front, from the neck to the pile. */
  head: IsoTrack;
  /** 0 → 1: the stream's last grain, from the neck to the pile. */
  tail: IsoTrack;
}

const beat = (t0: number): Clip => {
  const over = t0 + 60;
  const down = t0 + 600;
  const land = down + 200;
  const run = land + 50;
  const done = run + 1100;
  const lift: IsoKey[] = [
    [t0, 0, EASE.easy],
    [t0 + 240, 0.5, "hold"],
    [down, 0.5, EASE.in],
    [land, 0],
  ];
  const squash: IsoKey[] = [
    [land, 1, EASE.easy],
    [land + 70, 0.97, EASE.easy],
    [land + 160, 1.01, EASE.easy],
    [land + 240, 1],
  ];
  const turn: IsoKey[] = [
    [over, 0, EASE.snap],
    [over + 600, 185, EASE.easy],
    [over + 740, 179, EASE.easy],
    [over + 860, 180],
  ];
  const slide: IsoKey[] = [
    [t0 + 360, 0, EASE.easy],
    [t0 + 660, 1],
  ];
  const flow: IsoKey[] = [
    [run, 0],
    [done, 1],
  ];
  const head: IsoKey[] = [
    [run, 0, EASE.in],
    [run + 100, 1],
  ];
  const tail: IsoKey[] = [
    [done, 0, EASE.in],
    [done + 100, 1],
  ];
  return { end: done + 100, flow, head, lift, slide, squash, tail, turn };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/** The clock's time as state (the sand is rebuilt from it every frame). */
const useBeatTime = (clock: MotionValue<number> | undefined, rest: number) => {
  const [ms, setMs] = useState(0);
  useEffect(() => clock?.on("change", setMs), [clock]);
  return clock ? ms : rest;
};

/* ─────────────────────────── Round solids ─────────────────────────────── */

type P2 = readonly [number, number];

const pathOf = (pts: readonly P2[]) =>
  `M${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" L")} Z`;

/** Which way a → b turns about o (the cross product's sign). */
const turn = (o: P2, a: P2, b: P2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull of screen points (monotone chain). */
const hull = (pts: readonly P2[]) => {
  const sorted = [...pts].toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const side = (list: readonly P2[]) => {
    const out: P2[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        turn(out.at(-2) as P2, out.at(-1) as P2, p) <= 0
      ) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...side(sorted), ...side(sorted.toReversed())];
};

const det = (a: Vec3, b: Vec3, c: Vec3) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) -
  a[1] * (b[0] * c[2] - b[2] * c[0]) +
  a[2] * (b[0] * c[1] - b[1] * c[0]);

/**
 * A body of revolution about the local z axis, exact at any lean. Its
 * outline is where the surface turns edge-on to the camera: with the
 * direction toward the viewer k in local units and the surface normal
 * (cos φ, sin φ, −w′), cos φ·kx + sin φ·ky = w′·kz. Between those two
 * contour lines, the end ring that faces the viewer closes it over the
 * back, the other one under the front. `toward` is k.
 */
const useLathe = () => {
  const rigged = useRigged();
  const o = rigged([0, 0, 0]);
  const col = (p: Vec3): Vec3 => {
    const q = rigged(p);
    return [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
  };
  const ex = col([1, 0, 0]);
  const ey = col([0, 1, 0]);
  const ez = col([0, 0, 1]);
  // The camera looks along (1, 1, 1); undo every rig to find it locally.
  const view: Vec3 = [1, 1, 1];
  const d = det(ex, ey, ez);
  const toward: Vec3 = [
    det(view, ey, ez) / d,
    det(ex, view, ez) / d,
    det(ex, ey, view) / d,
  ];
  const at = (w: number, phi: number, z: number) =>
    project(rigged([w * Math.cos(phi), w * Math.sin(phi), z])) as P2;
  const alpha = Math.atan2(toward[1], toward[0]);
  const reach = Math.hypot(toward[0], toward[1]);
  const contour = (profile: Profile, z: number) => {
    const [w, slope] = profile(z);
    const c = Math.max(-1, Math.min(1, (slope * toward[2]) / reach));
    const beta = Math.acos(c);
    return { beta, w };
  };
  const arc = (w: number, z: number, from: number, to: number) =>
    Array.from({ length: 17 }, (_, i) =>
      at(w, from + ((to - from) * i) / 16, z)
    );
  /** The outline from z0 up to z1, and which end faces the viewer. */
  const outline = (profile: Profile, z0: number, z1: number) => {
    const n = Math.max(2, Math.ceil((z1 - z0) / 0.125));
    const zs = Array.from(
      { length: n + 1 },
      (_, i) => z0 + ((z1 - z0) * i) / n
    );
    const cs = zs.map((z) => contour(profile, z));
    const up = toward[2] >= 0;
    const { [n]: top } = cs;
    const [foot] = cs;
    const pts: P2[] = [
      ...zs.map((z, i) => at(cs[i].w, alpha + cs[i].beta, z)),
      ...arc(
        top.w,
        z1,
        alpha + top.beta,
        up ? alpha + 2 * Math.PI - top.beta : alpha - top.beta
      ),
      ...zs.toReversed().map((z, i) => {
        const c = cs[n - i];
        return at(c.w, alpha - c.beta, z);
      }),
      ...arc(
        foot.w,
        z0,
        alpha - foot.beta,
        up ? alpha + foot.beta : alpha + foot.beta - 2 * Math.PI
      ),
    ];
    return { d: pathOf(pts), up };
  };
  /** A cone: a level ring at z with its tip `rise` along z. */
  const cone = (w: number, z: number, rise: number) =>
    pathOf(
      hull([
        ...ring([0, 0, z], w).map((p) => project(rigged(p)) as P2),
        project(rigged([0, 0, z + rise])) as P2,
      ])
    );
  return { cone, outline, toward };
};

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const GLASS_FILL = { ...faceFill("surface", "top"), stroke: "none" };
const SAND_SIDE = faceFill("main", "left");
const SAND_TOP = faceFill("main", "top");

/**
 * Sand filling the glass between z0 and z1. The end that faces the viewer
 * is a flat level, or a cone of `mound` when the pile is on that end
 * (`pile`: z1 for sand in the lower bulb standing up, z0 once over).
 */
const Sand = ({
  z0,
  z1,
  mound = 0,
  pile = "z1",
}: {
  z0: number;
  z1: number;
  mound?: number;
  pile?: "z0" | "z1";
}) => {
  const { cone, outline } = useLathe();
  if (z1 - z0 < 0.02) {
    return null;
  }
  const { d, up } = outline(bore, z0, z1);
  const capZ = up ? z1 : z0;
  const [w] = bore(capZ);
  // A pile only shows on the face that looks up at the viewer.
  const piled = mound > 0.02 && (up ? pile === "z1" : pile === "z0");
  const rise = up ? mound : -mound;
  return (
    <g>
      <path d={d} style={SAND_SIDE} />
      {piled ? (
        <path d={cone(w, capZ, rise)} style={SAND_TOP} />
      ) : (
        <Ring center={[0, 0, capZ]} palette="main" r={w} />
      )}
    </g>
  );
};

/** The sand's levels at a time on the clip, in the glass's own heights. */
const sandAt = (clip: Clip, ms: number) => {
  const slide = sample(clip.slide, ms);
  // The pile slumps as the glass tips, and is flat by the time it is on
  // its side.
  const tip = Math.max(0, Math.cos((sample(clip.turn, ms) * Math.PI) / 180));
  const flow = sample(clip.flow, ms);
  // Before it runs: one body of sand, moving from the cap to the neck.
  const first = {
    mound: SAND.mound * tip * (1 - slide),
    z0: BORE.from + (SLID - BORE.from) * slide,
    z1: SAND.level + (MID - SAND.level) * slide,
  };
  // Running: the top bulb (z below MID once over) drains into the cap end.
  const left = SAND_V * (1 - flow);
  const top = { z0: levelOf(volumeTo(MID) - left), z1: MID };
  const pileFrom = levelOf(TOTAL_V - SAND_V * flow);
  const mound = SAND.mound * Math.sqrt(flow);
  const pile = { mound, z0: pileFrom, z1: BORE.to };
  const peak = pileFrom - mound;
  const head = sample(clip.head, ms);
  const tail = sample(clip.tail, ms);
  const stream =
    head > 0 && tail < 1
      ? { from: MID + (peak - MID) * tail, to: MID + (peak - MID) * head }
      : null;
  return { first, flow, pile, stream, top };
};

/**
 * The stream: a thin strip on the axis plane, from the neck (`from`) to
 * the pile (`to`). Once over, the glass's own z runs downward on screen,
 * so the strip's face corner is at `to`.
 */
const Stream = ({ from, to }: { from: number; to: number }) => (
  <FacePath
    at={[-SAND.stream / 2, 0, to]}
    d={`M0 0 H${SAND.stream} V${r2(to - from)} H0 Z`}
    plane="left"
    style={SAND_SIDE}
  />
);

/** A disc between two heights, its face to the viewer painted last. */
const Disc = ({
  z0,
  z1,
  r,
  up,
}: {
  z0: number;
  z1: number;
  r: number;
  up: boolean;
}) => {
  const lo: readonly [Vec3, number] = [[0, 0, z0], r];
  const hi: readonly [Vec3, number] = [[0, 0, z1], r];
  return up ? <Slice bottom={lo} top={hi} /> : <Slice bottom={hi} top={lo} />;
};

/** An end plate: the bottom one or the top one. */
const End = ({ top, up }: { top: boolean; up: boolean }) =>
  top ? (
    <Disc r={PLATE.r} up={up} z0={H - PLATE.h} z1={H} />
  ) : (
    <Disc r={PLATE.r} up={up} z0={0} z1={PLATE.h} />
  );

/** A post: a thin rod from plate to plate. */
const Post = ({ x, up }: { x: number; up: boolean }) => {
  const lo: readonly [Vec3, number] = [[x, 0, PLATE.h], POST.r];
  const hi: readonly [Vec3, number] = [[x, 0, H - PLATE.h], POST.r];
  return up ? <Slice bottom={lo} top={hi} /> : <Slice bottom={hi} top={lo} />;
};

/**
 * The hourglass at a time on the clip. Inside its rigs it reads which way
 * up it is and paints from the end furthest from the viewer: the lower
 * end, the posts, the glass and its sand, the upper end.
 */
const Body = ({ clip, ms }: { clip: Clip; ms: number }) => {
  const { outline, toward } = useLathe();
  const up = toward[2] >= 0;
  const glassPath = outline(glass, GLASS.from, GLASS.to).d;
  const sand = sandAt(clip, ms);
  const running = sand.flow > 0 || sand.stream !== null;
  return (
    <g>
      <End top={!up} up={up} />
      <Post up={up} x={-POST.x} />
      <Post up={up} x={POST.x} />
      <path d={glassPath} style={GLASS_FILL} />
      {running ? (
        <>
          <Sand
            mound={sand.pile.mound}
            pile="z0"
            z0={sand.pile.z0}
            z1={sand.pile.z1}
          />
          {sand.stream ? <Stream {...sand.stream} /> : null}
          <Sand z0={sand.top.z0} z1={sand.top.z1} />
        </>
      ) : (
        <Sand z0={sand.first.z0} z1={sand.first.z1} mound={sand.first.mound} />
      )}
      <path d={glassPath} style={LINE} />
      <End top={up} up={up} />
    </g>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type HourglassProps = LineStateProps;

/**
 * Hourglass: a complete "nothing here yet" state with a line illustration,
 * a heading, a line of copy and a button. An hourglass is turned over and
 * its sand runs down into the lower bulb, ending exactly as it started.
 * One fine outline, paper faces, the sand the one brand mark, facing the
 * screen, no shadow. Pass `active` (PlayOnHover, or your own state) to
 * play it again. Follows the shadcn theme.
 */
export const Hourglass = ({
  heading = "Nothing here yet",
  description = "Results will appear once the first run finishes.",
  actionLabel = "Refresh",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: HourglassProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const ms = useBeatTime(clock, clip.end);
  const s = r2(sample(clip.squash, ms));
  const w = r2(1 / Math.sqrt(s));
  return (
    <LineState
      bounds={BOUNDS}
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
      defaultArtClassName="w-36"
      slot="hourglass"
    >
      <Rig
        offset={[0, 0, r2(sample(clip.lift, ms))]}
        pivot={[0, 0, 0]}
        scale={[w, w, s]}
      >
        <Rig axis="y" pivot={[0, 0, MID]} rotate={r2(sample(clip.turn, ms))}>
          <Body clip={clip} ms={ms} />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default Hourglass;
