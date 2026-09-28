"use client";

import { Monitor, Moon, Smartphone, Sun, Tablet } from "lucide-react";
import {
  animate,
  cubicBezier,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { Transition } from "motion/react";
import { useTheme } from "next-themes";
import * as React from "react";

import type { FeatureId } from "@/components/hero-features/features-data";
import { FEATURES } from "@/components/hero-features/features-data";
import type { DeviceId } from "@/components/hero-templates/templates-data";
import { DEVICES } from "@/components/hero-templates/templates-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// One minimal illustration per feature, each making a single point. Drawn on
// a 400 x 300 canvas with theme tokens (fill-*/stroke-* classes), so they
// follow light and dark. Each loops gently while shown and holds a still,
// representative frame with reduced motion.

const VIEW = "0 0 400 300";
// The screens ring sliding between devices.
const DEVICE_RING: Transition = { bounce: 0, duration: 0.45, type: "spring" };
const MONO = "var(--font-mono)";

const Canvas = ({
  children,
  label,
  view = VIEW,
}: {
  children: React.ReactNode;
  label: string;
  // A crop of the 400 x 300 canvas, for drawings shown in small tiles.
  view?: string;
}) => (
  <svg
    viewBox={view}
    role="img"
    aria-label={label}
    className="size-full"
    fill="none"
  >
    {children}
  </svg>
);

// ── Accessibility: four details, shown together in a bento ───────────────

// Tab order: a focus ring stepping across three controls as Tab is pressed.
const PILLS = [55, 155, 255] as const;

const TabOrderVisual = () => {
  const still = useReducedMotion();
  const loop = {
    duration: 3.2,
    ease: "easeInOut",
    repeat: Infinity,
    repeatType: "reverse",
  } as const;

  return (
    <Canvas
      view="30 72 340 186"
      label="A focus ring moving from one button to the next as the Tab key is pressed"
    >
      {PILLS.map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={100}
            width={90}
            height={40}
            rx={12}
            className="fill-background stroke-foreground/15"
          />
          <rect
            x={x + 25}
            y={117}
            width={40}
            height={6}
            rx={3}
            className="fill-muted-foreground/35"
          />
        </g>
      ))}
      {/* Ring radius 18 = control radius 12 + 6 offset (concentric). */}
      <m.rect
        x={49}
        y={94}
        width={102}
        height={52}
        rx={18}
        strokeWidth={3}
        className="stroke-brand"
        animate={still ? undefined : { x: [0, 0, 100, 100, 200, 200] }}
        transition={{ ...loop, times: [0, 0.2, 0.34, 0.54, 0.68, 1] }}
      />
      <m.g
        animate={still ? undefined : { y: [0, 0, 3, 0, 0, 3, 0, 0] }}
        transition={{
          ...loop,
          times: [0, 0.16, 0.22, 0.3, 0.5, 0.56, 0.64, 1],
        }}
      >
        <rect
          x={158}
          y={196}
          width={84}
          height={48}
          rx={10}
          className="fill-foreground/10"
        />
        <rect
          x={158}
          y={190}
          width={84}
          height={48}
          rx={10}
          className="fill-background stroke-foreground/15"
        />
        <text
          x={200}
          y={219}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={14}
          className="fill-muted-foreground"
        >
          tab
        </text>
      </m.g>
    </Canvas>
  );
};

