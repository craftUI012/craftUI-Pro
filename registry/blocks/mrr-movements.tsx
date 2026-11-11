"use client";

import NumberFlow from "@number-flow/react";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useInView,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { MotionValue } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent, PointerEvent } from "react";
import { TextMorph } from "torph/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * MRR movements. A month of recurring revenue as two running totals: what
 * came in (new customers, upgrades, comebacks) climbs above zero in green,
 * what went out (downgrades, cancellations) falls below in red, and the
 * net runs between them as a dotted line. Under the chart, one lane per
 * plan carries a tick for every customer change. Point at any moment (or
 * step through with the arrow keys) and it shows that change as a diff:
 * the plan the customer left in red, the plan they moved to in green.
 *
 * Pass your own `movements` (one per customer change, straight from your
 * billing events: Stripe's customer.subscription.created / updated /
 * deleted map one to one), or leave it out to show four demo months. It
 * shows one calendar month at a time: the arrows step through the months
 * that have changes, and the month's name opens a list of them all, each
 * with its net, to jump straight to one. Uncontrolled by default (it
 * opens on the latest month); pass `month` and `onMonthChange` to drive it.
 *
 * Which lane a change sits on: money coming in lands on the plan it came
 * to; money going out sits on the plan it left. An upgrade from Pro to
 * Team is a gain on Team; a downgrade from Team to Pro is a loss on Team.
 *
 * LAYOUT. One headline: the month's net new MRR. Under it the plot sits
 * in three columns: the labels (values, then plan names) right-aligned on
 * the left; the month; and on the right, from sm up, each line labelled at
 * its own end and each plan's net beside its lane. A tick's height grows
 * with the money it moved, so the big changes stand out on their lane.
 * While the month runs, a Today line marks where the data stops.
 *
 * ANIMATION STORYBOARD
 *
 *    in view   a sweep reveals the month left to right (1.4s, ease-in-
 *              out): the lines step up and down, the lanes' ticks appear
 *              as it passes, and the headline counts up with it
 *    settle    over the last 15% of the sweep the line ends, their labels
 *              and each plan's net fade in; while the month runs, the
 *              ends ring twice and then hold still
 *    point     a crosshair snaps to the nearest change, its lane lights
 *              up, the rest dim (150ms), the headline jumps to the net at
 *              that moment, and the change opens as a diff (120ms in,
 *              ease-out); moving on glides the crosshair and the card to
 *              the next change on a no-bounce spring (0.18s)
 *    month     the old month slides 16px the way you're leaving and fades
 *              (200ms, ease-in-out: it's on screen); the new one draws in
 *              left to right (0.8s) with the headline counting up; the
 *              grid and its labels crossfade to the new scale (200ms); the
 *              month's name slides in from the side you're heading to
 *              (200ms in, 150ms out, ease-out)
 *
 * It draws in once, the first time it scrolls into view. With reduced
 * motion it's simply there, and the crosshair and the card jump instead
 * of gliding.
 * ───────────────────────────────────────────────────────────────────────── */

/** A plan and what it bills a month. */
export interface MrrPlan {
  /** The plan's name, e.g. "Pro". */
  plan: string;
  /** What it bills a month, in the currency's main unit. */
  mrr: number;
}

/** One customer's change in recurring revenue. */
export interface MrrMovement {
  /** A stable id for the change, e.g. the billing event's id. */
  id: string;
  /** When it happened. */
  at: Date | string | number;
  /** Who it was. */
  customer: string;
  /** What they paid before. Leave out for a new customer. */
  from?: MrrPlan;
  /** What they pay now. Leave out for a cancellation. */
  to?: MrrPlan;
  /** A customer coming back after cancelling, rather than a new one. */
  reactivation?: boolean;
}

export interface MrrMovementsProps extends Omit<
  ComponentProps<"div">,
  "children" | "title"
> {
  /** Every change, across as many months as you have. Leave out for the demo. */
  movements?: MrrMovement[];
  /** The month shown (any moment in it), when you control it. */
  month?: Date | string | number;
  /** The month to open on, when it's left uncontrolled. Defaults to the latest. */
  defaultMonth?: Date | string | number;
  /** Called with the first day of the month picked. */
  onMonthChange?: (month: Date) => void;
  /** Where the data stops ("today", for a month still running). */
  now?: Date | string | number;
  /** The plans, top lane first. Defaults to the order they first appear. */
  plans?: string[];
  /** The card's title. */
  title?: string;
  /** An ISO currency code, e.g. "USD". */
  currency?: string;
  /** A BCP 47 locale for numbers and dates. Set one so the server and the
   * browser format alike. */
  locale?: string;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Demo month.
 * ───────────────────────────────────────────────────────────────────────── */

const STARTER = { mrr: 29, plan: "Starter" };
const PRO = { mrr: 99, plan: "Pro" };
const TEAM = { mrr: 249, plan: "Team" };
const ENTERPRISE = { mrr: 1200, plan: "Enterprise" };

const day = (date: number, hour: number) => new Date(2026, 10, date, hour);

const LADDER = [STARTER, PRO, TEAM, ENTERPRISE];
const rung = (index: number) => LADDER[Math.min(index, 3)] ?? PRO;

const NAMES = [
  "Arbor",
  "Beacon",
  "Canopy",
  "Delta Nine",
  "Evergreen",
  "Foundry",
  "Granite",
  "Harbor",
  "Inkwell",
  "Jetstream",
  "Keystone",
  "Lantern",
  "Meridian",
  "Northstar",
  "Outpost",
  "Pinecone",
  "Quarry",
  "Redwood",
  "Saltmarsh",
  "Trellis",
  "Upland",
  "Vantage",
  "Willow",
  "Yardstick",
];

/** A small seeded random, so the demo months are the same on every load. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 9301 + 49_297) % 233_280;
    return state / 233_280;
  };
};

/** A plausible demo month: new customers, upgrades, a few losses. */
const demoMonth = (month: number, count: number, seed: number) => {
  const random = seeded(seed);
  const days = new Date(2026, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i): MrrMovement => {
    const at = new Date(
      2026,
      month,
      1 + Math.floor(random() * days),
      9 + Math.floor(random() * 9)
    );
    const roll = random();
    const step = Math.floor(random() * 3);
    const base = {
      at,
      customer: NAMES[Math.floor(random() * NAMES.length)] ?? "Arbor",
      id: `d${month}-${i}`,
    };
    if (roll < 0.34) {
      return { ...base, to: rung(step) };
    }
    if (roll < 0.62) {
      return { ...base, from: rung(step), to: rung(step + 1) };
    }
    if (roll < 0.76) {
      return { ...base, from: rung(step + 1), to: rung(step) };
    }
    if (roll < 0.92) {
      return { ...base, from: rung(step) };
    }
    return { ...base, reactivation: true, to: rung(step) };
  });
};

const NOVEMBER: MrrMovement[] = [
  { at: day(1, 10), customer: "Bluebird Labs", id: "m1", to: PRO },
  { at: day(2, 15), customer: "Kettle & Co", id: "m2", to: STARTER },
  { at: day(3, 11), customer: "Orbital", from: PRO, id: "m3", to: TEAM },
  { at: day(5, 9), customer: "Fernhill", from: STARTER, id: "m4" },
  { at: day(6, 14), customer: "Quill", id: "m5", to: TEAM },
  {
    at: day(8, 12),
    customer: "Lumen Studio",
    from: TEAM,
    id: "m6",
    to: ENTERPRISE,
  },
  { at: day(9, 16), customer: "Brightside", from: TEAM, id: "m7", to: PRO },
  { at: day(10, 10), customer: "Parcel", id: "m8", to: PRO },
  { at: day(12, 13), customer: "Tidewater", from: PRO, id: "m9" },
  { at: day(13, 9), customer: "Ninefold", id: "m10", to: STARTER },
  { at: day(14, 17), customer: "Cobalt", from: STARTER, id: "m11", to: PRO },
  { at: day(15, 11), customer: "Maple Health", id: "m12", to: ENTERPRISE },
  { at: day(16, 15), customer: "Driftwood", from: TEAM, id: "m13" },
  {
    at: day(18, 10),
    customer: "Halcyon",
    id: "m14",
    reactivation: true,
    to: PRO,
  },
  { at: day(19, 14), customer: "Ember", from: PRO, id: "m15", to: TEAM },
  {
    at: day(20, 12),
    customer: "Kettle & Co",
    from: STARTER,
    id: "m16",
    to: PRO,
  },
  { at: day(21, 16), customer: "Quill", from: TEAM, id: "m17", to: PRO },
  {
    at: day(22, 11),
    customer: "Orbital",
    from: TEAM,
    id: "m18",
    to: ENTERPRISE,
  },
  { at: day(23, 9), customer: "Parcel", from: PRO, id: "m19" },
  { at: day(24, 15), customer: "Juniper", id: "m20", to: TEAM },
];

const DEMO: MrrMovement[] = [
  ...demoMonth(7, 13, 11),
  ...demoMonth(8, 17, 23),
  ...demoMonth(9, 22, 37),
  ...NOVEMBER,
];

const DEMO_NOW = day(24, 20);
const DEMO_PLANS = ["Enterprise", "Team", "Pro", "Starter"];

/* ─────────────────────────────────────────────────────────────────────────
 * Motion and layout. Every value that sets a beat or a size lives here.
 * ───────────────────────────────────────────────────────────────────────── */

const MOTION = {
  /** The grid and its labels crossfade to a new month's scale, in seconds. */
  axes: 0.2,
  /** The tooltip and crosshair glide between changes, in seconds. */
  glide: 0.18,
  /** A month's name slides in, in seconds. */
  labelIn: 0.2,
  /** And out, quicker. */
  labelOut: 0.15,
  /** The month you leave slides away and fades, in seconds. */
  leave: 0.2,
  /** A month you switch to draws in, in seconds. */
  redraw: 0.8,
  /** The draw-in sweep across the month, in seconds. */
  sweep: 1.4,
  /** The tooltip fades in, in seconds. */
  tipIn: 0.12,
  /** And out, quicker. */
  tipOut: 0.1,
} as const;

/** The headline number. */
const HERO = "text-3xl font-semibold tracking-tight";

/** The change card's size and its gap from the crosshair, in px. */
const TIP = { gap: 16, width: 240 } as const;

const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const GLIDE = {
  bounce: 0,
  type: "spring",
  visualDuration: MOTION.glide,
} as const;

/** The plot's measurements, in px. */
const PLOT = {
  /** Room under the time axis for its labels. */
  axis: 26,
  /** A mono label character's width at 10px, to size the label column. */
  char: 6.2,
  /** The chart's height on a phone and from sm up. */
  chart: 148,
  chartWide: 184,
  /** The gap between the chart and the first lane. */
  gap: 14,
  /** From sm up, room right of the plot for the end labels and plan nets. */
  gutter: 76,
  /** The share of the width the label column may take before the plan
   * names move above their lanes, so long names never squeeze the plot. */
  labels: 0.36,
  /** One lane's height. */
  lane: 22,
  /** One lane's height when its name sits above it. */
  laneStacked: 36,
  /** On a phone, room right of the plot so a line's end ring isn't cut. */
  right: 10,
  /** Room above the chart, for the same. */
  top: 10,
} as const;

/** The colours, light then dark. Retune them on the block or a parent. */
const COLORS = cn(
  "[--mrr-up:oklch(0.55_0.15_152)] [--mrr-down:oklch(0.58_0.2_25)]",
  "dark:[--mrr-up:oklch(0.79_0.17_152)] dark:[--mrr-down:oklch(0.7_0.19_22)]"
);

const CSS = `
@keyframes mrr-ring { from { opacity: .55; transform: scale(1) } to { opacity: 0; transform: scale(2.6) } }
.mrr-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: mrr-ring 1.6s cubic-bezier(.23,1,.32,1) ${MOTION.sweep}s 2 both; }
@media (prefers-reduced-motion: reduce) { .mrr-ring { animation: none; opacity: 0; } }
`;

/* ─────────────────────────────────────────────────────────────────────────
 * The numbers.
 * ───────────────────────────────────────────────────────────────────────── */

const toTime = (value: Date | string | number) => new Date(value).getTime();

/** A change with its time and its signed effect on MRR worked out. */
interface Change extends MrrMovement {
  delta: number;
  lane: string;
  time: number;
}

const changeOf = (movement: MrrMovement): Change => {
  const delta = (movement.to?.mrr ?? 0) - (movement.from?.mrr ?? 0);
  const lane =
    (delta >= 0 ? movement.to?.plan : movement.from?.plan) ??
    movement.to?.plan ??
    movement.from?.plan ??
    "";
  return { ...movement, delta, lane, time: toTime(movement.at) };
};

/** What the change was, in a few words. */
const verbOf = (change: Change) => {
  if (!change.from) {
    return change.reactivation
      ? `Came back on ${change.to?.plan}`
      : `Started on ${change.to?.plan}`;
  }
  if (!change.to) {
    return `Cancelled ${change.from.plan}`;
  }
  return change.delta >= 0
    ? `Upgraded to ${change.to.plan}`
    : `Downgraded to ${change.to.plan}`;
};

/** The running totals at a moment: gained, lost, and their difference. */
const totalsAt = (changes: Change[], time: number) => {
  let gained = 0;
  let lost = 0;
  for (const change of changes) {
    if (change.time > time) {
      break;
    }
    if (change.delta >= 0) {
      gained += change.delta;
    } else {
      lost -= change.delta;
    }
  }
  return { gained, lost, net: gained - lost };
};

/** A round step that splits `span` into about `count` parts. */
const niceStep = (span: number, count: number) => {
  const raw = Math.max(span, 1) / count;
  const size = 10 ** Math.floor(Math.log10(raw));
  const lead = raw / size;
  const steps = [1, 2, 2.5, 5, 10];
  return (steps.find((step) => lead <= step) ?? 10) * size;
};

const monthStart = (time: number) => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
};

