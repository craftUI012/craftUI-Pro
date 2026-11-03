"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  Bloom,
  Box,
  Face,
  FacePath,
  FloorGrid,
  GLASS,
  hop,
  ISO_MONO,
  IsoStage,
  isoStroke,
  jolt,
  Panel,
  press,
  Rig,
  sample,
  shiftTrack,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCast,
  IsoPose,
  IsoTrack,
  IsoOrbit,
  IsoRotate,
  IsoTone,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * One moment in an edge network: a feature flag rolls a new version out.
 * Traffic runs on light rails across the open floor; packets trail dashes.
 * Read top-to-bottom. Each value is ms after the scene comes into view.
 *
 *    0ms   rollout at the first step (10%): v2's rail carries 1 packet in 4
 * 1300ms   slider glides to 50%; v2 hops as its share jumps and lights up;
 *          the router presses as it re-splits; v2's packets multiply
 * 2500ms   metrics confirm v2 is healthy (pill lights)
 * 3900ms   slider glides to 100%; v2 hops again, the router presses, v1
 *          sinks a little as its rail goes quiet and its lights dim
 * 5100ms   console reads "Rolled out" and is kicked back, settling
 * 9000ms   hold ends; back to the first step, play again
 *
 * Packets loop continuously (CSS), only their count follows the story.
 * Drawn in ink over a floor grid; v2 is the one lit thing.
 * The viewer leans the camera with the pointer and can click to replay.
 * Reduced motion: no timeline, no packets moving; the rolled-out state.
 * ───────────────────────────────────────────────────────── */

// Every stage's start, in ms after the scene comes into view. Keys are
// sorted for lint; the storyboard above reads them in time order.
const TIMING = {
  // The console reads "Rolled out".
  done: 5100,
  // The slider glides to the last step.
  full: 3900,
  // The slider glides to the middle step.
  half: 1300,
  // Metrics confirm v2 is healthy.
  healthy: 2500,
  // Reset and replay.
  loop: 9000,
};

const STAGE = { done: 4, full: 3, half: 1, healthy: 2, start: 0 } as const;

// The rollout percentage at a stage: first step, then middle, then last.
const rolloutAt = (stage: number, steps: readonly [number, number, number]) => {
  if (stage >= STAGE.full) {
    return steps[2];
  }
  if (stage >= STAGE.half) {
    return steps[1];
  }
  return steps[0];
};

/* Shared motion */
const FADE = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };
const EASE_IN = [0.8, 0, 1, 1] as const;
const EASE_OUT = [0.2, 0, 0, 1] as const;
const GLIDE = { damping: 26, stiffness: 120, type: "spring" as const };