// Press: a button giving to 0.96 under a tap, then springing back.
const PressVisual = () => {
  const still = useReducedMotion();
  const loop: Transition = {
    duration: 1.8,
    ease: "easeOut",
    repeat: Infinity,
    times: [0, 0.35, 0.42, 0.62, 0.72, 1],
  };

  return (
    <Canvas
      view="80 84 240 158"
      label="A button scaling down slightly as it's tapped, then back up"
    >
      <m.g
        style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
        animate={still ? undefined : { scale: [1, 1, 0.96, 0.96, 1, 1] }}
        transition={loop}
      >
        <rect
          x={120}
          y={112}
          width={160}
          height={52}
          rx={14}
          className="fill-brand"
        />
        <text
          x={200}
          y={143}
          textAnchor="middle"
          fontSize={16}
          fontWeight={500}
          className="fill-brand-foreground"
        >
          Continue
        </text>
      </m.g>
      <m.circle
        cx={236}
        cy={150}
        r={18}
        className="fill-foreground/10 stroke-foreground/25"
        style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
        animate={
          still
            ? { opacity: 0 }
            : { opacity: [0, 0, 1, 1, 0, 0], scale: [1.3, 1.3, 1, 1, 1.1, 1.1] }
        }
        transition={loop}
      />
      <text
        x={200}
        y={212}
        textAnchor="middle"
        fontFamily={MONO}
        fontSize={17}
        className="fill-muted-foreground"
      >
        scale 0.96
      </text>
    </Canvas>
  );
};

// Optical padding: a button with a leading icon, drawn at 2x. The icon side
// keeps 12px; the label side gets 13px so the label doesn't look crowded
// toward the edge.
const BTN = { h: 60, w: 220, x: 90, y: 100 } as const;
const ICON_PAD = 24;
const TEXT_PAD = 26;

const Guide = ({
  from,
  label,
  strong,
  to,
}: {
  from: number;
  label: string;
  strong?: boolean;
  to: number;
}) => {
  const y = BTN.y + BTN.h + 24;

  return (
    <g className={strong ? "stroke-brand" : "stroke-foreground/30"}>
      <path
        d={`M${from} ${y - 5} v10 M${to} ${y - 5} v10 M${from} ${y} H${to}`}
      />
      <text
        x={(from + to) / 2}
        y={y + 22}
        textAnchor="middle"
        fontFamily={MONO}
        fontSize={17}
        stroke="none"
        className={strong ? "fill-brand-text" : "fill-muted-foreground"}
      >
        {label}
      </text>
    </g>
  );
};

const OpticalVisual = () => (
  <Canvas
    view="66 80 268 160"
    label="A button with an icon on the left: 12 pixels of padding on the icon side and 13 on the label side"
  >
    <rect
      x={BTN.x}
      y={BTN.y}
      width={BTN.w}
      height={BTN.h}
      rx={14}
      className="fill-background stroke-foreground/15"
    />
    {/* Leading icon (a plus) and the label bar. */}
    <path
      d={`M${BTN.x + ICON_PAD + 10} ${BTN.y + 20} v20 M${BTN.x + ICON_PAD} ${BTN.y + 30} h20`}
      strokeWidth={2.5}
      strokeLinecap="round"
      className="stroke-foreground"
    />
    <rect
      x={BTN.x + ICON_PAD + 34}
      y={BTN.y + 25}
      width={BTN.w - ICON_PAD - 34 - TEXT_PAD}
      height={10}
      rx={5}
      className="fill-foreground/70"
    />
    <path
      d={`M${BTN.x + ICON_PAD} ${BTN.y} V${BTN.y + BTN.h} M${BTN.x + BTN.w - TEXT_PAD} ${BTN.y} V${BTN.y + BTN.h}`}
      strokeDasharray="3 4"
      className="stroke-brand/40"
    />
    <Guide from={BTN.x} to={BTN.x + ICON_PAD} label="12" />
    <Guide
      from={BTN.x + BTN.w - TEXT_PAD}
      to={BTN.x + BTN.w}
      label="13"
      strong
    />
  </Canvas>
);

// Hit area: a small 32px icon button whose target reaches 40px, drawn at
// 3x (96 inside 120) so the extra 4px margin is visible. A pointer lands in
// that margin, outside the button, and still hovers it.
const CURSOR =
  "M0 0 L0 17 L4.6 12.6 L7.8 19.6 L10.4 18.5 L7.3 11.7 L13.4 11.7 Z";
const HIT = { button: 96, target: 120, x: 140, y: 70 } as const;
const HIT_MARGIN = (HIT.target - HIT.button) / 2;

