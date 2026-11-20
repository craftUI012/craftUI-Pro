"use client";

import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * OPTICAL CENTRING: a ~15s explainer, played once on load (R replays).
 * The times below are at PACE 1; every beat is multiplied by PACE.
 * Recorded by hand; nothing here renders video.
 *
 *     0ms   the two buttons as they were: icons centred by their box
 *   600ms   "Centred by its box"; red crosshair draws through each circle
 *  1400ms   the icon's 24-unit box draws (red dashed), centre 12.00, 12.00
 *  2600ms   "But the eye weighs the shape"; blue weight dot + its value
 *  3800ms   the offset, in real px at 14px
 *  5600ms   every line and value fades out
 *  6400ms   the "Optical centring" toggle fades in
 *  7400ms   toggle on: "Nudge by the weight"; icons spring by the nudge
 *  9200ms   lines draw again: blue weight dots now sit on the red cross
 * 11000ms   "Optically centred"; hold
 *
 * Scale: the real button is 28px with a 14px icon. Here the icon is
 * 160px (×11.43), so 0.5px of nudge shows as 5.7px. Every number on
 * screen is the real measured value at 14px.
 * ───────────────────────────────────────────────────────── */

// The storyboard as data: [stage, starts at ms]. A stage's number is
// its place in this list.
const TIMELINE = [
  ["start", 0],
  ["crosshair", 600],
  ["box", 1400],
  ["weight", 2600],
  ["offset", 3800],
  ["clear", 5600],
  ["toggle", 6400],
  ["nudge", 7400],
  ["verify", 9200],
  ["end", 11_000],
] as const;

type StageName = (typeof TIMELINE)[number][0];

const S = Object.fromEntries(
  TIMELINE.map(([name], index) => [name, index])
) as Record<StageName, number>;

const CIRCLE = 320;
const ICON = 160;
// px per icon-grid unit
const UNIT = ICON / 24;
// this drawing vs the real 14px icon
const SCALE = ICON / 14;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_OUT_CUBIC = [0.215, 0.61, 0.355, 1] as const;
// One knob for the whole piece: beats and animations stretch together.
// 1 = the first cut (about 13s); 1.25 = a touch slower (about 15.5s).
const PACE = 1.25;

const DRAW = { duration: 0.6 * PACE, ease: EASE_OUT_CUBIC };
const FADE = { duration: 0.3 * PACE, ease: EASE_OUT };
const NUDGE = {
  bounce: 0,
  type: "spring" as const,
  visualDuration: 0.6 * PACE,
};
const TOGGLE = { bounce: 0, duration: 0.3 * PACE, type: "spring" as const };
const CAPTION = { duration: 0.45 * PACE, ease: EASE_OUT_CUBIC };

interface Glyph {
  key: string;
  name: string;
  icon: IconSvgElement;
  /** Visual weight, in the 24-unit grid (measured as filled shapes). */
  weight: [number, number];
  /** Offset at the real 14px size, in px. */
  offset: string;
  /** The correction applied at 14px, in px. */
  nudge: [number, number];
}

const GLYPHS: Glyph[] = [
  {
    icon: PencilEdit02Icon,
    key: "edit",
    name: "Edit",
    nudge: [0.5, -0.5],
    offset: "0.41px left, 0.38px low",
    weight: [11.29, 12.66],
  },
  {
    icon: Delete02Icon,
    key: "trash",
    name: "Remove",
    nudge: [0, -0.25],
    offset: "0.17px low",
    weight: [11.97, 12.29],
  },
];

const CAPTIONS: { from: number; text: string }[] = [
  { from: S.crosshair, text: "Centred by its box" },
  { from: S.weight, text: "But the eye weighs the shape" },
  { from: S.nudge, text: "Nudge by the weight" },
  { from: S.end, text: "Optically centred" },
];

// How far the crosshair runs past the circle (short of the values).
const REACH = 20;

const RED = "#f87171";
const BLUE = "#60a5fa";

