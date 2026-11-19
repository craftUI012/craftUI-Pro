"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { EASE_OUT, Reveal } from "./motion";
import { RING } from "./surface";

/* ─────────────────────────────────────────────────────────
 * SECURITY CHECKUP: how many protections are on, and what's left.
 *
 *   ( 2/5 )  Security checkup
 *            2 at risk, 1 recommended
 *   Two-factor authentication   ● At risk
 *   Off: a stolen password is enough to get in
 *   Turn on →
 *
 * No rules between items: space alone groups them (lines read as noise).
 *
 * THREE STATUSES, each a word and a colour (never colour alone):
 *   ● Done          green   protected, nothing to do
 *   ● Recommended   yellow  not urgent, makes the account safer
 *   ● At risk       red     fix this now
 *
 * The ring counts what's done and takes the colour of the worst status
 * left: red while anything is at risk, yellow while only recommendations
 * remain, green when everything is done. It fills as things get fixed
 * (400ms ease-out on the stroke: feedback for what the person just did);
 * reduced motion: it jumps to its new value.
 *
 * WHEN AN ITEM CHANGES (you fixed it, or it slipped back)
 *   badge     its label rolls to the new status (200ms ease-out, y 100%
 *             → 0; the new colour comes with it). The slot is as wide as
 *             the widest status, so nothing beside it moves.
 *   action    the fix link folds away when done (height 150ms ease-in-out
 *             with a fade) and opens again if the item slips back
 *   counter   the done count rolls with the ring: up from below when it
 *             rises, down from above when it falls (200ms ease-out)
 *   reduced   fades only
 * ───────────────────────────────────────────────────────── */

export type CheckupStatus = "done" | "recommended" | "risk";

/** One protection in the checkup. */
export interface CheckupItem {
  /** Unique id. */
  id: string;
  /** What it is, e.g. "Two-factor authentication". */
  label: string;
  /** Done (green), recommended (yellow) or at risk (red). */
  status: CheckupStatus;
  /** One line on its state, e.g. "Off: a stolen password is enough to get in". */
  hint: string;
  /** The fix, shown until it's done, e.g. { label: "Turn on" }. */
  action?: { label: string; onClick: () => void };
}

const STATUS: Record<
  CheckupStatus,
  { label: string; badge: string; stroke: string }
> = {
  done: {
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
    label: "Done",
    stroke: "stroke-emerald-500",
  },
  recommended: {
    badge:
      "bg-amber-500/15 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300",
    label: "Recommended",
    stroke: "stroke-amber-500",
  },
  risk: {
    badge: "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
    label: "At risk",
    stroke: "stroke-red-500",
  },
};

export const StatusBadge = ({ status }: { status: CheckupStatus }) => (
  <span
    className={cn(
      "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
      STATUS[status].badge
    )}
  >
    <span aria-hidden className="size-1.5 rounded-full bg-current" />
    {STATUS[status].label}
  </span>
);

const ROLL = { duration: 0.2, ease: EASE_OUT };
const ORDER: CheckupStatus[] = ["risk", "recommended", "done"];