const HitAreaVisual = () => {
  const still = useReducedMotion();
  const loop: Transition = {
    duration: 3,
    ease: "easeInOut",
    repeat: Infinity,
    times: [0, 0.35, 0.75, 1],
  };
  // Pointer tip in the right-hand margin, level with the button's center.
  const tip = {
    x: HIT.x + HIT.target - HIT_MARGIN / 2,
    y: HIT.y + HIT.target / 2,
  };

  return (
    <Canvas
      view="112 52 200 200"
      label="A small icon button with a larger dashed area around it: pointing in that extra margin still reaches the button"
    >
      <rect
        x={HIT.x}
        y={HIT.y}
        width={HIT.target}
        height={HIT.target}
        rx={26}
        strokeDasharray="6 6"
        strokeWidth={2}
        className="fill-brand/10 stroke-brand"
      />
      <m.rect
        x={HIT.x + HIT_MARGIN}
        y={HIT.y + HIT_MARGIN}
        width={HIT.button}
        height={HIT.button}
        rx={20}
        strokeWidth={1.5}
        className="stroke-foreground/25"
        animate={
          still
            ? undefined
            : {
                fill: [
                  "var(--color-background)",
                  "var(--color-background)",
                  "var(--color-accent)",
                  "var(--color-background)",
                ],
              }
        }
        initial={{ fill: "var(--color-background)" }}
        transition={loop}
      />
      <path
        d={`M${HIT.x + 45} ${HIT.y + 45} l30 30 M${HIT.x + 75} ${HIT.y + 45} l-30 30`}
        strokeWidth={3.5}
        strokeLinecap="round"
        className="stroke-foreground"
      />
      <m.path
        d={CURSOR}
        className="fill-foreground stroke-background"
        strokeWidth={1.4}
        style={{ originX: 0, originY: 0, scale: 1.4 }}
        initial={{ x: tip.x, y: tip.y }}
        animate={
          still
            ? undefined
            : {
                x: [tip.x + 40, tip.x, tip.x, tip.x + 40],
                y: [tip.y + 50, tip.y, tip.y, tip.y + 50],
              }
        }
        transition={loop}
      />
      <text
        x={HIT.x + HIT.target / 2}
        y={HIT.y + HIT.target + 34}
        textAnchor="middle"
        fontFamily={MONO}
        fontSize={17}
        className="fill-muted-foreground"
      >
        32 → 40 px
      </text>
    </Canvas>
  );
};

const SUB_VISUALS = {
  hit: HitAreaVisual,
  optical: OpticalVisual,
  press: PressVisual,
  tab: TabOrderVisual,
} as const;

const [ACCESSIBILITY] = FEATURES;

// Bento placement on a 5-column grid: wide tiles take 3 columns, compact
// ones 2, alternating by row. Tile radius 12 = panel radius 24 - 12 padding
// (concentric).
const Bento = <Id extends string>({
  label,
  spans,
  subs,
  visuals,
}: {
  label: string;
  spans: Record<Id, string>;
  subs: readonly { id: Id; label: string }[];
  visuals: Record<Id, () => React.ReactNode>;
}) => (
  <ul
    aria-label={label}
    className="grid size-full grid-cols-5 grid-rows-2 gap-2 p-3"
  >
    {subs.map((sub) => {
      const Sub: React.ComponentType = visuals[sub.id];

      return (
        <li
          key={sub.id}
          className={cn(
            "bg-muted/40 relative flex min-h-0 flex-col rounded-xl",
            spans[sub.id]
          )}
        >
          <span
            className={cn(
              TYPE.cardCaption,
              "text-muted-foreground absolute top-3 left-3.5"
            )}
          >
            {sub.label}
          </span>
          <div className="min-h-0 flex-1 px-2 pt-7 pb-2">
            <Sub />
          </div>
        </li>
      );
    })}
  </ul>
);

// All four accessibility details at once.
const AccessibilityVisual = () => (
  <Bento
    label="Accessibility details"
    subs={ACCESSIBILITY.visuals}
    visuals={SUB_VISUALS}
    spans={{
      hit: "col-span-2",
      optical: "col-span-3",
      press: "col-span-2",
      tab: "col-span-3",
    }}
  />
);