/* Packets on the rails */
const PACKETS = {
  // Packets per rail at full traffic.
  count: 4,
  // Dash pattern (in % of the rail): tiny trailing dashes, then the head,
  // then a gap longer than the rail so each path carries one packet.
  pattern: "0.7 1.1 1 1.1 1.4 1.1 1.9 1.1 3.6 140",
  // Seconds for one packet to run a rail.
  period: 2.4,
  // Length of the visible pattern (sum before the gap).
  span: 13,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The rollout console: a glass panel standing in open space at the back
// left, floating a little above the floor. `at` is the top-left corner of
// its front face. The router's top stays below its bottom edge and the
// servers start right of its right edge on screen, so nothing hides its
// copy at home.
const CONSOLE = {
  at: [-8.5, -4.5, 0.4 + 6.2] as Vec3,
  depth: 0.45,
  // Height of its bottom edge above the floor.
  float: 0.4,
  size: [12, 6.2] as const,
};
// The display inset from the panel's edge, in face units.
const INSET = 0.35;

// Edge router at the front centre; traffic enters its hidden back face
// and leaves from its right face.
const ROUTER = { at: [-2.5, 1.5, 0] as Vec3, size: [3, 3, 1.2] as Vec3 };

// Two server stacks at the back right, side by side, fronts to the viewer:
// v1 (stable) then v2 (new). Rails reach their fronts across open floor,
// so the split is never hidden behind a box.
const SERVER = { d: 2.5, h: 3.4, w: 3, y: -4.5 };
const V1: Vec3 = [6.25, SERVER.y, 0];
const V2: Vec3 = [10.25, SERVER.y, 0];
const FRONT_Y = SERVER.y + SERVER.d;

// Rails as polylines in world x, y on the floor (z = 0).
type Pt = readonly [number, number];
const RAILS: Record<"in" | "v1" | "v2", readonly Pt[]> = {
  in: [
    [-9, 3],
    [-2.5, 3],
  ],
  v1: [
    [0.5, 3],
    [V1[0] + 1.5, 3],
    [V1[0] + 1.5, FRONT_Y],
  ],
  v2: [
    [0.5, 3],
    [V2[0] + 1.5, 3],
    [V2[0] + 1.5, FRONT_Y],
  ],
};
const RAIL = { half: 0.42 };
const FLOOR: Vec3 = [0, 0, 0];

const boxCast = (at: Vec3, size: Vec3): IsoCast => ({
  box: [at[0], at[1], size[0], size[1], size[2]],
  z: at[2],
});

const CASTS: IsoCast[] = [
  {
    // Kept low so the shadow reads as a pool at its foot, not a smear behind.
    box: [
      CONSOLE.at[0],
      CONSOLE.at[1] - CONSOLE.depth,
      CONSOLE.size[0],
      CONSOLE.depth,
      1.8,
    ],
    z: CONSOLE.float,
  },
  boxCast(ROUTER.at, ROUTER.size),
  boxCast(V1, [SERVER.w, SERVER.d, SERVER.h]),
  boxCast(V2, [SERVER.w, SERVER.d, SERVER.h]),
];

// The frame fits the console, the servers, the router and the rails: no plate.
const BOUNDS: Vec3[] = [
  CONSOLE.at,
  [CONSOLE.at[0] + CONSOLE.size[0], CONSOLE.at[1], CONSOLE.at[2]],
  [CONSOLE.at[0], CONSOLE.at[1], CONSOLE.float],
  [CONSOLE.at[0], CONSOLE.at[1] - CONSOLE.depth, CONSOLE.at[2]],
  [
    CONSOLE.at[0] + CONSOLE.size[0],
    CONSOLE.at[1] - CONSOLE.depth,
    CONSOLE.at[2],
  ],
  [V2[0] + SERVER.w, SERVER.y, SERVER.h],
  [V2[0] + SERVER.w, SERVER.y, 0],
  [V2[0] + SERVER.w, FRONT_Y, 0],
  [RAILS.in[0][0] - RAIL.half, RAILS.in[0][1] + RAIL.half, 0],
  [ROUTER.at[0], ROUTER.at[1] + ROUTER.size[1], 0],
  [ROUTER.at[0] + ROUTER.size[0], ROUTER.at[1] + ROUTER.size[1], 0],
  [V2[0] + 1.5 + RAIL.half, 3 + RAIL.half, 0],
];

// The construction grid under everything.
const GRID = { at: [-10, -6] as const, size: [26, 12] as const };

// Rig pivots: boxes stand on their base centre, the console on its foot.
const base = (at: Vec3, size: Vec3): Vec3 => [
  at[0] + size[0] / 2,
  at[1] + size[1] / 2,
  0,
];
const SERVER_SIZE: Vec3 = [SERVER.w, SERVER.d, SERVER.h];
const V1_PIVOT = base(V1, SERVER_SIZE);
const V2_PIVOT = base(V2, SERVER_SIZE);
const ROUTER_PIVOT = base(ROUTER.at, ROUTER.size);
const CONSOLE_PIVOT: Vec3 = [
  CONSOLE.at[0] + CONSOLE.size[0] / 2,
  CONSOLE.at[1],
  0,
];

/* Tracks, on the storyboard's clock (ms since the scene started). */

// A track that fires twice: at the half step, and again at full.
const twice = (make: (start: number) => IsoTrack): IsoTrack => [
  ...make(TIMING.half),
  ...shiftTrack(make(0), TIMING.full),
];
// v2 hops as its share jumps.
const V2_TRACK = twice((t) => hop(1.1, t));
// The router presses as it re-splits the traffic.
const ROUTER_TRACK = twice((t) => press(0.3, t + 80));
// v1 sinks a little, and stays down, as its rail goes quiet.
const V1_TRACK: IsoTrack = [
  [TIMING.full, 1, EASE_IN],
  [TIMING.full + 260, 0.94, EASE_OUT],
  [TIMING.full + 460, 0.955],
];
// The console takes "Rolled out": kicked back (−y), settles, holds, home.
const CONSOLE_TRACK = jolt(0.35, TIMING.done, 600);

const v2Pose = (ms: number): IsoPose => ({
  offset: [0, 0, sample(V2_TRACK, ms)],
});
const routerPose = (ms: number): IsoPose => ({
  scale: [1, 1, sample(ROUTER_TRACK, ms)],
});
const v1Pose = (ms: number): IsoPose => ({
  scale: [1, 1, sample(V1_TRACK, ms)],
});
const consolePose = (ms: number): IsoPose => ({
  offset: [0, -sample(CONSOLE_TRACK, ms), 0],
});

// The camera turns around the middle of the floor.
const PIVOT: readonly [number, number] = [1, 0];

// The console faces one way: turning toward it (+) reads well, away (−)
// soon foreshortens its copy.
const DEFAULT_ORBIT: IsoOrbit = [-15, 30];

// CSS pixels per world unit for UI rendered into the screen with `screen`.
const SCREEN_PX = 40;

/* ─────────────────────────── Rails (math) ─────────────────────────────── */

// Polyline → face-path string on the plate's top plane (u = x, v = y).
const railD = (pts: readonly Pt[]) =>
  pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");

const unit = ([x, y]: Pt): Pt => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/**
 * One edge of a rail: the polyline offset sideways by `d`. Rails turn at
 * right angles, so a corner's offset is the sum of the two segments'
 * normals (a mitre), which lands exactly on both offset edges.
 */
const offsetLine = (pts: readonly Pt[], d: number): Pt[] =>
  pts.map((p, i) => {
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const dirIn = prev ? unit([p[0] - prev[0], p[1] - prev[1]]) : null;
    const dirOut = next ? unit([next[0] - p[0], next[1] - p[1]]) : null;
    const nIn: Pt | null = dirIn ? [-dirIn[1], dirIn[0]] : null;
    const nOut: Pt | null = dirOut ? [-dirOut[1], dirOut[0]] : null;
    const straight =
      nIn &&
      nOut &&
      Math.abs(nIn[0] - nOut[0]) + Math.abs(nIn[1] - nOut[1]) < 1e-6;
    const n: Pt =
      nIn && nOut && !straight
        ? [nIn[0] + nOut[0], nIn[1] + nOut[1]]
        : (nIn ?? nOut ?? [0, 0]);
    return [p[0] + n[0] * d, p[1] + n[1] * d];
  });

// The glow under a rail: one rectangle per segment, padded at both ends
// so turns close, in floor (face) units.
const grooveRects = (pts: readonly Pt[]) =>
  pts.slice(1).map((b, i) => {
    const a = pts[i];
    const x0 = Math.min(a[0], b[0]) - RAIL.half;
    const y0 = Math.min(a[1], b[1]) - RAIL.half;
    return {
      h: Math.abs(b[1] - a[1]) + 2 * RAIL.half,
      key: `${a.join(",")}-${b.join(",")}`,
      w: Math.abs(b[0] - a[0]) + 2 * RAIL.half,
      x: x0,
      y: y0,
    };
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// A rail is a light track on the floor: two hairlines in the brand colour
// with a faint glow between them.
const Rail = ({ pts }: { pts: readonly Pt[] }) => (
  <>
    <Face at={FLOOR} plane="top">
      {grooveRects(pts).map((r) => (
        <rect
          fill="var(--iso-glow)"
          height={r.h}
          key={r.key}
          opacity={0.07}
          rx={RAIL.half}
          width={r.w}
          x={r.x}
          y={r.y}
        />
      ))}
    </Face>
    {[RAIL.half, -RAIL.half].map((d) => (
      <FacePath
        at={FLOOR}
        d={railD(offsetLine(pts, d))}
        fill="none"
        key={d}
        opacity={0.35}
        plane="top"
        stroke="var(--iso-glow)"
        style={{ strokeWidth: isoStroke(0.6, 0.07) }}
      />
    ))}
  </>
);

/**
 * Packets on one rail: `shown` of PACKETS.count run at once, evenly
 * spaced in time. Each is a dash pattern (trailing dashes, then a head)
 * sliding along the rail; hidden ones fade out where they are.
 */
const Packets = ({
  pts,
  shown,
  lit,
  still,
}: {
  pts: readonly Pt[];
  shown: number;
  lit: boolean;
  still: boolean;
}) => {
  // The new version's packets are lit; the stable version's are quieter.
  const on = lit ? 1 : 0.45;
  return (
    <g>
      {Array.from({ length: PACKETS.count }, (_, i) => (
        <FacePath
          at={FLOOR}
          className={
            still
              ? undefined
              : "motion-safe:animate-[iso-rail_2.4s_linear_infinite]"
          }
          d={railD(pts)}
          fill="none"
          key={i}
          pathLength={100}
          plane="top"
          stroke={lit ? "var(--iso-glow)" : "var(--iso-text)"}
          strokeDasharray={PACKETS.pattern}
          strokeDashoffset={still ? -40 - i * 12 : PACKETS.span}
          strokeLinecap="round"
          style={{
            animationDelay: `${(-i * PACKETS.period) / PACKETS.count}s`,
            opacity: i < shown ? on : 0,
            strokeWidth: isoStroke(1.05, 0.14),
            transition: "opacity 0.6s ease",
          }}
        />
      ))}
    </g>
  );
};

const RackFace = ({
  w,
  h,
  label,
  note,
  active,
}: {
  w: number;
  h: number;
  label: string;
  note: string;
  active: boolean;
}) => (
  <>
    <text
      fill="var(--iso-text)"
      fontSize={0.7}
      fontWeight={600}
      x={0.35}
      y={0.95}
    >
      {label}
    </text>
    <text
      fill="var(--iso-text)"
      fontFamily={ISO_MONO}
      fontSize={0.24}
      opacity={0.55}
      x={0.38}
      y={1.38}
    >
      {note}
    </text>
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect
          fill="var(--iso-text)"
          height={0.5}
          opacity={0.08}
          rx={0.08}
          width={w - 0.7}
          x={0.35}
          y={1.75 + i * 0.62}
        />
        <circle
          cx={w - 0.65}
          cy={2 + i * 0.62}
          fill={active ? "var(--iso-glow)" : "var(--iso-text)"}
          r={0.09}
          style={{
            opacity: active ? 1 : 0.25,
            transition: "opacity 0.6s ease",
          }}
        />
      </g>
    ))}
    <rect
      fill="var(--iso-text)"
      height={0.06}
      opacity={0.12}
      width={w - 0.7}
      x={0.35}
      y={h - 0.3}
    />
  </>
);

