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
  Box,
  EASE,
  Extrude,
  Face,
  FacePath,
  FloorGrid,
  IsoStage,
  press,
  Rig,
  roundedRect,
  sample,
  settle,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCast,
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
 * A hero object with a product moment: deposits. A small bank (steps, a
 * flat-roofed hall with an arched door, two columns and a pediment on its
 * portico) with five coins standing on the ground to its right and a
 * debit card leaning to its left that shows the balance. One by one the
 * coins hop through the arch on an arc and the balance goes up.
 *
 *    0ms   coins pop in at their spots (scale), balance at its start
 *  600ms   the first coin leaps: an arc through the arch (720ms), leaning
 *          into the flight, shrinking away as it crosses the threshold;
 *          the bank dips as it lands; the balance counts up by one credit,
 *          a "+$25" pill pops on the card, the card is nudged and settles
 *          and its contactless waves pulse
 * 1250ms   the second coin, and so on, 650ms apart
 * 3850ms   the last coin lands
 * 5600ms   the next cycle
 *
 * Reduced motion: no loop; the coins hold at their spots, the balance
 * shows the total.
 * ───────────────────────────────────────────────────────── */

const COUNT = 5;

const TIMING = {
  // Milliseconds of each arc.
  flight: 720,
  // The first coin leaps.
  leap: 600,
  // Between coins.
  leapStagger: 650,
  // One cycle.
  period: 5600,
  // How long the credit pill shows.
  pill: 900,
};

/* The leap. */
const LEAP = {
  // How far the bank dips (z scale) as a coin lands.
  dip: 0.05,
  // Degrees a coin leans into its flight, about z.
  lean: -40,
  // World units the arc rises above a straight line.
  lift: 3.2,
};