// ── Interaction: CSS ease-out against craftUI's curve, side by side ──────

// The two curves being compared. CRAFT mirrors --motion-ease-out.
const DEFAULT_EASE = [0, 0, 0.58, 1] as const;
const CRAFT_EASE = [0.23, 1, 0.32, 1] as const;
const defaultEase = cubicBezier(...DEFAULT_EASE);
const craftEase = cubicBezier(...CRAFT_EASE);

// One shared loop so every tile moves together: open, hold, close, rest.
// Slowed well below real UI timing (150-200ms) so the curves are visible.
const LOOP = { close: 0.35, holdUntil: 2, open: 0.8, total: 2.8 } as const;
const LOOP_TIMES = [
  0,
  LOOP.open / LOOP.total,
  LOOP.holdUntil / LOOP.total,
  (LOOP.holdUntil + LOOP.close) / LOOP.total,
  1,
];

const loopWith = (curve: readonly number[]): Transition => ({
  duration: LOOP.total,
  ease: [
    [...curve] as [number, number, number, number],
    "linear",
    [...curve] as [number, number, number, number],
    "linear",
  ],
  repeat: Infinity,
  times: LOOP_TIMES,
});

// Keyframes for the loop: from → to, hold, back, rest.
const cycle = <T,>(from: T, to: T) => [from, to, to, from, from];

const ROWS = [
  { curve: DEFAULT_EASE, label: "ease-out", top: 0 },
  { curve: CRAFT_EASE, label: "craftUI", top: 85 },
] as const;

type Row = (typeof ROWS)[number];

// Two rows, one per curve, with the row's label.
const CompareRows = ({
  children,
  label,
}: {
  children: (row: Row, craft: boolean) => React.ReactNode;
  label: string;
}) => (
  <Canvas view="0 0 260 170" label={label}>
    <line x1={0} x2={260} y1={85} y2={85} className="stroke-foreground/10" />
    {ROWS.map((row, index) => (
      <g key={row.label}>
        <text
          x={4}
          y={row.top + 16}
          fontFamily={MONO}
          fontSize={11}
          className={index === 1 ? "fill-brand-text" : "fill-muted-foreground"}
        >
          {row.label}
        </text>
        {children(row, index === 1)}
      </g>
    ))}
  </Canvas>
);

// Menu: the default scales up from 0.9 around its own center; craftUI's
// grows from 0.96 out of the trigger, on the stronger curve.
const MenuCompare = () => {
  const still = useReducedMotion();

  return (
    <CompareRows label="A menu opening twice: with the default ease-out it scales up from its center; with craftUI's curve it grows out of the button quickly and settles">
      {(row, craft) => (
        <>
          <rect
            x={20}
            y={row.top + 32}
            width={44}
            height={24}
            rx={7}
            className="fill-background stroke-foreground/20"
          />
          <rect
            x={30}
            y={row.top + 42}
            width={24}
            height={4}
            rx={2}
            className="fill-muted-foreground/40"
          />
          <m.g
            style={{
              originX: craft ? "0%" : "50%",
              originY: craft ? "0%" : "50%",
              transformBox: "fill-box",
            }}
            initial={still ? undefined : { opacity: 0 }}
            animate={
              still
                ? undefined
                : {
                    opacity: cycle(0, 1),
                    scale: cycle(craft ? 0.96 : 0.9, 1),
                  }
            }
            transition={loopWith(row.curve)}
          >
            <rect
              x={72}
              y={row.top + 24}
              width={150}
              height={54}
              rx={9}
              className="fill-background stroke-foreground/15"
            />
            {[0, 1, 2].map((line) => (
              <rect
                key={line}
                x={84}
                y={row.top + 34 + line * 13}
                width={line === 2 ? 70 : 110}
                height={5}
                rx={2.5}
                className="fill-muted-foreground/30"
              />
            ))}
          </m.g>
        </>
      )}
    </CompareRows>
  );
};

