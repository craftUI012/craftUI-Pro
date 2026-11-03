"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  Box,
  ISO_MONO,
  IsoStage,
  Panel,
  Slab,
  projectWith,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCamera,
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
 * One moment at a desk: a developer pushes from the laptop's terminal, and
 * the monitor behind it shows the deployment build and go live.
 * Read top-to-bottom. Each value is ms after the scene comes into view.
 *
 *    0ms   monitor lists the project's deployments; terminal at the prompt
 *  300ms   "git push" types out (60ms a key)
 *  900ms   enter: the terminal answers "→ Deploying …"
 * 1200ms   the push arcs from the laptop to the monitor (700ms)
 * 1900ms   a new deployment slides in on top: Building; older rows move down
 * 2100ms   the build bar fills (1.6s); terminal streams the build
 * 3800ms   the card turns Ready, preview thumbnail fades in
 * 4300ms   terminal prints "✓ Live at …"; the domain pill lights
 * 8000ms   hold ends; the scene resets and plays again
 *
 * Reduced motion: no timeline; the live end state is shown.
 * ───────────────────────────────────────────────────────── */

// Every stage's start, in ms after the scene comes into view. Keys are
// sorted for lint; the storyboard above reads them in time order.
const TIMING = {
  // The build bar starts filling.
  building: 2100,
  // The new deployment card slides in.
  cardArrives: 1900,
  // Enter is pressed; the terminal answers.
  commandSent: 900,
  // The site is live; the domain pill lights.
  live: 4300,
  // Reset and replay.
  loop: 8000,
  // The push arcs laptop → monitor.
  pushTravels: 1200,
  // The card turns Ready.
  ready: 3800,
  // The command starts typing.
  typing: 300,
};

const STAGE = {
  building: 5,
  card: 4,
  idle: 0,
  live: 7,
  ready: 6,
  sent: 2,
  travel: 3,
  typing: 1,
} as const;

/* Shared motion */
const FADE = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };
const SETTLE = { damping: 30, stiffness: 380, type: "spring" as const };

/* Typing in the terminal */
const KEYS = {
  // Seconds between keys.
  gap: 0.06,
};

/* The new deployment card and the rows it pushes down */
const CARD = {
  // Face units the card drops from.
  fromV: -0.6,
  // Face units the older rows move down by.
  shift: 2.35,
  spring: { damping: 28, stiffness: 340, type: "spring" as const },
};

/* The build bar */
const BUILD = {
  // Seconds to fill.
  duration: 1.6,
  ease: [0.3, 0, 0.2, 1] as const,
};

