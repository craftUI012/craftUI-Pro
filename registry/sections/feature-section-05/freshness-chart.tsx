"use client";

import {
  Calendar03Icon,
  FileSyncIcon,
  GithubIcon,
  GoogleDriveIcon,
  NotionIcon,
  SlackIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import NumberFlow from "@number-flow/react";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { MotionValue } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  ComponentProps,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Context freshness. A step chart for one question: how much of what a
 * team knows is still true? Two lines start together on the
 * day a snapshot was built. The snapshot's line steps down every time a file
 * changes for the first time (it never hears about it); the live line holds.
 * The dotted field between them is the drift. Under the chart, one lane per
 * source carries a tick for every change. Point at any moment (or step
 * through with the arrow keys) and the change opens as a diff: the line the
 * snapshot still has in red, the line that is true now in green.
 *
 * ANIMATION STORYBOARD
 *
 *    play     a sweep reveals the timeline left to right (1.4s, ease-in-
 *             out): the snapshot line steps down, the ticks appear as it
 *             passes, and the snapshot's number counts down with it
 *    settle   over the last 15% of the sweep the line ends, their labels
 *             and each source's count fade in
 *    live     both line ends pulse twice: a ring grows out of each dot
 *             and fades, 2s a pulse, together. Then they rest: anything
 *             that blinks for more than five seconds needs a way to stop
 *             it. They pulse twice again whenever the chart comes back to
 *             attention: brought forward, or focused
 *    point    a crosshair snaps to the nearest change, its lane lights up,
 *             the rest dim (150ms), and the change opens as a diff (120ms
 *             in); moving on glides both to the next change (0.18s spring)
 *
 * With reduced motion it is simply there, and the crosshair jumps.
 * ───────────────────────────────────────────────────────────────────────── */

/** One change to one file. */
export interface ContextChange {
  /** A stable id for the change. */
  id: string;
  /** When it happened. */
  at: Date | string | number;
  /** The file that changed, e.g. "policies/refunds.md". */
  file: string;
  /** Where the change came from. Names its lane. */
  source: string;
  /** Who made it. */
  by: string;
  /** The line as the snapshot has it. */
  before: string;
  /** The line as it is now. */
  after: string;
}

/** A place changes come from: one lane under the chart. */
export interface ContextSource {
  /** The source's name. A change belongs to the lane whose name matches
   * its `source`. */
  name: string;
  /** Its icon: any icon from the Hugeicons core-free-icons package. */
  icon: IconSvgElement;
}

export interface FreshnessChartProps extends Omit<
  ComponentProps<"div">,
  "children" | "title"
> {
  /** Every change since the snapshot. Leave out for the demo. */
  changes?: ContextChange[];
  /** How many files are tracked in all. */
  files?: number;
  /** The share still current with live updates, in percent. */
  live?: number;
  /** The day the snapshot was built. */
  snapshot?: Date | string | number;
  /** Today: where the timeline ends. */
  now?: Date | string | number;
  /** The lanes, top first. */
  sources?: ContextSource[];
  /** The window's title. */
  title?: string;
  /** A BCP 47 locale for the dates. */
  locale?: string;
  /** Draws the chart in. Flip it to true when the chart is in view. */
  play?: boolean;
  /** A change to show while nothing is pointed at (for a guided demo). */
  pick?: string;
  /** Fades the right gutter (the lines' end labels) out at lg and up, for
   * while the window beside the chart covers it. */
  quiet?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Demo: 128 files, a snapshot from January, 212 changes since.
 * ───────────────────────────────────────────────────────────────────────── */

export const DEMO_SNAPSHOT = new Date(2026, 0, 12, 9);
export const DEMO_NOW = new Date(2026, 10, 13, 9);
export const DEMO_FILES = 128;

/** The change the demo points at. The chat's answer cites the same file. */
export const DEMO_PICK = "refunds";

export const DEMO_SOURCES: ContextSource[] = [
  { icon: SlackIcon, name: "Slack" },
  { icon: NotionIcon, name: "Notion" },
  { icon: GoogleDriveIcon, name: "Drive" },
  { icon: GithubIcon, name: "GitHub" },
];

const FOLDERS = [
  "policies",
  "pricing",
  "product",
  "security",
  "people",
  "sales",
  "support",
  "finance",
];
const NAMES = [
  "overview",
  "playbook",
  "tiers",
  "roadmap",
  "onboarding",
  "sla",
  "escalation",
  "glossary",
  "faq",
  "limits",
];
const TEAMS = [
  "Support ops",
  "Sales ops",
  "Product",
  "Security",
  "People",
  "Finance",
];
const EDITS = [
  ["Reply within 5 days", "Reply within 2 days"],
  ["Free plan: 3 seats", "Free plan: 5 seats"],
  ["SSO on Enterprise only", "SSO on Team and up"],
  ["Reviewed every quarter", "Reviewed every month"],
  ["Tier 2 after 48 hours", "Tier 2 after 24 hours"],
  ["Ships in Q3", "Ships in Q4"],
  ["Discount cap: 20%", "Discount cap: 15%"],
  ["Owner: Priya", "Owner: Tomás"],
];

/** A small seeded random, so the demo is the same on every load. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 9301 + 49_297) % 233_280;
    return state / 233_280;
  };
};

/** 75 files changed at least once, 212 changes in all. */
const demoChanges = (): ContextChange[] => {
  const random = seeded(19);
  const start = DEMO_SNAPSHOT.getTime();
  const span = DEMO_NOW.getTime() - start;
  const pickOf = <T,>(list: T[]) =>
    list[Math.floor(random() * list.length)] as T;
  const paths = FOLDERS.flatMap((folder) =>
    NAMES.map((name) => `${folder}/${name}.md`)
  );
  const detail = () => {
    const [before, after] = pickOf(EDITS);
    return {
      after: after ?? "",
      before: before ?? "",
      by: pickOf(TEAMS),
      source: pickOf(DEMO_SOURCES).name,
    };
  };
  // The first change to each of 74 files, a little denser early on.
  const firsts = paths.slice(0, 74).map(
    (file, i): ContextChange => ({
      ...detail(),
      at: start + span * (0.01 + 0.97 * random() ** 1.15),
      file,
      id: `f${i}`,
    })
  );
  // Then 137 more edits to files that had already changed.
  const repeats = Array.from({ length: 137 }, (_, i): ContextChange => {
    const earlier = pickOf(firsts);
    const from = new Date(earlier.at).getTime();
    return {
      ...detail(),
      at: from + (start + span - from) * (0.04 + 0.95 * random()),
      file: earlier.file,
      id: `r${i}`,
    };
  });
  return [
    ...firsts,
    ...repeats,
    {
      after: "Refunds within 30 days",
      at: new Date(2026, 5, 9, 11),
      before: "Refunds within 14 days",
      by: "Support ops",
      file: "policies/refunds.md",
      id: DEMO_PICK,
      source: "Notion",
    },
  ];
};

const DEMO = demoChanges();

/* ─────────────────────────────────────────────────────────────────────────
 * Motion and layout. Every value that sets a beat or a size lives here.
 * ───────────────────────────────────────────────────────────────────────── */

const MOTION = {
  /** The tooltip and crosshair glide between changes, in seconds. */
  glide: 0.18,
  /** One pulse of the line ends, in seconds: a ring out, then a rest. */
  pulse: 2,
  /** How many pulses in a row. Two is 4s: under the 5s that would need a
   * pause control. */
  pulses: 2,
  /** The draw-in sweep across the timeline, in seconds. */
  sweep: 1.4,
  /** The tooltip fades in, in seconds. */
  tipIn: 0.12,
  /** And out, quicker. */
  tipOut: 0.1,
} as const;

const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const GLIDE = {
  bounce: 0,
  type: "spring",
  visualDuration: MOTION.glide,
} as const;

/** The two headline numbers. */
const HERO = "text-3xl font-semibold tracking-tight tabular-nums";

/** The change card's size and its gap from the crosshair, in px. */
const TIP = { gap: 16, width: 232 } as const;

/** The plot's measurements, in px. */
const PLOT = {
  /** Room under the time axis for its labels. */
  axis: 26,
  /** The chart's height. */
  chart: 128,
  /** The gap between the chart and the first lane. */
  gap: 14,
  /** A mono label's line height: the label column is laid out from it. */
  label: 12,
  /** One lane's height. */
  lane: 22,
  /** Room above the chart, so a line's end ring isn't cut. */
  top: 10,
} as const;

/** The value axis: where the gridlines and their labels sit, in percent. */
const GRID = [100, 50, 0];

/** The colours, light then dark. Retune them on the chart or a parent. */
const COLORS = cn(
  "[--ctx-live:oklch(0.55_0.15_152)] [--ctx-stale:oklch(0.58_0.2_25)]",
  "dark:[--ctx-live:oklch(0.79_0.17_152)] dark:[--ctx-stale:oklch(0.7_0.19_22)]"
);

const CSS = `
@keyframes ctx-ring { 0% { opacity: .5; transform: scale(1) } 70%, 100% { opacity: 0; transform: scale(3) } }
.ctx-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ctx-ring ${MOTION.pulse}s cubic-bezier(0,0,.2,1) ${MOTION.pulses}; }
@media (prefers-reduced-motion: reduce) { .ctx-ring { animation: none; opacity: 0; } }
`;

/* ─────────────────────────────────────────────────────────────────────────
 * The numbers.
 * ───────────────────────────────────────────────────────────────────────── */

const toTime = (value: Date | string | number) => new Date(value).getTime();

/** A change with its time and what it did to the snapshot worked out. */
interface Change extends ContextChange {
  /** The first change to its file: the moment the snapshot lost it. */
  first: boolean;
  /** The share of files the snapshot still has right, after this change. */
  share: number;
  time: number;
}

const useModel = ({
  changes,
  files,
  now,
  snapshot,
}: Required<Pick<FreshnessChartProps, "files" | "now" | "snapshot">> & {
  changes: ContextChange[];
}) =>
  useMemo(() => {
    const start = toTime(snapshot);
    const stop = Math.max(toTime(now), start + 1);
    const changed = new Set<string>();
    const all = changes
      .map((change) => ({ ...change, time: toTime(change.at) }))
      .filter((change) => change.time >= start && change.time <= stop)
      .toSorted((a, b) => a.time - b.time)
      .map((change): Change => {
        const first = !changed.has(change.file);
        changed.add(change.file);
        return {
          ...change,
          first,
          share: ((files - changed.size) / files) * 100,
        };
      });
    return { all, share: all.at(-1)?.share ?? 100, start, stop };
  }, [changes, files, now, snapshot]);

type Model = ReturnType<typeof useModel>;

const useFormat = (locale?: string) =>
  useMemo(() => {
    const date = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    });
    const month = new Intl.DateTimeFormat(locale, { month: "short" });
    const list = new Intl.ListFormat(locale, { type: "conjunction" });
    return {
      date: (time: number) => date.format(time),
      list: (items: string[]) => list.format(items),
      month: (time: number) => month.format(time),
    };
  }, [locale]);

