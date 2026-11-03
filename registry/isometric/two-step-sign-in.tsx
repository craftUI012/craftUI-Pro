"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  Face,
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
 * One moment at a desk: a laptop asks for a sign-in code, the phone beside
 * it receives the text, the code lands, and the user is in.
 * Read top-to-bottom. Each value is ms after the scene comes into view.
 *
 *    0ms   laptop shows "Check your phone"; phone asleep
 *  500ms   phone wakes: wallpaper and clock fade up
 *  900ms   message drops in from the phone's top edge (spring)
 * 1700ms   the code lifts off the phone and arcs to the laptop (700ms)
 * 2400ms   digits land in the boxes, one by one (90ms apart)
 * 3100ms   boxes confirm, button reads "Verified" (spring)
 * 3700ms   laptop crossfades to "Welcome back"
 * 4100ms   phone dims back to sleep
 * 7600ms   hold ends; the scene resets and plays again
 *
 * Reduced motion: no timeline; the signed-in end state is shown.
 * ───────────────────────────────────────────────────────── */

// Every stage's start, in ms after the scene comes into view. Keys are
// sorted for lint; the storyboard above reads them in time order.
const TIMING = {
  // The pulse arcs phone → laptop.
  codeTravels: 1700,
  // Boxes fill, staggered.
  digitsLand: 2400,
  // Reset and replay.
  loop: 7600,
  // The notification drops in.
  messageArrives: 900,
  // The phone dims.
  phoneSleeps: 4100,
  // Wallpaper and clock fade up.
  phoneWakes: 500,
  // Boxes and button confirm.
  verified: 3100,
  // The laptop swaps to the signed-in view.
  welcome: 3700,
};

const STAGE = {
  digits: 4,
  idle: 0,
  message: 2,
  sleep: 7,
  travel: 3,
  verified: 5,
  wake: 1,
  welcome: 6,
} as const;

/* Shared motion */
const FADE = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };
const SETTLE = { damping: 30, stiffness: 380, type: "spring" as const };

/* Notification on the phone */
const MESSAGE = {
  // Face units above its resting place, hidden under the top edge.
  fromV: -1.8,
  spring: { damping: 26, stiffness: 420, type: "spring" as const },
};

/* Code boxes on the laptop */
const DIGITS = {
  // Face units each digit drops from.
  liftV: 0.35,
  spring: { damping: 22, stiffness: 520, type: "spring" as const },
  // Seconds between digits.
  stagger: 0.09,
};

/* The code's flight from phone to laptop */
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
const DESK = { at: [-8.5, -5.5, 0] as Vec3, size: [17, 13, TOP] as Vec3 };

// Laptop: a base on the desk and an upright screen at its back edge.
const BASE = { at: [-7.5, -4.5, TOP] as Vec3, size: [9.5, 6.5, 0.3] as Vec3 };
const SCREEN = {
  // Top-left corner of its front face.
  at: [-7.5, -4.1, TOP + 0.3 + 6.2] as Vec3,
  depth: 0.3,
  size: [9.5, 6.2] as const,
};

// Phone lying flat to the right, long side toward the viewer.
const PHONE = { at: [4, -1.5, TOP] as Vec3, size: [3.8, 7.4, 0.3] as Vec3 };
const PHONE_TOP: Vec3 = [PHONE.at[0], PHONE.at[1], TOP + PHONE.size[2]];

// Code boxes on the laptop screen (face units: u across, v down).
const BOXES = { gap: 0.2, h: 1.05, top: 2.85, w: 0.95 };
const BOXES_LEFT = (SCREEN.size[0] - (6 * BOXES.w + 5 * BOXES.gap)) / 2;