// Switch: the thumb travels 44 units and the track fills with brand. The
// longer the travel, the more the curves differ: the default glides across,
// craftUI's arrives almost at once and settles.
const TRACK = { h: 36, w: 84, x: 88 } as const;
const THUMB_TRAVEL = TRACK.w - TRACK.h;

const SwitchCompare = () => {
  const still = useReducedMotion();

  return (
    <CompareRows label="A switch turning on twice: with the default ease-out the thumb glides across; with craftUI's curve it gets there almost at once and settles">
      {(row) => (
        <>
          <rect
            x={TRACK.x}
            y={row.top + 32}
            width={TRACK.w}
            height={TRACK.h}
            rx={TRACK.h / 2}
            className="fill-muted"
          />
          <m.rect
            x={TRACK.x}
            y={row.top + 32}
            width={TRACK.w}
            height={TRACK.h}
            rx={TRACK.h / 2}
            className="fill-brand"
            initial={{ opacity: still ? 1 : 0 }}
            animate={still ? undefined : { opacity: cycle(0, 1) }}
            transition={loopWith(row.curve)}
          />
          <m.circle
            cx={TRACK.x + TRACK.h / 2}
            cy={row.top + 32 + TRACK.h / 2}
            r={TRACK.h / 2 - 4}
            // As the real Switch: a light thumb in both themes.
            className="fill-background dark:fill-primary-foreground"
            initial={{ x: still ? THUMB_TRAVEL : 0 }}
            animate={still ? undefined : { x: cycle(0, THUMB_TRAVEL) }}
            transition={loopWith(row.curve)}
          />
        </>
      )}
    </CompareRows>
  );
};

