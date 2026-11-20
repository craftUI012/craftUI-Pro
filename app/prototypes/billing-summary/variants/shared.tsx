"use client";

import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import type * as React from "react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Odometer } from "@/registry/blocks/billing-settings/odometer";
import { useButtonState } from "@/registry/blocks/billing-settings/status-button";
import { LIFT } from "@/registry/blocks/billing-settings/surface";

import { Reveal, SLIDE } from "./motion";

// Prototype-only building blocks for the billing summary variants.
// TYPE: 18/500 amounts and titles, 14/500 labels, 14/400 body, 12/400 meta.

export const usd = (value: number, cents = true) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
    style: "currency",
  }).format(value);

export const group = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

/** 0 until the element is in view, then the value: an Odometer fed by
 *  this rolls each digit up from 0 the first time the card appears. */
export const useAppear = <T,>(value: T, empty: T) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: true });
  // Derived, not stored: callers pass a fresh object each render.
  return { ref, shown: inView ? value : empty };
};

/** A summary card: lifted, quiet, label on top. */
export const SummaryCard = ({
  children,
  className,
  label,
  aside,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  aside?: React.ReactNode;
}) => (
  <section
    aria-label={label}
    className={cn(
      LIFT,
      "bg-card flex min-w-0 flex-col gap-3 rounded-2xl p-4",
      className
    )}
  >
    {/* min-h-5: the same header height with or without a pill, so
        amounts line up across a row of cards. */}
    <div className="flex min-h-5 items-center justify-between gap-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      {aside}
    </div>
    {children}
  </section>
);

/** A rolling amount, counted up from 0 on first view. */
export const Amount = ({ text, suffix }: { text: string; suffix?: string }) => (
  <p className="flex items-baseline gap-1">
    <Odometer text={text} className="text-lg font-medium" />
    {suffix ? (
      <span className="text-muted-foreground text-xs">{suffix}</span>
    ) : null}
  </p>
);

/** Quiet text action with a chevron (link variant, foreground colour). */
export const LinkAction = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  /** A fuller name for screen readers, when the words alone are vague. */
  label?: string;
  onClick?: () => void;
}) => (
  <Button
    type="button"
    variant="link"
    size="sm"
    aria-label={label}
    onClick={onClick}
    className="text-foreground -mx-1.5 h-6 gap-1 self-start px-1.5 has-[>svg]:px-1.5"
  >
    {children}
    <HugeiconsIcon
      icon={ArrowRight01Icon}
      strokeWidth={2}
      className="size-3.5"
    />
  </Button>
);

/** Status pill: a word and a colour, never colour alone. */
export const Pill = ({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  children: React.ReactNode;
}) => (
  <span
    className={cn(
      "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
      tone === "ok" &&
        "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
      tone === "warn" &&
        "bg-amber-500/15 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300",
      tone === "bad" &&
        "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
      tone === "muted" && "bg-muted text-muted-foreground"
    )}
  >
    <span aria-hidden className="size-1.5 rounded-full bg-current" />
    {children}
  </span>
);

// Switch press-stretch overrides (literal, so Tailwind sees them).
export const SWITCH_MOTION = [
  "[&_[data-slot=switch-thumb]]:transition-[translate,width,background-color]",
  "[&_[data-slot=switch-thumb]]:duration-200",
  "[&_[data-slot=switch-thumb]]:ease-[cubic-bezier(0.23,1,0.32,1)]",
  "[&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[14px]",
  "active:[&_[data-slot=switch-thumb]]:w-5",
  "active:[&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[10px]",
  "motion-reduce:[&_[data-slot=switch-thumb]]:transition-none",
  "motion-reduce:active:[&_[data-slot=switch-thumb]]:w-4",
  "motion-reduce:active:[&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[14px]",
].join(" ");

