"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { useRef, useState } from "react";

import {
  EASE,
  Extrude,
  FacePath,
  Rig,
  roundedRect,
  sample,
  scaleTrack,
  settle,
  shiftTrack,
} from "./iso-core";
import type { IsoTrack, Vec3 } from "./iso-core";
import { ICON, LINE, LineState, facing, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A blocked state told by one object, in line: an unplugged cord, its
 * plug and its socket facing each other across a gap, the cable hanging
 * between them with one curl in it. A fine outline, near-white faces, the plug's
 * two pins the one brand mark, facing the screen, no shadow. Under it,
 * the state's own words: a heading, a line, a button. Each value is ms
 * after the art comes into view.
 *
 *    0ms   the two ends hang apart, still
 *  400ms   the plug reaches for the socket (380ms); the socket leans in
 *          after it, 60ms later and two thirds as far; the cable sags
 *  780ms   it strains the last little way and stops short of the socket
 * 1000ms   it gives up: both ends spring apart, past rest, and sway home
 * 2150ms   still: apart, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true (or with `loop`, after a 5.2s hold).
 * Reduced motion, or `active` false before any play: the two ends apart,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true the reach starts this soon.
  again: 80,
  // The socket follows the plug this much later.
  lag: 60,
  // The plug travels most of the way in this long.
  reach: 380,
  // The reach starts this long after the cord comes into view.
  start: 400,
  // It strains at full stretch for this long before letting go.
  strain: 220,
};

