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

import { useBillingActions } from "./actions";
import { MOTION } from "./billing-motion";
import { Odometer } from "./odometer";
import { useButtonState } from "./status-button";
import { LIFT } from "./surface";

/* Small pieces shared across the block.
 * TYPE: 18/500 amounts and titles, 14/500 labels, 14/400 body, 12/400 meta. */

export const usd = (value: number, cents = true) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
    style: "currency",
  }).format(value);

/** 0 until the element is in view, then the value: an Odometer fed by
 *  this rolls each digit up from 0 the first time it appears. */
export const useAppear = <T,>(value: T, empty: T) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: true });
  // Derived, not stored: callers pass a fresh object each render.
  return { ref, shown: inView ? value : empty };
};

/** A card: lifted, quiet, label on top. */
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
    {/* min-h-5: the same header height with or without a pill. */}
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

// Switch press-stretch: the thumb widens toward where it's going while
// pressed. Literal classes, so Tailwind sees them.
export const SWITCH_MOTION = [
  "[&_[data-slot=switch-thumb]]:transition-[translate,width,background-color]",
  "[&_[data-slot=switch-thumb]]:duration-200",
  "[&_[data-slot=switch-thumb]]:ease-[cubic-bezier(0.23,1,0.32,1)]",
  "[&_[data-slot=switch-thumb][data-checked]]:translate-x-[14px]",
  "active:[&_[data-slot=switch-thumb]]:w-5",
  "active:[&_[data-slot=switch-thumb][data-checked]]:translate-x-[10px]",
  "motion-reduce:[&_[data-slot=switch-thumb]]:transition-none",
  "motion-reduce:active:[&_[data-slot=switch-thumb]]:w-4",
  "motion-reduce:active:[&_[data-slot=switch-thumb][data-checked]]:translate-x-[14px]",
].join(" ");

// Icon swap: scale 0.25 → 1, opacity, blur 4px → 0, spring 0.3 bounce 0.
// Reduced motion: opacity only.
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

/** Download for one invoice: ↓ → spinner → ✓, the icons cross-fade. */
export const RowDownload = ({ id, what }: { id: string; what: string }) => {
  const reduce = useReducedMotion();
  const actions = useBillingActions();
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
          run(() => actions.downloadInvoice(id));
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
          transition={MOTION.swap}
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