// The router's front: four ports with blinking lights and its label.
const RouterFace = ({ w }: { w: number }) => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect
          fill="var(--iso-text)"
          height={0.32}
          opacity={0.12}
          rx={0.06}
          width={0.42}
          x={0.4 + i * 0.6}
          y={0.45}
        />
        <circle
          className="motion-safe:animate-[iso-blink_1.2s_ease-in-out_infinite]"
          cx={0.61 + i * 0.6}
          cy={0.95}
          fill="var(--iso-glow)"
          r={0.06}
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      </g>
    ))}
    <text
      fill="var(--iso-text)"
      fontFamily={ISO_MONO}
      fontSize={0.22}
      opacity={0.5}
      textAnchor="end"
      x={w - 0.3}
      y={0.98}
    >
      edge
    </text>
  </>
);

const Router = () => (
  <Box
    at={ROUTER.at}
    left={(w) => <RouterFace w={w} />}
    palette="surface"
    size={ROUTER.size}
  />
);

interface ConsoleCopy {
  errorRate: string;
  flag: string;
  latency: string;
}

const Console = ({
  stage,
  steps,
  copy,
  w,
  h,
}: {
  stage: number;
  steps: readonly [number, number, number];
  copy: ConsoleCopy;
  w: number;
  h: number;
}) => {
  const pct = rolloutAt(stage, steps);
  const track = { w: w - 1.4, x: 0.7, y: 3.05 };
  const healthy = stage >= STAGE.healthy;
  const done = stage >= STAGE.done;
  return (
    <>
      <rect
        fill="var(--iso-screen)"
        height={h - 2 * INSET}
        rx={0.45}
        width={w - 2 * INSET}
        x={INSET}
        y={INSET}
      />
      <rect
        fill="var(--iso-glow)"
        height={0.5}
        rx={0.14}
        width={0.5}
        x={0.7}
        y={0.62}
      />
      <text
        fill="var(--iso-screen-ink)"
        fontFamily={ISO_MONO}
        fontSize={0.36}
        fontWeight={600}
        x={1.4}
        y={1}
      >
        {copy.flag}
      </text>
      <motion.g
        animate={{ opacity: done ? 1 : 0 }}
        initial={false}
        transition={FADE}
      >
        <rect
          fill="var(--iso-glow)"
          height={0.5}
          opacity={0.15}
          rx={0.25}
          width={2.1}
          x={w - 2.8}
          y={0.62}
        />
        <text
          fill="var(--iso-glow)"
          fontSize={0.26}
          fontWeight={600}
          textAnchor="middle"
          x={w - 1.75}
          y={0.95}
        >
          ✓ Rolled out
        </text>
      </motion.g>
      <text
        fill="var(--iso-screen-ink)"
        fontSize={0.28}
        opacity={0.5}
        x={0.7}
        y={1.75}
      >
        Rollout to new version
      </text>
      <text
        fill="var(--iso-screen-ink)"
        fontSize={0.95}
        fontWeight={600}
        letterSpacing={-0.02}
        style={{ fontVariantNumeric: "tabular-nums" }}
        x={0.7}
        y={2.7}
      >
        {`${pct}%`}
      </text>
      <rect
        fill="var(--iso-screen-ink)"
        height={0.18}
        opacity={0.1}
        rx={0.09}
        width={track.w}
        x={track.x}
        y={track.y}
      />
      <motion.g
        animate={{ scaleX: pct / 100 }}
        initial={false}
        style={{ originX: 0, transformBox: "fill-box" }}
        transition={GLIDE}
      >
        <rect
          fill="var(--iso-glow)"
          height={0.18}
          rx={0.09}
          width={track.w}
          x={track.x}
          y={track.y}
        />
      </motion.g>
      <motion.g
        animate={{ x: (track.w * pct) / 100 }}
        initial={false}
        transition={GLIDE}
      >
        <circle
          cx={track.x}
          cy={track.y + 0.09}
          fill="var(--iso-screen)"
          r={0.26}
          stroke="var(--iso-glow)"
          strokeWidth={0.07}
        />
      </motion.g>
      <text
        fill="var(--iso-screen-ink)"
        fontFamily={ISO_MONO}
        fontSize={0.24}
        opacity={0.6}
        x={0.7}
        y={3.85}
      >
        {`v1 ${100 - pct}%`}
      </text>
      <text
        fill="var(--iso-glow)"
        fontFamily={ISO_MONO}
        fontSize={0.24}
        textAnchor="end"
        x={w - 0.7}
        y={3.85}
      >
        {`v2 ${pct}%`}
      </text>
      <rect
        fill="var(--iso-screen-ink)"
        height={0.03}
        opacity={0.12}
        width={w - 1.4}
        x={0.7}
        y={4.2}
      />
      <text
        fill="var(--iso-screen-ink)"
        fontSize={0.26}
        opacity={0.5}
        x={0.7}
        y={4.85}
      >
        Error rate
      </text>
      <text
        fill="var(--iso-screen-ink)"
        fontFamily={ISO_MONO}
        fontSize={0.3}
        x={0.7}
        y={5.25}
      >
        {copy.errorRate}
      </text>
      <text
        fill="var(--iso-screen-ink)"
        fontSize={0.26}
        opacity={0.5}
        x={3.3}
        y={4.85}
      >
        p95
      </text>
      <text
        fill="var(--iso-screen-ink)"
        fontFamily={ISO_MONO}
        fontSize={0.3}
        x={3.3}
        y={5.25}
      >
        {copy.latency}
      </text>
      <motion.g
        animate={{ opacity: healthy ? 1 : 0.35 }}
        initial={false}
        transition={FADE}
      >
        <rect
          fill="var(--iso-glow)"
          height={0.5}
          opacity={healthy ? 0.15 : 0.06}
          rx={0.25}
          width={1.7}
          x={w - 2.4}
          y={4.8}
        />
        <circle
          cx={w - 2.1}
          cy={5.05}
          fill={healthy ? "var(--iso-glow)" : "var(--iso-screen-ink)"}
          r={0.08}
        />
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.26}
          fontWeight={600}
          x={w - 1.9}
          y={5.14}
        >
          Healthy
        </text>
      </motion.g>
    </>
  );
};