/* How far things move, in world units. */
const MOVE = {
  // How far the plug travels toward the socket.
  plug: 0.46,
  // How much of the reach the first, quick part covers.
  quick: 0.88,
  // The socket's travel, as a share of the plug's.
  socket: 0.65,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The two ends: a block each, built facing +y and shown facing the
// screen, mirrored about the middle. `face` is how far each one's front
// end is from the middle; `z` is the height of its centre line. Its
// corners are kept small so the parts that meet its ends (pins, sleeve,
// lip) meet a straight side: a line that runs into a curve near its
// tangent drew a second line a pixel beside the first.
const HEAD = { depth: 0.75, face: 0.95, h: 1.7, r: 0.35, w: 2.3, z: 5.4 };
const HEAD_TOP = HEAD.z + HEAD.h / 2;
const HEAD_END = HEAD.face + HEAD.w;

// The sleeve where the cable enters each end: smaller, set in the middle
// of the block's depth, and tucked a little way into it.
const SLEEVE = { depth: 0.45, h: 0.85, r: 0.22, tuck: 0.2, w: 0.55 };
const SLEEVE_Y = -(HEAD.depth - SLEEVE.depth) / 2;

// The plug's two pins, one over the other: flat blades in the middle of
// the block's depth (a blade's thin depth drew as a strip two lines a
// pixel apart).
const PIN = { h: 0.24, len: 0.8, r: 0.08, spread: 0.42, tuck: 0.2 };
const PIN_Y = -HEAD.depth / 2;

// The lip round the socket's mouth, taller than the block by enough that
// the block's back edge meets its straight side.
const LIP = { h: 2.3, r: 0.12, w: 0.3 };

// The grip: three ridges across each block, counted from the cable's end.
const GRIP = { at: [0.5, 0.82, 1.14] as const, h: 0.8 };

// The cable: a tube hanging from one sleeve to the other, in the plane
// through the middle of the blocks' depth, with one curl at its foot (a
// plain sag would read as a smile under two eyes). `reach` is the handle
// length of the two long curves at the sleeves and `belly` how far out
// from the middle their handles sit at the foot, the same on both sides,
// so the cable is as wide on the right as on the left; `curl` is the curl's
// half width, its height, the handles that round it and how far left of
// the middle it hangs (off centre, as a cord falls); `slack` is how far
// the foot drops for every unit the ends come together.
const CABLE = {
  belly: 4.3,
  curl: { h: 2, lead: 1.7, round: 1.25, w: 0.95, x: -1.1 },
  foot: 0.85,
  from: HEAD_END + SLEEVE.w - 0.25,
  half: 0.17,
  overlap: 2,
  reach: 2.8,
  slack: 0.42,
  steps: 22,
};
const CABLE_Y = -HEAD.depth / 2;

type P2 = readonly [number, number];
type Span = readonly [P2, P2, P2, P2];

// A point on a cubic curve and its direction there.
const cubic = ([a, b, c, d]: Span, t: number): [P2, P2] => {
  const m = 1 - t;
  const at = (i: 0 | 1) =>
    m * m * m * a[i] +
    3 * m * m * t * b[i] +
    3 * m * t * t * c[i] +
    t * t * t * d[i];
  const along = (i: 0 | 1) =>
    3 * m * m * (b[i] - a[i]) +
    6 * m * t * (c[i] - b[i]) +
    3 * t * t * (d[i] - c[i]);
  return [
    [at(0), at(1)],
    [along(0), along(1)],
  ];
};

/**
 * The cable's centre line, in x and z, as four curves: out of the socket's
 * sleeve and down to the foot, up the right of the curl to its top, down
 * its left and across the first curve, then up into the plug's sleeve.
 * `socket` and `plug` are how far each end has moved toward the middle;
 * the curl shifts with them and drops as they close.
 */
const cableSpans = (socket: number, plug: number): Span[] => {
  const { belly, curl, reach } = CABLE;
  const start: P2 = [-CABLE.from + socket, HEAD.z];
  const end: P2 = [CABLE.from - plug, HEAD.z];
  const shift = (socket - plug) / 2;
  const mid = curl.x + shift;
  const low = CABLE.foot - CABLE.slack * (socket + plug);
  const left: P2 = [mid - curl.w, low];
  const right: P2 = [mid + curl.w, low];
  const top: P2 = [mid, low + curl.h];
  return [
    [start, [start[0] - reach, HEAD.z], [shift - belly, low], left],
    [left, [left[0] + curl.lead, low], [mid + curl.round, top[1]], top],
    [top, [mid - curl.round, top[1]], [right[0] - curl.lead, low], right],
    [right, [shift + belly, low], [end[0] + reach, HEAD.z], end],
  ];
};

/** The two edges of a length of tube: its centre line pushed out by half its width on either side. */
interface Edges {
  near: P2[];
  far: P2[];
}

/**
 * The cable as two lengths of tube, the second lying over the first where
 * the curl crosses itself. Each is the two edges of its half of the centre
 * line; the first runs a few steps past the top of the curl, under the
 * second, so no gap shows where they meet.
 */
const cableEdges = (socket: number, plug: number): [Edges, Edges] => {
  const spans = cableSpans(socket, plug);
  const edge = (list: readonly Span[], extra: Span | null): Edges => {
    const near: P2[] = [];
    const far: P2[] = [];
    const push = (span: Span, upTo: number) => {
      for (let i = 0; i <= upTo; i += 1) {
        const [[x, z], [sx, sz]] = cubic(span, i / CABLE.steps);
        const len = Math.hypot(sx, sz) || 1;
        const nx = (-sz / len) * CABLE.half;
        const nz = (sx / len) * CABLE.half;
        near.push([x + nx, z + nz]);
        far.push([x - nx, z - nz]);
      }
    };
    for (const span of list) {
      push(span, CABLE.steps);
    }
    if (extra) {
      push(extra, CABLE.overlap);
    }
    return { far, near };
  };
  return [edge(spans.slice(0, 2), spans[2]), edge(spans.slice(2), null)];
};

// Points as a path on the cable's plane (u = x, v = −z).
const trace = (points: readonly P2[]) =>
  `M${points.map(([x, z]) => `${r2(x)} ${r2(-z)}`).join(" L")}`;

// The frame fits the cord at rest: as wide as the cable, from its foot to
// the top of the socket's lip. The spring apart reaches a little wider;
// that runs into the stage's padding, which is not clipped.
const REST = cableEdges(0, 0).flatMap(({ far, near }) => [...far, ...near]);
const REACH_X = Math.max(...REST.map(([x]) => Math.abs(x)));
const LOW = Math.min(...REST.map(([, z]) => z));
const LIP_TOP = HEAD.z + LIP.h / 2;
const EXTENT: Vec3[] = [
  [-REACH_X, CABLE_Y, LOW],
  [REACH_X, CABLE_Y, LOW],
  [-REACH_X, -HEAD.depth, LIP_TOP],
  [REACH_X, -HEAD.depth, LIP_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: how far each end has moved in, and when it is at rest. */
interface Clip {
  end: number;
  plug: IsoTrack;
  socket: IsoTrack;
}

// The beat itself, starting `t0` ms into a run: the plug reaches, strains
// and springs back; the socket does the same a moment later and less far.
const beat = (t0: number): Clip => {
  const there = t0 + TIMING.reach;
  const letGo = there + TIMING.strain;
  const back = settle(0, letGo, 0.75, MOVE.plug);
  const plug: IsoTrack = [
    [t0, 0, EASE.easy],
    [there, MOVE.plug * MOVE.quick, EASE.drop],
    ...back,
  ];
  return {
    end: (back.at(-1)?.[0] ?? letGo) + TIMING.lag,
    plug,
    socket: shiftTrack(scaleTrack(plug, MOVE.socket), TIMING.lag),
  };
};

// The first run waits a moment after coming into view; a play asked for by
// `active` does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The cable, drawn as a flat tube (it is round, so it shows no top edge):
 * each length is its fill, then its two edges as lines, so the second
 * length covers the first where the curl crosses and no line closes the
 * tube where the two meet.
 */
const Cable = ({ socket, plug }: { socket: number; plug: number }) => (
  <>
    {cableEdges(socket, plug).map(({ far, near }, i) => (
      // oxlint-disable-next-line react/no-array-index-key -- two fixed lengths, never reordered
      <g key={i}>
        <FacePath
          at={[0, CABLE_Y, 0]}
          d={`${trace([...near, ...far.toReversed()])} Z`}
          plane="left"
          style={{ fill: "var(--iso-surface-left)", stroke: "none" }}
        />
        <FacePath
          at={[0, CABLE_Y, 0]}
          d={`${trace(near)} ${trace(far)}`}
          plane="left"
          strokeLinecap="round"
          style={LINE}
        />
      </g>
    ))}
  </>
);

/**
 * A rectangle `w` by `h` with its left corners rounded and its right ones
 * square: the socket's block, whose right end is hidden behind the lip,
 * so its top edge runs straight into the lip's side.
 */
const roundedLeft = (w: number, h: number, r: number) => {
  const k = r * 0.5523;
  return [
    `M${r} 0 H${w} V${h} H${r}`,
    `C${r2(r - k)} ${h} 0 ${r2(h - r + k)} 0 ${r2(h - r)}`,
    `V${r}`,
    `C0 ${r2(r - k)} ${r2(r - k)} 0 ${r} 0 Z`,
  ].join(" ");
};

/**
 * One end's block with its sleeve and grip. `side` is −1 for the socket
 * (left of the middle) and 1 for the plug.
 */
const Head = ({ side }: { side: -1 | 1 }) => {
  // The block's left edge, and its sleeve's, whichever side it is on.
  const x = side === 1 ? HEAD.face : -HEAD_END;
  const sleeveX = side === 1 ? HEAD_END - SLEEVE.tuck : -HEAD_END - SLEEVE.w;
  const grip = GRIP.at
    .map((from) => {
      const u = side === 1 ? HEAD.w - from : from;
      return `M${r2(u)} ${r2((HEAD.h - GRIP.h) / 2)} V${r2((HEAD.h + GRIP.h) / 2)}`;
    })
    .join(" ");
  return (
    <>
      <Extrude
        at={[sleeveX, SLEEVE_Y, HEAD.z + SLEEVE.h / 2]}
        convex
        d={roundedRect(SLEEVE.w + SLEEVE.tuck, SLEEVE.h, SLEEVE.r)}
        depth={SLEEVE.depth}
        palette="surface"
        plane="left"
      />
      <Extrude
        at={[x, 0, HEAD_TOP]}
        convex
        d={
          side === 1
            ? roundedRect(HEAD.w, HEAD.h, HEAD.r)
            : roundedLeft(HEAD.w, HEAD.h, HEAD.r)
        }
        depth={HEAD.depth}
        palette="surface"
        plane="left"
      />
      <FacePath at={[x, 0, HEAD_TOP]} d={grip} plane="left" style={LINE} />
    </>
  );
};

/** The socket's end: its block, and the lip round its mouth. */
const Socket = () => (
  <>
    <Head side={-1} />
    <Extrude
      at={[-HEAD.face - LIP.w, 0, HEAD.z + LIP.h / 2]}
      convex
      d={roundedRect(LIP.w, LIP.h, LIP.r)}
      depth={HEAD.depth}
      palette="surface"
      plane="left"
    />
  </>
);

/** The plug's end: its two pins, the one brand mark, then its block. */
const Plug = () => (
  <>
    {[1, -1].map((up) => (
      <FacePath
        at={[HEAD.face - PIN.len, PIN_Y, HEAD.z + up * PIN.spread + PIN.h / 2]}
        d={roundedRect(PIN.len + PIN.tuck, PIN.h, PIN.r)}
        key={up}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-main-left)" }}
      />
    ))}
    <Head side={1} />
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** How far each end has moved in, re-rendered only when one changes. */
const useReach = (
  clock: MotionValue<number> | undefined,
  clip: Clip
): readonly [number, number] => {
  const idle = useMotionValue(0);
  const read = (ms: number): readonly [number, number] => [
    r2(sample(clip.socket, ms)),
    r2(sample(clip.plug, ms)),
  ];
  const [value, setValue] = useState<readonly [number, number]>([0, 0]);
  const last = useRef("0,0");
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next.join(",") !== last.current) {
      last.current = next.join(",");
      setValue(next);
    }
  });
  return clock ? value : [0, 0];
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type PlugAndSocketProps = LineStateProps;

/**
 * Plug and socket: a complete not-connected state ("Not connected") with
 * a line illustration, a heading, a line of copy and a button, all props.
 * An unplugged cord, its plug and socket facing each other with the cable
 * hanging in a loop between them; the plug reaches for the socket, stops
 * short and springs back. One fine outline, near-white faces, no shadow,
 * facing the screen; the plug's two pins carry the brand, like the button
 * under it. It plays when it comes into view, or each time `active` turns
 * true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const PlugAndSocket = ({
  heading = "Not connected",
  description = "Connect an app to start bringing your data in here.",
  actionLabel = "Connect an app",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: PlugAndSocketProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const [socket, plug] = useReach(shell.clock, shell.clip);
  return (
    <LineState
      bounds={BOUNDS}
      defaultArtClassName="w-64"
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
      slot="plug-and-socket"
    >
      <Cable plug={plug} socket={socket} />
      <Rig offset={[socket, 0, 0]} pivot={[0, 0, 0]}>
        <Socket />
      </Rig>
      <Rig offset={[-plug, 0, 0]} pivot={[0, 0, 0]}>
        <Plug />
      </Rig>
    </LineState>
  );
};

export default PlugAndSocket;