/* The credit, on the card. */
const CREDIT = {
  // Degrees the card is nudged back, then settles.
  nudge: 4,
  // How much the contactless waves grow.
  pulse: 0.45,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The bank: two steps, a flat-roofed hall whose front carries the arched
// door and two windows, two columns with square capitals at the portico's
// ends, an entablature and a pediment standing on its front.
const STEP1 = { at: [-4.75, -3.25, 0] as Vec3, size: [9.5, 6.5, 0.5] as Vec3 };
const STEP2 = {
  at: [-4.25, -2.75, 0.5] as Vec3,
  size: [8.5, 5.5, 0.5] as Vec3,
};
const FLOOR_Z = 1;
const BODY = { at: [-3.5, -2.25, FLOOR_Z] as Vec3, size: [7, 4, 4.6] as Vec3 };
const BODY_FRONT_Y = BODY.at[1] + BODY.size[1];
const COLUMN = { h: 4.6, w: 0.75, y: BODY_FRONT_Y + 0.45 };
const COLUMN_XS = [-3.6, 2.85];
const CAPITAL = { h: 0.3, pad: 0.15 };
const ENTABLATURE = {
  at: [-4.1, -2.5, FLOOR_Z + COLUMN.h] as Vec3,
  size: [8.2, 5.2, 0.55] as Vec3,
};
const ROOF_Z = ENTABLATURE.at[2] + ENTABLATURE.size[2];
const PEDIMENT = { depth: 0.6, h: 1.9, w: 8.2 };
const PEDIMENT_AT: Vec3 = [
  ENTABLATURE.at[0],
  ENTABLATURE.at[1] + ENTABLATURE.size[1],
  ROOF_Z + PEDIMENT.h,
];
// The arched door the coins fly through.
const DOOR = { h: 3.3, w: 2.3, x: -1.15 };
const DOOR_CENTRE: Vec3 = [
  DOOR.x + DOOR.w / 2,
  BODY_FRONT_Y,
  FLOOR_Z + DOOR.h * 0.45,
];

// The coins, standing on the ground to the right, a loose pile.
const COIN = { depth: 0.22, r: 0.6 };
const SPOTS: Vec3[] = [
  [5.4, 1.5, 0],
  [6.3, 2.7, 0],
  [7.2, 1.3, 0],
  [8, 2.6, 0],
  [8.9, 1.8, 0],
];

// The card, after Wise's, standing to the left of the steps and leaning
// back a little: chip and contactless waves top-left, the wordmark
// top-right, the balance bottom-left, the network's circles bottom-right.
const CARD = { depth: 0.42, h: 4.1, lean: 14, radius: 0.45, w: 6.4 };
const CARD_AT: Vec3 = [-12.6, 2.4, CARD.h];
const CARD_PIVOT: Vec3 = [CARD_AT[0] + CARD.w / 2, CARD_AT[1], 0];
// Where the contactless waves sit on the card (face units), for the pulse.
const WAVES = { u: 2.1, v: 1.05 };
const WAVES_PIVOT: Vec3 = [
  CARD_AT[0] + WAVES.u,
  CARD_AT[1],
  CARD_AT[2] - WAVES.v,
];

const BOUNDS: Vec3[] = [
  STEP1.at,
  [STEP1.at[0] + STEP1.size[0], STEP1.at[1], 0],
  [STEP1.at[0] + STEP1.size[0], STEP1.at[1] + STEP1.size[1], 0],
  [STEP1.at[0], STEP1.at[1] + STEP1.size[1], 0],
  PEDIMENT_AT,
  [PEDIMENT_AT[0] + PEDIMENT.w, PEDIMENT_AT[1], PEDIMENT_AT[2]],
  [BODY.at[0] + BODY.size[0], BODY.at[1], FLOOR_Z + BODY.size[2]],
  ...SPOTS.map((s): Vec3 => [s[0] + COIN.r, s[1], 0]),
  [SPOTS[2][0], SPOTS[2][1] - 1, LEAP.lift + 2],
  [CARD_AT[0], CARD_AT[1] - 1.2, CARD_AT[2] + 0.3],
  [CARD_AT[0], CARD_AT[1], 0],
  [CARD_AT[0] + CARD.w, CARD_AT[1], 0],
];

const CASTS: IsoCast[] = [
  { box: [STEP1.at[0], STEP1.at[1], STEP1.size[0], STEP1.size[1], 1] },
  {
    box: [BODY.at[0], BODY.at[1], BODY.size[0], BODY.size[1], COLUMN.h + 0.6],
    z: FLOOR_Z,
  },
];

const GRID = { at: [-14, -6] as const, size: [25, 12] as const };
const PIVOT: readonly [number, number] = [0, 0];
const DEFAULT_ORBIT: IsoOrbit = 20;

/* ───────────────────────────── Tracks ─────────────────────────────────── */

const leapStart = (i: number) => TIMING.leap + i * TIMING.leapStagger;
const landAt = (i: number) => leapStart(i) + TIMING.flight;

const cycle = (ms: number) => ms % TIMING.period;

// How many coins have landed by a time in the cycle.
const landed = (t: number) => {
  let n = 0;
  for (let i = 0; i < COUNT; i += 1) {
    if (t >= landAt(i)) {
      n += 1;
    }
  }
  return n;
};

// Per coin: pop in at the cycle's start, fly, shrink at the door.
const scaleTrack = (i: number): IsoTrack => [
  [0, 0, EASE.soft],
  [220 + i * 60, 1, "hold"],
  [landAt(i) - 120, 1, EASE.in],
  [landAt(i), 0],
];
const flightTrack = (i: number): IsoTrack => [
  [leapStart(i), 0, EASE.snap],
  [landAt(i), 1],
];
const leanTrack = (i: number): IsoTrack => [
  [leapStart(i), 0, EASE.soft],
  [leapStart(i) + 200, LEAP.lean, EASE.easy],
  [landAt(i), 0],
];
const SCALES = SPOTS.map((_, i) => scaleTrack(i));
const FLIGHTS = SPOTS.map((_, i) => flightTrack(i));
const LEANS = SPOTS.map((_, i) => leanTrack(i));
// With every landing: the bank dips, the card is nudged and settles, and
// its waves pulse.
const DIPS: IsoTrack = SPOTS.flatMap((_, i) => press(LEAP.dip, landAt(i) - 60));
const NUDGES: IsoTrack = SPOTS.flatMap((_, i) =>
  settle(0, landAt(i), 0.7, CREDIT.nudge)
);
const PULSES: IsoTrack = SPOTS.flatMap(
  (_, i): IsoTrack => [
    [landAt(i), 1, EASE.soft],
    [landAt(i) + 160, 1 + CREDIT.pulse, EASE.easy],
    [landAt(i) + 560, 1],
  ]
);

// A point on coin i's arc: a straight line to the door, lifted by sin.
const arcAt = (i: number, t: number): Vec3 => {
  const from = SPOTS[i];
  const to = DOOR_CENTRE;
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t + LEAP.lift * Math.sin(Math.PI * t),
  ];
};