type Format = ReturnType<typeof useFormat>;

/* ─────────────────────────────────────────────────────────────────────────
 * Geometry. The plot is the middle column only: x runs its full width.
 * ───────────────────────────────────────────────────────────────────────── */

const LANES_TOP = PLOT.top + PLOT.chart + PLOT.gap;

const useGeometry = (model: Model, lanes: number, width: number) =>
  useMemo(() => {
    const lanesBottom = LANES_TOP + lanes * PLOT.lane;
    return {
      height: lanesBottom + PLOT.axis,
      laneY: (index: number) => LANES_TOP + index * PLOT.lane + PLOT.lane / 2,
      lanesBottom,
      width,
      x: (time: number) =>
        ((time - model.start) / (model.stop - model.start)) * width,
      y: (share: number) => PLOT.top + ((100 - share) / 100) * PLOT.chart,
    };
  }, [lanes, model, width]);

type Geometry = ReturnType<typeof useGeometry>;

/** The snapshot's share as a step line: down one file at every first change. */
const stepPath = (model: Model, geo: Geometry) => {
  let d = `M0,${geo.y(100)}`;
  for (const change of model.all) {
    if (change.first) {
      d += `H${geo.x(change.time)}V${geo.y(change.share)}`;
    }
  }
  return `${d}H${geo.width}`;
};

