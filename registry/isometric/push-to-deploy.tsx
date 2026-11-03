"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  FloorGrid,
  GLASS,
  ISO_MONO,
  IsoStage,
  jolt,
  Panel,
  press,
  projectWith,
  Rig,
  sample,
  Slab,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCamera,
  IsoPose,
  IsoTrack,
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
 * One moment: a developer pushes from a terminal tile in front, the push
 * runs down a cable on the floor, and the dashboard floating behind shows
 * the deployment build and go live.
 * Read top-to-bottom. Each value is ms after the scene comes into view.
 *
 *    0ms   monitor lists the project's deployments; terminal at the prompt
 *  300ms   "git push" types out (60ms a key)
 *  900ms   enter: the terminal tile presses in and pops back; it answers
 *          "→ Deploying …"
 * 1200ms   a pulse runs down the cable from the terminal to the dashboard (700ms)
 * 1900ms   the pulse hits: the dashboard is kicked back and settles; a new
 *          deployment slides in on top: Building; older rows move down
 * 2100ms   the build bar fills (1.6s); terminal streams the build
 * 3800ms   the card turns Ready, preview thumbnail fades in
 * 4300ms   terminal prints "✓ Live at …"; the domain pill lights
 * 8000ms   hold ends; the scene resets and plays again
 *
 * The viewer leans the camera with the pointer and can click to replay.
 * Drawn in ink over a floor grid.
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