const coinPose =
  (i: number) =>
  (ms: number): IsoPose => {
    const t = cycle(ms);
    const f = sample(FLIGHTS[i], t);
    const at = arcAt(i, f);
    return {
      axis: "z",
      offset: [at[0] - SPOTS[i][0], at[1] - SPOTS[i][1], at[2] - SPOTS[i][2]],
      rotate: sample(LEANS[i], t),
      scale: sample(SCALES[i], t),
    };
  };
const bankPose = (ms: number): IsoPose => ({
  scale: [1, 1, sample(DIPS, cycle(ms))],
});
const cardPose = (ms: number): IsoPose => ({
  axis: "x",
  rotate: CARD.lean + sample(NUDGES, cycle(ms)),
});
const wavesPose = (ms: number): IsoPose => ({
  scale: sample(PULSES, cycle(ms)),
});

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const INK_STROKE: CSSProperties = {
  strokeWidth: "var(--iso-edge-w)",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};
const HAIRLINE: CSSProperties = {
  strokeWidth: "var(--iso-guide-w)",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/** An arched opening in face units: a rect with a semicircular top. */
const archPath = (x: number, y: number, w: number, h: number) => {
  const r = w / 2;
  const k = 0.5523 * r;
  return [
    `M${x} ${y + h}`,
    `V${y + r}`,
    `C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}`,
    `C${x + r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
};

/** The bank. Drawn before the coins; the arch is open, nothing hides a coin. */
const Bank = () => (
  <>
    <Box at={STEP1.at} palette="main" size={STEP1.size} />
    <Box at={STEP2.at} palette="main" size={STEP2.size} />
    <Box
      at={BODY.at}
      left={(w, h) => (
        <>
          {/* The arched door, dark. */}
          <path
            d={archPath(DOOR.x - BODY.at[0], h - DOOR.h, DOOR.w, DOOR.h)}
            fill="var(--iso-shadow)"
          />
          {/* A window either side. */}
          {[-2.75, 1.65].map((x) => (
            <rect
              fill="var(--iso-shadow)"
              height={1.3}
              key={x}
              rx={0.12}
              width={1.1}
              x={x - BODY.at[0]}
              y={h - DOOR.h + 0.25}
            />
          ))}
          {/* A course line under the entablature. */}
          <rect
            fill="var(--iso-ink)"
            height={0.05}
            opacity={0.35}
            width={w - 0.6}
            x={0.3}
            y={0.45}
          />
        </>
      )}
      palette="main"
      size={BODY.size}
    />
    {COLUMN_XS.map((x) => (
      <g key={x}>
        <Box
          at={[x, COLUMN.y, FLOOR_Z]}
          palette="main"
          size={[COLUMN.w, COLUMN.w, COLUMN.h - CAPITAL.h]}
        />
        <Box
          at={[
            x - CAPITAL.pad,
            COLUMN.y - CAPITAL.pad,
            FLOOR_Z + COLUMN.h - CAPITAL.h,
          ]}
          palette="main"
          size={[
            COLUMN.w + 2 * CAPITAL.pad,
            COLUMN.w + 2 * CAPITAL.pad,
            CAPITAL.h,
          ]}
        />
      </g>
    ))}
    <Box at={ENTABLATURE.at} palette="main" size={ENTABLATURE.size} />
    {/* The pediment: a triangle standing on the entablature's front. */}
    <Extrude
      at={PEDIMENT_AT}
      d={`M0 ${PEDIMENT.h} L${PEDIMENT.w} ${PEDIMENT.h} L${PEDIMENT.w / 2} 0 Z`}
      depth={PEDIMENT.depth}
      palette="main"
      plane="left"
    >
      <Face at={PEDIMENT_AT} plane="left">
        <circle
          cx={PEDIMENT.w / 2}
          cy={PEDIMENT.h * 0.62}
          fill="var(--iso-shadow)"
          r={0.42}
        />
      </Face>
    </Extrude>
  </>
);

/** A coin: a small disc in the coin tone with a rim and its glyph. */
const Coin = ({ spot, glyph }: { spot: Vec3; glyph: string }) => {
  const at: Vec3 = [spot[0] - COIN.r, spot[1], spot[2] + COIN.r * 2];
  const inset = 0.14;
  const rim = roundedRect(
    COIN.r * 2 - inset * 2,
    COIN.r * 2 - inset * 2,
    COIN.r - inset,
    inset,
    inset
  );
  return (
    <Extrude
      at={at}
      d={roundedRect(COIN.r * 2, COIN.r * 2, COIN.r)}
      depth={COIN.depth}
      palette="surface"
      plane="left"
    >
      <FacePath
        at={at}
        d={rim}
        fill="none"
        plane="left"
        stroke="var(--iso-ink)"
        style={HAIRLINE}
      />
      <Face at={at} plane="left">
        <text
          fill="var(--iso-screen)"
          fontSize={0.66}
          fontWeight={800}
          textAnchor="middle"
          x={COIN.r}
          y={COIN.r + 0.24}
        >
          {glyph}
        </text>
      </Face>
    </Extrude>
  );
};

/** Formats a whole-dollar amount with thousands separators. */
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Three contactless arcs, as quadratics, opening to the right. */
const wavesPath = (cx: number, cy: number) =>
  [0.3, 0.54, 0.78]
    .map(
      (r) =>
        `M${cx - r * 0.7} ${cy - r * 0.7} Q${cx + r * 0.3} ${cy} ${cx - r * 0.7} ${cy + r * 0.7}`
    )
    .join(" ");

/**
 * The card, after Wise's: chip and contactless waves top-left, the
 * wordmark top-right, the balance bottom-left counting up by one credit
 * per landed coin with a "+credit" pill, the network's circles
 * bottom-right. Print in a deep shade of the card's own colour. Reads the
 * clock itself and re-renders only when the count or the pill changes.
 */
const BalanceCard = ({
  clock,
  still,
  brand,
  label,
  start,
  credit,
}: {
  clock: MotionValue<number> | undefined;
  still: boolean;
  brand: string;
  label: string;
  start: number;
  credit: number;
}) => {
  const idle = useMotionValue(0);
  const [count, setCount] = useState(still ? COUNT : 0);
  const [pill, setPill] = useState(false);
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const t = cycle(ms);
    const n = landed(t);
    if (n !== count) {
      setCount(n);
    }
    const last = n > 0 ? landAt(n - 1) : -1;
    const show = n > 0 && t - last < TIMING.pill;
    if (show !== pill) {
      setPill(show);
    }
  });
  const amount = start + count * credit;
  return (
    <Rig
      axis="x"
      clock={clock}
      pivot={CARD_PIVOT}
      pose={still ? undefined : cardPose}
      rotate={CARD.lean}
    >
      <Extrude
        at={CARD_AT}
        d={roundedRect(CARD.w, CARD.h, CARD.radius)}
        depth={CARD.depth}
        palette="accent"
        plane="left"
      >
        <Face at={CARD_AT} plane="left">
          {/* Chip. */}
          <rect
            fill="var(--iso-screen)"
            height={0.66}
            rx={0.15}
            stroke="var(--iso-card-ink)"
            style={HAIRLINE}
            width={0.92}
            x={0.6}
            y={0.72}
          />
          <path
            d="M0.6 1.05 H1.52 M1.06 0.72 V1.38"
            fill="none"
            stroke="var(--iso-card-ink)"
            style={HAIRLINE}
          />
          {/* Wordmark. */}
          <text
            fill="var(--iso-card-ink)"
            fontSize={0.56}
            fontWeight={800}
            letterSpacing={-0.02}
            textAnchor="end"
            x={CARD.w - 0.6}
            y={1.12}
          >
            {brand}
          </text>
          {/* Balance. */}
          <text
            fill="var(--iso-card-ink)"
            fontSize={0.3}
            fontWeight={700}
            letterSpacing={0.08}
            opacity={0.75}
            x={0.6}
            y={2.45}
          >
            {label.toUpperCase()}
          </text>
          <text
            fill="var(--iso-card-ink)"
            fontSize={0.92}
            fontWeight={800}
            letterSpacing={-0.02}
            style={{ fontVariantNumeric: "tabular-nums" }}
            x={0.56}
            y={3.45}
          >
            {dollars(amount)}
          </text>
          <g style={{ opacity: pill ? 1 : 0, transition: "opacity 0.2s ease" }}>
            <rect
              fill="var(--iso-card-ink)"
              height={0.6}
              rx={0.3}
              width={1.75}
              x={CARD.w - 2.35}
              y={1.5}
            />
            <text
              fill="var(--iso-accent)"
              fontSize={0.34}
              fontWeight={800}
              textAnchor="middle"
              x={CARD.w - 1.475}
              y={1.92}
            >
              {`+${dollars(credit)}`}
            </text>
          </g>
          {/* Network circles. */}
          <circle
            cx={CARD.w - 1.25}
            cy={CARD.h - 0.68}
            fill="var(--iso-card-ink)"
            opacity={0.55}
            r={0.32}
          />
          <circle
            cx={CARD.w - 0.82}
            cy={CARD.h - 0.68}
            fill="var(--iso-card-ink)"
            opacity={0.35}
            r={0.32}
          />
        </Face>
      </Extrude>
      {/* Contactless waves, pulsing on each credit. Their own rig so they grow in place. */}
      <Rig
        clock={clock}
        pivot={WAVES_PIVOT}
        pose={still ? undefined : wavesPose}
      >
        <FacePath
          at={CARD_AT}
          d={wavesPath(WAVES.u, WAVES.v)}
          fill="none"
          plane="left"
          stroke="var(--iso-card-ink)"
          strokeLinecap="round"
          style={INK_STROKE}
        />
      </Rig>
    </Rig>
  );
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
 * Stage overrides: the bank a pastel of the brand (toward white in both
 * themes), the card in the accent (the lit thing) with its print in a deep
 * shade of that colour, the coins in their own tone through the otherwise
 * unused surface palette, the door in the tone's deepest shade.
 */
const stageStyle = (line: boolean, coinTone: string) =>
  ({
    "--iso-accent-base": "var(--iso-accent)",
    "--iso-card-ink": "oklch(from var(--iso-accent) 0.3 calc(c * 0.6) h)",
    "--iso-contour-w": line ? undefined : "0",
    "--iso-main-base": "color-mix(in oklab, var(--iso-tone) 46%, white)",
    "--iso-shadow": "oklch(from var(--iso-tone) 0.2 calc(c * 0.6) h)",
    "--iso-surface-base": coinTone,
  }) as CSSProperties;

/** The frame's shell: in view, reduced motion, the clock and the camera. */
const useHero = ({
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
  const clock = useClock(inView && !still);
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  return { camera, orbitProps, ref, rig: still ? undefined : clock, still };
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface BankDepositProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. The bank is a pastel of it. */
  tone?: IsoTone;
  /** Colour of the card. Default a lime green, `oklch(0.88 0.2 128)`. */
  accent?: IsoTone;
  /** Wordmark printed top-right on the card, up to about 8 characters. */
  cardBrand?: string;
  /** Colour of the coins. Default an amber, `oklch(0.8 0.16 80)`. */
  coinTone?: string;
  /** Glyph on the coins, one character. */
  glyph?: string;
  /** Label above the balance, up to about 12 characters. */
  label?: string;
  /** Balance at the start of each cycle, in whole dollars. */
  start?: number;
  /** Credit per coin, in whole dollars. */
  credit?: number;
  /** Flat ink drawing (default), soft tint, full colour, or blueprint outline. */
  variant?: IsoVariant;
  /** Line weight: in `ink` 0.3 is a 1.3 px outline at any size. */
  strokeWidth?: number;
  /** Coins deposit while in view, five per cycle. Off holds the coins at their spots and the total on the card. */
  autoPlay?: boolean;
  /** No shadow (default), or the soft cast shadow. */
  shadow?: "soft" | "none";
  /** Dashed construction grid on the floor. Off by default for a hero. */
  grid?: boolean;
  /**
   * Let the viewer turn the scene: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default 20. */
  orbit?: IsoOrbit;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

/**
 * Bank deposit, in isometric ink: a small bank (steps, a hall with an
 * arched door, two columns and a pediment) in a pastel of the brand, five
 * coins standing on the ground beside it, and a debit card after Wise's
 * leaning on the left with the balance on its face. One by one the coins
 * leap through the arch on an arc, the bank dips, the balance counts up by
 * a credit, the amount pops and the card's contactless waves pulse. One
 * even outline, the camera leans with the pointer. Follows the shadcn
 * theme.
 */
export const BankDeposit = ({
  tone = "primary",
  accent = "oklch(0.88 0.2 128)",
  cardBrand = "wise",
  coinTone = "oklch(0.8 0.16 80)",
  glyph = "$",
  label = "Balance",
  start = 1240,
  credit = 25,
  variant = "ink",
  strokeWidth = 0.3,
  autoPlay = true,
  shadow = "none",
  grid = false,
  rotate = "pointer",
  orbit = DEFAULT_ORBIT,
  title,
  className,
}: BankDepositProps) => {
  const { camera, orbitProps, ref, rig, still } = useHero({
    autoPlay,
    orbit,
    rotate,
  });
  const line = variant === "line";
  return (
    <div
      {...turnableLabel(rotate, title)}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-slot="bank-deposit"
      ref={ref}
      {...orbitProps}
    >
      <IsoStage
        accent={accent}
        bounds={BOUNDS}
        camera={camera}
        casts={CASTS}
        orbit={rotate === "off" ? 0 : orbit}
        shadow={shadow === "soft"}
        strokeWidth={strokeWidth}
        style={stageStyle(line, coinTone)}
        title={title}
        tone={tone}
        variant={variant}
      >
        {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
        <BalanceCard
          brand={cardBrand}
          clock={rig}
          credit={credit}
          label={label}
          start={start}
          still={still}
        />
        <Rig clock={rig} pivot={[0, 0, 0]} pose={still ? undefined : bankPose}>
          <Bank />
        </Rig>
        {SPOTS.map((spot, i) => (
          <Rig
            clock={rig}
            key={spot.join(",")}
            pivot={[spot[0], spot[1] + COIN.depth / 2, spot[2] + COIN.r]}
            pose={still ? undefined : coinPose(i)}
          >
            <Coin glyph={glyph} spot={spot} />
          </Rig>
        ))}
      </IsoStage>
    </div>
  );
};

export default BankDeposit;
