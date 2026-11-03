"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  Box,
  Face,
  FacePath,
  ISO_MONO,
  IsoStage,
  Panel,
  Slab,
  isoStroke,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCast,
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
 * Traffic runs on rails cut into the floor plate; packets trail dashes.
 * Read top-to-bottom. Each value is ms after the scene comes into view.
 *
 *    0ms   rollout at the first step (10%): v2's rail carries 1 packet in 4
 * 1300ms   slider glides to 50%; v2's packets multiply, v1's thin out
 * 2500ms   metrics confirm v2 is healthy (pill lights)
 * 3900ms   slider glides to 100%; v1's rail goes quiet, its lights dim
 * 5100ms   console reads "Rolled out"
 * 9000ms   hold ends; back to the first step, play again
 *
 * Packets loop continuously (CSS), only their count follows the story.
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

// The floor plate everything stands on, and the height of its top.
const TOP = 0.6;
const PLATE = { at: [-9, -6, 0] as Vec3, size: [20.5, 11.5, TOP] as Vec3 };

// Rollout console standing at the back left. The router's top stays below
// its bottom edge and v1 starts right of its right edge on screen, so
// nothing hides its copy at home.
const CONSOLE = {
  at: [-8, -4.5, TOP + 5.6] as Vec3,
  depth: 0.4,
  size: [9, 5.6] as const,
};

// Edge router at the front centre; traffic enters its hidden back face
// and leaves from its right face.
const ROUTER = { at: [-2.5, 1, TOP] as Vec3, size: [3, 3, 1.2] as Vec3 };

// Two server stacks at the back right, side by side, fronts to the viewer:
// v1 (stable) then v2 (new). Rails reach their fronts across open floor,
// so the split is never hidden behind a box.
const SERVER = { d: 2.5, h: 3.4, w: 3, y: -4.5 };
const V1: Vec3 = [3.75, SERVER.y, TOP];
const V2: Vec3 = [7.75, SERVER.y, TOP];
const FRONT_Y = SERVER.y + SERVER.d;

// Rails as polylines in world x, y on the plate's top (z = TOP).
type Pt = readonly [number, number];
const RAILS: Record<"in" | "v1" | "v2", readonly Pt[]> = {
  in: [
    [-8.5, 2.5],
    [-2.5, 2.5],
  ],
  v1: [
    [0.5, 2.5],
    [V1[0] + 1.5, 2.5],
    [V1[0] + 1.5, FRONT_Y],
  ],
  v2: [
    [0.5, 2.5],
    [V2[0] + 1.5, 2.5],
    [V2[0] + 1.5, FRONT_Y],
  ],
};
const RAIL = { half: 0.42 };
const PLATE_TOP: Vec3 = [0, 0, TOP];

const boxCast = (at: Vec3, size: Vec3): IsoCast => ({
  box: [at[0], at[1], size[0], size[1], size[2]],
  z: at[2],
});

const CASTS: IsoCast[] = [
  {
    box: [
      CONSOLE.at[0],
      CONSOLE.at[1] - CONSOLE.depth,
      CONSOLE.size[0],
      CONSOLE.depth,
      CONSOLE.size[1],
    ],
    z: CONSOLE.at[2] - CONSOLE.size[1],
  },
  boxCast(ROUTER.at, ROUTER.size),
  boxCast(V1, [SERVER.w, SERVER.d, SERVER.h]),
  boxCast(V2, [SERVER.w, SERVER.d, SERVER.h]),
];

const BOUNDS: Vec3[] = [
  PLATE.at,
  [PLATE.at[0] + PLATE.size[0], PLATE.at[1], 0],
  [PLATE.at[0] + PLATE.size[0], PLATE.at[1] + PLATE.size[1], 0],
  [PLATE.at[0], PLATE.at[1] + PLATE.size[1], 0],
  [CONSOLE.at[0], CONSOLE.at[1] - CONSOLE.depth, CONSOLE.at[2]],
  [
    CONSOLE.at[0] + CONSOLE.size[0],
    CONSOLE.at[1] - CONSOLE.depth,
    CONSOLE.at[2],
  ],
];