const monthEnd = (start: number) => {
  const date = new Date(start);
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime() - 1;
};

/**
 * Every change, the months that have any (plus the running month, once
 * it's past the last), and each month's net, for the month list.
 */
const useHistory = (
  movements: MrrMovement[] | undefined,
  now: MrrMovementsProps["now"]
) =>
  useMemo(() => {
    const isDemo = movements === undefined;
    const all = (movements ?? DEMO)
      .map(changeOf)
      .toSorted((a, b) => a.time - b.time);
    const today = toTime(now ?? (isDemo ? DEMO_NOW : Date.now()));
    const months = [...new Set(all.map((change) => monthStart(change.time)))];
    const current = monthStart(today);
    if (months.length === 0 || current > (months.at(-1) ?? 0)) {
      months.push(current);
    }
    const nets: Record<number, number> = {};
    for (const change of all) {
      const key = monthStart(change.time);
      nets[key] = (nets[key] ?? 0) + change.delta;
    }
    return { all, isDemo, months, nets, today };
  }, [movements, now]);

type History = ReturnType<typeof useHistory>;

/** One month, its plans and everything the plot is drawn from. */
const useModel = (history: History, start: number, plans?: string[]) =>
  useMemo(() => {
    const end = monthEnd(start);
    const changes = history.all.filter(
      (change) => change.time >= start && change.time <= end
    );
    const stop = Math.min(end, Math.max(history.today, start));
    // The same lanes every month, so switching never reshuffles them.
    const lanes =
      plans ??
      (history.isDemo
        ? DEMO_PLANS
        : [...new Set(history.all.map((change) => change.lane))]);
    const total = totalsAt(changes, end);
    const visible = changes.filter((change) => change.time <= stop);
    // Each plan's net, and the biggest single change (for the ticks' size).
    const laneNet = Object.fromEntries(
      lanes.map((lane) => [
        lane,
        visible
          .filter((change) => change.lane === lane)
          .reduce((sum, change) => sum + change.delta, 0),
      ])
    );
    const biggest = Math.max(1, ...visible.map((c) => Math.abs(c.delta)));
    // The scale fits the data, with a little air: gridlines sit on round
    // steps inside it, and the side below zero always has some room.
    const step = niceStep(total.gained + total.lost, 3);
    const yMax = Math.max(total.gained * 1.08, step / 2);
    const yMin = -Math.max(total.lost * 1.2, yMax * 0.14);
    return {
      biggest,
      changes,
      end,
      laneNet,
      lanes,
      start,
      stop,
      total,
      visible,
      yMax,
      yMin,
      yStep: step,
    };
  }, [history, plans, start]);