const fmt = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

const useStage = () => {
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setStage(0);
    // 800ms of stillness first, so a recording starts on a clean frame.
    const timers = TIMELINE.map(([, at], index) =>
      setTimeout(() => setStage(index), at * PACE + 800)
    );
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [run]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "r" || event.key === "R") {
        setRun((value) => value + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return stage;
};

const Line = ({
  x1,
  y1,
  x2,
  y2,
  color,
  show,
  delay = 0,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  show: boolean;
  delay?: number;
}) => (
  <motion.line
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={color}
    strokeWidth={1.5}
    strokeDasharray="6 6"
    // Drawn by scaling out from its middle, not pathLength: pathLength
    // takes over stroke-dasharray and the dashes would turn solid.
    style={{ transformBox: "fill-box", transformOrigin: "center" }}
    initial={false}
    animate={{
      opacity: show ? 1 : 0,
      [y1 === y2 ? "scaleX" : "scaleY"]: show ? 1 : 0,
    }}
    transition={show ? { ...DRAW, delay } : FADE}
  />
);

const Guides = ({
  glyph,
  stage,
  nudged,
}: {
  glyph: Glyph;
  stage: number;
  nudged: boolean;
}) => {
  const c = CIRCLE / 2;
  const first = stage >= S.crosshair && stage < S.clear;
  const again = stage >= S.verify;
  const cross = first || again;
  const box = stage >= S.box && stage < S.clear;
  const weight = (stage >= S.weight && stage < S.clear) || again;
  // Where the weight sits now, in this drawing's px.
  const shift = nudged ? glyph.nudge.map((value) => value * SCALE) : [0, 0];
  const wx = c + (glyph.weight[0] - 12) * UNIT + (shift[0] ?? 0);
  const wy = c + (glyph.weight[1] - 12) * UNIT + (shift[1] ?? 0);
  const half = ICON / 2;

  return (
    <svg
      aria-hidden
      width={CIRCLE}
      height={CIRCLE}
      className="pointer-events-none absolute inset-0 overflow-visible"
    >
      <Line
        x1={-REACH}
        y1={c}
        x2={CIRCLE + REACH}
        y2={c}
        color={RED}
        show={cross}
      />
      <Line
        x1={c}
        y1={-REACH}
        x2={c}
        y2={CIRCLE + REACH}
        color={RED}
        show={cross}
        delay={0.1}
      />
      <motion.rect
        x={c - half}
        y={c - half}
        width={ICON}
        height={ICON}
        rx={4}
        fill="none"
        stroke={RED}
        strokeWidth={1.5}
        strokeDasharray="4 6"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={false}
        animate={{ opacity: box ? 0.8 : 0, scale: box ? 1 : 0.92 }}
        transition={box ? DRAW : FADE}
      />
      <motion.circle
        cx={c}
        cy={c}
        r={4}
        fill={RED}
        initial={false}
        animate={{ opacity: box ? 1 : 0, scale: box ? 1 : 0 }}
        transition={FADE}
      />
      <motion.circle
        r={7}
        fill={BLUE}
        stroke="#0a0a0a"
        strokeWidth={2}
        initial={false}
        animate={{
          cx: wx,
          cy: wy,
          opacity: weight ? 1 : 0,
          scale: weight ? 1 : 0,
        }}
        transition={{ cx: NUDGE, cy: NUDGE, default: FADE }}
      />
    </svg>
  );
};

const Values = ({ glyph, stage }: { glyph: Glyph; stage: number }) => {
  const rows: { color: string; text: string; key: string }[] = [];
  if (stage >= S.box && stage < S.clear) {
    rows.push({ color: RED, key: "box", text: "box centre 12.00, 12.00" });
  }
  if (stage >= S.weight && stage < S.clear) {
    rows.push({
      color: BLUE,
      key: "weight",
      text: `weight ${glyph.weight[0].toFixed(2)}, ${glyph.weight[1].toFixed(2)}`,
    });
  }
  if (stage >= S.offset && stage < S.clear) {
    rows.push({ color: "#e5e5e5", key: "off", text: `off by ${glyph.offset}` });
  }
  if (stage >= S.nudge) {
    rows.push({
      color: "#e5e5e5",
      key: "nudge",
      text: `nudge x ${fmt(glyph.nudge[0])} y ${fmt(glyph.nudge[1])} px`,
    });
  }
  return (
    <div className="flex h-24 flex-col items-center gap-1.5 font-mono text-sm">
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <motion.p
            key={row.key}
            layout="position"
            initial={{ filter: "blur(6px)", opacity: 0, y: 6 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            exit={{ filter: "blur(6px)", opacity: 0 }}
            transition={FADE}
            style={{ color: row.color }}
          >
            {row.text}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
};

const Button = ({ glyph, stage }: { glyph: Glyph; stage: number }) => {
  const nudged = stage >= S.nudge;
  return (
    <div className="flex flex-col items-center gap-8">
      <div
        className="relative flex items-center justify-center rounded-full bg-[#1c1c1c]"
        style={{ height: CIRCLE, width: CIRCLE }}
      >
        <motion.span
          className="flex text-[#a3a3a3]"
          initial={false}
          animate={{
            x: nudged ? glyph.nudge[0] * SCALE : 0,
            y: nudged ? glyph.nudge[1] * SCALE : 0,
          }}
          transition={NUDGE}
        >
          <HugeiconsIcon
            icon={glyph.icon}
            strokeWidth={1.75}
            style={{ height: ICON, width: ICON }}
          />
        </motion.span>
        <Guides glyph={glyph} stage={stage} nudged={nudged} />
      </div>
      <Values glyph={glyph} stage={stage} />
    </div>
  );
};

const Toggle = ({ stage }: { stage: number }) => {
  const on = stage >= S.nudge;
  return (
    <motion.div
      initial={false}
      animate={{
        filter: stage >= S.toggle ? "blur(0px)" : "blur(6px)",
        opacity: stage >= S.toggle ? 1 : 0,
      }}
      transition={FADE}
      className="flex items-center gap-3 text-sm text-[#d4d4d4]"
    >
      <span>Optical centring</span>
      <span
        className="relative h-6 w-11 rounded-full transition-colors duration-[375ms]"
        style={{ background: on ? "#2563eb" : "#3f3f46" }}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white"
          initial={false}
          animate={{ x: on ? 20 : 0 }}
          transition={TOGGLE}
        />
      </span>
    </motion.div>
  );
};

const Caption = ({ stage }: { stage: number }) => {
  const caption = CAPTIONS.findLast((each) => stage >= each.from);
  return (
    <div className="relative h-9 overflow-hidden text-center text-2xl font-medium text-[#f5f5f5]">
      <AnimatePresence initial={false} mode="popLayout">
        {caption ? (
          <motion.p
            key={caption.text}
            initial={{ filter: "blur(6px)", opacity: 0, y: "60%" }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            exit={{ filter: "blur(6px)", opacity: 0, y: "-60%" }}
            transition={CAPTION}
          >
            {caption.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const Page = () => {
  const stage = useStage();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-14 bg-[#0a0a0a] px-6 py-12 antialiased">
      <Caption stage={stage} />
      <div className="flex flex-wrap items-start justify-center gap-24">
        {GLYPHS.map((glyph) => (
          <Button key={glyph.key} glyph={glyph} stage={stage} />
        ))}
      </div>
      <Toggle stage={stage} />
      {/* Only before it starts and once it ends, so it's out of the take. */}
      <motion.p
        initial={false}
        animate={{ opacity: stage === 0 || stage === S.end ? 1 : 0 }}
        transition={FADE}
        className="fixed right-4 bottom-3 text-xs text-[#525252]"
      >
        R to replay
      </motion.p>
    </main>
  );
};

export default Page;
