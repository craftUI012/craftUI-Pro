"use client";

import { EASE, FacePath, Rig, project, sample, useRigged } from "./iso-core";
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
 * "No API keys yet", told by one object in line: a classic key lying flat
 * on the desk, seen in isometric, that is picked up and pushed forward as
 * if into a lock, turns a quarter turn about its own length, turns back
 * and is set down where it was. Use: empty state. Move: a lift and slide,
 * a turn about the part's own axis, and back. Each value is ms after the
 * art comes into view.
 *
 *    0ms   the key lies still, its teeth along its far edge
 *  400ms   it lifts 0.5 and slides forward 1 unit along its length
 *          (280ms, fast out, soft in)
 *  680ms   it turns a quarter turn about its own length, its face rolling
 *          toward the viewer, a few degrees past and back (360ms)
 * 1040ms   it holds, standing on its edge (260ms)
 * 1300ms   it turns back flat (280ms)
 * 1580ms   it slides home and is set down (280ms) with one tiny bounce
 *          (150ms)
 * 2010ms   still: lying exactly where it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the key, lying flat.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The turn back flat.
  back: 280,
  // How long it holds on its edge.
  hold: 260,
  // The slide home and the set-down.
  home: 280,
  // The lift and the slide forward.
  push: 280,
  start: 400,
  // The quarter turn.
  turn: 360,
};

/* How far things move. */
const MOVE = {
  // The tiny bounce as it is set down, world units.
  bounce: 0.06,
  // How high it is lifted, world units.
  lift: 0.5,
  // How far it slides forward, world units.
  push: 1,
  // The quarter turn about its length, degrees (negative rolls its face
  // toward the viewer, so the face stays the side you see).
  turn: -90,
  // How far past the quarter turn it goes before it settles, degrees.
  turnOver: -5,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Lying on z = 0 along the x axis (down-right on screen): the bow at −x,
// the tip at +x, the bit on the −y side (away from the viewer). Plan
// coordinates are [x, y] on the key's top face.

type P2 = readonly [number, number];

// As thick as the bit's cut is deep, so nothing seen through the cut is
// hidden by a wall in front of it.
const T = 0.5;

// The bow: a round head with the hole the ring goes through.
const BOW = { hole: 0.75, r: 1.75, x: -3.5 };
// A rim stamped round the bow's face, half way between hole and edge.
const RIM = 1.25;
// The collar between the bow and the shaft (the brand mark lies on it),
// then the shaft out to its square tip.
const COLLAR = { half: 1, x: -1.25 };
const SHAFT = { half: 0.5, tip: 5.25 };
// The bit on the far (−y) side, so the teeth read as the key's outline
// and stand up when it turns: [x from, x to, how far out], from the bow
// toward the tip. Two teeth and one cut, each 0.75 wide.
const TEETH: readonly (readonly [number, number, number])[] = [
  [2.25, 3, 1.5],
  [3, 3.75, 1],
  [3.75, 4.5, 1.5],
];
// The groove milled along the shaft, a quiet mark.
const GROOVE = { from: -0.75, to: 4.5 };

/** Points round an arc of the bow, from angle a0 to a1 (radians, CCW). */
const arc = (r: number, a0: number, a1: number, n: number): P2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [BOW.x + r * Math.cos(a), r * Math.sin(a)] as P2;
  });

// Where the collar's edges meet the bow.
const MEET = Math.asin(COLLAR.half / BOW.r);

