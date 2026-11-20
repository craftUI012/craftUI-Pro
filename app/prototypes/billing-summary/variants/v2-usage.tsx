"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { EASE_OUT } from "./motion";
import {
  Amount,
  HistoryCard,
  HistoryRow,
  LinkAction,
  Pill,
  SummaryCard,
  usd,
  useAppear,
} from "./shared";

// V2 · USAGE-BASED (Snowflake, Laravel Cloud, Cofounder, Cursor)
//   Spend this month (daily bars: past solid, rest of month ghosted as the
//   forecast)   Budget (used + where the forecast lands)   Daily average
// Bars grow up from the baseline when first seen, 12ms apart (≈ 360ms),
// each 250ms ease-out; amounts roll up. A forecast over budget turns the
// budget card amber and says by how much.
const DAYS = 30;
const TODAY = 18;
const DAILY = [
  0.6, 0.9, 1.4, 1.1, 0.8, 0.5, 0.4, 1.6, 2.1, 1.8, 1.5, 1.2, 0.7, 0.6, 2.4,
  2.9, 3.4, 2.6,
];
const SPENT = DAILY.reduce((sum, day) => sum + day, 0);
const AVERAGE = SPENT / TODAY;
const FORECAST = SPENT + AVERAGE * (DAYS - TODAY);
const BUDGET = 50;
const MAX = Math.max(...DAILY, AVERAGE) * 1.1;

// Where this month's spend went; sums to SPENT ($26.50).
const SERVICES = [
  { amount: 12.4, label: "Compute", meta: "412 vCPU-hours" },
  { amount: 7.85, label: "Database", meta: "2 Postgres instances" },
  { amount: 3.95, label: "Storage", meta: "198 GB-months" },
  { amount: 2.3, label: "Bandwidth", meta: "46 GB out" },
];

const Share = ({ share, on }: { share: number; on: boolean }) => (
  <span
    aria-hidden
    className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full"
  >
    <motion.span
      initial={{ scaleX: 0 }}
      animate={{ scaleX: on ? share : 0 }}
      transition={{ delay: 0.2, duration: 0.5, ease: EASE_OUT }}
      className="bg-foreground/70 absolute inset-0 origin-left rounded-full"
    />
  </span>
);

const Bars = ({ on }: { on: boolean }) => {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="flex h-16 items-end gap-[3px]">
      {Array.from({ length: DAYS }, (_, day) => {
        const past = day < TODAY;
        const value = past ? (DAILY[day] ?? 0) : AVERAGE;
        return (
          <motion.span
            // Days are fixed positions in the month.
            // oxlint-disable-next-line react/no-array-index-key
            key={day}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: on ? 1 : 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { delay: day * 0.012, duration: 0.25, ease: EASE_OUT }
            }
            style={{ height: `${(value / MAX) * 100}%` }}
            className={cn(
              "flex-1 origin-bottom rounded-sm",
              past ? "bg-foreground/80" : "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
};

export const V2Usage = () => {
  const { ref, shown } = useAppear(
    { average: AVERAGE, forecast: FORECAST, on: true, spent: SPENT },
    { average: 0, forecast: 0, on: false, spent: 0 }
  );
  const over = FORECAST > BUDGET;
  const usedShare = Math.min(1, SPENT / BUDGET);
  const forecastShare = Math.min(1, FORECAST / BUDGET);

  return (
    <div className="flex w-full flex-col gap-3">
      <div ref={ref} className="grid w-full gap-3 md:grid-cols-4">
        <SummaryCard
          label="Spend this month"
          className="md:col-span-2"
          aside={
            <span className="text-muted-foreground text-xs">
              Nov 1 – 30 · day {TODAY}
            </span>
          }
        >
          <div className="flex items-baseline justify-between gap-4">
            <Amount text={usd(shown.spent)} suffix="so far" />
            <p className="text-muted-foreground text-xs">
              Forecast{" "}
              <span className="text-foreground tabular-nums">
                {usd(shown.forecast)}
              </span>
            </p>
          </div>
          <Bars on={shown.on} />
        </SummaryCard>

        <SummaryCard
          label="Budget"
          aside={
            over ? (
              <Pill tone="warn">Over by {usd(FORECAST - BUDGET, false)}</Pill>
            ) : (
              <Pill tone="ok">On track</Pill>
            )
          }
        >
          <Amount text={usd(BUDGET, false)} suffix="a month" />
          {/* Used (solid) and where the forecast lands (tinted), on one track. */}
          <div className="bg-muted relative h-2 overflow-hidden rounded-full">
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: shown.on ? forecastShare : 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: EASE_OUT }}
              className={cn(
                "absolute inset-y-0 left-0 w-full origin-left rounded-full",
                over ? "bg-amber-500/35" : "bg-foreground/15"
              )}
            />
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: shown.on ? usedShare : 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className={cn(
                "absolute inset-y-0 left-0 w-full origin-left rounded-full",
                over ? "bg-amber-500" : "bg-foreground/80"
              )}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {Math.round(usedShare * 100)}% used · forecast{" "}
            {Math.round((FORECAST / BUDGET) * 100)}%
          </p>
          <LinkAction>Set alerts</LinkAction>
        </SummaryCard>

        <SummaryCard label="Daily average">
          <Amount text={usd(shown.average)} suffix="/ day" />
          <p className="text-muted-foreground text-xs">Up 18% on last month</p>
          <p className="text-muted-foreground text-xs">$20.51 credit left</p>
          <LinkAction>Top up</LinkAction>
        </SummaryCard>
      </div>
      <HistoryCard title="By service this month" action="Usage details">
        {SERVICES.map((row) => (
          <HistoryRow
            key={row.label}
            label={row.label}
            meta={row.meta}
            amount={usd(row.amount)}
            middle={<Share share={row.amount / SPENT} on={shown.on} />}
          />
        ))}
      </HistoryCard>
    </div>
  );
};