type Model = ReturnType<typeof useModel>;

/** Whether the period is still running: the lines end before it does. */
const isLive = (model: Model) => model.stop < model.end;

/* ─────────────────────────────────────────────────────────────────────────
 * Formatting.
 * ───────────────────────────────────────────────────────────────────────── */

const MINUS = "−";

const useFormat = (currency: string, locale?: string) =>
  useMemo(() => {
    const money = new Intl.NumberFormat(locale, {
      currency,
      maximumFractionDigits: 0,
      style: "currency",
    });
    const compact = new Intl.NumberFormat(locale, {
      currency,
      maximumFractionDigits: 1,
      notation: "compact",
      style: "currency",
    });
    const date = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    });
    const month = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    });
    const monthShort = new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
    });
    const signed = (value: number, format = money) => {
      if (value === 0) {
        return format.format(0);
      }
      return `${value > 0 ? "+" : MINUS}${format.format(Math.abs(value))}`;
    };
    return {
      axis: (value: number) => signed(value, compact),
      date: (time: number) => date.format(time),
      money: (value: number) => money.format(value),
      month: (time: number) => month.format(time),
      monthShort: (time: number) => monthShort.format(time),
      signed,
    };
  }, [currency, locale]);

type Format = ReturnType<typeof useFormat>;

/* ─────────────────────────────────────────────────────────────────────────
 * Geometry.
 * ───────────────────────────────────────────────────────────────────────── */

/** The value axis's labelled lines, one per step from the low end up. */
const axisValues = (model: Model) => {
  const values: number[] = [];
  const lowest = Math.ceil(model.yMin / model.yStep) * model.yStep;
  for (let v = lowest; v <= model.yMax; v += model.yStep) {
    values.push(v);
  }
  return values;
};