const CASTS: IsoCast[] = [
  { box: [BASE.at[0], BASE.at[1], BASE.size[0], BASE.size[1], BASE.size[2]] },
  {
    box: [
      SCREEN.at[0],
      SCREEN.at[1] - SCREEN.depth,
      SCREEN.size[0],
      SCREEN.depth,
      SCREEN.size[1],
    ],
    z: SCREEN.at[2] - SCREEN.size[1],
  },
  {
    box: [
      PHONE.at[0],
      PHONE.at[1],
      PHONE.size[0],
      PHONE.size[1],
      PHONE.size[2],
    ],
  },
];

const BOUNDS: Vec3[] = [
  DESK.at,
  [DESK.at[0] + DESK.size[0], DESK.at[1], 0],
  [DESK.at[0] + DESK.size[0], DESK.at[1] + DESK.size[1], 0],
  [DESK.at[0], DESK.at[1] + DESK.size[1], 0],
  [SCREEN.at[0], SCREEN.at[1] - SCREEN.depth, SCREEN.at[2]],
  [SCREEN.at[0] + SCREEN.size[0], SCREEN.at[1] - SCREEN.depth, SCREEN.at[2]],
];

// The flight: a quadratic arc in 3D from the message on the phone to the
// code boxes on the screen, sampled and projected (math §3).
const ARC = {
  from: [PHONE.at[0] + 1.9, PHONE.at[1] + 2, TOP + 0.4] as Vec3,
  peak: [1.5, -1.2, 9] as Vec3,
  to: [
    SCREEN.at[0] + SCREEN.size[0] / 2,
    SCREEN.at[1] + 0.02,
    SCREEN.at[2] - 3.5,
  ] as Vec3,
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

// Turning toward the screen (+) reads well; away (−) soon turns it edge-on.
const DEFAULT_ORBIT: IsoOrbit = [-20, 35];

// The camera turns around the middle of the desk.
const PIVOT: readonly [number, number] = [
  DESK.at[0] + DESK.size[0] / 2,
  DESK.at[1] + DESK.size[1] / 2,
];

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const Keyboard = ({ w }: { w: number }) => (
  <>
    {Array.from({ length: 48 }, (_, i) => (
      <rect
        fill="var(--iso-text)"
        height={0.5}
        key={i}
        opacity={0.08}
        rx={0.1}
        width={0.55}
        x={(w - 12 * 0.65) / 2 + (i % 12) * 0.65}
        y={0.7 + Math.floor(i / 12) * 0.65}
      />
    ))}
    <rect
      fill="var(--iso-text)"
      height={1.9}
      opacity={0.06}
      rx={0.25}
      width={3}
      x={w / 2 - 1.5}
      y={4}
    />
  </>
);

interface ScreenCopy {
  code: string;
  destination: string;
  name: string;
}

const LaptopScreen = ({
  stage,
  copy,
  w,
  h,
}: {
  stage: number;
  copy: ScreenCopy;
  w: number;
  h: number;
}) => {
  const verified = stage >= STAGE.verified;
  const welcome = stage >= STAGE.welcome;
  return (
    <>
      <rect
        fill="var(--iso-screen)"
        height={h - 0.7}
        rx={0.35}
        width={w - 0.7}
        x={0.35}
        y={0.35}
      />
      {/* Step 2 of sign-in: the code. */}
      <motion.g
        animate={{ opacity: welcome ? 0 : 1 }}
        initial={false}
        transition={FADE}
      >
        <rect
          fill="var(--iso-glow)"
          height={0.6}
          rx={0.18}
          width={0.6}
          x={0.8}
          y={0.8}
        />
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.46}
          fontWeight={600}
          x={0.8}
          y={2.05}
        >
          Check your phone
        </text>
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.27}
          opacity={0.55}
          x={0.8}
          y={2.52}
        >
          {`Enter the code sent to ${copy.destination}`}
        </text>
        {/*
         * Motion treats x / y on SVG elements as transforms, which would
         * escape the screen's face matrix. So shapes keep plain SVG
         * positions, and motion only drives wrapper groups (opacity and
         * offsets in face units) or CSS transitions.
         */}
        {Array.from({ length: 6 }, (_, i) => {
          const x = BOXES_LEFT + i * (BOXES.w + BOXES.gap);
          const landed = stage >= STAGE.digits;
          return (
            <g key={i}>
              <rect
                fill="var(--iso-screen)"
                height={BOXES.h}
                rx={0.2}
                style={{
                  stroke: verified
                    ? "var(--iso-glow)"
                    : "var(--iso-screen-ink)",
                  strokeOpacity: verified ? 1 : 0.18,
                  strokeWidth: verified ? 0.07 : 0.05,
                  transition: `stroke 0.4s ease ${verified ? i * 0.04 : 0}s, stroke-opacity 0.4s ease ${verified ? i * 0.04 : 0}s`,
                }}
                width={BOXES.w}
                x={x}
                y={BOXES.top}
              />
              <motion.g
                animate={{
                  opacity: landed ? 1 : 0,
                  y: landed ? 0 : -DIGITS.liftV,
                }}
                initial={false}
                transition={{
                  ...DIGITS.spring,
                  delay: landed ? i * DIGITS.stagger : 0,
                }}
              >
                <text
                  fill="var(--iso-screen-ink)"
                  fontSize={0.52}
                  fontWeight={600}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                  textAnchor="middle"
                  x={x + BOXES.w / 2}
                  y={BOXES.top + 0.73}
                >
                  {copy.code[i] ?? ""}
                </text>
              </motion.g>
            </g>
          );
        })}
        <motion.g
          animate={{ opacity: stage < STAGE.digits ? [1, 0.15, 1] : 0 }}
          initial={false}
          transition={
            stage < STAGE.digits
              ? { duration: 1, repeat: Number.POSITIVE_INFINITY }
              : FADE
          }
        >
          <rect
            fill="var(--iso-glow)"
            height={0.5}
            width={0.05}
            x={BOXES_LEFT + BOXES.w / 2 - 0.025}
            y={BOXES.top + 0.3}
          />
        </motion.g>
        <rect
          fill="var(--iso-glow)"
          height={0.7}
          rx={0.2}
          width={w - 2 * BOXES_LEFT}
          x={BOXES_LEFT}
          y={4.7}
        />
        <motion.g
          animate={{ opacity: verified ? 0 : 1 }}
          initial={false}
          transition={FADE}
        >
          <text
            fill="var(--iso-screen)"
            fontSize={0.3}
            fontWeight={600}
            textAnchor="middle"
            x={w / 2}
            y={5.15}
          >
            Verify
          </text>
        </motion.g>
        <motion.g
          animate={{ opacity: verified ? 1 : 0, scale: verified ? 1 : 0.85 }}
          initial={false}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          transition={SETTLE}
        >
          <text
            fill="var(--iso-screen)"
            fontSize={0.3}
            fontWeight={600}
            textAnchor="middle"
            x={w / 2}
            y={5.15}
          >
            ✓ Verified
          </text>
        </motion.g>
      </motion.g>
      {/* Signed in. */}
      <motion.g
        animate={{ opacity: welcome ? 1 : 0, y: welcome ? 0 : 0.4 }}
        initial={false}
        transition={welcome ? SETTLE : FADE}
      >
        <circle cx={w / 2} cy={2} fill="var(--iso-glow)" r={0.72} />
        <text
          fill="var(--iso-screen)"
          fontSize={0.52}
          fontWeight={600}
          textAnchor="middle"
          x={w / 2}
          y={2.19}
        >
          {copy.name.slice(0, 1)}
        </text>
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.46}
          fontWeight={600}
          textAnchor="middle"
          x={w / 2}
          y={3.55}
        >
          {`Welcome back, ${copy.name}`}
        </text>
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.27}
          opacity={0.55}
          textAnchor="middle"
          x={w / 2}
          y={4.02}
        >
          Signed in with 2-step verification
        </text>
        <rect
          fill="var(--iso-glow)"
          height={0.55}
          opacity={0.14}
          rx={0.275}
          width={2.9}
          x={w / 2 - 1.45}
          y={4.45}
        />
        <text
          fill="var(--iso-glow)"
          fontSize={0.26}
          fontWeight={600}
          textAnchor="middle"
          x={w / 2}
          y={4.81}
        >
          Session secured
        </text>
      </motion.g>
    </>
  );
};