/** What the console is showing, for UI passed in through `screen`. */
export interface RolloutScreenState {
  /** "start" (first step), "half", "healthy", "full", "done". */
  step: "start" | "half" | "healthy" | "full" | "done";
  /** The rollout percentage at this step. */
  percent: number;
  /** The feature flag's name. */
  flag: string;
  /** Error rate copy, e.g. "0.00%". */
  errorRate: string;
  /** p95 latency copy, e.g. "212 ms". */
  latency: string;
}

const stepOf = (stage: number): RolloutScreenState["step"] => {
  if (stage >= STAGE.done) {
    return "done";
  }
  if (stage >= STAGE.full) {
    return "full";
  }
  if (stage >= STAGE.healthy) {
    return "healthy";
  }
  if (stage >= STAGE.half) {
    return "half";
  }
  return "start";
};

const resolveScreen = (
  screen: ReactNode | ((state: RolloutScreenState) => ReactNode),
  state: RolloutScreenState
) => (typeof screen === "function" ? screen(state) : screen);

/** Any React UI, rendered into the screen's face at SCREEN_PX per unit. */
const CustomScreen = ({
  children,
  w,
  h,
}: {
  children: ReactNode;
  w: number;
  h: number;
}) => {
  const dw = w - 2 * INSET;
  const dh = h - 2 * INSET;
  return (
    <>
      <rect
        fill="var(--iso-screen)"
        height={dh}
        rx={0.45}
        width={dw}
        x={INSET}
        y={INSET}
      />
      <foreignObject
        height={dh * SCREEN_PX}
        style={{ overflow: "hidden" }}
        transform={`translate(${INSET} ${INSET}) scale(${1 / SCREEN_PX})`}
        width={dw * SCREEN_PX}
      >
        <div
          className="size-full overflow-hidden"
          style={{
            borderRadius: 0.45 * SCREEN_PX,
            height: dh * SCREEN_PX,
            width: dw * SCREEN_PX,
          }}
        >
          {children}
        </div>
      </foreignObject>
    </>
  );
};