/** The first day of every month inside the timeline. */
const monthsOf = (model: Model) => {
  const months: number[] = [];
  const date = new Date(model.start);
  let time = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  while (time < model.stop) {
    months.push(time);
    const next = new Date(time);
    time = new Date(next.getFullYear(), next.getMonth() + 1, 1).getTime();
  }
  return months;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Pieces.
 * ───────────────────────────────────────────────────────────────────────── */

/** The value grid, and the months along the bottom. */
const Axes = ({
  format,
  geo,
  model,
}: {
  format: Format;
  geo: Geometry;
  model: Model;
}) => {
  const axisY = geo.lanesBottom + 6;
  const months = monthsOf(model);
  // A label every month, or every second or third when they'd touch, and
  // none that would run into Today at the end.
  const gap = months.length > 1 ? geo.width / (months.length + 1) : geo.width;
  const stride = Math.max(1, Math.ceil(34 / Math.max(gap, 1)));
  const labelled = months.filter(
    (time, i) => i % stride === 0 && geo.width - geo.x(time) > 44
  );
  return (
    <g className="font-mono text-[0.625rem]">
      {GRID.map((value) => (
        // Plain hairlines: the dots belong to the data.
        <line
          key={value}
          className={value === 0 ? "stroke-border" : "stroke-border/50"}
          x1={0}
          x2={geo.width}
          y1={geo.y(value)}
          y2={geo.y(value)}
        />
      ))}
      {months.map((time) => (
        <line
          key={time}
          className="stroke-muted-foreground/40"
          x1={geo.x(time)}
          x2={geo.x(time)}
          y1={axisY}
          y2={axisY + 4}
        />
      ))}
      {labelled.map((time) => (
        <text
          key={time}
          className="fill-muted-foreground"
          textAnchor="middle"
          x={geo.x(time)}
          y={axisY + 16}
        >
          {format.month(time)}
        </text>
      ))}
      <line
        className="stroke-foreground/20"
        x1={geo.width}
        x2={geo.width}
        y1={PLOT.top}
        y2={axisY + 5}
      />
      <text
        className="fill-foreground"
        textAnchor="end"
        x={geo.width}
        y={axisY + 16}
      >
        Today
      </text>
    </g>
  );
};

/** One source's lane: a track from its first change to its last, a tick each. */
const Lane = ({
  active,
  dim,
  geo,
  index,
  model,
  source,
}: {
  active?: string;
  dim: boolean;
  geo: Geometry;
  index: number;
  model: Model;
  source: string;
}) => {
  const changes = model.all.filter((change) => change.source === source);
  const y = geo.laneY(index);
  const [first] = changes;
  const last = changes.at(-1);
  if (!(first && last)) {
    return null;
  }
  return (
    <g
      className={cn(
        "transition-opacity duration-150 ease-out",
        dim && "opacity-35"
      )}
    >
      <line
        className="stroke-muted-foreground/20"
        strokeLinecap="round"
        strokeWidth={2}
        x1={geo.x(first.time)}
        x2={geo.x(last.time)}
        y1={y}
        y2={y}
      />
      {changes.map((change) => {
        // A file's first change is the one the snapshot misses: taller,
        // and in the snapshot's colour. Later edits to it are quiet.
        const height = (change.first ? 12 : 7) + (change.id === active ? 4 : 0);
        return (
          <rect
            key={change.id}
            className={
              change.first ? "fill-(--ctx-stale)" : "fill-muted-foreground/45"
            }
            height={height}
            rx={1}
            width={2}
            x={geo.x(change.time) - 1}
            y={y - height / 2}
          />
        );
      })}
    </g>
  );
};

/** The change under the pointer, as a diff of one line. */
const ChangeCard = ({
  change,
  format,
  width,
}: {
  change: Change;
  format: Format;
  width: number;
}) => (
  <Card
    className="bg-popover text-popover-foreground gap-0 overflow-hidden rounded-lg border py-0 shadow-lg"
    style={{ width }}
  >
    <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5">
      <span className="min-w-0 font-mono text-xs font-medium break-words">
        {change.file}
      </span>
      <span className="text-muted-foreground shrink-0 font-mono text-[0.6875rem] whitespace-nowrap">
        {format.date(change.time)}
      </span>
    </div>
    <p className="text-muted-foreground px-3 pt-0.5 pb-2.5 text-xs">
      {change.by} · {change.source}
    </p>
    <div className="border-t font-mono text-xs">
      <div className="flex items-center gap-2 bg-(--ctx-stale)/10 px-3 py-1.5">
        <span className="text-(--ctx-stale)">−</span>
        <span className="min-w-0 flex-1 break-words">{change.before}</span>
      </div>
      <div className="flex items-center gap-2 bg-(--ctx-live)/10 px-3 py-1.5">
        <span className="text-(--ctx-live)">+</span>
        <span className="min-w-0 flex-1 break-words">{change.after}</span>
      </div>
    </div>
  </Card>
);

/** The crosshair at a change, with a mark on each line where it crosses. */
const Crosshair = ({
  change,
  geo,
  live,
}: {
  change: Change;
  geo: Geometry;
  live: number;
}) => {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : GLIDE;
  return (
    <motion.g
      animate={{ x: geo.x(change.time) }}
      initial={false}
      transition={transition}
    >
      <line
        className="stroke-foreground/30"
        x1={0}
        x2={0}
        y1={PLOT.top}
        y2={geo.lanesBottom}
      />
      {[
        { className: "fill-(--ctx-live)", value: live },
        { className: "fill-(--ctx-stale)", value: change.share },
      ].map((mark) => (
        <motion.circle
          key={mark.className}
          animate={{ cy: geo.y(mark.value) }}
          className={cn(mark.className, "stroke-card")}
          cx={0}
          initial={false}
          r={3.5}
          strokeWidth={2}
          transition={transition}
        />
      ))}
    </motion.g>
  );
};

/**
 * Follows an element's width, and the room its parent leaves on each side
 * of it (here: the label column before the plot and the gutter after it).
 */
const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ after: 0, before: 0, width: 0 });
  useEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!(element && parent)) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const box = element.getBoundingClientRect();
      const around = parent.getBoundingClientRect();
      setSize({
        after: Math.round(around.right - box.right),
        before: Math.round(box.left - around.left),
        width: Math.round(box.width),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
};

/** `progress` runs 0 → 1 across the sweep, once `play` turns true. */
const useDrawIn = (play: boolean) => {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!play) {
      return;
    }
    if (reduce) {
      progress.set(1);
      setDrawn(true);
      return;
    }
    const controls = animate(progress, 1, {
      duration: MOTION.sweep,
      ease: EASE_IN_OUT,
      onComplete: () => setDrawn(true),
    });
    return () => controls.stop();
  }, [play, progress, reduce]);
  return { drawn, progress };
};