/* The push's flight from laptop to monitor */
const FLIGHT = {
  // Dash length, as a % of the arc.
  comet: 16,
  // Seconds.
  duration: 0.7,
  ease: [0.45, 0, 0.55, 1] as const,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The desk everything sits on, and the height of its top.
const TOP = 0.4;
const DESK = { at: [-8.5, -6.6, 0] as Vec3, size: [14.5, 12.6, TOP] as Vec3 };

// Monitor at the back: a base slab, a neck, and a wide screen facing the
// viewer, its bottom edge at z 2.
const MONITOR = {
  base: { at: [-4, -6, TOP] as Vec3, size: [4, 2.2, 0.25] as Vec3 },
  neck: { at: [-2.5, -5, TOP + 0.25] as Vec3, size: [1, 0.6, 1.4] as Vec3 },
  screen: {
    at: [-7.5, -4, 2 + 6.6] as Vec3,
    depth: 0.4,
    size: [11, 6.6] as const,
  },
};

// Laptop at the front left: base and an upright terminal screen. Its
// screen's top stays below the monitor's bottom edge wherever they overlap
// on screen, so neither hides the other at home.
const LAPTOP = {
  base: { at: [-6.5, 1, TOP] as Vec3, size: [6.5, 4.5, 0.3] as Vec3 },
  screen: {
    at: [-6.5, 1.4, TOP + 0.3 + 4.2] as Vec3,
    depth: 0.25,
    size: [6.5, 4.2] as const,
  },
};

const boxCast = ({ at, size }: { at: Vec3; size: Vec3 }): IsoCast => ({
  box: [at[0], at[1], size[0], size[1], size[2]],
  z: at[2],
});

const panelCast = (p: {
  at: Vec3;
  depth: number;
  size: readonly [number, number];
}): IsoCast => ({
  box: [p.at[0], p.at[1] - p.depth, p.size[0], p.depth, p.size[1]],
  z: p.at[2] - p.size[1],
});

const CASTS: IsoCast[] = [
  boxCast(MONITOR.base),
  boxCast(MONITOR.neck),
  panelCast(MONITOR.screen),
  boxCast(LAPTOP.base),
  panelCast(LAPTOP.screen),
];

const BOUNDS: Vec3[] = [
  DESK.at,
  [DESK.at[0] + DESK.size[0], DESK.at[1], 0],
  [DESK.at[0] + DESK.size[0], DESK.at[1] + DESK.size[1], 0],
  [DESK.at[0], DESK.at[1] + DESK.size[1], 0],
  [MONITOR.screen.at[0], MONITOR.screen.at[1] - 0.4, MONITOR.screen.at[2]],
  [
    MONITOR.screen.at[0] + MONITOR.screen.size[0],
    MONITOR.screen.at[1] - 0.4,
    MONITOR.screen.at[2],
  ],
];

// The camera turns around the middle of the desk.
const PIVOT: readonly [number, number] = [
  DESK.at[0] + DESK.size[0] / 2,
  DESK.at[1] + DESK.size[1] / 2,
];

// Turning toward the screens (+) reads well; away (−) turns both big
// screens edge-on quickly (−20° already crushes the copy), so keep it short.
const DEFAULT_ORBIT: IsoOrbit = [-12, 35];

// The push: a quadratic arc in 3D from the terminal to the new card on the
// monitor, sampled and projected through the camera (math §3, §7b).
const ARC = {
  from: [-3.25, 1.42, 3.2] as Vec3,
  peak: [-1.5, -1.5, 11] as Vec3,
  to: [-2.5, -3.98, 6.1] as Vec3,
};

const arcPath = (cam: IsoCamera) => {
  const steps = 32;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const a = (1 - t) ** 2;
    const b = 2 * (1 - t) * t;
    const c = t ** 2;
    const p: Vec3 = [
      a * ARC.from[0] + b * ARC.peak[0] + c * ARC.to[0],
      a * ARC.from[1] + b * ARC.peak[1] + c * ARC.to[1],
      a * ARC.from[2] + b * ARC.peak[2] + c * ARC.to[2],
    ];
    return `${i === 0 ? "M" : "L"}${projectWith(cam, p).join(",")}`;
  }).join(" ");
};

/* ───────────────────────────── Pieces ─────────────────────────────────── */

interface DeployCopy {
  branch: string;
  buildTime: string;
  commit: string;
  domain: string;
  project: string;
}

const Keyboard = ({ w }: { w: number }) => (
  <>
    {Array.from({ length: 40 }, (_, i) => (
      <rect
        fill="var(--iso-text)"
        height={0.42}
        key={i}
        opacity={0.08}
        rx={0.08}
        width={0.46}
        x={(w - 10 * 0.56) / 2 + (i % 10) * 0.56}
        y={0.55 + Math.floor(i / 10) * 0.55}
      />
    ))}
    <rect
      fill="var(--iso-text)"
      height={1.5}
      opacity={0.06}
      rx={0.2}
      width={2.4}
      x={w / 2 - 1.2}
      y={2.8}
    />
  </>
);

// Monospace advance: Geist Mono (and most monospaces) are 0.6em wide.
const MONO_ADVANCE = 0.6;

const TerminalLine = ({
  show,
  text,
  y,
  lit = false,
}: {
  show: boolean;
  text: string;
  y: number;
  lit?: boolean;
}) => {
  const shown = lit ? 1 : 0.72;
  return (
    <motion.g
      animate={{ opacity: show ? shown : 0 }}
      initial={false}
      transition={FADE}
    >
      <text
        fill={lit ? "var(--iso-glow)" : "var(--iso-screen)"}
        fontFamily={ISO_MONO}
        fontSize={0.26}
        x={0.55}
        y={y}
      >
        {text}
      </text>
    </motion.g>
  );
};