/** The built-in console, or whatever `screen` provides. */
const ScreenContent = ({
  custom,
  copy,
  stage,
  steps,
  w,
  h,
}: {
  custom: ReactNode;
  copy: ConsoleCopy;
  stage: number;
  steps: readonly [number, number, number];
  w: number;
  h: number;
}) =>
  custom === undefined ? (
    <Console copy={copy} h={h} stage={stage} steps={steps} w={w} />
  ) : (
    <CustomScreen h={h} w={w}>
      {custom}
    </CustomScreen>
  );

/** Film grain over the whole stage, so flat colour reads as rendered. */
const Grain = ({ uid }: { uid: string }) => (
  <>
    <defs>
      <filter id={`${uid}-grain`}>
        <feTurbulence
          baseFrequency="9"
          numOctaves="2"
          result="noise"
          stitchTiles="stitch"
          type="fractalNoise"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
    <rect
      fill="white"
      filter={`url(#${uid}-grain)`}
      height="400%"
      opacity={0.07}
      style={{ mixBlendMode: "overlay", pointerEvents: "none" }}
      width="400%"
      x="-200%"
      y="-200%"
    />
  </>
);

/** The floor's construction grid, when wanted. */
const Ground = ({ show }: { show: boolean }) =>
  show ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null;

/** Film grain, for the lit variants only. */
const Film = ({ show, uid }: { show: boolean; uid: string }) =>
  show ? <Grain uid={uid} /> : null;