/** Which change sits nearest a point along the plot, in px. */
const nearest = (changes: Change[], geo: Geometry, px: number) => {
  let best: Change | undefined;
  let gap = Number.POSITIVE_INFINITY;
  for (const change of changes) {
    const distance = Math.abs(geo.x(change.time) - px);
    if (distance < gap) {
      best = change;
      gap = distance;
    }
  }
  return best;
};

/** A slider's keys: up and right go on, down and left back, pages by ten. */
const KEY_STEP: Record<string, number> = {
  ArrowDown: -1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -10,
  PageUp: 10,
};

/** Where a key takes the picked change: an index, "clear", or nowhere. */
const keyTarget = (key: string, index: number, last: number) => {
  const step = KEY_STEP[key];
  if (step !== undefined) {
    // Nothing picked yet: the first step lands on the first (or last).
    const origin = index === -1 && step < 0 ? last + 1 : index;
    return Math.min(last, Math.max(0, origin + step));
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return last;
  }
  return key === "Escape" ? "clear" : undefined;
};

/** The counting numbers land with the sweep. */
const COUNT = {
  duration: MOTION.sweep * 1000,
  easing: "cubic-bezier(0.65, 0, 0.35, 1)",
};

/** One fact under the numbers: an icon and a few words. */
const Fact = ({
  children,
  icon,
}: {
  children: ReactNode;
  icon: IconSvgElement;
}) => (
  <span className="inline-flex items-center gap-1.5">
    <HugeiconsIcon
      absoluteStrokeWidth
      aria-hidden
      className="shrink-0"
      icon={icon}
      size={14}
      strokeWidth={1.25}
    />
    <span>{children}</span>
  </span>
);