// Toast: the default slides up 24 units; craftUI's rises just 8 and
// arrives sooner, the quieter entrance.
const ToastCompare = () => {
  const still = useReducedMotion();
  const id = `toast-${React.useId().replaceAll(/[^\w-]/g, "")}`;

  return (
    <CompareRows label="A toast appearing twice: the default slides up a long way; craftUI's rises a little and settles sooner">
      {(row, craft) => (
        <>
          <defs>
            <clipPath id={`${id}-${row.top}`}>
              <rect x={0} y={row.top} width={260} height={85} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-${row.top})`}>
            <m.g
              initial={still ? undefined : { opacity: 0 }}
              animate={
                still
                  ? undefined
                  : { opacity: cycle(0, 1), y: cycle(craft ? 8 : 24, 0) }
              }
              transition={loopWith(row.curve)}
            >
              <rect
                x={60}
                y={row.top + 36}
                width={140}
                height={30}
                rx={15}
                className="fill-background stroke-foreground/15"
              />
              <circle cx={78} cy={row.top + 51} r={5} className="fill-brand" />
              <rect
                x={92}
                y={row.top + 48}
                width={90}
                height={6}
                rx={3}
                className="fill-muted-foreground/35"
              />
            </m.g>
          </g>
        </>
      )}
    </CompareRows>
  );
};

// The curves themselves: time across, progress up. Both dots run on the
// same clock as the other tiles.
const PLOT = { h: 110, w: 190, x: 44, y: 34 } as const;

const curvePath = ([x1, y1, x2, y2]: readonly number[]) =>
  `M${PLOT.x} ${PLOT.y + PLOT.h} C${PLOT.x + (x1 ?? 0) * PLOT.w} ${PLOT.y + PLOT.h - (y1 ?? 0) * PLOT.h} ${PLOT.x + (x2 ?? 0) * PLOT.w} ${PLOT.y + PLOT.h - (y2 ?? 0) * PLOT.h} ${PLOT.x + PLOT.w} ${PLOT.y}`;

const CurvesCompare = () => {
  const still = useReducedMotion();
  const time = useMotionValue(still ? 0.5 : 0);
  const x = useTransform(time, (t) => PLOT.x + t * PLOT.w);
  const defaultY = useTransform(
    time,
    (t) => PLOT.y + PLOT.h - defaultEase(t) * PLOT.h
  );
  const craftY = useTransform(
    time,
    (t) => PLOT.y + PLOT.h - craftEase(t) * PLOT.h
  );

  React.useEffect(() => {
    if (still) {
      return;
    }

    const controls = animate(time, cycle(0, 1), {
      duration: LOOP.total,
      ease: "linear",
      repeat: Infinity,
      times: LOOP_TIMES,
    });

    return () => controls.stop();
  }, [still, time]);

  return (
    <Canvas
      view="0 0 260 170"
      label="The two curves plotted: CSS ease-out rises gradually; craftUI's curve rises almost at once, then settles"
    >
      <path
        d={`M${PLOT.x} ${PLOT.y - 6} V${PLOT.y + PLOT.h} H${PLOT.x + PLOT.w + 6}`}
        className="stroke-foreground/15"
      />
      <path
        d={curvePath(DEFAULT_EASE)}
        strokeWidth={2}
        className="stroke-muted-foreground/60"
      />
      <path
        d={curvePath(CRAFT_EASE)}
        strokeWidth={2}
        className="stroke-brand"
      />
      <m.circle cx={x} cy={defaultY} r={5} className="fill-muted-foreground" />
      <m.circle cx={x} cy={craftY} r={5} className="fill-brand" />
      <text
        x={PLOT.x + 8}
        y={PLOT.y + 4}
        fontFamily={MONO}
        fontSize={11}
        className="fill-brand-text"
      >
        craftUI
      </text>
      <text
        x={PLOT.x + PLOT.w - 4}
        y={PLOT.y + PLOT.h - 8}
        textAnchor="end"
        fontFamily={MONO}
        fontSize={11}
        className="fill-muted-foreground"
      >
        ease-out
      </text>
      <text
        x={PLOT.x + PLOT.w + 6}
        y={PLOT.y + PLOT.h + 20}
        textAnchor="end"
        fontFamily={MONO}
        fontSize={10}
        className="fill-muted-foreground/70"
      >
        slowed down to show
      </text>
    </Canvas>
  );
};

const INTERACTION_VISUALS = {
  curves: CurvesCompare,
  menu: MenuCompare,
  switch: SwitchCompare,
  toast: ToastCompare,
} as const;

// Themes: a real form built from the kit, with a Light / Dark toggle on
// top. The toggle re-themes only this panel (a .light or .dark scope; see
// globals.css) and starts on the site's current theme.
type Mode = "dark" | "light";

const ThemeVisual = () => {
  const { resolvedTheme } = useTheme();
  const [mode, setMode] = React.useState<Mode>("light");

  // Start on, and follow, the site's theme.
  React.useEffect(() => {
    if (resolvedTheme === "dark" || resolvedTheme === "light") {
      setMode(resolvedTheme);
    }
  }, [resolvedTheme]);

  return (
    <div
      className={cn(
        mode,
        // Colors ease across the swap instead of snapping.
        "bg-background text-foreground flex size-full flex-col items-center justify-center gap-5 p-6 transition-colors duration-300 ease-out-strong [&_*]:transition-[background-color,border-color,color,box-shadow] [&_*]:duration-300 [&_*]:ease-out-strong motion-reduce:[&_*]:transition-none"
      )}
    >
      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(value) => value && setMode(value as Mode)}
        aria-label="Theme of this preview"
      >
        <ToggleGroupItem value="light" className="gap-2 px-3">
          <Sun />
          Light
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" className="gap-2 px-3">
          <Moon />
          Dark
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="flex w-full max-w-xl items-stretch justify-center gap-3">
        <form
          aria-label="Sample sign-up form"
          onSubmit={(event) => event.preventDefault()}
          className="bg-card flex min-w-0 flex-1 flex-col gap-4 rounded-2xl p-5 shadow-card"
        >
          <div className="flex flex-col gap-1">
            <span className={TYPE.cardHeader}>Create your account</span>
            <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
              Free for 14 days. No card needed.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="theme-demo-email" className={TYPE.cardLabel}>
              Work email
            </Label>
            <Input
              id="theme-demo-email"
              type="email"
              placeholder="name@company.com"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="theme-demo-updates" defaultChecked />
            <Label
              htmlFor="theme-demo-updates"
              className={cn(TYPE.cardLabel, "font-normal")}
            >
              Send me product updates
            </Label>
          </div>
          <Button type="submit">Create account</Button>
        </form>
        {/* A second kind of component, so the toggle shows the whole kit
          re-theming, not just a form. Hidden where the panel is too narrow. */}
        <div className="bg-card hidden w-44 shrink-0 flex-col gap-4 rounded-2xl p-5 shadow-card sm:flex">
          <div className="flex items-center justify-between">
            <span className={TYPE.cardHeader}>Plan</span>
            <Badge>Pro</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <span className={cn(TYPE.cardMetric, "tabular-nums")}>68%</span>
            <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
              of seats in use
            </span>
            <Progress value={68} aria-label="Seats in use" />
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <Label
              htmlFor="theme-demo-renew"
              className={cn(TYPE.cardLabel, "font-normal")}
            >
              Auto-renew
            </Label>
            <Switch id="theme-demo-renew" defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
};

// Screens: one real card inside a frame that resizes to the chosen screen
// (the same Mobile / Tablet / Desktop toggle as the templates section). The
// card reflows (one column, three, three plus a chart) and its metric type
// steps through the real card-metric sm / md / lg tokens, whose live value
// is printed under the frame.
const SCREEN_ICONS = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };
// Toggle and frames run smallest to largest.
const SCREEN_ORDER = ["mobile", "tablet", "desktop"] as const;

// Class strings written out in full so Tailwind generates them.
const SCREEN_LAYOUTS = {
  desktop: {
    chart: true,
    cols: "grid-cols-3",
    header: "text-card-header-lg",
    metric: "text-card-metric-lg",
    pad: "p-5 gap-4",
    size: "lg",
    width: "94%",
  },
  mobile: {
    chart: false,
    cols: "grid-cols-1",
    header: "text-card-header-sm",
    metric: "text-card-metric-sm",
    pad: "p-3 gap-2.5",
    size: "sm",
    width: "40%",
  },
  tablet: {
    chart: false,
    cols: "grid-cols-3",
    header: "text-card-header-md",
    metric: "text-card-metric-md",
    pad: "p-4 gap-3",
    size: "md",
    width: "68%",
  },
} as const;

const SCREEN_METRICS = [
  { label: "Readers", value: "1,284" },
  { label: "Shared", value: "342" },
  { label: "Read time", value: "4m 12s" },
] as const;

const SCREEN_BARS = [42, 58, 36, 64, 51, 72, 66, 80] as const;

// The token's value as globals.css sets it right now.
const useTokenValue = (name: string) => {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    setValue(
      getComputedStyle(document.documentElement)
        .getPropertyValue(`--${name}`)
        .trim()
    );
  }, [name]);

  return value;
};

const DeviceVisual = () => {
  const [active, setActive] = React.useState<DeviceId>("desktop");
  const layout = SCREEN_LAYOUTS[active];

  // On a phone, start on the phone layout (the desktop one doesn't fit a
  // phone-sized panel), as the templates section does.
  React.useEffect(() => {
    if (matchMedia("(max-width: 47.99rem)").matches) {
      setActive("mobile");
    }
  }, []);
  const token = `card-metric-${layout.size}`;
  const tokenValue = useTokenValue(token);

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 p-5">
      <ToggleGroup
        type="single"
        variant="outline"
        value={active}
        onValueChange={(value) => value && setActive(value as DeviceId)}
        aria-label="Show the card on"
      >
        {SCREEN_ORDER.map((id) => {
          const device = DEVICES.find((item) => item.id === id) ?? DEVICES[0];
          const Icon = SCREEN_ICONS[device.id];

          return (
            <ToggleGroupItem
              key={device.id}
              value={device.id}
              aria-label={device.label}
              className="gap-2 px-3"
            >
              <Icon />
              <span className="hidden sm:inline">{device.label}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <m.div
        layout
        transition={DEVICE_RING}
        className="bg-background max-h-[70%] overflow-hidden rounded-xl shadow-border"
        style={{ borderRadius: 12, width: layout.width }}
      >
        <m.div
          layout="position"
          transition={DEVICE_RING}
          className={cn("flex flex-col", layout.pad)}
        >
          <span className={cn(layout.header, "font-medium")}>Weekly brief</span>
          <div className={cn("grid gap-2", layout.cols)}>
            {SCREEN_METRICS.map((metric) => (
              <div
                key={metric.label}
                className="bg-muted/50 flex min-w-0 flex-col gap-0.5 rounded-lg p-2.5"
              >
                <span
                  className={cn(
                    TYPE.cardCaption,
                    "text-muted-foreground truncate"
                  )}
                >
                  {metric.label}
                </span>
                <span className={cn(layout.metric, "truncate tabular-nums")}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
          {layout.chart && (
            <div aria-hidden className="flex h-14 items-end gap-1.5">
              {SCREEN_BARS.map((height, index) => (
                <span
                  key={index}
                  className="bg-chart-2 flex-1 rounded-t-sm"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          )}
        </m.div>
      </m.div>

      <span className={cn(TYPE.cardCaption, "text-muted-foreground font-mono")}>
        --{token}: {tokenValue}
      </span>
    </div>
  );
};

// Details: the same card twice, with a 1px border (before) and the kit's
// layered shadow (after). The ground turns to a brand tint halfway down, as
// cards often sit on a colored band or image: the border's flat grey reads as
// a hard outline on one ground and dirt on the other, while the shadow sits
// naturally on both.
const DetailCard = ({ shadow }: { shadow: boolean }) => (
  <div
    className={cn(
      "bg-card flex flex-col gap-[2cqw] rounded-2xl p-[3.5cqw]",
      shadow ? "shadow-card" : "border-border border"
    )}
  >
    <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
      Weekly readers
    </span>
    <span className={cn(TYPE.cardMetric, "tabular-nums")}>1,284</span>
    <span className="bg-muted-foreground/25 h-[1.2cqw] w-full rounded-full" />
    <span className="bg-muted-foreground/25 h-[1.2cqw] w-3/5 rounded-full" />
  </div>
);

const DetailVisual = () => (
  <div className="@container relative size-full">
    {/* The two-tone ground. */}
    {/* Stronger tint in dark, where a shadow and a border otherwise look
        alike on a near-black ground. */}
    <div
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-1/2 [--tint:22%] dark:[--tint:45%]"
      style={{
        background:
          "linear-gradient(120deg, color-mix(in oklab, var(--brand) var(--tint), var(--background)), color-mix(in oklab, var(--chart-2) calc(var(--tint) * 0.8), var(--background)))",
      }}
    />
    <div className="relative grid size-full grid-cols-2 content-center items-start gap-[5cqw] p-[7cqw]">
      {[false, true].map((shadow) => (
        <figure key={String(shadow)} className="flex flex-col gap-[2.5cqw]">
          <figcaption
            className={cn(
              TYPE.cardCaption,
              "truncate font-mono",
              shadow ? "text-brand-text" : "text-muted-foreground"
            )}
          >
            {shadow ? "After · shadow" : "Before · border"}
          </figcaption>
          <DetailCard shadow={shadow} />
        </figure>
      ))}
    </div>
  </div>
);

const [, INTERACTION] = FEATURES;

// Menu, switch and toast each compared, plus the two curves.
const InteractionVisual = () => (
  <Bento
    label="Default ease-out compared with craftUI's easing"
    subs={INTERACTION.visuals}
    visuals={INTERACTION_VISUALS}
    spans={{
      curves: "col-span-3",
      menu: "col-span-3",
      switch: "col-span-2",
      toast: "col-span-2",
    }}
  />
);

export const FEATURE_VISUALS: Record<FeatureId, () => React.ReactNode> = {
  accessibility: AccessibilityVisual,
  detail: DetailVisual,
  device: DeviceVisual,
  interaction: InteractionVisual,
  theme: ThemeVisual,
};