/** Demo action: resolves after 0.9s. */
export const demoWait = async (ms = 900) => {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/** Prototype chrome: names the variant and the industry it comes from. */
export const VariantFrame = ({
  children,
  idea,
  name,
}: {
  children: React.ReactNode;
  idea: string;
  name: string;
}) => (
  <section className="flex w-full flex-col items-center gap-4">
    <div className="flex max-w-2xl flex-col items-center gap-1 text-center">
      <p className="text-sm font-medium">{name}</p>
      <p className="text-muted-foreground text-xs text-pretty">{idea}</p>
    </div>
    {children}
  </section>
);

/* ─────────────────────────────────────────────────────────
 * HISTORY: the list under the summary row. Something done in a card
 * (paid, withdrew, bought) lands here as a new row: it opens in
 * (Reveal, 210ms) and its tint fades over 1.2s, so the eye sees where
 * the money went. No rules between rows: space groups them.
 * ───────────────────────────────────────────────────────── */

export const HistoryCard = ({
  title,
  children,
  action = "View all",
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
}) => (
  <section
    aria-label={title}
    className={cn(LIFT, "bg-card flex flex-col gap-1 rounded-2xl p-2")}
  >
    <div className="flex items-center justify-between gap-3 px-2 pt-2 pb-1">
      <h2 className="text-sm font-medium">{title}</h2>
      <LinkAction>{action}</LinkAction>
    </div>
    <ul className="flex flex-col">
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  </section>
);

export const HistoryRow = ({
  label,
  meta,
  amount,
  middle,
  action,
  fresh = false,
}: {
  label: string;
  meta: string;
  amount: string;
  /** A pill or small bar between the words and the amount. */
  middle?: React.ReactNode;
  /** A small icon button at the end of the row. */
  action?: React.ReactNode;
  /** Added after the page loaded: tinted, then fades to plain. */
  fresh?: boolean;
}) => {
  const reduce = useReducedMotion();
  return (
    <li>
      <Reveal>
        <div className="relative flex items-center gap-3 rounded-xl px-2 py-2">
          {fresh ? (
            <motion.span
              aria-hidden
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{
                delay: reduce ? 0 : 0.4,
                duration: 1.2,
                ease: "easeOut",
              }}
              className="bg-primary/[0.07] dark:bg-primary/15 absolute inset-0 rounded-xl"
            />
          ) : null}
          <div className="relative flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm">{label}</span>
            <span className="text-muted-foreground truncate text-xs">
              {meta}
            </span>
            {middle ? (
              <span className="mt-1 flex sm:hidden">{middle}</span>
            ) : null}
          </div>
          {middle ? (
            <span className="relative hidden w-32 sm:flex">{middle}</span>
          ) : null}
          <span className="relative w-24 text-right text-sm tabular-nums">
            {amount}
          </span>
          {action ? <span className="relative flex">{action}</span> : null}
        </div>
      </Reveal>
    </li>
  );
};

// Icon swap per better-ui: scale 0.25 → 1, opacity, blur 4px → 0,
// spring 0.3 bounce 0. Reduced motion: opacity only.
const SWAP = {
  animate: { filter: "blur(0px)", opacity: 1, scale: 1 },
  exit: { filter: "blur(4px)", opacity: 0, scale: 0.25 },
  initial: { filter: "blur(4px)", opacity: 0, scale: 0.25 },
};
const SWAP_REDUCED = {
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  initial: { opacity: 0 },
};

const DOWNLOAD_ICON = {
  busy: Loading03Icon,
  done: CheckmarkCircle02Icon,
  idle: Download04Icon,
};

/** Download for one row: ↓ → spinner → ✓, the icons cross-fade in place. */
export const RowDownload = ({ what }: { what: string }) => {
  const reduce = useReducedMotion();
  const [state, run] = useButtonState();
  const busy = state === "busy";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Download ${what}`}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (state === "idle") {
          run(() => demoWait(900));
        }
      }}
      className={cn(
        "text-muted-foreground hover:text-foreground relative size-8",
        busy && "cursor-progress"
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          {...(reduce ? SWAP_REDUCED : SWAP)}
          transition={SLIDE}
          className={cn(
            "flex",
            state === "done" && "text-emerald-600 dark:text-emerald-400"
          )}
        >
          <HugeiconsIcon
            icon={DOWNLOAD_ICON[state]}
            strokeWidth={1.75}
            className={cn(
              "size-4",
              busy &&
                "animate-[spin_600ms_linear_infinite] motion-reduce:animate-none"
            )}
          />
        </motion.span>
      </AnimatePresence>
      <span aria-live="polite" className="sr-only">
        {state === "done" ? `${what} downloaded` : ""}
      </span>
    </Button>
  );
};