const Terminal = ({
  stage,
  command,
  copy,
  w,
  h,
}: {
  stage: number;
  command: string;
  copy: DeployCopy;
  w: number;
  h: number;
}) => {
  const size = 0.26;
  const promptX = 0.55;
  const cmdX = promptX + 2 * MONO_ADVANCE * size;
  const typed = stage >= STAGE.typing;
  return (
    <>
      <rect
        fill="var(--iso-console)"
        height={h - 0.5}
        rx={0.3}
        width={w - 0.5}
        x={0.25}
        y={0.25}
      />
      {[0, 1, 2].map((i) => (
        <circle
          cx={0.6 + i * 0.3}
          cy={0.6}
          fill="var(--iso-screen)"
          key={i}
          opacity={0.25}
          r={0.08}
        />
      ))}
      <text
        fill="var(--iso-glow)"
        fontFamily={ISO_MONO}
        fontSize={size}
        x={promptX}
        y={1.25}
      >
        $
      </text>
      {Array.from(command, (ch, i) => (
        <motion.g
          animate={{ opacity: typed ? 1 : 0 }}
          initial={false}
          key={`${i}-${ch}`}
          transition={{ delay: typed ? i * KEYS.gap : 0, duration: 0.01 }}
        >
          <text
            fill="var(--iso-screen)"
            fontFamily={ISO_MONO}
            fontSize={size}
            x={cmdX + i * MONO_ADVANCE * size}
            y={1.25}
          >
            {ch}
          </text>
        </motion.g>
      ))}
      <TerminalLine
        show={stage >= STAGE.sent}
        text={`→ Deploying ${copy.project} (${copy.branch})`}
        y={1.75}
      />
      <TerminalLine
        show={stage >= STAGE.building}
        text="→ Installing dependencies"
        y={2.2}
      />
      <TerminalLine
        show={stage >= STAGE.ready}
        text={`→ Built in ${copy.buildTime}`}
        y={2.65}
      />
      <TerminalLine
        lit
        show={stage >= STAGE.live}
        text={`✓ Live at ${copy.domain}`}
        y={3.1}
      />
    </>
  );
};

const OlderRow = ({
  label,
  when,
  y,
  w,
}: {
  label: string;
  when: string;
  y: number;
  w: number;
}) => (
  <g>
    <circle
      cx={1.05}
      cy={y - 0.09}
      fill="var(--iso-screen-ink)"
      opacity={0.3}
      r={0.1}
    />
    <text
      fill="var(--iso-screen-ink)"
      fontSize={0.28}
      opacity={0.75}
      x={1.35}
      y={y}
    >
      {label}
    </text>
    <text
      fill="var(--iso-screen-ink)"
      fontSize={0.24}
      opacity={0.45}
      textAnchor="end"
      x={w - 1}
      y={y}
    >
      {when}
    </text>
  </g>
);

const Preview = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect
      fill="var(--iso-screen)"
      height={1.6}
      rx={0.15}
      stroke="var(--iso-screen-ink)"
      strokeOpacity={0.15}
      strokeWidth={0.04}
      width={2.4}
      x={x}
      y={y}
    />
    <rect
      fill="var(--iso-glow)"
      height={0.6}
      opacity={0.85}
      rx={0.08}
      width={2}
      x={x + 0.2}
      y={y + 0.2}
    />
    <rect
      fill="var(--iso-screen-ink)"
      height={0.12}
      opacity={0.3}
      rx={0.06}
      width={1.4}
      x={x + 0.2}
      y={y + 1}
    />
    <rect
      fill="var(--iso-screen-ink)"
      height={0.12}
      opacity={0.3}
      rx={0.06}
      width={0.9}
      x={x + 0.2}
      y={y + 1.25}
    />
  </g>
);