// The camera turns around the middle of the plate.
const PIVOT: readonly [number, number] = [
  PLATE.at[0] + PLATE.size[0] / 2,
  PLATE.at[1] + PLATE.size[1] / 2,
];

// The console faces one way: turning toward it (+) reads well, away (−)
// soon foreshortens its copy.
const DEFAULT_ORBIT: IsoOrbit = [-15, 30];

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

// The groove under a rail: one rectangle per segment, padded at both ends
// so turns close, in plate (face) units.
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

const Rail = ({ pts }: { pts: readonly Pt[] }) => (
  <>
    <Face at={PLATE_TOP} plane="top">
      {grooveRects(pts).map((r) => (
        <rect
          fill="var(--iso-text)"
          height={r.h}
          key={r.key}
          opacity={0.07}
          width={r.w}
          x={r.x}
          y={r.y}
        />
      ))}
    </Face>
    {[RAIL.half, -RAIL.half].map((d) => (
      <FacePath
        at={PLATE_TOP}
        d={railD(offsetLine(pts, d))}
        fill="none"
        key={d}
        plane="top"
        stroke="var(--iso-contour)"
        style={{ strokeWidth: isoStroke(0.7, 0.08) }}
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
          at={PLATE_TOP}
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
}: {
  stage: number;
  steps: readonly [number, number, number];
  copy: ConsoleCopy;
  w: number;
}) => {
  const pct = rolloutAt(stage, steps);
  const track = { w: w - 1.1, x: 0.55, y: 2.85 };
  const healthy = stage >= STAGE.healthy;
  const done = stage >= STAGE.done;
  return (
    <>
      <rect
        fill="var(--iso-screen)"
        height={5.6 - 0.6}
        rx={0.35}
        width={w - 0.6}
        x={0.3}
        y={0.3}
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
        fontSize={0.75}
        fontWeight={600}
        style={{ fontVariantNumeric: "tabular-nums" }}
        x={0.7}
        y={2.55}
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
        y={3.6}
      >
        {`v1 ${100 - pct}%`}
      </text>
      <text
        fill="var(--iso-glow)"
        fontFamily={ISO_MONO}
        fontSize={0.24}
        textAnchor="end"
        x={w - 0.7}
        y={3.6}
      >
        {`v2 ${pct}%`}
      </text>
      <rect
        fill="var(--iso-screen-ink)"
        height={0.03}
        opacity={0.12}
        width={w - 1.4}
        x={0.7}
        y={3.95}
      />
      <text
        fill="var(--iso-screen-ink)"
        fontSize={0.26}
        opacity={0.5}
        x={0.7}
        y={4.55}
      >
        Error rate
      </text>
      <text
        fill="var(--iso-screen-ink)"
        fontFamily={ISO_MONO}
        fontSize={0.3}
        x={0.7}
        y={4.95}
      >
        {copy.errorRate}
      </text>
      <text
        fill="var(--iso-screen-ink)"
        fontSize={0.26}
        opacity={0.5}
        x={3.3}
        y={4.55}
      >
        p95
      </text>
      <text
        fill="var(--iso-screen-ink)"
        fontFamily={ISO_MONO}
        fontSize={0.3}
        x={3.3}
        y={4.95}
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
          y={4.5}
        />
        <circle
          cx={w - 2.1}
          cy={4.75}
          fill={healthy ? "var(--iso-glow)" : "var(--iso-screen-ink)"}
          r={0.08}
        />
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.26}
          fontWeight={600}
          x={w - 1.9}
          y={4.84}
        >
          Healthy
        </text>
      </motion.g>
    </>
  );
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
        "aria-label": `${title ?? "Illustration"}. Drag sideways or use the left and right arrow keys to turn it.`,
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
  return stage;
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface GradualRolloutProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. */
  tone?: IsoTone;
  /** Colour of lit details (packets of the new version, slider, lights). Defaults to `tone`. */
  accent?: IsoTone;
  /** Soft tint, full colour, or outlined. */
  variant?: IsoVariant;
  /** Edge weight in canvas units: rims, hairlines and rails, or outlines in `line`. */
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
  /** Play when the scene scrolls into view. Off shows the rolled-out end state. */
  autoPlay?: boolean;
  /** Replay after a pause. Off plays once and holds the end state. */
  loop?: boolean;
  /**
   * Let the viewer turn the plate: "drag" (drag sideways or use the arrow
   * keys; it springs back on release), "pointer" (leans toward the
   * pointer), or "off".
   */
  rotate?: IsoRotate;
  /**
   * How far it turns, in degrees: a number for both ways, or [min, max].
   * Default [-15, 30]: further toward the console than away from it, so the
   * copy stays readable. Each side is capped at 40.
   */
  orbit?: IsoOrbit;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

const DEFAULT_STEPS: readonly [number, number, number] = [10, 50, 100];

/**
 * Gradual rollout, in isometric: a feature flag's console moves a new
 * version from 10% to 100% of traffic, and the packets on the floor's rails
 * shift from the stable server to the new one. Follows the shadcn theme;
 * plays in view, loops, and can be turned by the viewer.
 */
export const GradualRollout = ({
  tone = "primary",
  accent,
  variant = "duotone",
  strokeWidth = 0.3,
  flag = "new-checkout",
  steps = DEFAULT_STEPS,
  errorRate = "0.00%",
  latency = "212 ms",
  stableLabel = "v1",
  canaryLabel = "v2",
  autoPlay = true,
  loop = true,
  rotate = "drag",
  orbit = DEFAULT_ORBIT,
  title,
  className,
}: GradualRolloutProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const still = reduced || !autoPlay;
  const stage = useStory({ inView, loop, still });
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  const pct = rolloutAt(stage, steps);
  const newShare = packetsFor(pct);
  const oldShare = packetsFor(100 - pct);
  const serverSize: Vec3 = [SERVER.w, SERVER.d, SERVER.h];
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
    >
      <IsoStage
        accent={accent}
        base={
          <Slab at={PLATE.at} palette="surface" radius={1} size={PLATE.size} />
        }
        baseCasts={[boxCast(PLATE.at, PLATE.size)]}
        bounds={BOUNDS}
        camera={camera}
        casts={CASTS}
        ground={TOP}
        orbit={rotate === "off" ? 0 : orbit}
        strokeWidth={strokeWidth}
        title={title}
        tone={tone}
        variant={variant}
      >
        <style>
          {`@keyframes iso-rail{from{stroke-dashoffset:${PACKETS.span}}to{stroke-dashoffset:-100}}@keyframes iso-blink{0%,100%{opacity:1}50%{opacity:.25}}`}
        </style>
        <Rail pts={RAILS.in} />
        <Rail pts={RAILS.v1} />
        <Rail pts={RAILS.v2} />
        <Packets lit pts={RAILS.in} shown={PACKETS.count} still={still} />
        <Packets lit={false} pts={RAILS.v1} shown={oldShare} still={still} />
        <Packets lit pts={RAILS.v2} shown={newShare} still={still} />
        <Panel
          at={CONSOLE.at}
          content={(w) => (
            <Console
              copy={{ errorRate, flag, latency }}
              stage={stage}
              steps={steps}
              w={w}
            />
          )}
          depth={CONSOLE.depth}
          radius={0.45}
          size={CONSOLE.size}
        />
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
        <Box
          at={V2}
          left={(w, h) => (
            <RackFace active h={h} label={canaryLabel} note={flag} w={w} />
          )}
          palette="surface"
          size={serverSize}
        />
        <Router />
      </IsoStage>
    </div>
  );
};

export default GradualRollout;
