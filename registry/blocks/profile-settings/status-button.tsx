"use client";

import {
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { EASE_OUT } from "./motion";

/* ─────────────────────────────────────────────────────────
 * STATUS BUTTON: an async button whose label rolls to its new state.
 *
 *   [ Add passkey ]  click
 *        ↑ label leaves upward (y 0 → -100%, fades)
 *        ↑ the spinner rises in from below (y 100% → 0)
 *   [      ◌      ]  spinner only, centred (busy words: screen readers only)
 *   [   ✓ Added   ]  same roll; back to idle after 1.5s
 *
 * FIXED WIDTH: the button never changes size. Every state's label is
 * stacked invisibly in one grid cell, so the button is as wide as its
 * longest label from the first paint; the visible label is centred on top.
 *
 * MOTION
 *   label roll    200ms ease-out, out and in together (popLayout, so the
 *                 two labels pass like a conveyor, never stacked)
 *   spinner       600ms a turn (a fast spinner reads as a fast app)
 *   press         0.96 scale, from the shadcn button itself
 *   reduced       labels cross-fade in place; the spinner holds still
 *
 * While busy the button is aria-disabled, not disabled: it keeps full
 * colour (shadcn dims disabled buttons, which would fade the loader) and
 * keeps keyboard focus; clicks are ignored. aria-busy tells screen readers.
 *
 * `trailing` (e.g. a ⌘S key hint) shows after the idle words only, and
 * is part of the idle sizer, so the width still never changes.
 * ───────────────────────────────────────────────────────── */

export type ButtonState = "idle" | "busy" | "done";

const ROLL = { duration: 0.2, ease: EASE_OUT };

const StateIcon = ({
  icon,
  state,
}: {
  icon?: IconSvgElement;
  state: ButtonState;
}) => {
  if (state === "busy") {
    return (
      <HugeiconsIcon
        icon={Loading03Icon}
        strokeWidth={2}
        className="size-4 animate-[spin_600ms_linear_infinite] motion-reduce:animate-none"
      />
    );
  }
  if (state === "done") {
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        strokeWidth={2}
        className="size-4 text-emerald-600 dark:text-emerald-400"
      />
    );
  }
  return icon ? (
    <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-4" />
  ) : null;
};

interface Labels {
  idle: string;
  busy?: string;
  done?: string;
}

const STATES: ButtonState[] = ["idle", "busy", "done"];

// The label for a state: the spinner alone while busy (its words go to
// screen readers), otherwise the state's icon and words.
const LabelContent = ({
  icon,
  labels,
  state,
  trailing,
}: {
  icon?: IconSvgElement;
  labels: Labels;
  state: ButtonState;
  trailing?: React.ReactNode;
}) => (
  <>
    <StateIcon icon={icon} state={state} />
    {state === "busy" ? (
      <span className="sr-only">{labels.busy ?? labels.idle}</span>
    ) : (
      (labels[state] ?? labels.idle)
    )}
    {state === "idle" ? trailing : null}
  </>
);

// The rolling label. Keyed by state + text, so any change of words rolls
// (Continue → Verify in a dialog), not only a change of state.
export const RollingLabel = ({
  icon,
  labels,
  reserve = [],
  state,
  trailing,
}: {
  icon?: IconSvgElement;
  labels: Labels;
  /** Other words this button can show (e.g. "Set up" ↔ "Turn off"): room is kept for them too. */
  reserve?: string[];
  state: ButtonState;
  /** Shown after the idle words only (e.g. a key hint). */
  trailing?: React.ReactNode;
}) => {
  const reduce = useReducedMotion();
  const cell = "col-start-1 row-start-1 flex items-center justify-center";
  return (
    <span className="inline-grid overflow-hidden">
      {/* Sizers: every state, invisible, in the same cell. */}
      {/* Only the states this button uses: a "done" it never shows
          would reserve room for a ✓ it never draws. */}
      {STATES.filter((each) => each === "idle" || labels[each]).map((each) => (
        <span
          key={each}
          aria-hidden
          className={cn(cell, "invisible gap-1.5 whitespace-nowrap")}
        >
          <LabelContent
            icon={icon}
            labels={labels}
            state={each}
            trailing={trailing}
          />
        </span>
      ))}
      {reserve.map((words) => (
        <span
          key={`reserve:${words}`}
          aria-hidden
          className={cn(cell, "invisible gap-1.5 whitespace-nowrap")}
        >
          {words}
        </span>
      ))}
      <span className={cn(cell, "relative")}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={`${state}:${labels[state] ?? labels.idle}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
            initial={{ opacity: 0, y: reduce ? 0 : "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : "-100%" }}
            transition={ROLL}
          >
            <LabelContent
              icon={icon}
              labels={labels}
              state={state}
              trailing={trailing}
            />
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
};

type StatusButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "children"
> & {
  /** Idle, busy (spinner) or done (check). */
  state: ButtonState;
  /** The words for each state; busy and done fall back to idle. */
  labels: Labels;
  /** Icon shown while idle. */
  icon?: IconSvgElement;
  /** Shown after the idle words only (e.g. a key hint). */
  trailing?: React.ReactNode;
};

export const StatusButton = ({
  className,
  icon,
  labels,
  onClick,
  state,
  trailing,
  ...props
}: StatusButtonProps) => {
  const busy = state === "busy";
  return (
    <Button
      {...props}
      aria-busy={busy || undefined}
      aria-disabled={busy || props["aria-disabled"] || undefined}
      onClick={(event) => {
        if (!busy) {
          onClick?.(event);
        }
      }}
      className={cn(busy && "cursor-progress", className)}
    >
      <RollingLabel
        icon={icon}
        state={state}
        labels={labels}
        trailing={trailing}
      />
    </Button>
  );
};

/**
 * Runs an async action as idle → busy → done → idle. Returns the state
 * and `run`, which resolves true on success; on failure it goes straight
 * back to idle and resolves false (show your own error message).
 */
export const useButtonState = (doneFor = 1500) => {
  const [state, setState] = useState<ButtonState>("idle");
  useEffect(() => {
    if (state !== "done") {
      return;
    }
    const timer = setTimeout(() => setState("idle"), doneFor);
    return () => clearTimeout(timer);
  }, [state, doneFor]);

  const run = async (action: () => Promise<unknown>, showDone = true) => {
    setState("busy");
    try {
      await action();
    } catch {
      setState("idle");
      return false;
    }
    setState(showDone ? "done" : "idle");
    return true;
  };

  return [state, run] as const;
};