// Header: the project and its production domain (lit once live).
const DashboardHeader = ({
  copy,
  live,
  w,
}: {
  copy: DeployCopy;
  live: boolean;
  w: number;
}) => (
  <>
    <rect
      fill="var(--iso-glow)"
      height={0.5}
      rx={0.14}
      width={0.5}
      x={0.8}
      y={0.62}
    />
    <text
      fill="var(--iso-screen-ink)"
      fontSize={0.4}
      fontWeight={600}
      x={1.5}
      y={1.02}
    >
      {copy.project}
    </text>
    <rect
      fill="var(--iso-glow)"
      height={0.52}
      rx={0.26}
      style={{ opacity: live ? 0.18 : 0.08, transition: "opacity 0.4s ease" }}
      width={2.3}
      x={w - 3.1}
      y={0.6}
    />
    <circle
      cx={w - 2.82}
      cy={0.86}
      fill={live ? "var(--iso-glow)" : "var(--iso-screen-ink)"}
      r={0.09}
      style={{ opacity: live ? 1 : 0.35, transition: "opacity 0.4s ease" }}
    />
    <text
      fill="var(--iso-screen-ink)"
      fontFamily={ISO_MONO}
      fontSize={0.26}
      x={w - 2.6}
      y={0.95}
    >
      {copy.domain}
    </text>
    <text
      fill="var(--iso-screen-ink)"
      fontSize={0.26}
      opacity={0.5}
      x={0.8}
      y={1.75}
    >
      Deployments
    </text>
  </>
);

// The new deployment: drops in, builds, turns Ready with its preview.
const DeployCard = ({
  building,
  card,
  copy,
  ready,
  w,
}: {
  building: boolean;
  card: boolean;
  copy: DeployCopy;
  ready: boolean;
  w: number;
}) => {
  const cardTop = 2.05;
  return (
    <>
      <motion.g
        animate={{ opacity: card ? 1 : 0, y: card ? 0 : CARD.fromV }}
        initial={false}
        transition={card ? CARD.spring : FADE}
      >
        <rect
          fill="var(--iso-screen)"
          height={2.1}
          rx={0.22}
          stroke={ready ? "var(--iso-glow)" : "var(--iso-screen-ink)"}
          strokeOpacity={ready ? 0.7 : 0.16}
          strokeWidth={0.05}
          style={{ transition: "stroke 0.4s ease, stroke-opacity 0.4s ease" }}
          width={w - 1.4}
          x={0.7}
          y={cardTop}
        />
        <motion.g
          animate={{ opacity: ready ? 1 : [1, 0.25, 1] }}
          initial={false}
          transition={
            ready ? FADE : { duration: 1, repeat: Number.POSITIVE_INFINITY }
          }
        >
          <circle cx={1.1} cy={cardTop + 0.5} fill="var(--iso-glow)" r={0.12} />
        </motion.g>
        <motion.g
          animate={{ opacity: ready ? 0 : 1 }}
          initial={false}
          transition={FADE}
        >
          <text
            fill="var(--iso-screen-ink)"
            fontSize={0.32}
            fontWeight={600}
            x={1.4}
            y={cardTop + 0.61}
          >
            Building
          </text>
        </motion.g>
        <motion.g
          animate={{ opacity: ready ? 1 : 0 }}
          initial={false}
          transition={FADE}
        >
          <text
            fill="var(--iso-screen-ink)"
            fontSize={0.32}
            fontWeight={600}
            x={1.4}
            y={cardTop + 0.61}
          >
            {`Ready · ${copy.buildTime}`}
          </text>
        </motion.g>
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.3}
          x={1}
          y={cardTop + 1.15}
        >
          {copy.commit}
        </text>
        <rect
          fill="var(--iso-screen-ink)"
          height={0.38}
          opacity={0.08}
          rx={0.19}
          width={1.1}
          x={1}
          y={cardTop + 1.4}
        />
        <text
          fill="var(--iso-screen-ink)"
          fontFamily={ISO_MONO}
          fontSize={0.22}
          opacity={0.75}
          x={1.2}
          y={cardTop + 1.66}
        >
          {copy.branch}
        </text>
        <text
          fill="var(--iso-screen-ink)"
          fontFamily={ISO_MONO}
          fontSize={0.22}
          opacity={0.45}
          x={2.35}
          y={cardTop + 1.66}
        >
          a1b2c3d
        </text>
        {/* Build bar: fills while building, fades once ready. */}
        <rect
          fill="var(--iso-screen-ink)"
          height={0.1}
          opacity={ready ? 0 : 0.08}
          rx={0.05}
          width={5.2}
          x={1}
          y={cardTop + 1.92}
        />
        <motion.g
          animate={{ opacity: ready ? 0 : 1, scaleX: building ? 1 : 0 }}
          initial={false}
          style={{ originX: 0, transformBox: "fill-box" }}
          transition={
            building && !ready
              ? { duration: BUILD.duration, ease: BUILD.ease }
              : FADE
          }
        >
          <rect
            fill="var(--iso-glow)"
            height={0.1}
            rx={0.05}
            width={5.2}
            x={1}
            y={cardTop + 1.92}
          />
        </motion.g>
        {/* Preview: a skeleton while building, the page once ready. */}
        <rect
          fill="var(--iso-screen-ink)"
          height={1.6}
          opacity={ready ? 0 : 0.06}
          rx={0.15}
          style={{ transition: "opacity 0.4s ease" }}
          width={2.4}
          x={w - 3.35}
          y={cardTop + 0.25}
        />
        <motion.g
          animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.94 }}
          initial={false}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          transition={SETTLE}
        >
          <Preview x={w - 3.35} y={cardTop + 0.25} />
        </motion.g>
      </motion.g>
    </>
  );
};