// The outline, counter-clockwise seen from above: out along the −y side
// to the tip, back along the bit's teeth and the +y side, round the bow.
const OUTLINE: P2[] = [
  [COLLAR.x, -COLLAR.half],
  [COLLAR.x, -SHAFT.half],
  [TEETH[0][0], -SHAFT.half],
  ...TEETH.flatMap(([a, b, y]): P2[] => [
    [a, -y],
    [b, -y],
  ]),
  [TEETH.at(-1)?.[1] ?? 0, -SHAFT.half],
  [SHAFT.tip, -SHAFT.half],
  [SHAFT.tip, SHAFT.half],
  [COLLAR.x, SHAFT.half],
  [COLLAR.x, COLLAR.half],
  ...arc(BOW.r, MEET, Math.PI * 2 - MEET, 72),
];
// The hole, clockwise.
const HOLE: P2[] = arc(BOW.hole, Math.PI * 2, 0, 40).slice(1);

// The brand mark: a band of colour round the collar, on the top face.
const BAND = { x0: BOW.x + BOW.r, x1: COLLAR.x };

// The frame fits the key at rest: every outline point, top and foot. The
// slide and the turn run into the padding.
const EXTENT: Vec3[] = OUTLINE.flatMap(([x, y]): Vec3[] => [
  [x, y, 0],
  [x, y, T],
]);
const BOUNDS = viewBounds("isometric", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Height off the desk, world units (never below 0). */
  lift: IsoTrack;
  /** Slide forward along its length, world units. */
  push: IsoTrack;
  /** Turn about its own length, degrees. */
  turn: IsoTrack;
}

const beat = (t0: number): Clip => {
  const out = t0 + TIMING.push;
  const turned = out + TIMING.turn;
  const back = turned + TIMING.hold;
  const flat = back + TIMING.back;
  const home = flat + TIMING.home;
  const lift: IsoKey[] = [
    [t0, 0, EASE.soft],
    [out, MOVE.lift, "hold"],
    [flat, MOVE.lift, EASE.in],
    [home, 0, EASE.drop],
    [home + 80, MOVE.bounce, EASE.in],
    [home + 150, 0],
  ];
  const push: IsoKey[] = [
    [t0, 0, EASE.snap],
    [out, MOVE.push, "hold"],
    [flat, MOVE.push, EASE.snap],
    [home, 0],
  ];
  const turn: IsoKey[] = [
    [out, 0, EASE.snap],
    [turned - 90, MOVE.turn + MOVE.turnOver, EASE.easy],
    [turned, MOVE.turn, "hold"],
    [back, MOVE.turn, EASE.snap],
    [flat, 0],
  ];
  return { end: home + 150, lift, push, turn };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const movePose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [r2(sample(clip.push, ms)), 0, r2(sample(clip.lift, ms))],
  });

const turnPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "x",
    rotate: r2(sample(clip.turn, ms)),
  });

const AXIS: Vec3 = [0, 0, T / 2];

/* ───────────────────────────── Plate ──────────────────────────────────── */

// A flat solid from a plan outline (and holes), `T` thick, drawn exactly
// at any pose through the rigs around it: the walls that face the viewer,
// their far edge and the joins where the outline turns, then the face on
// top. The engine's extrusion draws the far edge only for convex outlines
// that stay level; a key turning about its length needs it everywhere.

const SHARP = Math.PI / 7;
const WALL = "var(--iso-surface-right)";

const pathOf = (pts: readonly (readonly [number, number])[], close: boolean) =>
  `M${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" L")}${close ? " Z" : ""}`;

/** The turn between segment a→b and b→c, radians. */
const bend = (a: P2, b: P2, c: P2) => {
  const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  const d = Math.abs(t2 - t1) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};