/** Glass fronts belong to the lit and ink variants, not the blueprint. */
const glass = (line: boolean) => (line ? undefined : GLASS);

/** A still scene has no orbit. */
const orbitFor = (rotate: IsoRotate, orbit: IsoOrbit): IsoOrbit =>
  rotate === "off" ? 0 : orbit;

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

/** Stage overrides for the benchmark look: no hairline, brand-tinted shadow. */
const stageStyle = (line: boolean) =>
  ({
    // Edgeless variants rely on light and shadow alone: no hairline.
    "--iso-contour-w": line ? undefined : "0",
    // Shadows carry the brand: a deep tint of the tone, not grey.
    "--iso-shadow":
      "color-mix(in oklab, color-mix(in oklab, var(--iso-tone) 45%, black) 20%, transparent)",
  }) as CSSProperties;

/** Pointer handlers that keep the orbit working and replay on a plain click. */
const useReplayOnClick = (orbitProps: object, onClick: (() => void) | null) => {
  const pressed = useRef({ x: 0, y: 0 });
  const handlers = orbitProps as OrbitHandlers;
  return {
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
      if (onClick && !moved) {
        onClick();
      }
    },
  };
};

/* ───────────────────────────── Story ──────────────────────────────────── */

// How many of a rail's packets run for a share of traffic (0–100).
const packetsFor = (share: number) =>
  share <= 0 ? 0 : Math.max(1, Math.round((share / 100) * PACKETS.count));

// A turnable scene is a focusable group that says how to turn it.
const turnableLabel = (rotate: IsoRotate, title?: string) =>
  rotate === "off"
    ? {}
    : {
        "aria-label": `${title ?? "Illustration"}. Move the pointer or use the left and right arrow keys to turn it.`,
        role: "group",
      };