/* The pulse running down the cable */
const PULSE = {
  // Seconds.
  duration: 0.7,
  ease: [0.45, 0, 0.55, 1] as const,
  // Dash length, as a % of the cable.
  head: 14,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The dashboard: a glass panel standing in open space, floating a little
// above the floor. `at` is the top-left corner of its front face.
const SCREEN = {
  at: [-6.25, 0, 7] as Vec3,
  depth: 0.45,
  // Height of its bottom edge above the floor.
  float: 0.4,
  size: [12.5, 6.6] as const,
};
// The display inset from the panel's edge, in face units.
const INSET = 0.35;

// The terminal: a dark glass tile lying flat beside the dashboard's right
// edge, nearer the viewer, like a console deck.
const TERMINAL = {
  at: [6.9, -3.2, 0] as Vec3,
  size: [7.2, 4.4, 0.3] as Vec3,
};

const panelCast = (p: {
  at: Vec3;
  depth: number;
  size: readonly [number, number];
  float: number;
}): IsoCast => ({
  // Kept low so the shadow reads as a pool at its foot, not a smear behind.
  box: [p.at[0], p.at[1] - p.depth, p.size[0], p.depth, 1.8],
  z: p.float,
});

const CASTS: IsoCast[] = [
  panelCast(SCREEN),
  {
    box: [
      TERMINAL.at[0],
      TERMINAL.at[1],
      TERMINAL.size[0],
      TERMINAL.size[1],
      TERMINAL.size[2],
    ],
  },
];

// The frame fits the dashboard and the terminal, nothing else: no desk.
const BOUNDS: Vec3[] = [
  SCREEN.at,
  [SCREEN.at[0] + SCREEN.size[0], SCREEN.at[1], SCREEN.at[2]],
  [SCREEN.at[0], SCREEN.at[1], SCREEN.float],
  [SCREEN.at[0] + SCREEN.size[0], SCREEN.at[1], SCREEN.float],
  [SCREEN.at[0], SCREEN.at[1] - SCREEN.depth, SCREEN.at[2]],
  [SCREEN.at[0] + SCREEN.size[0], SCREEN.at[1] - SCREEN.depth, SCREEN.at[2]],
  TERMINAL.at,
  [TERMINAL.at[0] + TERMINAL.size[0], TERMINAL.at[1], 0],
  [TERMINAL.at[0] + TERMINAL.size[0], TERMINAL.at[1] + TERMINAL.size[1], 0],
  [TERMINAL.at[0], TERMINAL.at[1] + TERMINAL.size[1], 0],
];

// The construction grid under everything.
const GRID = { at: [-9, -5] as const, size: [24, 12] as const };

// Rig pivots: the dashboard slides about its foot, the terminal presses
// into the floor about its base centre.
const SCREEN_PIVOT: Vec3 = [SCREEN.at[0] + SCREEN.size[0] / 2, SCREEN.at[1], 0];
const TERMINAL_PIVOT: Vec3 = [
  TERMINAL.at[0] + TERMINAL.size[0] / 2,
  TERMINAL.at[1] + TERMINAL.size[1] / 2,
  0,
];

/* Tracks, on the storyboard's clock (ms since the scene started). */

// The terminal takes the keystroke: pressed into the floor, pops back.
const TERMINAL_TRACK: IsoTrack = press(0.45, TIMING.commandSent - 40);
// The dashboard takes the pulse: kicked back (−y), settles, holds, home.
const SCREEN_TRACK: IsoTrack = jolt(0.4, TIMING.cardArrives, 500);

const terminalPose = (ms: number): IsoPose => ({
  scale: [1, 1, sample(TERMINAL_TRACK, ms)],
});
const screenPose = (ms: number): IsoPose => ({
  offset: [0, -sample(SCREEN_TRACK, ms), 0],
});

// The camera turns around the foot of the dashboard.
const PIVOT: readonly [number, number] = [0, 0.5];

// Leaning toward the dashboard (+) reads well; away (−) soon turns it
// edge-on, so keep that side short.
const DEFAULT_ORBIT: IsoOrbit = [-12, 30];

// CSS pixels per world unit for UI rendered into the screen with `screen`.
const SCREEN_PX = 40;

// The cable: a cubic bezier lying on the floor from the terminal's left
// edge to under the dashboard's right end, sampled and projected through
// the camera (math §3, §7b). The pulse runs along it on push.
const CABLE = {
  c1: [4.6, -1.4, 0.16] as Vec3,
  c2: [4.2, 1.6, 0.16] as Vec3,
  from: [TERMINAL.at[0], TERMINAL.at[1] + 1.6, 0.16] as Vec3,
  to: [2.6, 0.9, 0.16] as Vec3,
};

const cablePath = (cam: IsoCamera) => {
  const steps = 40;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const a = (1 - t) ** 3;
    const b = 3 * (1 - t) ** 2 * t;
    const c = 3 * (1 - t) * t ** 2;
    const d = t ** 3;
    const p: Vec3 = [
      a * CABLE.from[0] + b * CABLE.c1[0] + c * CABLE.c2[0] + d * CABLE.to[0],
      a * CABLE.from[1] + b * CABLE.c1[1] + c * CABLE.c2[1] + d * CABLE.to[1],
      a * CABLE.from[2] + b * CABLE.c1[2] + c * CABLE.c2[2] + d * CABLE.to[2],
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
        height={h - 2 * INSET}
        rx={0.45}
        width={w - 2 * INSET}
        x={INSET}
        y={INSET}
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

/** What the dashboard is showing, for UI passed in through `screen`. */
export interface DeployScreenState {
  /** "idle", "pushed" (command sent), "building", "ready", "live". */
  step: "idle" | "pushed" | "building" | "ready" | "live";
  /** Project name. */
  project: string;
  /** Production domain. */
  domain: string;
  /** Branch pushed. */
  branch: string;
  /** Commit message of the new deployment. */
  commit: string;
  /** Build time shown once ready. */
  buildTime: string;
}

const stepOf = (stage: number): DeployScreenState["step"] => {
  if (stage >= STAGE.live) {
    return "live";
  }
  if (stage >= STAGE.ready) {
    return "ready";
  }
  if (stage >= STAGE.card) {
    return "building";
  }
  if (stage >= STAGE.sent) {
    return "pushed";
  }
  return "idle";
};

const resolveScreen = (
  screen: ReactNode | ((state: DeployScreenState) => ReactNode),
  state: DeployScreenState
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

/** The built-in dashboard, or whatever `screen` provides. */
const ScreenContent = ({
  custom,
  copy,
  stage,
  w,
  h,
}: {
  custom: ReactNode;
  copy: DeployCopy;
  stage: number;
  w: number;
  h: number;
}) =>
  custom === undefined ? (
    <Dashboard copy={copy} h={h} stage={stage} w={w} />
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

/**
 * The cable on the floor from the terminal to the dashboard, and the
 * pulse that runs down it when the push is sent.
 */
const Cable = ({ camera, flying }: { camera: IsoCamera; flying: boolean }) => {
  const d = cablePath(camera);
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="var(--iso-surface-left-c)"
        strokeLinecap="round"
        strokeWidth={0.46}
      />
      <path
        d={d}
        fill="none"
        opacity={0.35}
        stroke="var(--iso-surface-rim)"
        strokeLinecap="round"
        strokeWidth={0.14}
        transform="translate(0 -0.14)"
      />
      <motion.path
        animate={
          flying
            ? {
                opacity: [0, 1, 1, 0],
                strokeDashoffset: [PULSE.head, -100],
              }
            : { opacity: 0, strokeDashoffset: PULSE.head }
        }
        d={d}
        fill="none"
        initial={false}
        pathLength={100}
        stroke="var(--iso-glow)"
        strokeDasharray={`${PULSE.head} 140`}
        strokeLinecap="round"
        strokeWidth={0.26}
        transition={
          flying
            ? { duration: PULSE.duration, ease: PULSE.ease }
            : { duration: 0 }
        }
      />
    </>
  );
};

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

/* ───────────────────────────── Story clock ────────────────────────────── */

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
 * `replay` restarts it.
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

export interface PushToDeployProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. */
  tone?: IsoTone;
  /** Colour of lit details (status, build bar, the pulse). Defaults to `tone`. */
  accent?: IsoTone;
  /** Flat ink drawing (default), soft tint, full colour, or blueprint outline. */
  variant?: IsoVariant;
  /** Line weight: in `ink` 0.3 is a 1.3 px outline at any size; rims or outlines elsewhere. */
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
  /**
   * Your own UI inside the dashboard instead of the built-in one: any
   * React node, or a function of the story's state (`step` and the copy)
   * so your UI follows the push. It renders at 472 × 236 CSS px (the
   * screen is 11.8 × 5.9 units at 40 px per unit) and is projected into
   * the scene; the terminal and the cable still play.
   */
  screen?: ReactNode | ((state: DeployScreenState) => ReactNode);
  /** Play when the scene scrolls into view. Off shows the live end state. */
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
   * Default [-12, 30]: further toward the dashboard than away from it, so
   * the copy stays readable. Each side is capped at 40.
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

/**
 * Push to deploy, in isometric ink: `git push` on a terminal tile (which
 * presses in on enter) sends a pulse down a cable to the dashboard
 * floating behind it; the dashboard takes the hit, and the deployment
 * builds and goes live. Flat ink drawing with one even outline, objects
 * that move as solids, the camera leans with the pointer, and `screen`
 * puts your own React UI inside the dashboard. Follows the shadcn theme;
 * plays in view, loops.
 */
export const PushToDeploy = ({
  tone = "primary",
  accent,
  variant = "ink",
  strokeWidth = 0.3,
  project = "acme-web",
  domain = "acme.com",
  branch = "main",
  commit = "Update pricing page",
  buildTime = "24s",
  command = "git push",
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
}: PushToDeployProps) => {
  const { camera, clock, line, orbitProps, pointer, ref, stage, uid } =
    useSceneShell({ autoPlay, loop, orbit, replayOnClick, rotate, variant });
  const copy: DeployCopy = { branch, buildTime, commit, domain, project };
  const custom = resolveScreen(screen, { ...copy, step: stepOf(stage) });
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
        <Ground show={grid} />
        <Cable camera={camera} flying={stage === STAGE.travel} />
        <Rig clock={clock} pivot={SCREEN_PIVOT} pose={screenPose}>
          <Panel
            at={SCREEN.at}
            content={(w, h) => (
              <ScreenContent
                copy={copy}
                custom={custom}
                h={h}
                stage={stage}
                w={w}
              />
            )}
            depth={SCREEN.depth}
            frontStyle={glass(line)}
            radius={0.6}
            size={SCREEN.size}
          />
        </Rig>
        <Rig clock={clock} pivot={TERMINAL_PIVOT} pose={terminalPose}>
          <Slab
            at={TERMINAL.at}
            content={(w, d) => (
              <Terminal
                command={command}
                copy={copy}
                h={d}
                stage={stage}
                w={w}
              />
            )}
            frontStyle={{ fill: "var(--iso-console)" }}
            palette="surface"
            radius={0.5}
            size={TERMINAL.size}
          />
        </Rig>
        <Film show={grain && !line} uid={uid} />
      </IsoStage>
    </div>
  );
};

export default PushToDeploy;