const useGeometry = (model: Model, format: Format, width: number) =>
  useMemo(() => {
    // From sm up the right gutter carries the end labels and plan nets.
    const wide = width >= 480;
    const chart = wide ? PLOT.chartWide : PLOT.chart;
    // The label column starts on the card's content edge, like the title
    // and the headline, and is as wide as its longest label plus a gap
    // before the plot. Plan names too long for it (a narrow card, long or
    // translated names) move above their lanes instead.
    const column = (chars: number) => Math.ceil(chars * PLOT.char + 16);
    const names = Math.max(0, ...model.lanes.map((lane) => lane.length));
    const values = Math.max(
      5,
      ...axisValues(model).map((value) => format.axis(value).length)
    );
    const stacked = column(names) > width * PLOT.labels;
    const left = column(stacked ? values : Math.max(names, values));
    const right = Math.max(left + 1, width - (wide ? PLOT.gutter : PLOT.right));
    const x = (time: number) =>
      left +
      ((time - model.start) / (model.end - model.start)) * (right - left);
    const y = (value: number) =>
      PLOT.top + ((model.yMax - value) / (model.yMax - model.yMin)) * chart;
    const lanesTop = PLOT.top + chart + PLOT.gap;
    const lane = stacked ? PLOT.laneStacked : PLOT.lane;
    // Stacked, the name sits at the top of the lane and the ticks (up to
    // 20px tall) just under it, closer to their name than to the next one.
    const laneY = (index: number) =>
      lanesTop + index * lane + (stacked ? 21 : lane / 2);
    const nameY = (index: number) =>
      stacked ? lanesTop + index * lane + 6 : laneY(index);
    const lanesBottom = lanesTop + model.lanes.length * lane;
    const height = lanesBottom + PLOT.axis;
    return {
      chart,
      height,
      laneY,
      lanesBottom,
      left,
      nameY,
      right,
      wide,
      width,
      x,
      y,
    };
  }, [format, model, width]);

type Geometry = ReturnType<typeof useGeometry>;

/** A running total as a step line, from the period's start to `stop`. */
const stepPath = (
  model: Model,
  geo: Geometry,
  pick: (totals: ReturnType<typeof totalsAt>) => number
) => {
  let value = 0;
  let d = `M${geo.x(model.start)},${geo.y(0)}`;
  for (const change of model.changes) {
    if (change.time > model.stop) {
      break;
    }
    const next = pick(totalsAt(model.changes, change.time));
    if (next !== value) {
      d += `H${geo.x(change.time)}V${geo.y(next)}`;
      value = next;
    }
  }
  return { d: `${d}H${geo.x(model.stop)}`, value };
};

/** The same line closed down to zero, for its dotted fill. */
const areaOf = (line: string, model: Model, geo: Geometry) =>
  `${line}V${geo.y(0)}H${geo.x(model.start)}Z`;

/* ─────────────────────────────────────────────────────────────────────────
 * Pieces.
 * ───────────────────────────────────────────────────────────────────────── */

/** The value grid and its labels, and the month's days along the bottom. */
const Axes = ({
  format,
  geo,
  model,
}: {
  format: Format;
  geo: Geometry;
  model: Model;
}) => {
  const values = axisValues(model);
  const days: number[] = [];
  for (let t = model.start; t <= model.end; t += 86_400_000) {
    days.push(t);
  }
  const axisY = geo.lanesBottom + 6;
  const live = isLive(model);
  const today = geo.x(model.stop);
  // A label every week, or every second week when the dates are too wide
  // for that (a narrow card, a long date format). One gives way to Today
  // when the two would touch.
  const labelWidth = (text: string) => text.length * PLOT.char;
  const widest = Math.max(...days.map((time) => labelWidth(format.date(time))));
  const week = geo.x(model.start + 7 * 86_400_000) - geo.x(model.start);
  const stride = 7 * Math.max(1, Math.ceil((widest + 8) / week));
  const clear = (widest + labelWidth("Today")) / 2 + 8;
  const weeks = days.filter(
    (time, i) =>
      i % stride === 0 && !(live && Math.abs(geo.x(time) - today) < clear)
  );
  return (
    <g className="font-mono text-[0.625rem]">
      {values.map((value) => (
        <g key={value}>
          {/* Plain hairlines: the dots belong to the data. */}
          <line
            className={value === 0 ? "stroke-border" : "stroke-border/50"}
            x1={geo.left}
            x2={geo.right}
            y1={geo.y(value)}
            y2={geo.y(value)}
          />
          <text
            className="fill-muted-foreground"
            dominantBaseline="middle"
            textAnchor="start"
            x={0}
            y={geo.y(value)}
          >
            {format.axis(value)}
          </text>
        </g>
      ))}
      {days.map((time, i) => (
        <line
          key={time}
          className="stroke-muted-foreground/40"
          x1={geo.x(time)}
          x2={geo.x(time)}
          y1={axisY}
          y2={axisY + (i % 7 === 0 ? 5 : 3)}
        />
      ))}
      {weeks.map((time) => (
        <text
          key={time}
          className="fill-muted-foreground"
          textAnchor="middle"
          x={geo.x(time)}
          y={axisY + 16}
        >
          {format.date(time)}
        </text>
      ))}
      {live && (
        <g>
          <line
            className="stroke-foreground/20"
            x1={today}
            x2={today}
            y1={PLOT.top}
            y2={axisY + 5}
          />
          <text
            className="fill-foreground"
            textAnchor="middle"
            x={today}
            y={axisY + 16}
          >
            Today
          </text>
        </g>
      )}
    </g>
  );
};

/**
 * A tick's height: 6px for the smallest change, up to 16px for the month's
 * biggest (by area, so a change four times bigger is twice as tall); the
 * picked one grows 4px more.
 */
const tickHeight = (change: Change, model: Model, on: boolean) =>
  6 + 10 * Math.sqrt(Math.abs(change.delta) / model.biggest) + (on ? 4 : 0);