const Dashboard = ({
  stage,
  copy,
  w,
  h,
}: {
  stage: number;
  copy: DeployCopy;
  w: number;
  h: number;
}) => {
  const card = stage >= STAGE.card;
  const building = stage >= STAGE.building;
  const ready = stage >= STAGE.ready;
  const live = stage >= STAGE.live;
  return (
    <>
      <rect
        fill="var(--iso-screen)"
        height={h - 0.6}
        rx={0.35}
        width={w - 0.6}
        x={0.3}
        y={0.3}
      />
      <DashboardHeader copy={copy} live={live} w={w} />

      {/* Older deployments move down when the new one arrives. */}
      <motion.g
        animate={{ y: card ? 0 : -CARD.shift }}
        initial={false}
        transition={card ? CARD.spring : FADE}
      >
        <OlderRow label="Fix footer links" w={w} when="2d ago" y={4.75} />
        <OlderRow label="Add pricing FAQ" w={w} when="5d ago" y={5.45} />
      </motion.g>

      <DeployCard
        building={building}
        card={card}
        copy={copy}
        ready={ready}
        w={w}
      />
    </>
  );
};

/* ───────────────────────────── Story clock ────────────────────────────── */

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
  const [stage, setStage] = useState<number>(still ? STAGE.live : STAGE.idle);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (still) {
      setStage(STAGE.live);
      return;
    }
    if (!inView) {
      setStage(STAGE.idle);
      return;
    }
    setStage(STAGE.idle);
    const at: [number, number][] = [
      [TIMING.typing, STAGE.typing],
      [TIMING.commandSent, STAGE.sent],
      [TIMING.pushTravels, STAGE.travel],
      [TIMING.cardArrives, STAGE.card],
      [TIMING.building, STAGE.building],
      [TIMING.ready, STAGE.ready],
      [TIMING.live, STAGE.live],
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

export interface PushToDeployProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. */
  tone?: IsoTone;
  /** Colour of lit details (status, build bar, push flight). Defaults to `tone`. */
  accent?: IsoTone;
  /** Soft tint, full colour, or outlined. */
  variant?: IsoVariant;
  /** Edge weight in canvas units: rims and hairlines, or outlines in `line`. */
  strokeWidth?: number;
  /** Project name on the dashboard and in the terminal, up to about 14 characters. */
  project?: string;
  /** Production domain, up to about 14 characters. */
  domain?: string;
  /** Branch pushed, up to about 8 characters. */
  branch?: string;
  /** Commit message on the new deployment, up to about 28 characters. */
  commit?: string;
  /** Build time shown when it's ready, e.g. "24s". */
  buildTime?: string;
  /** Command typed in the terminal, up to about 24 characters. */
  command?: string;
  /** Play when the scene scrolls into view. Off shows the live end state. */
  autoPlay?: boolean;
  /** Replay after a pause. Off plays once and holds the end state. */
  loop?: boolean;
  /**
   * Let the viewer turn the desk: "drag" (drag sideways or use the arrow
   * keys; it springs back on release), "pointer" (leans toward the
   * pointer), or "off".
   */
  rotate?: IsoRotate;
  /**
   * How far it turns, in degrees: a number for both ways, or [min, max].
   * Default [-12, 35]: further toward the screens than away from them, so
   * the copy stays readable. Each side is capped at 40.
   */
  orbit?: IsoOrbit;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

/**
 * Push to deploy, in isometric: on a desk, `git push` in the laptop's
 * terminal starts a deployment that builds and goes live on the monitor's
 * dashboard behind it. Follows the shadcn theme; plays in view, loops, and
 * can be turned by the viewer.
 */
export const PushToDeploy = ({
  tone = "primary",
  accent,
  variant = "duotone",
  strokeWidth = 0.3,
  project = "acme-web",
  domain = "acme.com",
  branch = "main",
  commit = "Update pricing page",
  buildTime = "24s",
  command = "git push",
  autoPlay = true,
  loop = true,
  rotate = "drag",
  orbit = DEFAULT_ORBIT,
  title,
  className,
}: PushToDeployProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const stage = useStory({ inView, loop, still: reduced || !autoPlay });
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  const copy: DeployCopy = { branch, buildTime, commit, domain, project };
  const arc = arcPath(camera);
  const flying = stage === STAGE.travel;
  return (
    <div
      {...turnableLabel(rotate, title)}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-slot="push-to-deploy"
      ref={ref}
      {...orbitProps}
    >
      <IsoStage
        accent={accent}
        base={
          <Slab at={DESK.at} palette="surface" radius={1.2} size={DESK.size} />
        }
        baseCasts={[boxCast(DESK)]}
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
        <Slab
          at={MONITOR.base.at}
          palette="surface"
          radius={0.5}
          size={MONITOR.base.size}
        />
        <Box at={MONITOR.neck.at} palette="surface" size={MONITOR.neck.size} />
        <Panel
          at={MONITOR.screen.at}
          content={(w, h) => (
            <Dashboard copy={copy} h={h} stage={stage} w={w} />
          )}
          depth={MONITOR.screen.depth}
          radius={0.45}
          size={MONITOR.screen.size}
        />
        <Slab
          at={LAPTOP.base.at}
          content={(w) => <Keyboard w={w} />}
          palette="surface"
          radius={0.4}
          size={LAPTOP.base.size}
        />
        <Panel
          at={LAPTOP.screen.at}
          content={(w, h) => (
            <Terminal command={command} copy={copy} h={h} stage={stage} w={w} />
          )}
          depth={LAPTOP.screen.depth}
          radius={0.4}
          size={LAPTOP.screen.size}
        />
        <motion.path
          animate={{ opacity: flying ? 0.3 : 0 }}
          d={arc}
          fill="none"
          initial={false}
          stroke="var(--iso-glow)"
          strokeDasharray="0.4 0.5"
          strokeLinecap="round"
          strokeWidth={0.18}
          transition={FADE}
        />
        <motion.path
          animate={
            flying
              ? {
                  opacity: [0, 1, 1, 0],
                  strokeDashoffset: [FLIGHT.comet, -100],
                }
              : { opacity: 0, strokeDashoffset: FLIGHT.comet }
          }
          d={arc}
          fill="none"
          initial={false}
          pathLength={100}
          stroke="var(--iso-glow)"
          strokeDasharray={`${FLIGHT.comet} 140`}
          strokeLinecap="round"
          strokeWidth={0.42}
          transition={
            flying
              ? { duration: FLIGHT.duration, ease: FLIGHT.ease }
              : { duration: 0 }
          }
        />
      </IsoStage>
    </div>
  );
};

export default PushToDeploy;