/**
 * The window's title and the two numbers the whole section is about, side
 * by side: the live one holds, the snapshot's counts down with the sweep
 * and follows the crosshair while a change is picked.
 */
const Header = ({
  active,
  format,
  live,
  locale,
  model,
  play,
  title,
}: {
  active?: Change;
  format: Format;
  live: number;
  locale: string;
  model: Model;
  play: boolean;
  title: string;
}) => (
  <div className="px-5 pt-4">
    <p className="py-1.5 text-base font-normal text-pretty">{title}</p>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
      <p className="flex items-baseline gap-x-2">
        <span className={HERO}>{live}%</span>
        <span className="text-muted-foreground text-sm">live</span>
      </p>
      <p className="flex items-baseline gap-x-2">
        <NumberFlow
          animated={!active}
          // The line height is pinned: as served the element takes its own
          // (1), once running the text size's (1.2), and the difference
          // would make the window 6px taller a moment after it loads.
          className={cn(HERO, "text-muted-foreground leading-9!")}
          locales={locale}
          spinTiming={COUNT}
          suffix="%"
          transformTiming={COUNT}
          value={Math.round(active?.share ?? (play ? model.share : 100))}
        />
        <span className="text-muted-foreground text-sm">snapshot</span>
      </p>
    </div>
    {/* The facts under the numbers, the way a repository lists its
        commits: how many changes, and since when. While a change is picked
        both follow the crosshair: the changes up to it, and its date. */}
    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <Fact icon={FileSyncIcon}>
        <span className="text-foreground tabular-nums">
          {active ? model.all.indexOf(active) + 1 : model.all.length}
        </span>{" "}
        changes
      </Fact>
      <Fact icon={Calendar03Icon}>
        {active
          ? `As of ${format.date(active.time)}`
          : `Since ${format.date(model.start)}`}
      </Fact>
    </div>
  </div>
);