/** One plan's lane: a track from its first change to its last, a tick each. */
const Lane = ({
  active,
  dim,
  geo,
  index,
  lane,
  model,
}: {
  active?: string;
  dim: boolean;
  geo: Geometry;
  index: number;
  lane: string;
  model: Model;
}) => {
  const changes = model.changes.filter(
    (change) => change.lane === lane && change.time <= model.stop
  );
  const y = geo.laneY(index);
  const [first] = changes;
  const last = changes.at(-1);
  if (!(first && last)) {
    return null;
  }
  const x1 = geo.x(first.time);
  const x2 = geo.x(last.time);
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
        x1={x1}
        x2={x2}
        y1={y}
        y2={y}
      />
      {changes.map((change) => {
        const height = tickHeight(change, model, change.id === active);
        return (
          <rect
            key={change.id}
            className={
              change.delta >= 0 ? "fill-(--mrr-up)" : "fill-(--mrr-down)"
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

/** The plans' names, in the label column, the picked one's lit. */
const LaneNames = ({
  activeLane,
  geo,
  model,
}: {
  activeLane?: string;
  geo: Geometry;
  model: Model;
}) => (
  <g className="font-mono text-[0.625rem]">
    {model.lanes.map((lane, index) => (
      <text
        key={lane}
        className={cn(
          "transition-opacity duration-150 ease-out",
          lane === activeLane ? "fill-foreground" : "fill-muted-foreground",
          activeLane && lane !== activeLane && "opacity-35"
        )}
        dominantBaseline="middle"
        textAnchor="start"
        x={0}
        y={geo.nameY(index)}
      >
        {lane}
      </text>
    ))}
  </g>
);

/** Each plan's net for the month, at the right edge beside its lane. */
const LaneNets = ({
  activeLane,
  format,
  geo,
  model,
}: {
  activeLane?: string;
  format: Format;
  geo: Geometry;
  model: Model;
}) => (
  <g className="font-mono text-[0.625rem]">
    {model.lanes.map((lane, index) => (
      <text
        key={lane}
        className={cn(
          "transition-opacity duration-150 ease-out",
          lane === activeLane ? "fill-foreground" : "fill-muted-foreground",
          activeLane && lane !== activeLane && "opacity-35"
        )}
        dominantBaseline="middle"
        textAnchor="end"
        x={geo.width}
        y={geo.laneY(index)}
      >
        {format.signed(model.laneNet[lane] ?? 0)}
      </text>
    ))}
  </g>
);

/**
 * Each line named at its own end: gained and lost with their totals, the
 * dotted one as Net. Nudged apart when they'd overlap.
 */
const EndLabels = ({
  format,
  geo,
  gained,
  lost,
  net,
  x,
}: {
  format: Format;
  geo: Geometry;
  gained: number;
  lost: number;
  net: number;
  x: number;
}) => {
  const labels = [
    {
      className: "fill-(--mrr-up)",
      text: format.signed(gained),
      y: geo.y(gained),
    },
    { className: "fill-muted-foreground", text: "Net", y: geo.y(net) },
    {
      className: "fill-(--mrr-down)",
      text: format.signed(lost),
      y: geo.y(lost),
    },
  ].toSorted((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i += 1) {
    const above = labels[i - 1];
    const label = labels[i];
    if (above && label) {
      label.y = Math.max(label.y, above.y + 13);
    }
  }
  return (
    <g className="font-mono text-[0.625rem]">
      {labels.map((label) => (
        <text
          key={label.text}
          className={label.className}
          dominantBaseline="middle"
          x={x + 9}
          y={label.y}
        >
          {label.text}
        </text>
      ))}
    </g>
  );
};

/**
 * The change under the pointer, as a diff of the customer's plans. Every
 * line wraps rather than truncating: it floats over the plot, so a long
 * name or a translated plan only makes it taller.
 */
const ChangeCard = ({
  change,
  format,
  width,
}: {
  change: Change;
  format: Format;
  width: number;
}) => (
  <div
    className="bg-popover text-popover-foreground overflow-hidden rounded-lg border shadow-lg"
    style={{ width }}
  >
    <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5">
      <span className="min-w-0 text-sm font-medium break-words">
        {change.customer}
      </span>
      <span className="text-muted-foreground shrink-0 font-mono text-[0.6875rem] whitespace-nowrap">
        {format.date(change.time)}
      </span>
    </div>
    <div className="flex flex-wrap items-baseline gap-x-2 px-3 pt-0.5 pb-2.5 text-xs">
      <span
        className={cn(
          "font-mono font-medium",
          change.delta >= 0 ? "text-(--mrr-up)" : "text-(--mrr-down)"
        )}
      >
        {format.signed(change.delta)}/mo
      </span>
      <span className="text-muted-foreground">{verbOf(change)}</span>
    </div>
    <div className="border-t font-mono text-xs">
      {change.from && (
        <div className="flex items-center gap-2 bg-(--mrr-down)/10 px-3 py-1.5">
          <span className="text-(--mrr-down)">{MINUS}</span>
          <span className="min-w-0 flex-1 break-words">{change.from.plan}</span>
          <span className="text-muted-foreground shrink-0 whitespace-nowrap">
            {format.money(change.from.mrr)}/mo
          </span>
        </div>
      )}
      {change.to && (
        <div className="flex items-center gap-2 bg-(--mrr-up)/10 px-3 py-1.5">
          <span className="text-(--mrr-up)">+</span>
          <span className="min-w-0 flex-1 break-words">{change.to.plan}</span>
          <span className="text-muted-foreground shrink-0 whitespace-nowrap">
            {format.money(change.to.mrr)}/mo
          </span>
        </div>
      )}
    </div>
  </div>
);

/** The crosshair at a change, with a mark on each line where it crosses. */
const Crosshair = ({
  change,
  geo,
  model,
}: {
  change: Change;
  geo: Geometry;
  model: Model;
}) => {
  const reduce = useReducedMotion();
  const totals = totalsAt(model.changes, change.time);
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
        { className: "fill-(--mrr-up)", value: totals.gained },
        { className: "fill-(--mrr-down)", value: -totals.lost },
        { className: "fill-foreground", value: totals.net },
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

/* ─────────────────────────────────────────────────────────────────────────
 * The plot.
 * ───────────────────────────────────────────────────────────────────────── */

/** A month leaving slides the way you're leaving it and fades. */
const LAYER = {
  leave: (direction: number) => ({
    opacity: 0,
    transition: { duration: MOTION.leave, ease: EASE_IN_OUT },
    x: -direction * 16,
  }),
  shown: { opacity: 1, x: 0 },
};

/**
 * One month's data: the lines and their fill, the lanes' ticks, the line
 * ends and their labels, each plan's net. Keyed by month, so switching
 * months swaps the whole layer: the new one draws in on `progress` (its
 * clip and its ends follow it), while the old one keeps its last look and
 * slides away (it stops reading `progress` once it's leaving, which by
 * then has gone back to 0 for the new month).
 */
const DataLayer = ({
  active,
  format,
  geo,
  model,
  progress,
}: {
  active?: Change;
  format: Format;
  geo: Geometry;
  model: Model;
  progress: MotionValue<number>;
}) => {
  const present = useIsPresent();
  const raw = useId();
  const id = raw.replaceAll(/[^a-zA-Z0-9]/gu, "");
  const gained = stepPath(model, geo, (t) => t.gained);
  const lost = stepPath(model, geo, (t) => -t.lost);
  const net = stepPath(model, geo, (t) => t.net);
  const sweep = useTransform(progress, (p) => p * geo.width);
  const ends = useTransform(progress, [0.85, 1], [0, 1]);
  const endX = geo.x(model.stop);
  const settled = present ? ends : 1;
  return (
    <motion.g animate="shown" exit="leave" initial={false} variants={LAYER}>
      <defs>
        {[
          ["up", "var(--mrr-up)"],
          ["down", "var(--mrr-down)"],
        ].map(([name, color]) => (
          <pattern
            key={name}
            height={4}
            id={`${id}-${name}`}
            patternUnits="userSpaceOnUse"
            width={4}
          >
            <circle cx={2} cy={2} fill={color} opacity={0.6} r={0.7} />
          </pattern>
        ))}
        <clipPath id={`${id}-sweep`}>
          <motion.rect
            height={geo.height}
            width={present ? sweep : geo.width}
            x={0}
            y={0}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-sweep)`}>
        <path d={areaOf(gained.d, model, geo)} fill={`url(#${id}-up)`} />
        <path d={areaOf(lost.d, model, geo)} fill={`url(#${id}-down)`} />
        <path
          className="stroke-(--mrr-up)"
          d={gained.d}
          fill="none"
          strokeLinejoin="round"
          strokeWidth={1.75}
        />
        <path
          className="stroke-(--mrr-down)"
          d={lost.d}
          fill="none"
          strokeLinejoin="round"
          strokeWidth={1.75}
        />
        <path
          className="stroke-foreground/70"
          d={net.d}
          fill="none"
          strokeDasharray="0.5 3.5"
          strokeLinecap="round"
          strokeWidth={1.5}
        />
        {model.lanes.map((lane, index) => (
          <Lane
            key={lane}
            active={active?.id}
            dim={Boolean(active) && active?.lane !== lane}
            geo={geo}
            index={index}
            lane={lane}
            model={model}
          />
        ))}
      </g>
      <motion.g style={{ opacity: active ? 0 : settled }}>
        {[
          { className: "fill-(--mrr-up)", value: gained.value },
          { className: "fill-(--mrr-down)", value: lost.value },
        ].map((mark) => (
          <g key={mark.className}>
            {isLive(model) && (
              <circle
                className={cn("mrr-ring", mark.className)}
                cx={endX}
                cy={geo.y(mark.value)}
                r={3.5}
              />
            )}
            <circle
              className={mark.className}
              cx={endX}
              cy={geo.y(mark.value)}
              r={3}
            />
          </g>
        ))}
        <circle
          className="fill-foreground"
          cx={endX}
          cy={geo.y(net.value)}
          r={2.25}
        />
        {geo.wide && model.visible.length > 0 && (
          <EndLabels
            format={format}
            gained={gained.value}
            geo={geo}
            lost={lost.value}
            net={net.value}
            x={endX}
          />
        )}
      </motion.g>
      {geo.wide && (
        <motion.g style={{ opacity: settled }}>
          <LaneNets
            activeLane={active?.lane}
            format={format}
            geo={geo}
            model={model}
          />
        </motion.g>
      )}
    </motion.g>
  );
};

const Plot = ({
  active,
  direction,
  format,
  geo,
  model,
  progress,
}: {
  active?: Change;
  direction: number;
  format: Format;
  geo: Geometry;
  model: Model;
  progress: MotionValue<number>;
}) => (
  // Time runs left to right here in every language, so the chart keeps
  // its own direction: in a right-to-left page the anchors and dates
  // would otherwise flip and spill out of the card.
  <svg
    aria-hidden
    className="block overflow-visible"
    direction="ltr"
    height={geo.height}
    width={geo.width}
  >
    {/* A new month's scale: the grid and its labels crossfade. */}
    <AnimatePresence initial={false}>
      <motion.g
        key={model.start}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{ duration: MOTION.axes, ease: EASE_IN_OUT }}
      >
        <Axes format={format} geo={geo} model={model} />
      </motion.g>
    </AnimatePresence>
    <LaneNames activeLane={active?.lane} geo={geo} model={model} />
    {model.visible.length === 0 && (
      <text
        className="fill-muted-foreground text-xs"
        dominantBaseline="middle"
        textAnchor="middle"
        x={(geo.left + geo.right) / 2}
        y={geo.y(0) - 18}
      >
        No changes yet
      </text>
    )}
    <AnimatePresence custom={direction} initial={false}>
      <DataLayer
        key={model.start}
        active={active}
        format={format}
        geo={geo}
        model={model}
        progress={progress}
      />
    </AnimatePresence>
    {active && <Crosshair change={active} geo={geo} model={model} />}
  </svg>
);

/** Follows an element's width. */
const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry?.contentRect.width ?? 0))
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
};

/**
 * The month draws in the first time the card is in view, and again,
 * quicker, each time the month changes. `progress` runs 0 → 1 across the
 * sweep; the plot's clip and the headline both read it.
 */
const useDrawIn = (month: number) => {
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.35, once: true });
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const [drawn, setDrawn] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (!inView) {
      return;
    }
    if (reduce) {
      progress.set(1);
      setDrawn(true);
      return;
    }
    const duration = first.current ? MOTION.sweep : MOTION.redraw;
    first.current = false;
    setDrawn(false);
    progress.set(0);
    const controls = animate(progress, 1, {
      duration,
      ease: EASE_IN_OUT,
      onComplete: () => setDrawn(true),
    });
    return () => controls.stop();
  }, [inView, month, progress, reduce]);

  return { drawn, inView, progress, root };
};