/**
 * The storyboard's clock: walks `stage` through TIMING while the scene is
 * in view, then (with `loop`) starts again. `still` holds the end state.
 */
const useStory = ({
  inView,
  loop,
  still,
}: {
  inView: boolean;
  loop: boolean;
  still: boolean;
}) => {
  const [stage, setStage] = useState<number>(still ? STAGE.done : STAGE.start);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (still) {
      setStage(STAGE.done);
      return;
    }
    if (!inView) {
      setStage(STAGE.start);
      return;
    }
    setStage(STAGE.start);
    const at: [number, number][] = [
      [TIMING.half, STAGE.half],
      [TIMING.healthy, STAGE.healthy],
      [TIMING.full, STAGE.full],
      [TIMING.done, STAGE.done],
    ];
    const timers = at.map(([ms, s]) => setTimeout(() => setStage(s), ms));
    if (loop) {
      timers.push(setTimeout(() => setCycle((c) => c + 1), TIMING.loop));
    }
    return () => {
      for (const t of timers) {
        clearTimeout(t);
      }
    };
  }, [inView, still, loop, cycle]);
  const replay = () => setCycle((c) => c + 1);
  return { cycle, replay, stage };
};

/** Everything a scene's shell needs: the clock, the camera, the pointer. */
const useSceneShell = ({
  autoPlay,
  loop,
  orbit,
  replayOnClick,
  rotate,
  variant,
}: {
  autoPlay: boolean;
  loop: boolean;
  orbit: IsoOrbit;
  replayOnClick: boolean;
  rotate: IsoRotate;
  variant: IsoVariant;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const still = reduced || !autoPlay;
  const { cycle, stage, replay } = useStory({ inView, loop, still });
  // The rigs' clock: runs while the story plays, restarts with every cycle.
  const clock = useClock(inView && !still, cycle);
  const uid = useId().replaceAll(/[^a-zA-Z0-9_-]/g, "");
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  const pointer = useReplayOnClick(
    orbitProps,
    replayOnClick && !still ? replay : null
  );
  return {
    camera,
    clock,
    line: variant === "line",
    orbitProps,
    pointer,
    ref,
    stage,
    still,
    uid,
  };
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface GradualRolloutProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. */
  tone?: IsoTone;
  /** Colour of lit details (rails, packets of the new version, slider, lights). Defaults to `tone`. */
  accent?: IsoTone;
  /** Flat ink drawing (default), soft tint, full colour, or blueprint outline. */
  variant?: IsoVariant;
  /** Line weight: in `ink` 0.3 is a 1.3 px outline at any size; rims and rails or outlines elsewhere. */
  strokeWidth?: number;
  /** Feature flag name on the console, up to about 16 characters. */
  flag?: string;
  /** The three rollout steps in percent, e.g. [10, 50, 100]. Default [10, 50, 100]. */
  steps?: readonly [number, number, number];
  /** Error rate shown on the console, e.g. "0.00%". */
  errorRate?: string;
  /** p95 latency shown on the console, e.g. "212 ms". */
  latency?: string;
  /** Label on the stable server's front, up to about 4 characters. */
  stableLabel?: string;
  /** Label on the new server's front, up to about 4 characters. */
  canaryLabel?: string;
  /**
   * Your own UI inside the console instead of the built-in one: any React
   * node, or a function of the story's state (`step`, `percent` and the
   * copy) so your UI follows the rollout. It renders at 452 × 220 CSS px
   * (the screen is 11.3 × 5.5 units at 40 px per unit) and is projected
   * into the scene; the rails and servers still play.
   */
  screen?: ReactNode | ((state: RolloutScreenState) => ReactNode);
  /** Play when the scene scrolls into view. Off shows the rolled-out end state. */
  autoPlay?: boolean;
  /** Replay after a pause. Off plays once and holds the end state. */
  loop?: boolean;
  /** Clicking the scene replays the story. */
  replayOnClick?: boolean;
  /**
   * Let the viewer turn the scene: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /**
   * How far it turns, in degrees: a number for both ways, or [min, max].
   * Default [-15, 30]: further toward the console than away from it, so the
   * copy stays readable. Each side is capped at 40.
   */
  orbit?: IsoOrbit;
  /** Dashed construction grid on the floor. */
  grid?: boolean;
  /** Film grain over the scene (off in ink). */
  grain?: boolean;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

const DEFAULT_STEPS: readonly [number, number, number] = [10, 50, 100];

/**
 * Gradual rollout, in isometric ink: a feature flag's console moves a new
 * version from 10% to 100% of traffic; the new server hops and lights up
 * as its share jumps, the router presses as it re-splits, the old server
 * sinks as its rail goes quiet, and the packets on the light rails shift
 * across. Flat ink drawing with one even outline, objects that move as
 * solids, the camera leans with the pointer, and `screen` puts your own
 * React UI inside the console. Follows the shadcn theme; plays in view,
 * loops.
 */
export const GradualRollout = ({
  tone = "primary",
  accent,
  variant = "ink",
  strokeWidth = 0.3,
  flag = "new-checkout",
  steps = DEFAULT_STEPS,
  errorRate = "0.00%",
  latency = "212 ms",
  stableLabel = "v1",
  canaryLabel = "v2",
  screen,
  autoPlay = true,
  loop = true,
  replayOnClick = true,
  rotate = "pointer",
  orbit = DEFAULT_ORBIT,
  grid = true,
  grain = false,
  title,
  className,
}: GradualRolloutProps) => {
  const { camera, clock, line, orbitProps, pointer, ref, stage, still, uid } =
    useSceneShell({ autoPlay, loop, orbit, replayOnClick, rotate, variant });
  const pct = rolloutAt(stage, steps);
  const newShare = packetsFor(pct);
  const oldShare = packetsFor(100 - pct);
  const serverSize = SERVER_SIZE;
  const copy: ConsoleCopy = { errorRate, flag, latency };
  const custom = resolveScreen(screen, {
    ...copy,
    percent: pct,
    step: stepOf(stage),
  });
  return (
    <div
      {...turnableLabel(rotate, title)}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-slot="gradual-rollout"
      ref={ref}
      {...orbitProps}
      onPointerDown={pointer.onPointerDown}
      onPointerUp={pointer.onPointerUp}
    >
      <IsoStage
        accent={accent}
        bounds={BOUNDS}
        camera={camera}
        casts={CASTS}
        orbit={orbitFor(rotate, orbit)}
        strokeWidth={strokeWidth}
        style={stageStyle(line)}
        title={title}
        tone={tone}
        variant={variant}
      >
        <style>
          {`@keyframes iso-rail{from{stroke-dashoffset:${PACKETS.span}}to{stroke-dashoffset:-100}}@keyframes iso-blink{0%,100%{opacity:1}50%{opacity:.25}}`}
        </style>
        <Ground show={grid} />
        <Rail pts={RAILS.in} />
        <Rail pts={RAILS.v1} />
        <Rail pts={RAILS.v2} />
        <Packets lit pts={RAILS.in} shown={PACKETS.count} still={still} />
        <Packets lit={false} pts={RAILS.v1} shown={oldShare} still={still} />
        <Packets lit pts={RAILS.v2} shown={newShare} still={still} />
        <Rig clock={clock} pivot={CONSOLE_PIVOT} pose={consolePose}>
          <Panel
            at={CONSOLE.at}
            content={(w, h) => (
              <ScreenContent
                copy={copy}
                custom={custom}
                h={h}
                stage={stage}
                steps={steps}
                w={w}
              />
            )}
            depth={CONSOLE.depth}
            frontStyle={glass(line)}
            radius={0.6}
            size={CONSOLE.size}
          />
        </Rig>
        <Rig clock={clock} pivot={V1_PIVOT} pose={v1Pose}>
          <Box
            at={V1}
            left={(w, h) => (
              <RackFace
                active={oldShare > 0}
                h={h}
                label={stableLabel}
                note="stable"
                w={w}
              />
            )}
            palette="surface"
            size={serverSize}
          />
        </Rig>
        <Rig clock={clock} pivot={V2_PIVOT} pose={v2Pose}>
          <motion.g
            animate={{ opacity: stage >= STAGE.half ? 1 : 0 }}
            initial={false}
            transition={FADE}
          >
            <Bloom at={V2} size={serverSize} strength={0.7} />
          </motion.g>
          <Box
            at={V2}
            left={(w, h) => (
              <RackFace active h={h} label={canaryLabel} note={flag} w={w} />
            )}
            palette={stage >= STAGE.half ? "main" : "surface"}
            size={serverSize}
          />
        </Rig>
        <Rig clock={clock} pivot={ROUTER_PIVOT} pose={routerPose}>
          <Router />
        </Rig>
        <Film show={grain && !line} uid={uid} />
      </IsoStage>
    </div>
  );
};

export default GradualRollout;
