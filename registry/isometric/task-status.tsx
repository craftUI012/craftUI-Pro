"use client";

import {
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  EASE,
  Face,
  FaceEllipse,
  FacePath,
  FloorGrid,
  IsoStage,
  projectWith,
  Rig,
  sample,
  settle,
  Slab,
  Tint,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCamera,
  IsoOrbit,
  IsoPose,
  IsoRotate,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * One moment of a task tracker: new tasks are sorted into their status.
 * A white hub tile sits in the middle; four status tiles, each in its own
 * pastel hue, sit around it in a pinwheel (Pending left, Done at the back,
 * Not started right, In progress at the front), joined to the hub by
 * dashed floor routes with one rounded bend. Each task shows as an issue
 * badge over the hub, collapses into a point of light in its status's
 * colour, runs the dashed route with a trailing line, and on hitting the
 * tile splits and races round the tile's border both ways; the glyph
 * answers in its own way. Tiles never move; nothing glows. Each value is ms into a cycle.
 *
 *    0ms   calm: five tiles
 *  300ms   the issue badge pops up over the hub ("Update docs")
 *  980ms   it collapses into a point of light in Not started's purple
 * 1160ms   the light runs the dashed route (900ms), a trailing line behind
 * 2060ms   it hits the tile: the light splits round the border (520ms);
 *          the dashed circle pops
 * 2880ms   the lit border fades
 * 1700ms+  the next tasks follow 1400ms apart: In progress (the spinner
 *          turns), Pending (the clock hand sweeps), Done (the check pops)
 * 7400ms   the last border has faded: hold
 * 9400ms   the next cycle starts
 *
 * Reduced motion (or autoPlay off): the calm board, every badge gone.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // How long the issue badge takes to collapse into a light.
  collapse: 180,
  // The first issue badge pops up.
  first: 300,
  // One cycle.
  period: 9400,
  // How long the issue badge takes to pop up.
  popIn: 260,
  // How long the issue badge holds before it collapses.
  show: 420,
  // Between tasks.
  stagger: 1400,
  // How long the light takes to race round the border.
  trace: 520,
  // How long the lit border fades.
  traceFade: 320,
  // How long the lit border holds once it closes.
  traceHold: 300,
  // How long the light takes to run its route.
  travel: 900,
};

/* The light's trailing line: three layers, each a span of the route the
 * head covered that many ms ago, fainter and thinner the older it is. */
const TRAIL = [
  { lag: 70, opacity: 1, width: 0.16 },
  { lag: 150, opacity: 0.55, width: 0.12 },
  { lag: 240, opacity: 0.25, width: 0.09 },
];