const Plate = ({ loops }: { loops: readonly (readonly P2[])[] }) => {
  const rigged = useRigged();
  const origin = rigged([0, 0, 0]);
  // Whether a direction in the key's own frame faces the viewer (along
  // 1, 1, 1 in this projection).
  const faces = (v: Vec3) => {
    const p = rigged(v);
    return p[0] + p[1] + p[2] - origin[0] - origin[1] - origin[2] > 0;
  };
  const up = faces([0, 0, 1]);
  const nearZ = up ? T : 0;
  const farZ = up ? 0 : T;
  const at = ([x, y]: P2, z: number) => project(rigged([x, y, z]));
  const walls: string[] = [];
  const edges: string[] = [];
  for (const loop of loops) {
    const n = loop.length;
    const facing = loop.map((a, i) => {
      const b = loop[(i + 1) % n];
      return faces([b[1] - a[1], a[0] - b[0], 0]);
    });
    // Start just after a segment that faces away, so runs don't wrap.
    const start = facing.indexOf(false) + 1;
    let run: number[] = [];
    const flush = () => {
      if (run.length === 0) {
        return;
      }
      const pts = [...run, (run.at(-1) as number) + 1].map((k) => loop[k % n]);
      const near = pts.map((p) => at(p, nearZ));
      const far = pts.map((p) => at(p, farZ));
      walls.push(pathOf([...near, ...far.toReversed()], true));
      edges.push(pathOf(far, false));
      for (const [k, p] of pts.entries()) {
        const ends = k === 0 || k === pts.length - 1;
        if (ends || bend(pts[k - 1], p, pts[k + 1]) > SHARP) {
          edges.push(pathOf([near[k], far[k]], false));
        }
      }
      run = [];
    };
    for (let s = 0; s < n; s += 1) {
      const i = (start + s) % n;
      if (facing[i]) {
        run.push(i);
      } else {
        flush();
      }
    }
    flush();
  }
  const cap = loops
    .map((loop) =>
      pathOf(
        loop.map((p) => at(p, nearZ)),
        true
      )
    )
    .join(" ");
  return (
    <g>
      {walls.map((d) => (
        <path d={d} key={d} style={{ fill: WALL, stroke: "none" }} />
      ))}
      {edges.map((d) => (
        <path d={d} key={d} style={LINE} />
      ))}
      <path d={cap} fillRule="evenodd" style={faceFill("surface", "top")} />
    </g>
  );
};

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const TOP: Vec3 = [0, 0, T];

/** The bow's rim, the groove along the shaft and the band (brand). */
const Marks = () => (
  <>
    <FacePath at={TOP} d={circle(BOW.x, 0, RIM)} plane="top" style={LINE} />
    <FacePath
      at={TOP}
      d={`M${GROOVE.from} 0 H${GROOVE.to}`}
      plane="top"
      style={LINE}
    />
    <FacePath
      at={TOP}
      d={`M${BAND.x0} ${-COLLAR.half} H${BAND.x1} V${COLLAR.half} H${BAND.x0} Z`}
      plane="top"
      style={{ fill: "var(--iso-main-top)" }}
    />
    {/* The collar's two edges again, over the band's fill. */}
    <FacePath
      at={TOP}
      d={`M${BAND.x0} ${-COLLAR.half} H${BAND.x1} M${BAND.x0} ${COLLAR.half} H${BAND.x1}`}
      plane="top"
      style={LINE}
    />
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type KeyProps = LineStateProps;

/**
 * Key: a complete "no API keys yet" state with a line illustration, a
 * heading, a line of copy and a button. A classic key lying flat on the
 * desk, seen in isometric (a round bow with its hole, a collar, a shaft
 * with a groove, a bit with cut teeth): it is lifted and pushed forward as
 * if into a lock, turns a quarter turn about its own length, turns back
 * and is set down. One fine outline, paper faces, the band round its
 * collar the one brand mark, no shadow. Plays when it comes into view, or
 * each time `active` turns true (PlayOnHover, or your own state). Follows
 * the shadcn theme.
 */
export const Key = ({
  heading = "No API keys yet",
  description = "Create a key to connect your apps securely.",
  actionLabel = "Create key",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: KeyProps) => {
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
      slot="key"
      view="isometric"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, movePose(clip), clip.end)}>
        <Rig pivot={AXIS} {...onClock(clock, turnPose(clip), clip.end)}>
          <Plate loops={[OUTLINE, HOLE]} />
          <Marks />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default Key;