/** The left column: the value axis's labels, then each source's name. */
const Labels = ({
  active,
  sources,
}: {
  active?: Change;
  sources: ContextSource[];
}) => (
  <div
    aria-hidden
    className="text-muted-foreground font-mono text-[0.625rem] leading-3"
  >
    {/* Three labels spread over the chart's height, each centred on its
        gridline: the box starts and ends half a line outside the chart. */}
    <div
      className="flex flex-col justify-between"
      style={{
        height: PLOT.top + PLOT.chart + PLOT.label / 2,
        paddingTop: PLOT.top - PLOT.label / 2,
      }}
    >
      {GRID.map((value) => (
        <span key={value}>{value}%</span>
      ))}
    </div>
    <div style={{ height: PLOT.gap - PLOT.label / 2 }} />
    {sources.map((source) => (
      <div
        key={source.name}
        className={cn(
          "flex items-center gap-1.5 transition-opacity duration-150 ease-out",
          active?.source === source.name && "text-foreground",
          active && active.source !== source.name && "opacity-35"
        )}
        style={{ height: PLOT.lane }}
      >
        <HugeiconsIcon
          absoluteStrokeWidth
          icon={source.icon}
          size={12}
          strokeWidth={1}
        />
        {source.name}
      </div>
    ))}
  </div>
);

/**
 * The right gutter: each line named at its end, each source's count beside
 * its lane. It is the strip the chat window covers when it comes forward,
 * so nothing is said only here.
 */
