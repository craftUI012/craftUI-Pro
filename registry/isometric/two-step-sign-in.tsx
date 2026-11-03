"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  Bloom,
  EASE,
  Face,
  FaceEllipse,
  FloorGrid,
  GLASS,
  hop,
  ISO_MONO,
  IsoStage,
  jolt,
  Panel,
  Rig,
  sample,
  Slab,
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
 * One moment: a sign-in screen asks for a code, the phone in front of it
 * receives the text, the code pops off the phone as a chip, is tossed
 * into the input, and the user is in. Objects act: the phone hops when
 * the text lands, the chip tilts through its flight, the screen takes
 * the hit, the boxes press in. Drawn in ink.
 * Read top-to-bottom. Each value is ms after the scene comes into view.
 *
 *    0ms   screen shows "Check your phone"; phone asleep
 *  400ms   phone wakes: wallpaper and clock fade up
 *  740ms   the phone hops (the text thuds in), rebounds twice
 *  800ms   message drops in from the phone's top edge (spring)
 * 1500ms   the code pops up off the message as a chip (scale, not
 *          opacity), lit, and is tossed to the input: a lifted arc with a
 *          tilt through the middle (900ms); its shadow runs on the floor
 * 2350ms   the chip slams in and shrinks away; the screen is kicked back
 *          and settles; digits land in the boxes, each box pressing in
 * 3050ms   boxes confirm, button reads "Verified" (spring)
 * 3650ms   screen crossfades to "Welcome back"
 * 4100ms   phone dims back to sleep
 * 7600ms   hold ends; the scene resets and plays again
 *
 * The viewer leans the camera with the pointer and can click to replay.
 * Reduced motion: no timeline; the signed-in end state is shown.
 * ───────────────────────────────────────────────────────── */

