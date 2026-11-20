"use client";

import {
  Delete02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { FADE_ONLY, MOTION, SWAP_IN } from "./billing-motion";
import { CardMark } from "./brand-marks";
import { canCharge, describe, healthOf, statusLine } from "./card-data";
import type { SavedCard } from "./card-data";
import { StatusButton, useButtonState } from "./status-button";
import { LIFT, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * CARD SLOTS
 *
 *   ┌───────────────────────────┐
 *   │ [VISA] Default          ● │   the pill stays; its words roll
 *   │                           │
 *   │ Company card              │   nickname, if any
 *   │ •••• 4242                 │
 *   │ Declined on Nov 1 [Retry] │   health line rolls when it changes
 *   └───────────────────────────┘
 *
 * The face is a picture; a transparent radio laid over it does the
 * choosing, so real buttons (Retry, Update, ✎, 🗑) can sit on the card
 * above it without nesting buttons.
 *
 * Health: declined (red, Retry) · expired (red, Update, can't be
 * chosen) · updated by your bank (green) · expiring (amber) · ok.
 * ───────────────────────────────────────────────────────── */

const FACE = `${LIFT} bg-background dark:bg-muted relative flex min-h-32 w-full flex-col justify-between gap-3 rounded-xl p-4 sm:aspect-[1.7]`;

const TONE: Record<ReturnType<typeof healthOf>, string> = {
  declined: "text-red-600 dark:text-red-400",
  expired: "text-red-600 dark:text-red-400",
  expiring: "text-amber-700 dark:text-amber-400",
  ok: "text-muted-foreground",
  updated: "text-emerald-700 dark:text-emerald-400",
};

const ICON_BUTTON =
  "text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/70 dark:bg-background/40 dark:hover:bg-background/70 focus-visible:ring-ring/50 relative z-10 flex size-7 items-center justify-center rounded-full outline-none transition-[background-color,color] duration-150 ease-out focus-visible:ring-[3px] aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

const SMALL_ACTION = cn(
  RING_BUTTON,
  "relative z-10 h-7 rounded-md px-2.5 text-xs"
);

/** A line of text that rolls up when its words change. */
const Rolling = ({
  children,
  className,
}: {
  children: string;
  className?: string;
}) => {
  const reduce = useReducedMotion();
  return (
    <span className="relative block overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={children}
          initial={{ opacity: 0, y: reduce ? 0 : "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : "-100%" }}
          transition={MOTION.roll}
          className={cn("block", className)}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

/** Default / Backup. The pill stays put on its card: when roles swap,
 *  only its words roll (Default ↔ Backup) and its tint cross-fades.
 *  Both words sit invisibly in one cell, so its width never changes. */
const RolePill = ({ kind }: { kind: "default" | "backup" }) => {
  const reduce = useReducedMotion();
  const word = kind === "default" ? "Default" : "Backup";
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: MOTION.enter }}
      exit={{ opacity: 0, transition: MOTION.exit }}
      className={cn(
        "inline-grid overflow-hidden rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
        "transition-[background-color,color] duration-200 ease-out",
        kind === "default"
          ? "bg-primary/10 text-primary dark:bg-primary/25 dark:text-blue-200"
          : "bg-muted text-muted-foreground dark:bg-background/50"
      )}
    >
      <span aria-hidden className="invisible col-start-1 row-start-1">
        Default
      </span>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        Backup
      </span>
      <span className="relative col-start-1 row-start-1 text-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={word}
            initial={{ opacity: 0, y: reduce ? 0 : "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : "-100%" }}
            transition={MOTION.roll}
            className="block"
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  );
};

const Dot = ({ on }: { on: boolean }) => (
  <span
    aria-hidden
    className={cn(
      "flex size-4 items-center justify-center rounded-full",
      on
        ? "bg-primary"
        : "shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--muted-foreground)_45%,transparent)]"
    )}
  >
    {on ? (
      <span className="bg-primary-foreground size-1.5 rounded-full" />
    ) : null}
  </span>
);

/* OPTICAL CENTRING: both glyphs are centred by their outer bounds,
 * but the eye centres the enclosed shape. Measured as filled shapes
 * in the 24-unit grid, drawn at 14px:
 *   pencil-edit  weight at 11.29, 12.66 (the box outweighs the pencil)
 *                → nudge 0.5px right, 0.5px up
 *   trash        weight at 11.97, 12.29 (the can outweighs the lid)
 *                → nudge 0.25px up
 * The icons move, the circles don't. */
const TrashIcon = () => (
  <HugeiconsIcon
    icon={Delete02Icon}
    strokeWidth={1.75}
    className="size-3.5 -translate-y-[0.25px]"
  />
);

const EditActions = ({
  card,
  isDefault,
  editing,
  onEdit,
  onRemove,
}: {
  card: SavedCard;
  isDefault: boolean;
  editing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) => (
  <span className="flex gap-1.5">
    <button
      type="button"
      aria-label={`Edit ${describe(card)}`}
      aria-pressed={editing}
      onClick={onEdit}
      className={ICON_BUTTON}
    >
      <HugeiconsIcon
        icon={PencilEdit02Icon}
        strokeWidth={1.75}
        className="size-3.5 translate-x-[0.5px] -translate-y-[0.5px]"
      />
    </button>
    {isDefault ? (
      // The default card can't go: say why instead of hiding the button.
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Remove ${describe(card)}`}
            aria-disabled
            aria-describedby={`why-${card.id}`}
            className={ICON_BUTTON}
          >
            <TrashIcon />
          </button>
        </TooltipTrigger>
        <TooltipContent id={`why-${card.id}`}>
          Choose another default card first
        </TooltipContent>
      </Tooltip>
    ) : (
      <button
        type="button"
        aria-label={`Remove ${describe(card)}`}
        onClick={onRemove}
        className={ICON_BUTTON}
      >
        <TrashIcon />
      </button>
    )}
  </span>
);

// Retry for a declined card; Update for an expired one.
const HealthAction = ({
  card,
  onRetry,
  onUpdate,
}: {
  card: SavedCard;
  onRetry: () => Promise<void>;
  onUpdate: () => void;
}) => {
  const [state, run] = useButtonState(900);
  const health = healthOf(card);
  if (health === "declined" || state !== "idle") {
    return (
      <StatusButton
        type="button"
        variant="outline"
        size="sm"
        className={SMALL_ACTION}
        state={state}
        labels={{ busy: "Retrying…", done: "Paid", idle: "Retry" }}
        onClick={() => run(onRetry)}
      />
    );
  }
  if (health === "expired") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={SMALL_ACTION}
        onClick={onUpdate}
      >
        Update
      </Button>
    );
  }
  return null;
};

export const CardSlot = ({
  card,
  isDefault,
  isBackup,
  editMode,
  editing,
  onSelect,
  onEdit,
  onRemove,
  onRetry,
}: {
  card: SavedCard;
  isDefault: boolean;
  isBackup: boolean;
  editMode: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onRetry: () => Promise<void>;
}) => {
  const reduce = useReducedMotion();
  const swap = reduce ? FADE_ONLY : SWAP_IN;
  const health = healthOf(card);
  const choosable = !editMode && canCharge(card);
  const outlined = editMode ? editing : isDefault;

  return (
    <div
      className={cn(
        "relative rounded-xl outline-2 outline-offset-2 transition-[outline-color] duration-150 ease-out",
        outlined ? "outline-primary" : "outline-transparent"
      )}
    >
      <div className={cn(FACE, health === "expired" && "opacity-80")}>
        {/* One 28px line (the ✎/🗑 size): logo 24, pill 20, dot 16 and
            the buttons all centre on it, at 14px. */}
        <span className="flex h-7 items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <CardMark brand={card.brand} />
            <AnimatePresence initial={false}>
              {isDefault || isBackup ? (
                <RolePill key="role" kind={isDefault ? "default" : "backup"} />
              ) : null}
            </AnimatePresence>
          </span>
          <AnimatePresence initial={false} mode="popLayout">
            {editMode ? (
              <motion.span
                key="edit"
                {...swap}
                transition={MOTION.swap}
                // flex: an inline wrapper adds line-height and drops the
                // buttons below the row's centre.
                className="flex"
              >
                <EditActions
                  card={card}
                  isDefault={isDefault}
                  editing={editing}
                  onEdit={onEdit}
                  onRemove={onRemove}
                />
              </motion.span>
            ) : (
              <motion.span
                key="dot"
                {...swap}
                transition={MOTION.swap}
                className="flex"
              >
                {canCharge(card) ? <Dot on={isDefault} /> : null}
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <span className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            {card.nickname ? (
              <span className="text-muted-foreground truncate text-xs">
                {card.nickname}
              </span>
            ) : null}
            <span className="text-sm tabular-nums">•••• {card.last4}</span>
            <Rolling className={cn("text-xs tabular-nums", TONE[health])}>
              {statusLine(card)}
            </Rolling>
          </span>
          {editMode ? null : (
            <HealthAction card={card} onRetry={onRetry} onUpdate={onEdit} />
          )}
        </span>
      </div>

      {/* The chooser: a transparent radio over the whole card. */}
      {choosable ? (
        <button
          type="button"
          role="radio"
          aria-checked={isDefault}
          aria-label={`${describe(card)}, ${statusLine(card)}${isDefault ? ", default" : ""}${isBackup ? ", backup" : ""}`}
          tabIndex={isDefault ? 0 : -1}
          data-card={card.id}
          onClick={onSelect}
          className="focus-visible:ring-ring/50 absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px]"
        />
      ) : null}
    </div>
  );
};

// An empty slot: a recessed well with a dashed edge (an SVG stroke,
// not a CSS border; rx matches rounded-xl). Only the first one offers
// Add card; the rest are just room.
export const EmptySlot = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "bg-muted/50 dark:bg-background/40 relative flex min-h-32 items-center justify-center rounded-xl shadow-[inset_0_1px_3px_oklch(0_0_0/0.07)] sm:aspect-[1.7] dark:shadow-[inset_0_1px_3px_oklch(0_0_0/0.5)]",
      className
    )}
  >
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <rect
        width="100%"
        height="100%"
        rx="12"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="6 5"
        className="stroke-foreground/20"
      />
    </svg>
    {children}
  </div>
);

export const AddCardButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={onClick}
    className={cn(RING_BUTTON, "gap-1.5")}
  >
    <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4" />
    Add card
  </Button>
);