/**
 * Numbers and the caption morph rather than swap. A figure spins digit by
 * digit straight from the old month's value to the new one, on the same
 * length and curve as the redraw, so it lands as the lines do. The caption
 * is lighter: a quick ease-out, like any small text change.
 */
const MORPH = {
  number: {
    duration: MOTION.redraw * 1000,
    easing: "cubic-bezier(0.65, 0, 0.35, 1)",
  },
  text: { duration: 300, ease: "cubic-bezier(0.23, 1, 0.32, 1)" },
};

const signOf = (value: number) => {
  if (value > 0) {
    return "+";
  }
  return value < 0 ? MINUS : "";
};

/**
 * A signed amount of money that morphs between values. The sign sits
 * outside the number so it's a true minus, like every other figure here.
 */
const Money = ({
  animated = true,
  className,
  currency,
  locale,
  value,
}: {
  animated?: boolean;
  className?: string;
  currency: string;
  locale?: string;
  value: number;
}) => (
  <NumberFlow
    animated={animated}
    className={cn("tabular-nums", className)}
    format={{ currency, maximumFractionDigits: 0, style: "currency" }}
    locales={locale}
    prefix={signOf(value)}
    spinTiming={MORPH.number}
    transformTiming={MORPH.number}
    value={Math.abs(value)}
  />
);