// Every stage's start, in ms after the scene comes into view. Keys are
// sorted for lint; the storyboard above reads them in time order.
const TIMING = {
  // The chip lifts off the phone.
  codeTravels: 1500,
  // Boxes fill, staggered.
  digitsLand: 2350,
  // Reset and replay.
  loop: 7600,
  // The notification drops in.
  messageArrives: 800,
  // The phone dims.
  phoneSleeps: 4100,
  // Wallpaper and clock fade up.
  phoneWakes: 400,
  // Boxes and button confirm.
  verified: 3050,
  // The screen swaps to the signed-in view.
  welcome: 3650,
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

/* Code boxes on the screen */
const DIGITS = {
  // Face units each digit drops from.
  liftV: 0.4,
  spring: { damping: 22, stiffness: 520, type: "spring" as const },
  // Seconds between digits.
  stagger: 0.09,
};

/* The chip's toss from phone to screen */
const FLIGHT = {
  // Milliseconds.
  duration: 850,
  // World units it rises at the middle of the arc.
  lift: 2.6,
  // Degrees it tilts about its travel at the middle of the arc.
  tilt: -30,
};

/* The phone's hop when the text lands, in world units. */
const PHONE_HOP = 0.9;

/* The screen kicked back (−y) when the chip slams in, in world units. */
const SCREEN_KICK = 0.45;

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The sign-in screen: a glass panel standing in open space, floating a
// little above the floor. `at` is the top-left corner of its front face.
const SCREEN = {
  at: [-6.25, 0, 7] as Vec3,
  depth: 0.45,
  // Height of its bottom edge above the floor.
  float: 0.4,
  size: [12.5, 6.6] as const,
};
// The display inset from the panel's edge, in face units.
const INSET = 0.35;

// Phone lying flat beside the screen's right edge, nearer the viewer.
const PHONE = { at: [6.9, -2.4, 0] as Vec3, size: [3.1, 5.8, 0.28] as Vec3 };
const PHONE_TOP: Vec3 = [PHONE.at[0], PHONE.at[1], PHONE.size[2]];

// Code boxes on the screen (face units: u across, v down).
const BOXES = { gap: 0.26, h: 1.3, top: 3.1, w: 1.2 };
const BOXES_LEFT = (SCREEN.size[0] - (6 * BOXES.w + 5 * BOXES.gap)) / 2;

// The code chip: a small tile that is the text message's code made solid.
// It starts lying on the phone's message and ends centred on the input.
const CHIP = { size: [2.7, 1.15, 0.14] as Vec3 };
const CHIP_FROM: Vec3 = [PHONE.at[0] + 0.2, PHONE.at[1] + 1.05, PHONE.size[2]];
const CHIP_TO: Vec3 = [
  SCREEN.at[0] + SCREEN.size[0] / 2 - CHIP.size[0] / 2,
  SCREEN.at[1] + 0.35,
  SCREEN.at[2] - BOXES.top - BOXES.h / 2 - CHIP.size[2] / 2,
];

// The chip's position at glide progress t: a straight line, lifted in z.
const chipAt = (t: number): Vec3 => [
  CHIP_FROM[0] + (CHIP_TO[0] - CHIP_FROM[0]) * t,
  CHIP_FROM[1] + (CHIP_TO[1] - CHIP_FROM[1]) * t,
  CHIP_FROM[2] +
    (CHIP_TO[2] - CHIP_FROM[2]) * t +
    FLIGHT.lift * Math.sin(Math.PI * t),
];

// Light travels along −L, so a point at height z lands on the floor at
// (x − z/3, y − 2z/3) (math §5).
const onFloor = ([x, y, z]: Vec3): Vec3 => [x - z / 3, y - (2 * z) / 3, 0];

// Shadows: the panel's is kept low so it reads as a pool at its foot
// instead of an 8-unit smear behind it; the phone's is its real shape.
const CASTS: IsoCast[] = [
  {
    box: [
      SCREEN.at[0],
      SCREEN.at[1] - SCREEN.depth,
      SCREEN.size[0],
      SCREEN.depth,
      1.8,
    ],
    z: SCREEN.float,
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

// The frame fits the screen and the phone, nothing else: no desk.
const BOUNDS: Vec3[] = [
  SCREEN.at,
  [SCREEN.at[0] + SCREEN.size[0], SCREEN.at[1], SCREEN.at[2]],
  [SCREEN.at[0], SCREEN.at[1], SCREEN.float],
  [SCREEN.at[0] + SCREEN.size[0], SCREEN.at[1], SCREEN.float],
  [SCREEN.at[0], SCREEN.at[1] - SCREEN.depth, SCREEN.at[2]],
  [SCREEN.at[0] + SCREEN.size[0], SCREEN.at[1] - SCREEN.depth, SCREEN.at[2]],
  PHONE.at,
  [PHONE.at[0] + PHONE.size[0], PHONE.at[1], 0],
  [PHONE.at[0] + PHONE.size[0], PHONE.at[1] + PHONE.size[1], 0],
  [PHONE.at[0], PHONE.at[1] + PHONE.size[1], 0],
  // The chip's shadow at the top of its glide.
  onFloor(chipAt(0.5)),
];

// The construction grid under everything.
const GRID = { at: [-9, -5] as const, size: [20, 12] as const };

// Rig pivots: the screen turns and slides about its foot, the phone about
// its centre on the floor.
const SCREEN_PIVOT: Vec3 = [SCREEN.at[0] + SCREEN.size[0] / 2, SCREEN.at[1], 0];
const PHONE_PIVOT: Vec3 = [
  PHONE.at[0] + PHONE.size[0] / 2,
  PHONE.at[1] + PHONE.size[1] / 2,
  0,
];

// Leaning toward the screen (+) reads well; away (−) soon turns it edge-on.
const DEFAULT_ORBIT: IsoOrbit = [-18, 30];

// The camera turns around the foot of the screen.
const PIVOT: readonly [number, number] = [0, 0.5];

// CSS pixels per world unit for UI rendered into the screen with `screen`.
const SCREEN_PX = 40;

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** What the sign-in screen is showing, for UI passed in through `screen`. */
export interface SignInScreenState {
  /** The six-digit code the phone received. */
  code: string;
  /** "waiting" for the code, "entered" (digits in the boxes), "verified", "signedIn". */
  step: "waiting" | "entered" | "verified" | "signedIn";
}

const resolveScreen = (
  screen: ReactNode | ((state: SignInScreenState) => ReactNode),
  state: SignInScreenState
) => (typeof screen === "function" ? screen(state) : screen);

const stepOf = (stage: number): SignInScreenState["step"] => {
  if (stage >= STAGE.welcome) {
    return "signedIn";
  }
  if (stage >= STAGE.verified) {
    return "verified";
  }
  if (stage >= STAGE.digits) {
    return "entered";
  }
  return "waiting";
};

interface ScreenCopy {
  code: string;
  destination: string;
  name: string;
}

const SignInScreen = ({
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
  const landed = stage >= STAGE.digits;
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
      {/* Step 2 of sign-in: the code. */}
      <motion.g
        animate={{ opacity: welcome ? 0 : 1 }}
        initial={false}
        transition={FADE}
      >
        <rect
          fill="var(--iso-glow)"
          height={0.8}
          rx={0.24}
          width={0.8}
          x={BOXES_LEFT}
          y={0.8}
        />
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.6}
          fontWeight={600}
          letterSpacing={-0.01}
          x={BOXES_LEFT}
          y={2.25}
        >
          Check your phone
        </text>
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.34}
          opacity={0.55}
          x={BOXES_LEFT}
          y={2.75}
        >
          {`Enter the code we sent to ${copy.destination}`}
        </text>
        {/*
         * Motion treats x / y on SVG elements as transforms, which would
         * escape the screen's face matrix. So shapes keep plain SVG
         * positions, and motion only drives wrapper groups (opacity and
         * offsets in face units) or CSS transitions.
         */}
        {Array.from({ length: 6 }, (_, i) => {
          const x = BOXES_LEFT + i * (BOXES.w + BOXES.gap);
          return (
            <motion.g
              animate={{ scale: landed ? [1, 0.86, 1.05, 1] : 1 }}
              initial={false}
              key={i}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              transition={{
                delay: landed ? i * DIGITS.stagger : 0,
                duration: 0.42,
                ease: EASE.drop as unknown as [number, number, number, number],
              }}
            >
              <rect
                fill="var(--iso-screen)"
                height={BOXES.h}
                rx={0.28}
                style={{
                  stroke: verified
                    ? "var(--iso-glow)"
                    : "var(--iso-screen-ink)",
                  strokeOpacity: verified ? 1 : 0.16,
                  strokeWidth: verified ? 0.09 : 0.06,
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
                  fontSize={0.68}
                  fontWeight={600}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                  textAnchor="middle"
                  x={x + BOXES.w / 2}
                  y={BOXES.top + 0.89}
                >
                  {copy.code[i] ?? ""}
                </text>
              </motion.g>
            </motion.g>
          );
        })}
        <motion.g
          animate={{ opacity: landed ? 0 : [1, 0.15, 1] }}
          initial={false}
          transition={
            landed ? FADE : { duration: 1, repeat: Number.POSITIVE_INFINITY }
          }
        >
          <rect
            fill="var(--iso-glow)"
            height={0.64}
            width={0.06}
            x={BOXES_LEFT + BOXES.w / 2 - 0.03}
            y={BOXES.top + 0.33}
          />
        </motion.g>
        <rect
          fill="var(--iso-glow)"
          height={0.9}
          rx={0.28}
          width={w - 2 * BOXES_LEFT}
          x={BOXES_LEFT}
          y={4.95}
        />
        <motion.g
          animate={{ opacity: verified ? 0 : 1 }}
          initial={false}
          transition={FADE}
        >
          <text
            fill="var(--iso-screen)"
            fontSize={0.38}
            fontWeight={600}
            textAnchor="middle"
            x={w / 2}
            y={5.53}
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
            fontSize={0.38}
            fontWeight={600}
            textAnchor="middle"
            x={w / 2}
            y={5.53}
          >
            ✓ Verified
          </text>
        </motion.g>
      </motion.g>
      {/* Signed in. */}
      <motion.g
        animate={{ opacity: welcome ? 1 : 0, y: welcome ? 0 : 0.5 }}
        initial={false}
        transition={welcome ? SETTLE : FADE}
      >
        <circle cx={w / 2} cy={2} fill="var(--iso-glow)" r={0.85} />
        <text
          fill="var(--iso-screen)"
          fontSize={0.66}
          fontWeight={600}
          textAnchor="middle"
          x={w / 2}
          y={2.24}
        >
          {copy.name.slice(0, 1)}
        </text>
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.6}
          fontWeight={600}
          letterSpacing={-0.01}
          textAnchor="middle"
          x={w / 2}
          y={3.65}
        >
          {`Welcome back, ${copy.name}`}
        </text>
        <text
          fill="var(--iso-screen-ink)"
          fontSize={0.34}
          opacity={0.55}
          textAnchor="middle"
          x={w / 2}
          y={4.2}
        >
          Signed in with 2-step verification
        </text>
        <rect
          fill="var(--iso-glow)"
          height={0.7}
          opacity={0.14}
          rx={0.35}
          width={3.8}
          x={w / 2 - 1.9}
          y={4.75}
        />
        <text
          fill="var(--iso-glow)"
          fontSize={0.33}
          fontWeight={600}
          textAnchor="middle"
          x={w / 2}
          y={5.21}
        >
          Session secured
        </text>
      </motion.g>
    </>
  );
};

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

/** The built-in sign-in, or whatever `screen` provides. */
const ScreenContent = ({
  custom,
  copy,
  stage,
  w,
  h,
}: {
  custom: ReactNode;
  copy: ScreenCopy;
  stage: number;
  w: number;
  h: number;
}) =>
  custom === undefined ? (
    <SignInScreen copy={copy} h={h} stage={stage} w={w} />
  ) : (
    <CustomScreen h={h} w={w}>
      {custom}
    </CustomScreen>
  );

const PhoneScreen = ({
  stage,
  code,
  appName,
  uid,
  w,
  d,
}: {
  stage: number;
  code: string;
  appName: string;
  uid: string;
  w: number;
  d: number;
}) => {
  const awake = stage >= STAGE.wake && stage < STAGE.sleep;
  const message = stage >= STAGE.message;
  // The code text leaves with the chip; the message stays, now read.
  const taken = stage >= STAGE.travel;
  const display = { h: d - 0.6, w: w - 0.44, x: 0.22, y: 0.3 };
  return (
    <>
      <defs>
        <clipPath id={`${uid}-phone`}>
          <rect
            height={display.h}
            rx={0.42}
            width={display.w}
            x={display.x}
            y={display.y}
          />
        </clipPath>
        <linearGradient id={`${uid}-wall`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--iso-glow)" stopOpacity={0.85} />
          <stop offset="1" stopColor="var(--iso-glow)" stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${uid}-phone)`}>
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
            fill={`url(#${uid}-wall)`}
            height={display.h}
            width={display.w}
            x={display.x}
            y={display.y}
          />
          <text
            fill="var(--iso-screen)"
            fontSize={0.95}
            fontWeight={500}
            opacity={0.92}
            textAnchor="middle"
            x={w / 2}
            y={4.1}
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
            height={2.05}
            rx={0.32}
            width={w - 0.6}
            x={0.3}
            y={0.55}
          />
          <rect
            fill="var(--iso-glow)"
            height={0.42}
            rx={0.12}
            width={0.42}
            x={0.55}
            y={0.8}
          />
          <text
            fill="var(--iso-screen-ink)"
            fontSize={0.21}
            fontWeight={600}
            letterSpacing={0.03}
            opacity={0.6}
            x={1.1}
            y={1.09}
          >
            {appName.toUpperCase()}
          </text>
          <text
            fill="var(--iso-screen-ink)"
            fontSize={0.21}
            opacity={0.45}
            textAnchor="end"
            x={w - 0.55}
            y={1.09}
          >
            now
          </text>
          <text fill="var(--iso-screen-ink)" fontSize={0.25} x={0.55} y={1.61}>
            Your sign-in code is
          </text>
          <motion.g
            animate={{ opacity: taken ? 0.18 : 1 }}
            initial={false}
            transition={FADE}
          >
            <text
              fill="var(--iso-screen-ink)"
              fontFamily={ISO_MONO}
              fontSize={0.5}
              fontWeight={600}
              letterSpacing={0.06}
              style={{ fontVariantNumeric: "tabular-nums" }}
              x={0.55}
              y={2.25}
            >
              {`${code.slice(0, 3)} ${code.slice(3, 6)}`}
            </text>
          </motion.g>
        </motion.g>
      </g>
    </>
  );
};

/* ───────────────────────────── Tracks ─────────────────────────────────── */

// Every track is on the storyboard's clock (ms since the scene started).

// The chip's flight progress, 0 → 1, fast out and smooth in.
const FLIGHT_T: IsoTrack = [
  [TIMING.codeTravels, 0, EASE.snap],
  [TIMING.codeTravels + FLIGHT.duration, 1],
];

// The chip's size: pops up with scale, slams in and shrinks away. Never
// opacity: a slab is a stack and alpha shows the stack.
const CHIP_SCALE: IsoTrack = [
  [TIMING.codeTravels - 1, 0, "hold"],
  [TIMING.codeTravels, 0.2, EASE.soft],
  [TIMING.codeTravels + 220, 1, "hold"],
  [TIMING.digitsLand, 1, EASE.in],
  [TIMING.digitsLand + 140, 0],
];

// The phone hops just before the message lands (the thud comes first).
const PHONE_TRACK = hop(PHONE_HOP, TIMING.messageArrives - 60);

// The screen takes the hit: kicked back, settles, holds, comes home.
const SCREEN_TRACK = jolt(SCREEN_KICK, TIMING.digitsLand, 500);

const chipPose = (ms: number): IsoPose => {
  const t = sample(FLIGHT_T, ms);
  const at = chipAt(t);
  return {
    axis: "y",
    offset: [at[0] - CHIP_FROM[0], at[1] - CHIP_FROM[1], at[2] - CHIP_FROM[2]],
    rotate: FLIGHT.tilt * Math.sin(Math.PI * t),
    scale: sample(CHIP_SCALE, ms),
  };
};

const chipShadowPose = (ms: number): IsoPose => {
  const t = sample(FLIGHT_T, ms);
  const from = onFloor(CHIP_FROM);
  const at = onFloor(chipAt(t));
  const s = sample(CHIP_SCALE, ms);
  return { offset: [at[0] - from[0], at[1] - from[1], 0], scale: s };
};

const phonePose = (ms: number): IsoPose => ({
  offset: [0, 0, sample(PHONE_TRACK, ms)],
});

const screenPose = (ms: number): IsoPose => ({
  offset: [0, -sample(SCREEN_TRACK, ms), 0],
});

/* ───────────────────────────── Pieces (rigged) ─────────────────────────── */

const CHIP_PIVOT: Vec3 = [
  CHIP_FROM[0] + CHIP.size[0] / 2,
  CHIP_FROM[1] + CHIP.size[1] / 2,
  CHIP_FROM[2] + CHIP.size[2] / 2,
];

/**
 * The code made solid: a small lit tile carrying the digits. It lives at
 * CHIP_FROM and a rig poses it along the toss; its shadow is a second rig
 * sliding on the floor.
 */
const CodeChip = ({
  code,
  clock,
}: {
  code: string;
  clock: ReturnType<typeof useClock>;
}) => (
  <>
    <Rig clock={clock} pivot={onFloor(CHIP_PIVOT)} pose={chipShadowPose}>
      <FaceEllipse
        center={onFloor(CHIP_PIVOT)}
        fill="var(--iso-shadow)"
        plane="top"
        r={CHIP.size[0] * 0.42}
      />
    </Rig>
    <Rig clock={clock} pivot={CHIP_PIVOT} pose={chipPose}>
      <Bloom at={CHIP_FROM} size={CHIP.size} strength={0.9} />
      <Slab
        at={CHIP_FROM}
        content={(w, d) => (
          <text
            fill="var(--iso-on-main)"
            fontFamily={ISO_MONO}
            fontSize={0.5}
            fontWeight={600}
            letterSpacing={0.08}
            style={{ fontVariantNumeric: "tabular-nums" }}
            textAnchor="middle"
            x={w / 2}
            y={d / 2 + 0.18}
          >
            {`${code.slice(0, 3)} ${code.slice(3, 6)}`}
          </text>
        )}
        palette="main"
        radius={0.3}
        size={CHIP.size}
      />
    </Rig>
  </>
);

/** Film grain over the whole stage, for the lit variants. */
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

export interface TwoStepSignInProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. */
  tone?: IsoTone;
  /** Colour of lit details (buttons, wallpaper, the code chip). Defaults to `tone`. */
  accent?: IsoTone;
  /** Flat ink drawing (default), soft tint, full colour, or blueprint outline. */
  variant?: IsoVariant;
  /** Line weight: in `ink` 0.3 is a 1.3 px outline at any size; rims or outlines elsewhere. */
  strokeWidth?: number;
  /** App name shown on the text message, up to about 10 characters. */
  appName?: string;
  /** The six-digit code sent and entered. */
  code?: string;
  /** Where the code was sent, shown on the screen (about 12 characters). */
  destination?: string;
  /** First name in the welcome line, up to about 10 characters. */
  name?: string;
  /**
   * Your own UI inside the screen instead of the built-in sign-in: any
   * React node, or a function of the story's state (`step`, `code`) so
   * your UI follows the phone. It renders at 472 × 236 CSS px (the
   * screen is 11.8 × 5.9 units at 40 px per unit) and is projected
   * into the scene; the chip still lifts off the phone and lands on it.
   */
  screen?: ReactNode | ((state: SignInScreenState) => ReactNode);
  /** Play when the scene scrolls into view. Off shows the signed-in end state. */
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
   * Default [-18, 30]: further toward the screen than away from it, so
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
 * Two-step sign-in, in isometric ink: a sign-in screen floating in open
 * space asks for a code, the phone in front of it hops as the text lands,
 * the code pops off as a lit chip and is tossed into the input, the screen
 * takes the hit, and the user is signed in. Flat ink drawing with one even
 * outline, objects that move as solids, the camera leans with the pointer,
 * and `screen` puts your own React UI inside the screen. Follows the
 * shadcn theme; plays once in view, then loops.
 */
export const TwoStepSignIn = ({
  tone = "primary",
  accent,
  variant = "ink",
  strokeWidth = 0.3,
  appName = "Acme",
  code = "481927",
  destination = "+1 ••• 4242",
  name = "Jane",
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
}: TwoStepSignInProps) => {
  const { camera, clock, line, orbitProps, pointer, ref, stage, uid } =
    useSceneShell({ autoPlay, loop, orbit, replayOnClick, rotate, variant });
  const custom = resolveScreen(screen, { code, step: stepOf(stage) });
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
        <Rig clock={clock} pivot={SCREEN_PIVOT} pose={screenPose}>
          <Panel
            at={SCREEN.at}
            content={(w, h) => (
              <ScreenContent
                copy={{ code, destination, name }}
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
        <Rig clock={clock} pivot={PHONE_PIVOT} pose={phonePose}>
          <Slab
            at={PHONE.at}
            content={(w, d) => (
              <PhoneScreen
                appName={appName}
                code={code}
                d={d}
                stage={stage}
                uid={uid}
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
              fill="var(--iso-screen)"
              height={0.12}
              opacity={0.3}
              rx={0.06}
              width={0.9}
              x={PHONE.size[0] / 2 - 0.45}
              y={0.1}
            />
          </Face>
        </Rig>
        <CodeChip clock={clock} code={code} />
        <Film show={grain && !line} uid={uid} />
      </IsoStage>
    </div>
  );
};

export default TwoStepSignIn;