const PhoneScreen = ({
  stage,
  code,
  appName,
  clipId,
  w,
  d,
}: {
  stage: number;
  code: string;
  appName: string;
  clipId: string;
  w: number;
  d: number;
}) => {
  const awake = stage >= STAGE.wake && stage < STAGE.sleep;
  const message = stage >= STAGE.message;
  const display = { h: d - 0.7, w: w - 0.5, x: 0.25, y: 0.35 };
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect
            height={display.h}
            rx={0.4}
            width={display.w}
            x={display.x}
            y={display.y}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect
          fill="var(--iso-console)"
          height={display.h}
          width={display.w}
          x={display.x}
          y={display.y}
        />
        <motion.g
          animate={{ opacity: awake ? 1 : 0 }}
          initial={false}
          transition={FADE}
        >
          <rect
            fill="var(--iso-glow)"
            height={display.h}
            opacity={0.45}
            width={display.w}
            x={display.x}
            y={display.y}
          />
          <text
            fill="var(--iso-screen)"
            fontSize={0.95}
            fontWeight={500}
            opacity={0.9}
            textAnchor="middle"
            x={w / 2}
            y={4.9}
          >
            9:41
          </text>
        </motion.g>
        <motion.g
          animate={{
            opacity: message && awake ? 1 : 0,
            y: message ? 0 : MESSAGE.fromV,
          }}
          initial={false}
          transition={message ? MESSAGE.spring : FADE}
        >
          <rect
            fill="var(--iso-screen)"
            height={1.95}
            rx={0.3}
            width={w - 0.9}
            x={0.45}
            y={0.65}
          />
          <rect
            fill="var(--iso-glow)"
            height={0.42}
            rx={0.12}
            width={0.42}
            x={0.7}
            y={0.9}
          />
          <text
            fill="var(--iso-screen-ink)"
            fontSize={0.21}
            fontWeight={600}
            letterSpacing={0.03}
            opacity={0.6}
            x={1.25}
            y={1.19}
          >
            {appName.toUpperCase()}
          </text>
          <text
            fill="var(--iso-screen-ink)"
            fontSize={0.21}
            opacity={0.45}
            textAnchor="end"
            x={w - 0.7}
            y={1.19}
          >
            now
          </text>
          <text fill="var(--iso-screen-ink)" fontSize={0.25} x={0.7} y={1.72}>
            Your sign-in code is
          </text>
          <text
            fill="var(--iso-screen-ink)"
            fontFamily={ISO_MONO}
            fontSize={0.48}
            fontWeight={600}
            letterSpacing={0.06}
            style={{ fontVariantNumeric: "tabular-nums" }}
            x={0.7}
            y={2.33}
          >
            {`${code.slice(0, 3)} ${code.slice(3, 6)}`}
          </text>
        </motion.g>
      </g>
    </>
  );
};

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
  const [stage, setStage] = useState<number>(
    still ? STAGE.welcome : STAGE.idle
  );
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (still) {
      setStage(STAGE.welcome);
      return;
    }
    if (!inView) {
      setStage(STAGE.idle);
      return;
    }
    setStage(STAGE.idle);
    const at: [number, number][] = [
      [TIMING.phoneWakes, STAGE.wake],
      [TIMING.messageArrives, STAGE.message],
      [TIMING.codeTravels, STAGE.travel],
      [TIMING.digitsLand, STAGE.digits],
      [TIMING.verified, STAGE.verified],
      [TIMING.welcome, STAGE.welcome],
      [TIMING.phoneSleeps, STAGE.sleep],
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

export interface TwoStepSignInProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. */
  tone?: IsoTone;
  /** Colour of lit details (buttons, wallpaper, code flight). Defaults to `tone`. */
  accent?: IsoTone;
  /** Soft tint, full colour, or outlined. */
  variant?: IsoVariant;
  /** Edge weight in canvas units: rims and hairlines, or outlines in `line`. */
  strokeWidth?: number;
  /** App name shown on the text message, up to about 10 characters. */
  appName?: string;
  /** The six-digit code sent and entered. */
  code?: string;
  /** Where the code was sent, shown on the laptop (about 10 characters). */
  destination?: string;
  /** First name in the welcome line, up to about 10 characters. */
  name?: string;
  /** Play when the scene scrolls into view. Off shows the signed-in end state. */
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
   * Default [-20, 35]: further toward the laptop screen than away from it,
   * so the copy stays readable. Each side is capped at 40.
   */
  orbit?: IsoOrbit;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

/**
 * Two-step sign-in, in isometric: a laptop on a desk asks for a code, the
 * phone beside it receives the text, the code flies across and fills the
 * boxes, and the user is signed in. Follows the shadcn theme; plays once
 * in view, then loops.
 */
export const TwoStepSignIn = ({
  tone = "primary",
  accent,
  variant = "duotone",
  strokeWidth = 0.3,
  appName = "Acme",
  code = "481927",
  destination = "•••• 4242",
  name = "Jane",
  autoPlay = true,
  loop = true,
  rotate = "drag",
  orbit = DEFAULT_ORBIT,
  title,
  className,
}: TwoStepSignInProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const still = reduced || !autoPlay;
  const stage = useStory({ inView, loop, still });
  const clipId = `${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}-phone`;
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced: reduced ?? false,
  });
  const arc = arcPath(camera);

  const flying = stage === STAGE.travel;
  return (
    <div
      {...turnableLabel(rotate, title)}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-slot="two-step-sign-in"
      ref={ref}
      {...orbitProps}
    >
      <IsoStage
        camera={camera}
        orbit={rotate === "off" ? 0 : orbit}
        accent={accent}
        base={
          <Slab at={DESK.at} palette="surface" radius={1.2} size={DESK.size} />
        }
        baseCasts={[
          {
            box: [
              DESK.at[0],
              DESK.at[1],
              DESK.size[0],
              DESK.size[1],
              DESK.size[2],
            ],
          },
        ]}
        bounds={BOUNDS}
        casts={CASTS}
        ground={TOP}
        strokeWidth={strokeWidth}
        title={title}
        tone={tone}
        variant={variant}
      >
        <Slab
          at={BASE.at}
          content={(w) => <Keyboard w={w} />}
          palette="surface"
          radius={0.4}
          size={BASE.size}
        />
        <Panel
          at={SCREEN.at}
          content={(w, h) => (
            <LaptopScreen
              copy={{ code, destination, name }}
              h={h}
              stage={stage}
              w={w}
            />
          )}
          depth={SCREEN.depth}
          radius={0.45}
          size={SCREEN.size}
        />
        <Slab
          at={PHONE.at}
          content={(w, d) => (
            <PhoneScreen
              appName={appName}
              clipId={clipId}
              code={code}
              d={d}
              stage={stage}
              w={w}
            />
          )}
          frontStyle={{ fill: "var(--iso-console)" }}
          palette="surface"
          radius={0.55}
          size={PHONE.size}
        />
        <Face at={PHONE_TOP} plane="top">
          <rect
            fill="var(--iso-text)"
            height={0.12}
            opacity={0.25}
            rx={0.06}
            width={0.9}
            x={PHONE.size[0] / 2 - 0.45}
            y={0.12}
          />
        </Face>
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

export default TwoStepSignIn;