/** A chevron pointing down, for the month list. */
const Chevron = () => (
  <svg
    aria-hidden
    className="size-3.5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.6}
    viewBox="0 0 16 16"
  >
    <path d="m4 6 4 4 4-4" />
  </svg>
);

/** A month's name slides in from the side you're heading to. */
const LABEL = {
  enter: (direction: number) => ({
    filter: "blur(2px)",
    opacity: 0,
    x: direction * 10,
  }),
  leave: (direction: number) => ({
    filter: "blur(2px)",
    opacity: 0,
    transition: { duration: MOTION.labelOut, ease: EASE_OUT },
    x: -direction * 10,
  }),
  shown: {
    filter: "blur(0px)",
    opacity: 1,
    transition: { duration: MOTION.labelIn, ease: EASE_OUT },
    x: 0,
  },
};

/**
 * Picks the month: its name opens the list of every month with changes
 * (plus the running one), newest first, each with its net.
 */
const MonthPicker = ({
  current,
  direction,
  format,
  history,
  onPick,
}: {
  current: number;
  direction: number;
  format: Format;
  history: History;
  onPick: (month: number) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      {/* Pulled out by its padding (0.5rem) plus the chevron's own inset
          to its stroke's tip (0.175rem), so the tip sits on the card's
          content edge. */}
      <Button
        aria-label={`Month: ${format.month(current)}`}
        className="-me-[0.675rem] shrink-0 gap-1.5 px-2 font-normal"
        size="sm"
        variant="ghost"
      >
        <span className="grid justify-items-end overflow-hidden">
          <AnimatePresence custom={direction} initial={false}>
            <motion.span
              key={current}
              animate="shown"
              className="col-start-1 row-start-1 whitespace-nowrap"
              custom={direction}
              exit="leave"
              initial="enter"
              variants={LABEL}
            >
              {/* Phones get the short name, so the title keeps room. */}
              <span className="sm:hidden">{format.monthShort(current)}</span>
              <span className="max-sm:hidden">{format.month(current)}</span>
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="text-muted-foreground">
          <Chevron />
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-60">
      <DropdownMenuRadioGroup
        onValueChange={(value) => onPick(Number(value))}
        value={String(current)}
      >
        {history.months.toReversed().map((month) => (
          <DropdownMenuRadioItem key={month} value={String(month)}>
            <span className="flex-1">{format.month(month)}</span>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {format.signed(history.nets[month] ?? 0)}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

/* ─────────────────────────────────────────────────────────────────────────
 * The block.
 * ───────────────────────────────────────────────────────────────────────── */

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

const KEY_STEP: Record<string, number> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
};

/**
 * The month shown: `month` when it's controlled, else the one picked,
 * else `defaultMonth`, else the latest. Picking also records which way
 * you went, for the motion.
 */
const useMonth = ({
  defaultMonth,
  history,
  month,
  onMonthChange,
}: {
  defaultMonth?: MrrMovementsProps["defaultMonth"];
  history: History;
  month?: MrrMovementsProps["month"];
  onMonthChange?: MrrMovementsProps["onMonthChange"];
}) => {
  const latest = history.months.at(-1) ?? monthStart(history.today);
  const [picked, setPicked] = useState(() =>
    defaultMonth === undefined ? undefined : monthStart(toTime(defaultMonth))
  );
  const [direction, setDirection] = useState(1);
  const current =
    month === undefined ? (picked ?? latest) : monthStart(toTime(month));
  const pick = (next: number) => {
    if (next === current) {
      return;
    }
    setDirection(next > current ? 1 : -1);
    setPicked(next);
    onMonthChange?.(new Date(next));
  };
  return { current, direction, pick };
};

export const MrrMovements = ({
  className,
  currency = "USD",
  defaultMonth,
  locale = "en-US",
  month,
  movements,
  now,
  onMonthChange,
  plans,
  title = "MRR movements",
  ...props
}: MrrMovementsProps) => {
  const history = useHistory(movements, now);
  const { current, direction, pick } = useMonth({
    defaultMonth,
    history,
    month,
    onMonthChange,
  });
  const model = useModel(history, current, plans);
  const format = useFormat(currency, locale);
  const { ref: plotRef, width } = useWidth();
  const geo = useGeometry(model, format, width);
  const { drawn, inView, progress, root } = useDrawIn(current);
  const shown = model.changes.filter((change) => change.time <= model.stop);
  const [activeId, setActiveId] = useState<string>();
  // A change from another month is never shown as picked.
  const active = shown.find((change) => change.id === activeId);
  const index = active ? shown.indexOf(active) : -1;

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!drawn) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    setActiveId(nearest(shown, geo, event.clientX - box.left)?.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = index;
    const step = KEY_STEP[event.key];
    if (step !== undefined) {
      // Nothing picked yet: the first step lands on the first (or last).
      let origin = index;
      if (index === -1) {
        origin = step > 0 ? -1 : shown.length;
      }
      next = Math.min(shown.length - 1, Math.max(0, origin + step));
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = shown.length - 1;
    } else if (event.key === "Escape") {
      setActiveId(undefined);
      return;
    } else {
      return;
    }
    event.preventDefault();
    setActiveId(shown[next]?.id);
  };

  const net = active ? totalsAt(model.changes, active.time).net : undefined;
  const caption = active
    ? `As of ${format.date(active.time)}`
    : `${isLive(model) ? "Month to date" : "Whole month"} · ${shown.length} changes`;
  // The change card sits beside the crosshair, flips to its left near the
  // right edge, and never leaves the plot.
  const crossX = active ? geo.x(active.time) : 0;
  // Never wider than the plot, in a narrow card.
  const tipWidth = Math.min(TIP.width, geo.width);
  const beside =
    crossX + TIP.gap + tipWidth > geo.width
      ? crossX - TIP.gap - tipWidth
      : crossX + TIP.gap;
  const tipX = Math.max(0, Math.min(beside, geo.width - tipWidth));

  return (
    <MotionConfig reducedMotion="user">
      <Card
        ref={root}
        data-slot="mrr-movements"
        className={cn(COLORS, "w-full max-w-2xl gap-0 py-0", className)}
        {...props}
      >
        <style>{CSS}</style>
        {/* Read out again whenever the month changes. */}
        <p aria-live="polite" className="sr-only">
          {`${title}, ${format.month(model.start)}: ${format.signed(model.total.gained)} gained, ${format.signed(-model.total.lost)} lost, net ${format.signed(model.total.net)}, across ${shown.length} changes.`}
        </p>
        <div className="px-5 pt-4">
          {/* A long title wraps rather than hiding: the month stays level
            with its first line (the trigger is 2rem, the line 1.25rem). */}
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 py-1.5 text-sm font-medium text-pretty">
              {title}
            </p>
            <MonthPicker
              current={current}
              direction={direction}
              format={format}
              history={history}
              onPick={(next) => {
                setActiveId(undefined);
                pick(next);
              }}
            />
          </div>
          {/* The headline: the month's net. It counts up from zero the
            first time the card comes into view, then morphs straight from
            one month's net to the next. While a change is picked it shows
            the net at that moment, without animation (it moves a lot). */}
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <Money
              animated={!active}
              className={HERO}
              currency={currency}
              locale={locale}
              value={
                net ?? (inView ? totalsAt(model.changes, model.stop).net : 0)
              }
            />
            <span className="text-muted-foreground text-sm">net new MRR</span>
          </div>
          {/* Wraps rather than truncating. While a change is picked it's
            only the date: the customer is in the card right below, and a
            short line keeps the plot from jumping while you scrub. */}
          <p className="text-muted-foreground mt-1 text-xs">
            {/* Morphs when the month changes; not while scrubbing. */}
            <TextMorph
              as="span"
              disabled={Boolean(active)}
              duration={MORPH.text.duration}
              ease={MORPH.text.ease}
              locale={locale}
              respectReducedMotion
            >
              {caption}
            </TextMorph>
          </p>
          {/* Phones have no end labels: the month's totals get their own
            line, so the caption above never has to share it. */}
          <p className="mt-0.5 flex gap-2 font-mono text-xs sm:hidden">
            <Money
              className="text-(--mrr-up)"
              currency={currency}
              locale={locale}
              value={model.total.gained}
            />
            <Money
              className="text-(--mrr-down)"
              currency={currency}
              locale={locale}
              value={-model.total.lost}
            />
          </p>
        </div>
        <div ref={plotRef} className="relative mx-5 mt-5 mb-4">
          {width > 0 && (
            <Plot
              active={active}
              direction={direction}
              format={format}
              geo={geo}
              model={model}
              progress={progress}
            />
          )}
          {/* The plot's input: pointer, touch and keys all pick a change.
            Placed once the plot is measured, like the chart: its edges
            come from the label widths, which the server can't know. */}
          {width > 0 && (
            <div
              aria-label="Changes this month"
              aria-valuemax={shown.length}
              aria-valuemin={1}
              aria-valuenow={index + 1 || 1}
              aria-valuetext={
                active
                  ? `${format.date(active.time)}: ${active.customer}, ${verbOf(active)}, ${format.signed(active.delta)} a month`
                  : "Use the arrow keys to step through the changes"
              }
              className="focus-visible:ring-ring/50 absolute inset-y-0 rounded-md outline-none focus-visible:ring-[3px]"
              onBlur={() => setActiveId(undefined)}
              onKeyDown={onKeyDown}
              onPointerDown={onPointer}
              onPointerLeave={() => setActiveId(undefined)}
              onPointerMove={onPointer}
              role="slider"
              style={{
                left: geo.left,
                touchAction: "pan-y",
                width: Math.max(0, geo.right - geo.left),
              }}
              tabIndex={shown.length > 0 ? 0 : -1}
            />
          )}
          <AnimatePresence>
            {active && (
              <motion.div
                key="tip"
                animate={{
                  opacity: 1,
                  scale: 1,
                  x: tipX,
                }}
                className="pointer-events-none absolute top-0 left-0 z-10 origin-top-left"
                exit={{
                  opacity: 0,
                  scale: 0.97,
                  transition: { duration: MOTION.tipOut },
                }}
                initial={{
                  opacity: 0,
                  scale: 0.97,
                  x: tipX,
                }}
                transition={{
                  opacity: { duration: MOTION.tipIn, ease: EASE_OUT },
                  scale: { duration: MOTION.tipIn, ease: EASE_OUT },
                  x: GLIDE,
                }}
              >
                <ChangeCard change={active} format={format} width={tipWidth} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </MotionConfig>
  );
};

export default MrrMovements;