// The badge in a slot as wide as the widest status ("Recommended"), so a
// change never shifts the label beside it. The pill hugs its own words
// and sits at the slot's end (narrow) or start (wide, after the label).
const RollingBadge = ({ status }: { status: CheckupStatus }) => {
  const reduce = useReducedMotion();
  return (
    <span className="inline-grid shrink-0 overflow-hidden">
      {ORDER.map((each) => (
        <span
          key={each}
          aria-hidden
          className="invisible col-start-1 row-start-1"
        >
          <StatusBadge status={each} />
        </span>
      ))}
      <span className="relative col-start-1 row-start-1 flex justify-end sm:justify-start xl:justify-end">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={status}
            initial={{ opacity: 0, y: reduce ? 0 : "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : "-100%" }}
            transition={ROLL}
          >
            <StatusBadge status={status} />
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
};

// The done count, rolling in the direction it moved.
const RollingCount = ({ value }: { value: number }) => {
  const reduce = useReducedMotion();
  // Direction of the last change, kept in state (adjusted during render,
  // React's pattern for "previous value"), so StrictMode's double render
  // can't flip it.
  const [prev, setPrev] = useState(value);
  const [up, setUp] = useState(true);
  if (value !== prev) {
    setPrev(value);
    setUp(value > prev);
  }
  const from = up ? "100%" : "-100%";
  const to = up ? "-100%" : "100%";
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout" custom={to}>
        <motion.span
          key={value}
          custom={to}
          initial={{ opacity: 0, y: reduce ? 0 : from }}
          animate={{ opacity: 1, y: 0 }}
          variants={{
            exit: (y: string) => ({ opacity: 0, y: reduce ? 0 : y }),
          }}
          exit="exit"
          transition={ROLL}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const worstOf = (items: CheckupItem[]): CheckupStatus => {
  if (items.some((item) => item.status === "risk")) {
    return "risk";
  }
  if (items.some((item) => item.status === "recommended")) {
    return "recommended";
  }
  return "done";
};

// "2 at risk, 1 recommended"; once nothing is left, says so.
const summaryOf = (items: CheckupItem[]) => {
  const risk = items.filter((item) => item.status === "risk").length;
  const recommended = items.filter(
    (item) => item.status === "recommended"
  ).length;
  const parts = [
    risk > 0 ? `${risk} at risk` : null,
    recommended > 0 ? `${recommended} recommended` : null,
  ].filter(Boolean);
  return parts.length > 0
    ? parts.join(", ")
    : "Everything's done. Your account is well protected.";
};

const SIZE = 64;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ProgressRing = ({
  done,
  status,
  total,
}: {
  done: number;
  status: CheckupStatus;
  total: number;
}) => {
  const reduce = useReducedMotion();
  return (
    <div className="relative size-16 shrink-0">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
        className="size-full -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - done / total) }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }
          }
          className={cn(
            "transition-[stroke] duration-200",
            STATUS[status].stroke
          )}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-medium tabular-nums">
        <RollingCount value={done} />/{total}
      </span>
    </div>
  );
};

export const SecurityCheckup = ({
  className,
  items,
}: {
  className?: string;
  items: CheckupItem[];
}) => {
  const done = items.filter((item) => item.status === "done").length;
  return (
    <section
      aria-label="Security checkup"
      className={cn(
        RING,
        "bg-card flex flex-col gap-4 rounded-xl p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <ProgressRing
          done={done}
          total={items.length}
          status={worstOf(items)}
        />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Security checkup</p>
          <p aria-live="polite" className="text-muted-foreground text-sm">
            {summaryOf(items)}
          </p>
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-5">
        {items.map((item) => (
          // Narrow (phones, and the xl side column): label and badge, hint,
          // then the fix underneath. Wide (full width, sm to xl): the fix
          // sits on the right and the badge follows the label.
          <li
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center sm:gap-4 xl:flex-col xl:items-stretch xl:gap-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-3 sm:justify-start xl:justify-between">
                <p className="text-sm font-medium">{item.label}</p>
                <RollingBadge status={item.status} />
              </div>
              <p className="text-muted-foreground text-xs text-pretty">
                {item.hint}
              </p>
            </div>
            {/* Folds away once done (the 4px above it folds with it). */}
            <AnimatePresence initial={false}>
              {item.status !== "done" && item.action ? (
                // A quiet text action, not an outlined button: the badge
                // carries the urgency, and the real controls live in the
                // sections this points to. Override: foreground, not the
                // primary colour; 24px tall for an easy target.
                <Reveal key="action" className="pt-1 sm:pt-0 xl:pt-1">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-foreground h-6 gap-1 px-0 has-[>svg]:px-0"
                    onClick={item.action.onClick}
                  >
                    {item.action.label}
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                  </Button>
                </Reveal>
              ) : null}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </section>
  );
};
