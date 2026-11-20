"use client";

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnimatePresence,
  motion,
  PresenceContext,
  useReducedMotion,
} from "motion/react";
import type * as React from "react";
import { useContext, useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * MOTION shared by the block's parts.
 *
 *   entering / exiting   ease-out    (0.23, 1, 0.32, 1)
 *   moving on screen     ease-in-out (0.645, 0.045, 0.355, 1)
 *   typing, focus, keyboard: never animated
 *   reduced motion: fades only
 * ───────────────────────────────────────────────────────── */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;
// Quadratic ease-out: speed falls in a straight line from 2× average to 0.
// Moves from the first frame (12% at 16ms over 260ms), never jumps more
// than 12% a frame, and has no long creeping tail: one continuous motion.
// For tall reveals, where ease-in-out's slow start reads as a second step.
export const EASE_OUT_QUAD = [0.5, 1, 0.89, 1] as const;

// Popovers grow out of the control that opened them (Base UI's transform
// origin), scale 0.95 → 1 + fade, 150ms ease-out; close in 100ms. The
// reduced-motion overrides carry the same data-open/closed as shadcn's zoom
// and slide classes, so they're as specific and win.
export const POPOVER_MOTION =
  "origin-(--transform-origin) ease-[cubic-bezier(0.23,1,0.32,1)] data-open:duration-150 data-closed:duration-100 motion-reduce:data-open:[--tw-enter-scale:1] motion-reduce:data-closed:[--tw-exit-scale:1] motion-reduce:data-open:[--tw-enter-translate-x:0] motion-reduce:data-closed:[--tw-exit-translate-x:0] motion-reduce:data-open:[--tw-enter-translate-y:0] motion-reduce:data-closed:[--tw-exit-translate-y:0]";

/** Resolves after `ms`: the demo's stand-in for a network call. */
export const wait = (ms: number) =>
  // oxlint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// Something opening below a field (Save / Cancel): height 0 → auto,
// 210ms ease-in-out (the rows below are on screen and move), with a fade
// (ease-out); closes in 150ms. Clipped only while moving, so focus rings
// show once it's open. Reduced motion: the fade only.
//
// Taller content: pass `enter` / `exit` (seconds) and `tall`. Tall uses
// EASE_OUT_QUAD for the height (no slow start), and a quick fade with no
// delay: in over the first 60% of the open, out over the first half of
// the close, so the content is gone before the box gets small.
export const Reveal = ({
  children,
  className,
  enter = 0.21,
  exit = 0.15,
  tall = false,
}: {
  children: React.ReactNode;
  className?: string;
  enter?: number;
  exit?: number;
  tall?: boolean;
}) => {
  const reduce = useReducedMotion();
  // Clip only while it moves. Rows already there on first paint (inside
  // AnimatePresence initial={false}) never animate, so they must start
  // unclipped, or they'd stay clipped (cutting rings, outlines) forever.
  const presence = useContext(PresenceContext);
  const animatesIn = presence?.initial !== false;
  const [moving, setMoving] = useState(!reduce && animatesIn);
  const timing = (duration: number, opening: boolean) => {
    const fade = tall ? duration * (opening ? 0.6 : 0.5) : duration;
    return {
      height: { duration, ease: tall ? EASE_OUT_QUAD : EASE_IN_OUT },
      opacity: { duration: fade, ease: tall ? EASE_OUT_QUAD : EASE_OUT },
    };
  };
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1, transition: timing(enter, true) }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { height: 0, opacity: 0, transition: timing(exit, false) }
      }
      onAnimationStart={() => setMoving(!reduce)}
      onAnimationComplete={() => setMoving(false)}
      style={{ overflow: moving ? "hidden" : "visible" }}
    >
      <div className={className}>{children}</div>
    </motion.div>
  );
};

// A short confirmation under a field ("Saved", "Verified just now"): a
// green tick and meta text, fading in (150ms ease-out). With `hideAfter`
// it fades away again after that many ms.
export const DoneNote = ({
  children,
  hideAfter,
  stamp,
}: {
  children: React.ReactNode;
  hideAfter?: number;
  // Change it to show the note again (0 = hidden).
  stamp: number;
}) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (stamp === 0) {
      return;
    }
    setShown(stamp);
    if (!hideAfter) {
      return;
    }
    const timer = setTimeout(() => setShown(0), hideAfter);
    return () => clearTimeout(timer);
  }, [stamp, hideAfter]);

  return (
    <AnimatePresence initial={false}>
      {shown ? (
        <motion.p
          key="done"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: EASE_OUT }}
          aria-live="polite"
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
        >
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-3.5 text-emerald-600 dark:text-emerald-400"
          />
          {children}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
};

// The visible area around an element: its nearest scrolling box (a
// settings pane, a preview stage), or the window.
const viewOf = (el: HTMLElement) => {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      const { bottom, top } = node.getBoundingClientRect();
      return { bottom, top };
    }
  }
  return { bottom: window.innerHeight, top: 0 };
};

// Points the eye at a card after the page scrolls to it: an outline in
// the brand (primary) colour at 55% that fades out once (900ms ease-out). An outline, not
// a shadow, so it never fights the card's own ring; no movement, so it
// stays under reduced motion. Runs when the scroll settles (or at once
// if the card is already in view).
export const flash = (el: HTMLElement) => {
  const run = () => {
    el.animate(
      [
        {
          outline:
            "2px solid color-mix(in oklch, var(--primary) 55%, transparent)",
          outlineOffset: "2px",
        },
        { outline: "2px solid transparent", outlineOffset: "2px" },
      ],
      { duration: 900, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  };
  const box = el.getBoundingClientRect();
  const view = viewOf(el);
  if (box.top >= view.top && box.bottom <= view.bottom) {
    run();
    return;
  }
  // Whichever comes first, the scroll settling or a 700ms fallback (for
  // browsers without scrollend), runs it once; the abort clears the other.
  // scrollend doesn't bubble, so it's heard in the capture phase.
  const done = new AbortController();
  const settle = () => {
    done.abort();
    run();
  };
  const timer = setTimeout(settle, 700);
  done.signal.addEventListener("abort", () => clearTimeout(timer));
  document.addEventListener("scrollend", settle, {
    capture: true,
    signal: done.signal,
  });
};