const Gutter = ({
  active,
  geo,
  live,
  model,
  quiet,
  settled,
  sources,
}: {
  active?: Change;
  geo: Geometry;
  live: number;
  model: Model;
  quiet: boolean;
  settled: MotionValue<number>;
  sources: ContextSource[];
}) => {
  const liveY = geo.y(live);
  const ends = [
    { className: "text-(--ctx-live)", text: `Live ${live}%`, y: liveY },
    {
      className: "text-(--ctx-stale)",
      text: `Snapshot ${Math.round(model.share)}%`,
      // Nudged down when the two lines end close together.
      y: Math.max(geo.y(model.share), liveY + 13),
    },
  ];
  return (
    // Two fades, one inside the other: the outer one for `quiet`, the
    // inner one for the draw-in.
    <div
      aria-hidden
      className={cn(
        "relative font-mono text-[0.625rem] leading-3 transition-opacity duration-300 ease-out max-sm:hidden",
        // Only where the section's two windows overlap: stacked, nothing
        // covers the gutter.
        quiet && "lg:opacity-0"
      )}
    >
      <motion.div className="absolute inset-0" style={{ opacity: settled }}>
        {ends.map((end) => (
          <span
            key={end.text}
            className={cn(
              "absolute left-0 -translate-y-1/2 whitespace-nowrap transition-opacity duration-150",
              end.className,
              active && "opacity-0"
            )}
            style={{ top: end.y }}
          >
            {end.text}
          </span>
        ))}
        {sources.map((source, i) => (
          <span
            key={source.name}
            className={cn(
              "text-muted-foreground absolute right-0 -translate-y-1/2 tabular-nums transition-opacity duration-150 ease-out",
              active?.source === source.name && "text-foreground",
              active && active.source !== source.name && "opacity-35"
            )}
            style={{ top: geo.laneY(i) }}
          >
            {model.all.filter((change) => change.source === source.name).length}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

/**
 * The timeline's drawing: the grid, the two lines with the drift between
 * them, the lanes, the line ends, and the crosshair when a change is picked.
 */
const Timeline = ({
  active,
  beat,
  format,
  geo,
  live,
  model,
  progress,
  settled,
  sources,
}: {
  active?: Change;
  /** Counts up to play the line ends' pulse again; 0 before the first. */
  beat: number;
  format: Format;
  geo: Geometry;
  live: number;
  model: Model;
  progress: MotionValue<number>;
  settled: MotionValue<number>;
  sources: ContextSource[];
}) => {
  const raw = useId();
  const id = raw.replaceAll(/[^a-zA-Z0-9]/gu, "");
  const sweep = useTransform(progress, (p) => p * geo.width);
  const line = stepPath(model, geo);
  const liveY = geo.y(live);
  return (
    // Time runs left to right here in every language.
    <svg
      aria-hidden
      className="block overflow-visible"
      direction="ltr"
      height={geo.height}
      width={geo.width}
    >
      <defs>
        <pattern
          height={4}
          id={`${id}-drift`}
          patternUnits="userSpaceOnUse"
          width={4}
        >
          <circle cx={2} cy={2} fill="var(--ctx-stale)" opacity={0.6} r={0.7} />
        </pattern>
        <clipPath id={`${id}-sweep`}>
          <motion.rect height={geo.height} width={sweep} x={0} y={0} />
        </clipPath>
      </defs>
      <Axes format={format} geo={geo} model={model} />
      <g clipPath={`url(#${id}-sweep)`}>
        {/* The drift: everything between the two lines. */}
        <path d={`${line}V${liveY}H0Z`} fill={`url(#${id}-drift)`} />
        <path
          className="stroke-(--ctx-live)"
          d={`M0,${liveY}H${geo.width}`}
          fill="none"
          strokeWidth={1.75}
        />
        <path
          className="stroke-(--ctx-stale)"
          d={line}
          fill="none"
          strokeLinejoin="round"
          strokeWidth={1.75}
        />
        {sources.map((source, i) => (
          <Lane
            key={source.name}
            active={active?.id}
            dim={Boolean(active) && active?.source !== source.name}
            geo={geo}
            index={i}
            model={model}
            source={source.name}
          />
        ))}
      </g>
      {/* The line ends, each a dot with a ring that pulses out of it. The
          ring is a new element on every beat: that is what replays it. */}
      <motion.g style={{ opacity: active ? 0 : settled }}>
        {[
          { className: "fill-(--ctx-live)", y: liveY },
          { className: "fill-(--ctx-stale)", y: geo.y(model.share) },
        ].map((end) => (
          <g key={end.className} className={end.className}>
            {beat > 0 && (
              <circle
                key={beat}
                className="ctx-ring"
                cx={geo.width}
                cy={end.y}
                r={3}
              />
            )}
            <circle cx={geo.width} cy={end.y} r={3} />
          </g>
        ))}
      </motion.g>
      {active && <Crosshair change={active} geo={geo} live={live} />}
    </svg>
  );
};

/** The plot's input: pointer, touch and keys all pick a change. */
const Scrubber = ({
  active,
  enabled,
  format,
  geo,
  model,
  onAttend,
  onPick,
}: {
  active?: Change;
  enabled: boolean;
  format: Format;
  geo: Geometry;
  model: Model;
  /** The plot took focus. */
  onAttend: () => void;
  onPick: (id?: string) => void;
}) => {
  const index = active ? model.all.indexOf(active) : -1;
  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    onPick(nearest(model.all, geo, event.clientX - box.left)?.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = keyTarget(event.key, index, model.all.length - 1);
    if (target === undefined) {
      return;
    }
    if (target === "clear") {
      onPick();
      return;
    }
    event.preventDefault();
    onPick(model.all[target]?.id);
  };
  return (
    <div
      aria-label="Changes since the snapshot"
      aria-valuemax={model.all.length}
      aria-valuemin={1}
      aria-valuenow={index + 1 || 1}
      aria-valuetext={
        active
          ? `${format.date(active.time)}: ${active.file}, changed by ${active.by} from "${active.before}" to "${active.after}". Snapshot at ${Math.round(active.share)}%.`
          : "Use the arrow keys to step through the changes"
      }
      // The focus ring is the text colour, which stands out on every
      // surface of any theme, and an outline still shows when the system
      // forces its own colours (a shadow ring would not).
      className="focus-visible:outline-foreground absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
      onBlur={() => onPick()}
      onFocus={onAttend}
      onKeyDown={onKeyDown}
      onPointerDown={onPointer}
      onPointerLeave={() => onPick()}
      onPointerMove={onPointer}
      role="slider"
      style={{ touchAction: "pan-y" }}
      tabIndex={model.all.length > 0 ? 0 : -1}
    />
  );
};

/**
 * Where the change card sits: beside the crosshair, flipped to its left
 * when the right has no room for it. It may run over the label column and
 * the gutter (`room`, in px each side of the plot), never past them.
 */
const tipPlace = (
  geo: Geometry,
  room: { after: number; before: number },
  change?: Change
) => {
  const cross = change ? geo.x(change.time) : 0;
  const width = Math.min(TIP.width, geo.width);
  const last = geo.width + room.after - width;
  const beside =
    cross + TIP.gap > last ? cross - TIP.gap - width : cross + TIP.gap;
  return { width, x: Math.max(-room.before, Math.min(beside, last)) };
};

/* ─────────────────────────────────────────────────────────────────────────
 * The chart.
 * ───────────────────────────────────────────────────────────────────────── */

export const FreshnessChart = ({
  changes = DEMO,
  className,
  files = DEMO_FILES,
  live = 99,
  locale = "en-GB",
  now = DEMO_NOW,
  pick,
  play = true,
  quiet = false,
  snapshot = DEMO_SNAPSHOT,
  sources = DEMO_SOURCES,
  title = "Context freshness",
  ...props
}: FreshnessChartProps) => {
  const model = useModel({ changes, files, now, snapshot });
  const format = useFormat(locale);
  const { after, before, ref: plotRef, width } = useWidth();
  const geo = useGeometry(model, sources.length, width);
  const { drawn, progress } = useDrawIn(play);
  const settled = useTransform(progress, [0.85, 1], [0, 1]);
  const [pointed, setPointed] = useState<string>();
  const shown = pointed ?? pick;
  const active = model.all.find((change) => change.id === shown);
  const tip = tipPlace(geo, { after, before }, active);
  const measured = width > 0;

  // The line ends pulse when the chart is drawn, and again each time it
  // comes back to attention: brought forward (no longer quiet) or focused.
  const [beat, setBeat] = useState(0);
  const last = useRef({ drawn: false, quiet });
  useEffect(() => {
    const was = last.current;
    last.current = { drawn, quiet };
    const justDrawn = drawn && !was.drawn;
    const cameForward = drawn && was.quiet && !quiet;
    if (justDrawn || cameForward) {
      setBeat((count) => count + 1);
    }
  }, [drawn, quiet]);

  // The card opens on hover, so Escape has to close it wherever focus is.
  useEffect(() => {
    if (!pointed) {
      return;
    }
    const onKey = (event: { key: string }) => {
      if (event.key === "Escape") {
        setPointed(undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pointed]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-slot="freshness-chart"
        className={cn(COLORS, "flex w-full flex-col", className)}
        {...props}
      >
        <style>{CSS}</style>
        <p className="sr-only">
          {`${title}: ${live}% of ${files} files are current with live updates. A snapshot from ${format.date(model.start)} has ${Math.round(model.share)}% of them right, after ${model.all.length} changes across ${format.list(sources.map((source) => source.name))}.`}
        </p>
        <Header
          active={active}
          format={format}
          live={live}
          locale={locale}
          model={model}
          play={play}
          title={title}
        />

        {/* The plot, on a three-column grid: labels, the timeline, and (from
            sm up) the gutter. Only the middle column is measured. */}
        <div className="mx-5 mt-5 mb-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 sm:grid-cols-[auto_minmax(0,1fr)_5.25rem]">
          <Labels active={active} sources={sources} />
          <div
            ref={plotRef}
            className="relative min-w-0"
            style={{ height: geo.height }}
          >
            {measured && (
              <>
                <Timeline
                  active={active}
                  beat={beat}
                  format={format}
                  geo={geo}
                  live={live}
                  model={model}
                  progress={progress}
                  settled={settled}
                  sources={sources}
                />
                <Scrubber
                  active={active}
                  enabled={drawn}
                  format={format}
                  geo={geo}
                  model={model}
                  onAttend={() => setBeat((count) => count + 1)}
                  onPick={setPointed}
                />
              </>
            )}
            <AnimatePresence>
              {active && measured && (
                <motion.div
                  key="tip"
                  animate={{ opacity: 1, scale: 1, x: tip.x }}
                  className="pointer-events-none absolute top-0 left-0 z-10 origin-top-left"
                  exit={{
                    opacity: 0,
                    scale: 0.97,
                    transition: { duration: MOTION.tipOut },
                  }}
                  initial={{ opacity: 0, scale: 0.97, x: tip.x }}
                  transition={{
                    opacity: { duration: MOTION.tipIn, ease: EASE_OUT },
                    scale: { duration: MOTION.tipIn, ease: EASE_OUT },
                    x: GLIDE,
                  }}
                >
                  <ChangeCard
                    change={active}
                    format={format}
                    width={tip.width}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Gutter
            active={active}
            geo={geo}
            live={live}
            model={model}
            quiet={quiet}
            settled={settled}
            sources={sources}
          />
        </div>
      </div>
    </MotionConfig>
  );
};