/* The glyphs' answers when a card lands */
const REACT = {
  // How much the check and the dashed circle grow before they settle back.
  pop: 0.28,
  // Degrees the spinner turns (one spoke step is 45°).
  spin: 90,
  // Degrees the clock's hand sweeps.
  sweep: 120,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

export type TaskStatusKey = "notStarted" | "inProgress" | "pending" | "done";

// Every tile is a rounded slab, 5 × 5 × 0.8, floating level at z 0.8.
const TILE = { depth: 0.8, radius: 1.15, size: 5, z: 0.8 };
const TILE_TOP = TILE.z + TILE.depth;

// The status tiles' centres, a pinwheel around the hub at the origin:
// each is 8.5 out along one axis and 4.5 across (the least that fits the
// tile's half-width, the 1.5 bend and a 0.5 straight), so its route runs
// out along that axis, bends, and enters the tile from the side. On screen: Done up right, Not started right, In progress down
// left, Pending left, as in the reference.
const CENTRES: Record<TaskStatusKey, readonly [number, number]> = {
  done: [-4.5, -8.5],
  inProgress: [4.5, 8.5],
  notStarted: [8.5, -4.5],
  pending: [-8.5, 4.5],
};
// Paint order, far to near (x + y): Done −13, Pending −4, hub 0, Not
// started 4, In progress 13.
const FAR: TaskStatusKey[] = ["done", "pending"];
const NEAR: TaskStatusKey[] = ["notStarted", "inProgress"];

const tileAt = (c: readonly [number, number]): Vec3 => [
  c[0] - TILE.size / 2,
  c[1] - TILE.size / 2,
  TILE.z,
];
const topAt = (c: readonly [number, number]): Vec3 => [
  c[0] - TILE.size / 2,
  c[1] - TILE.size / 2,
  TILE_TOP,
];
// Where a glyph sits on a tile's top, in face units, and its radius.
const GLYPH = { r: 0.95, u: 2.5, v: 2.05 };
const glyphCentre = (c: readonly [number, number]): Vec3 => [
  c[0] - TILE.size / 2 + GLYPH.u,
  c[1] - TILE.size / 2 + GLYPH.v,
  TILE_TOP,
];

/* The routes */
const ROUTE = {
  // Radius of the rounded bend.
  bend: 1.5,
  // Samples along a route, evenly spaced by length.
  steps: 64,
  // Height of the dashed lanes: low on the tiles' walls.
  z: 1.05,
};

/* The issue badges */
const CARD = {
  d: 1.7,
  depth: 0.22,
  w: 4.6,
  // Height it pops up to over the hub's top.
  z: TILE_TOP + 0.35,
};

// The frame: every tile, and room for a card riding over them.
const BOUNDS: Vec3[] = [[0, 0] as const, ...Object.values(CENTRES)].flatMap(
  (c): Vec3[] => {
    const [x, y] = tileAt(c);
    return [
      [x, y, CARD.z + CARD.depth],
      [x + TILE.size, y, CARD.z + CARD.depth],
      [x + TILE.size, y + TILE.size, TILE.z],
      [x, y + TILE.size, TILE.z],
    ];
  }
);

const GRID = { at: [-14, -14] as const, size: [28, 28] as const };
const PIVOT: readonly [number, number] = [0, 0];
const DEFAULT_ORBIT: IsoOrbit = 18;

/* ───────────────────────────── Content ────────────────────────────────── */

/** How a status looks: its name and its colour. */
export interface TaskStatusStyle {
  /** Name printed under the glyph, up to about 11 characters ("In progress"). */
  label: string;
  /** Pastel hue of the tile, its glyph and its cards: a theme token name or any CSS colour. */
  tone: IsoTone;
}

/** One task sorted into a status. */
export interface StatusTask {
  /** Card title, up to about 14 characters ("Fix login bug"). */
  title: string;
  /** The status it is sorted into. */
  status: "notStarted" | "inProgress" | "pending" | "done";
}

const DEFAULT_STATUSES: Record<TaskStatusKey, TaskStatusStyle> = {
  done: { label: "Done", tone: "oklch(0.68 0.15 158)" },
  inProgress: { label: "In progress", tone: "oklch(0.66 0.14 236)" },
  notStarted: { label: "Not started", tone: "oklch(0.6 0.19 292)" },
  pending: { label: "Pending", tone: "oklch(0.72 0.16 52)" },
};

const DEFAULT_TASKS: StatusTask[] = [
  { status: "notStarted", title: "Update docs" },
  { status: "inProgress", title: "Fix login bug" },
  { status: "pending", title: "Legal sign-off" },
  { status: "done", title: "Ship v2.4" },
];

/* ───────────────────────────── Tracks ─────────────────────────────────── */

const startOf = (i: number) => TIMING.first + i * TIMING.stagger;
const shownOf = (i: number) => startOf(i) + TIMING.popIn;
const collapseOf = (i: number) => shownOf(i) + TIMING.show;
const lightOf = (i: number) => collapseOf(i) + TIMING.collapse;
const hitOf = (i: number) => lightOf(i) + TIMING.travel;
const closedOf = (i: number) => hitOf(i) + TIMING.trace;
const fadedOf = (i: number) =>
  closedOf(i) + TIMING.traceHold + TIMING.traceFade;

// The issue badge: pops up over the hub, holds, collapses to a point.
const cardScale = (i: number): IsoTrack => [
  [startOf(i), 0, EASE.soft],
  [shownOf(i), 1, "hold"],
  [collapseOf(i), 1, EASE.in],
  [lightOf(i), 0],
];
// The light's head along its route, 0 → 1.
const lightHead = (i: number): IsoTrack => [
  [lightOf(i), 0, [0.45, 0, 0.55, 1]],
  [hitOf(i), 1],
];
// The light round the border, 0 → 1 (each half), then the lit border fades.
const traceRun = (i: number): IsoTrack => [
  [hitOf(i), 0, EASE.drop],
  [closedOf(i), 1],
];
const traceFade = (i: number): IsoTrack => [
  [closedOf(i) + TIMING.traceHold, 1, EASE.easy],
  [fadedOf(i), 0],
];
// What reduced motion shows: every card in, before the cycle ends.
const STILL_MS = TIMING.period - 400;

/* ───────────────────────────── Routes ─────────────────────────────────── */

/** Resamples a polyline to `n` + 1 points evenly spaced by length. */
const evenly = (pts: readonly Vec3[], n: number): Vec3[] => {
  const acc = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const [a, b] = [pts[i - 1], pts[i]];
    acc.push(acc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = acc.at(-1) ?? 1;
  const out: Vec3[] = [];
  let j = 1;
  for (let k = 0; k <= n; k += 1) {
    const d = (total * k) / n;
    while (j < pts.length - 1 && acc[j] < d) {
      j += 1;
    }
    const span = acc[j] - acc[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (d - acc[j - 1]) / span));
    const [a, b] = [pts[j - 1], pts[j]];
    out.push([
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ]);
  }
  return out;
};

/**
 * The route from the hub's centre to a status tile's centre at height z:
 * out along the axis the tile is furthest along, a quarter circle of
 * radius ROUTE.bend round the corner, then along the other axis into the
 * tile. With d1, d2 the two leg directions and C the corner, the bend runs
 * from C − r·d1 to C + r·d2 about O = C − r·d1 + r·d2:
 * p(θ) = O − r·d2·cos θ + r·d1·sin θ, θ ∈ [0, π/2].
 */
const route = (to: readonly [number, number], z: number): Vec3[] => {
  const [x1, y1] = to;
  const alongX = Math.abs(x1) > Math.abs(y1);
  const corner: [number, number] = alongX ? [x1, 0] : [0, y1];
  const d1: [number, number] = alongX ? [Math.sign(x1), 0] : [0, Math.sign(y1)];
  const d2: [number, number] = alongX ? [0, Math.sign(y1)] : [Math.sign(x1), 0];
  const r = ROUTE.bend;
  const o = [
    corner[0] - r * d1[0] + r * d2[0],
    corner[1] - r * d1[1] + r * d2[1],
  ];
  const bend = Array.from({ length: 13 }, (_, i): Vec3 => {
    const a = (i / 12) * (Math.PI / 2);
    return [
      o[0] - r * d2[0] * Math.cos(a) + r * d1[0] * Math.sin(a),
      o[1] - r * d2[1] * Math.cos(a) + r * d1[1] * Math.sin(a),
      z,
    ];
  });
  return evenly([[0, 0, z], ...bend, [x1, y1, z]], ROUTE.steps);
};

const pathOf = (cam: IsoCamera, pts: readonly Vec3[]) =>
  pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${projectWith(cam, p).join(",")}`)
    .join(" ");

/** A point a fraction of the way along an evenly sampled route. */
const along = (pts: readonly Vec3[], f: number): Vec3 => {
  const n = pts.length - 1;
  const x = Math.max(0, Math.min(n, f * n));
  const i = Math.min(n - 1, Math.floor(x));
  const k = x - i;
  const [a, b] = [pts[i], pts[i + 1]];
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
};

/** The span of an evenly sampled route between two fractions of its length. */
const span = (pts: readonly Vec3[], from: number, to: number): Vec3[] => {
  const a = Math.max(0, Math.min(1, from));
  const b = Math.max(0, Math.min(1, to));
  if (b - a < 1e-3) {
    return [];
  }
  const n = pts.length - 1;
  const inner = pts.slice(Math.ceil(a * n), Math.floor(b * n) + 1);
  return [along(pts, a), ...inner, along(pts, b)];
};

// The lanes the lights run, at lane height.
const LANES: Record<TaskStatusKey, Vec3[]> = {
  done: route(CENTRES.done, ROUTE.z),
  inProgress: route(CENTRES.inProgress, ROUTE.z),
  notStarted: route(CENTRES.notStarted, ROUTE.z),
  pending: route(CENTRES.pending, ROUTE.z),
};

/**
 * A tile's top outline as a loop at the top's height, evenly sampled and
 * started where the lane enters (the middle of the side the lane's last
 * leg comes in through), then split into the two halves the light races
 * round: one each way, meeting on the far side.
 */
const borderHalves = (c: readonly [number, number]): [Vec3[], Vec3[]] => {
  const [cx, cy] = c;
  const h = TILE.size / 2;
  const r = TILE.radius;
  const z = TILE_TOP;
  const arc = (sx: number, sy: number, a0: number): Vec3[] =>
    Array.from({ length: 7 }, (_, i): Vec3 => {
      const a = a0 + (i / 6) * (Math.PI / 2);
      return [
        cx + sx * (h - r) + r * Math.cos(a),
        cy + sy * (h - r) + r * Math.sin(a),
        z,
      ];
    });
  const loop = evenly(
    [
      [cx + h, cy, z],
      ...arc(1, 1, 0),
      ...arc(-1, 1, Math.PI / 2),
      ...arc(-1, -1, Math.PI),
      ...arc(1, -1, (3 * Math.PI) / 2),
      [cx + h, cy, z],
    ],
    80
  ).slice(0, 80);
  // The side the lane enters: against the direction of its last leg.
  const alongX = Math.abs(cx) > Math.abs(cy);
  const entry: [number, number] = alongX
    ? [cx, cy - Math.sign(cy) * h]
    : [cx - Math.sign(cx) * h, cy];
  let start = 0;
  let best = Number.POSITIVE_INFINITY;
  for (const [i, p] of loop.entries()) {
    const d = Math.hypot(p[0] - entry[0], p[1] - entry[1]);
    if (d < best) {
      best = d;
      start = i;
    }
  }
  const ring = [...loop.slice(start), ...loop.slice(0, start)];
  const half = ring.length / 2;
  return [ring.slice(0, half + 1), [ring[0], ...ring.slice(half).toReversed()]];
};

const BORDERS: Record<TaskStatusKey, [Vec3[], Vec3[]]> = {
  done: borderHalves(CENTRES.done),
  inProgress: borderHalves(CENTRES.inProgress),
  notStarted: borderHalves(CENTRES.notStarted),
  pending: borderHalves(CENTRES.pending),
};

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** A clock-driven value, re-rendered only when it changes. */
const useClockValue = <T,>(
  clock: MotionValue<number> | undefined,
  read: (ms: number) => T,
  still: boolean
) => {
  const idle = useMotionValue(0);
  const [value, setValue] = useState<T>(() => read(still ? STILL_MS : 0));
  const last = useRef(JSON.stringify(value));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    const key = JSON.stringify(next);
    if (key !== last.current) {
      last.current = key;
      setValue(next);
    }
  });
  return value;
};

/** Rig props: animated on the clock, or the pose at STILL_MS held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(STILL_MS));

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const LINE: CSSProperties = {
  strokeLinecap: "round",
  strokeLinejoin: "round",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};
const thick = (k: number): CSSProperties => ({
  ...LINE,
  strokeWidth: `calc(var(--iso-edge-w, 1px) * ${k})`,
});
// Text on a tile: its hue pulled toward the page's text colour, so it reads
// dark on a pastel tile in light mode and light in dark mode.
const TINT_TEXT = "color-mix(in oklab, var(--iso-tint) 50%, var(--iso-text))";

/** The dashed floor routes from the hub to each status. */
const Lanes = ({ camera }: { camera: IsoCamera }) => (
  <g fill="none" stroke="var(--iso-guide)" strokeLinecap="round">
    {Object.values(CENTRES).map((c) => (
      <path
        d={pathOf(camera, route(c, ROUTE.z))}
        key={c.join(",")}
        strokeDasharray="0.32 0.3"
        strokeWidth={0.075}
      />
    ))}
  </g>
);

/** A glyph's centre in the world, from its tile's top corner. */
const glyphCentreFrom = (at: Vec3): Vec3 => [
  at[0] + GLYPH.u,
  at[1] + GLYPH.v,
  at[2],
];

/** The hub's mark: a ring with a pupil, the tracker's logo. */
const HubGlyph = () => {
  const c = glyphCentre([0, 0]);
  const centre: Vec3 = [c[0], c[1] + 0.45, c[2]];
  return (
    <>
      <FaceEllipse
        center={centre}
        fill="var(--iso-screen-ink)"
        plane="top"
        r={1.25}
      />
      <FaceEllipse
        center={centre}
        fill="var(--iso-screen)"
        plane="top"
        r={0.82}
      />
      <FaceEllipse
        center={centre}
        fill="var(--iso-screen-ink)"
        plane="top"
        r={0.42}
      />
    </>
  );
};

/**
 * Done: a filled disc with a check, printed flat on the tile like its
 * label: drawn in the label's own frame (u along the text, v down it), so
 * it leans with the text instead of facing the camera.
 */
const DoneGlyph = ({ at }: { at: Vec3 }) => {
  const [u, v] = [GLYPH.u, GLYPH.v];
  return (
    <>
      <FaceEllipse
        center={glyphCentreFrom(at)}
        fill="var(--iso-tint)"
        plane="top"
        r={GLYPH.r}
      />
      <FacePath
        at={at}
        d={`M${u - 0.44} ${v - 0.02} L${u - 0.1} ${v + 0.32} L${u + 0.5} ${v - 0.4}`}
        fill="none"
        plane="top"
        stroke="white"
        style={thick(2.2)}
      />
    </>
  );
};

/** In progress: eight spokes, fading round the circle. */
const SpinnerGlyph = ({ at }: { at: Vec3 }) => (
  <>
    {Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      const [cx, cy] = [Math.cos(a), Math.sin(a)];
      return (
        <FacePath
          at={at}
          d={`M${GLYPH.u + cx * 0.45} ${GLYPH.v + cy * 0.45} L${GLYPH.u + cx * 0.95} ${GLYPH.v + cy * 0.95}`}
          fill="none"
          key={k}
          opacity={1 - k * 0.1}
          plane="top"
          stroke="var(--iso-tint)"
          style={thick(2.4)}
        />
      );
    })}
  </>
);

/** Pending: a clock face; its hand is rigged separately so it can sweep. */
const ClockFace = ({ at }: { at: Vec3 }) => (
  <>
    <FaceEllipse
      center={glyphCentreFrom(at)}
      fill="var(--iso-tint)"
      plane="top"
      r={GLYPH.r}
    />
    <FacePath
      at={at}
      d={`M${GLYPH.u} ${GLYPH.v} L${GLYPH.u + 0.42} ${GLYPH.v + 0.22}`}
      fill="none"
      plane="top"
      stroke="white"
      style={thick(2)}
    />
  </>
);
const ClockHand = ({ at }: { at: Vec3 }) => (
  <FacePath
    at={at}
    d={`M${GLYPH.u} ${GLYPH.v} L${GLYPH.u} ${GLYPH.v - 0.62}`}
    fill="none"
    plane="top"
    stroke="white"
    style={thick(2)}
  />
);

/**
 * Not started: an empty dashed circle (the usual "not started" mark), so
 * it can't be mistaken for the hub's ring logo. Eight dashes, each 60% of
 * its 45° step, sampled on the circle in face units and stroked after
 * projection.
 */
const DashedCircleGlyph = ({ at }: { at: Vec3 }) => (
  <>
    {Array.from({ length: 8 }, (_, k) => {
      const a0 = (k / 8) * Math.PI * 2;
      const pts = Array.from({ length: 5 }, (__, n) => {
        const a = a0 + (n / 4) * (Math.PI / 4) * 0.6;
        return `${GLYPH.u + Math.cos(a) * 0.8} ${GLYPH.v + Math.sin(a) * 0.8}`;
      });
      return (
        <FacePath
          at={at}
          d={`M${pts.join(" L")}`}
          fill="none"
          key={k}
          plane="top"
          stroke="var(--iso-tint)"
          style={thick(2.6)}
        />
      );
    })}
  </>
);

// The label's type, in face units.
const LABEL = { font: 0.55, v: 4.05 };

/** The status's name, printed under the glyph and centred on it. */
const StatusLabel = ({ at, label }: { at: Vec3; label: string }) => (
  <Face at={at} plane="top">
    <text
      fill={TINT_TEXT}
      fontSize={LABEL.font}
      fontWeight={600}
      textAnchor="middle"
      x={GLYPH.u}
      y={LABEL.v}
    >
      {label}
    </text>
  </Face>
);

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Points along a route → a path, or nothing for an empty span. */
const runPath = (cam: IsoCamera, pts: readonly Vec3[]) =>
  pts.length > 1 ? pathOf(cam, pts) : "";

/**
 * The lights on the lanes: a head with a trailing line made of the spans
 * the head covered 70, 150 and 240 ms ago. Drawn with the lanes, under the
 * tiles, so a light leaves from under the hub and dives under its tile.
 */
const Lights = ({
  camera,
  clock,
  look,
  still,
  tasks,
}: {
  camera: IsoCamera;
  clock: MotionValue<number> | undefined;
  look: (key: TaskStatusKey) => TaskStatusStyle;
  still: boolean;
  tasks: readonly StatusTask[];
}) => {
  const runs = useClockValue(
    clock,
    (ms) => {
      const t = ms % TIMING.period;
      return tasks.map((_, i) => ({
        head: r3(sample(lightHead(i), t)),
        tails: TRAIL.map((l) => r3(sample(lightHead(i), t - l.lag))),
      }));
    },
    still
  );
  return (
    <g fill="none" strokeLinecap="round">
      {tasks.map((task, i) => {
        const run = runs[i];
        if (!run || run.tails.at(-1) === 1 || run.head === 0) {
          return null;
        }
        const pts = LANES[task.status];
        const [hx, hy] = projectWith(camera, along(pts, run.head));
        return (
          <Tint
            color={look(task.status).tone}
            key={`${task.title}-${task.status}`}
          >
            {TRAIL.map((l, k) => (
              <path
                d={runPath(camera, span(pts, run.tails[k], run.head))}
                key={l.lag}
                opacity={l.opacity}
                stroke="var(--iso-tint)"
                strokeWidth={l.width}
              />
            ))}
            {run.head < 1 ? (
              <circle cx={hx} cy={hy} fill="var(--iso-tint)" r={0.2} />
            ) : null}
          </Tint>
        );
      })}
    </g>
  );
};

/**
 * The light racing round a tile's top border after it hits: both halves
 * grow from the entry point and meet on the far side, hold, then fade.
 * Drawn over the tiles.
 */
const Borders = ({
  camera,
  clock,
  look,
  still,
  tasks,
}: {
  camera: IsoCamera;
  clock: MotionValue<number> | undefined;
  look: (key: TaskStatusKey) => TaskStatusStyle;
  still: boolean;
  tasks: readonly StatusTask[];
}) => {
  const traces = useClockValue(
    clock,
    (ms) => {
      const t = ms % TIMING.period;
      return tasks.map((_, i) => ({
        fade: r3(sample(traceFade(i), t)),
        run: r3(sample(traceRun(i), t)),
      }));
    },
    still
  );
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {tasks.map((task, i) => {
        const tr = traces[i];
        if (!tr || tr.run === 0 || tr.fade === 0) {
          return null;
        }
        return (
          <Tint
            color={look(task.status).tone}
            key={`${task.title}-${task.status}`}
          >
            {BORDERS[task.status].map((half, side) => (
              <path
                d={runPath(camera, span(half, 0, tr.run))}
                key={side === 0 ? "cw" : "ccw"}
                opacity={tr.fade}
                stroke="var(--iso-tint)"
                strokeWidth={0.16}
              />
            ))}
          </Tint>
        );
      })}
    </g>
  );
};

/* ───────────────────────────── Poses ──────────────────────────────────── */

/** The glyph's answer each time a card lands in this status. */
const reactPose =
  (key: TaskStatusKey, tasks: readonly StatusTask[]) =>
  (ms: number): IsoPose => {
    const t = ms % TIMING.period;
    const lands = tasks.flatMap((task, i) =>
      task.status === key ? [hitOf(i)] : []
    );
    if (key === "inProgress" || key === "pending") {
      const amount = key === "inProgress" ? REACT.spin : REACT.sweep;
      const turns = lands.reduce(
        (sum, at) => sum + sample(settle(amount, at, 0.8), t),
        0
      );
      return { axis: "z", rotate: turns };
    }
    const grow = lands.reduce(
      (sum, at) =>
        sum +
        sample(
          [
            [at, 0, EASE.soft],
            [at + 160, REACT.pop, EASE.easy],
            [at + 520, 0],
          ],
          t
        ),
      0
    );
    return { scale: 1 + grow };
  };

const cardPose =
  (i: number) =>
  (ms: number): IsoPose => ({
    scale: Math.max(0.001, sample(cardScale(i), ms % TIMING.period)),
  });

/* ───────────────────────────── Shell ──────────────────────────────────── */

// A turnable scene is a focusable group that says how to turn it.
const turnableLabel = (rotate: IsoRotate, title?: string) =>
  rotate === "off"
    ? {}
    : {
        "aria-label": `${title ?? "Illustration"}. Move the pointer or use the left and right arrow keys to turn it.`,
        role: "group",
      };

interface PointerLike {
  button: number;
  clientX: number;
  clientY: number;
  currentTarget: Element;
  pointerId: number;
}
interface OrbitHandlers {
  onPointerDown?: (e: PointerLike) => void;
  onPointerUp?: () => void;
}

/** In view, reduced motion, the clock (restarted on a plain click) and the camera. */
const useShell = ({
  autoPlay,
  orbit,
  rotate,
}: {
  autoPlay: boolean;
  orbit: IsoOrbit;
  rotate: IsoRotate;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const still = reduced || !autoPlay;
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  // A plain click (no drag) replays; drags still turn.
  const pressed = useRef({ x: 0, y: 0 });
  const handlers = orbitProps as OrbitHandlers;
  const pointer = {
    onPointerDown: (e: PointerLike) => {
      pressed.current = { x: e.clientX, y: e.clientY };
      handlers.onPointerDown?.(e);
    },
    onPointerUp: (e: PointerLike) => {
      handlers.onPointerUp?.();
      const moved =
        Math.hypot(
          e.clientX - pressed.current.x,
          e.clientY - pressed.current.y
        ) > 6;
      if (!(still || moved)) {
        setRun((n) => n + 1);
      }
    },
  };
  return {
    camera,
    clock: still ? undefined : clock,
    orbitProps,
    pointer,
    ref,
    still,
  };
};

/** Stage overrides: no hairline contour outside the blueprint. */
const stageStyle = (line: boolean) =>
  ({
    "--iso-contour-w": line ? undefined : "0",
  }) as CSSProperties;

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface TaskStatusProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. The routes and the hub's tint. */
  tone?: IsoTone;
  /**
   * Name and pastel hue per status, keyed "notStarted", "inProgress",
   * "pending" and "done" (any you leave out keep the built-in demo
   * content: Not started, In progress, Pending and Done in purple, blue,
   * orange and green).
   */
  statuses?: Partial<Record<TaskStatusKey, Partial<TaskStatusStyle>>>;
  /**
   * The tasks sorted in one cycle, in order, one issue badge and light each. Default: "Update
   * docs" → Not started, "Fix login bug" → In progress, "Legal sign-off" →
   * Pending, "Ship v2.4" → Done.
   */
  tasks?: StatusTask[];
  /** Soft gradient drawing with a tinted outline (default), flat ink, soft tint, full colour, or blueprint outline. */
  variant?: IsoVariant;
  /** Line weight: in `soft` 0.3 is a 1 px outline at any size (1.3 px in `ink`). */
  strokeWidth?: number;
  /** Plays while in view, looping. Off shows the calm board. */
  autoPlay?: boolean;
  /** Dashed construction grid on the floor. */
  grid?: boolean;
  /**
   * Let the viewer turn the scene: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default 18. */
  orbit?: IsoOrbit;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

/**
 * Task status, in soft isometric: a white hub tile and four pastel status
 * tiles (Pending, Done, Not started, In progress) in a pinwheel, joined by
 * dashed floor routes with a rounded bend. Each task pops up as an issue
 * badge over the hub, collapses into a light in its status's colour, runs
 * the route with a trailing line and races round its tile's border; the
 * glyph answers (dashed circle pops, spinner turns, clock hand sweeps,
 * check pops). No shadow, no glow.
 * Click to replay; leans with the pointer. Follows the shadcn theme.
 */
export const TaskStatus = ({
  tone = "primary",
  statuses,
  tasks = DEFAULT_TASKS,
  variant = "soft",
  strokeWidth = 0.3,
  autoPlay = true,
  grid = false,
  rotate = "pointer",
  orbit = DEFAULT_ORBIT,
  title,
  className,
}: TaskStatusProps) => {
  const { camera, clock, orbitProps, pointer, ref, still } = useShell({
    autoPlay,
    orbit,
    rotate,
  });
  const look = (key: TaskStatusKey): TaskStatusStyle => ({
    ...DEFAULT_STATUSES[key],
    ...statuses?.[key],
  });
  // Which issue badges are on screen (a hidden one isn't drawn at all:
  // scaled to nothing, its outline would leave a dot).
  const story = useClockValue(
    clock,
    (ms) => {
      const t = ms % TIMING.period;
      return {
        shown: tasks.map((_, i) => sample(cardScale(i), t) > 0.01),
      };
    },
    still
  );

  const statusTile = (key: TaskStatusKey) => {
    const c = CENTRES[key];
    const top = topAt(c);
    const pose = rigged(clock, reactPose(key, tasks));
    return (
      <Tint color={look(key).tone} key={key} strength={22}>
        <Slab
          at={tileAt(c)}
          palette="surface"
          radius={TILE.radius}
          size={[TILE.size, TILE.size, TILE.depth]}
        />
        {key === "pending" ? <ClockFace at={top} /> : null}
        <Rig pivot={glyphCentre(c)} {...pose}>
          {key === "done" ? <DoneGlyph at={top} /> : null}
          {key === "inProgress" ? <SpinnerGlyph at={top} /> : null}
          {key === "pending" ? <ClockHand at={top} /> : null}
          {key === "notStarted" ? <DashedCircleGlyph at={top} /> : null}
        </Rig>
        <StatusLabel at={top} label={look(key).label} />
      </Tint>
    );
  };

  return (
    <div
      {...turnableLabel(rotate, title)}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-slot="task-status"
      ref={ref}
      {...orbitProps}
      onPointerDown={pointer.onPointerDown}
      onPointerUp={pointer.onPointerUp}
    >
      <IsoStage
        bounds={BOUNDS}
        camera={camera}
        orbit={rotate === "off" ? 0 : orbit}
        shadow={false}
        strokeWidth={strokeWidth}
        style={stageStyle(variant === "line")}
        title={title}
        tone={tone}
        variant={variant}
      >
        {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
        <Lanes camera={camera} />
        <Lights
          camera={camera}
          clock={clock}
          look={look}
          still={still}
          tasks={tasks}
        />
        {FAR.map(statusTile)}
        {/* The hub: white, the tracker's mark. */}
        <Tint color="var(--iso-ink)" strength={4}>
          <Slab
            at={tileAt([0, 0])}
            palette="surface"
            radius={TILE.radius}
            size={[TILE.size, TILE.size, TILE.depth]}
          />
          <HubGlyph />
        </Tint>
        {NEAR.map(statusTile)}
        <Borders
          camera={camera}
          clock={clock}
          look={look}
          still={still}
          tasks={tasks}
        />
        {/* The issue badges, over the hub. */}
        {tasks.map((task, i) =>
          story.shown[i] ? (
            <Rig
              key={`${task.title}-${i}`}
              pivot={[0, 0, CARD.z]}
              {...rigged(clock, cardPose(i))}
            >
              <Tint color={look(task.status).tone} strength={10}>
                <Slab
                  at={[-CARD.w / 2, -CARD.d / 2, CARD.z]}
                  content={(_, d) => (
                    <>
                      <circle
                        cx={0.55}
                        cy={d / 2}
                        fill="var(--iso-tint)"
                        r={0.24}
                      />
                      <text
                        fill="var(--iso-screen-ink)"
                        fontSize={0.48}
                        fontWeight={600}
                        x={1}
                        y={d / 2 + 0.17}
                      >
                        {task.title}
                      </text>
                    </>
                  )}
                  frontStyle={{ fill: "var(--iso-screen)" }}
                  palette="surface"
                  radius={0.5}
                  size={[CARD.w, CARD.d, CARD.depth]}
                />
              </Tint>
            </Rig>
          ) : null
        )}
      </IsoStage>
    </div>
  );
};

export default TaskStatus;
