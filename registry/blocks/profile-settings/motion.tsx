"use client";

import {
  AnimatePresence,
  motion,
  PresenceContext,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import type * as React from "react";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/* ─────────────────────────────────────────────────────────
 * MOTION for the profile settings block.
 *
 *   entering / exiting   ease-out    (0.23, 1, 0.32, 1)
 *   moving on screen     ease-in-out (0.645, 0.045, 0.355, 1)
 *   everything ≤ 260ms, exits ~30% faster than entrances
 *   typing, focus, keyboard: never animated
 *   reduced motion: opacity only, no travel, no height, no scale
 * ───────────────────────────────────────────────────────── */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;
// Quadratic ease-out: speed falls in a straight line from 2× average to 0.
// Moves from the first frame (12% at 16ms over 260ms), never jumps more
// than 12% a frame, and has no long creeping tail: one continuous motion.
// For tall reveals, where ease-in-out's slow start reads as a second step.
export const EASE_OUT_QUAD = [0.5, 1, 0.89, 1] as const;

export const MOTION = {
  // The save bar rising in once something changes, and sinking out.
  bar: { enter: 0.22, exit: 0.18, rise: 12 },
  // Leaving with unsaved changes: the bar shakes once, and its message
  // says why for this long (ms).
  nudge: 0.36,
  nudgeHold: 2400,
  // Something opening below a field (email actions, notes, lists).
  reveal: { enter: 0.21, exit: 0.15 },
  // How long "Saved" stays before the bar settles (ms).
  savedHold: 1100,
  // Status icons (spinner → check), dots, small swaps.
  status: 0.15,
  // A new photo crossfading in.
  swap: 0.2,
  // One thing replaced by another in place: the old one fades out
  // quickly, the new one in just after, so they barely overlap.
  swapSpace: { in: 0.16, inDelay: 0.04, out: 0.12 },
};

/** Resolves after `ms`: the demo's stand-in for a network call. */
export const wait = (ms: number) =>
  // oxlint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/* ─────────────────────────────────────────────────────────
 * REVEAL: something appearing below what's already there, so the rows
 * under it slide instead of jumping.
 *
 *   height 0 ↔ auto   210ms ease-in-out (the rows below are on screen
 *                     and moving; a strong ease-out did 60% of the
 *                     travel in the first frame, which read as a jump)
 *   opacity 0 ↔ 1     210ms ease-out (the content is entering)
 *   exit              150ms, or 210ms when it swaps with another Reveal
 *   tall              for anything ~150px or taller: pass `tall` with
 *                     `enter` / `exit` (e.g. 0.26 / 0.18). Height and fade
 *                     both on EASE_OUT_QUAD, the fade with no delay (60%
 *                     of the open, 50% of the close): one motion, no slow
 *                     start, gone before the box gets small
 *   reduced motion    opacity only
 *
 * Animates to "auto", never a measured number, so a Reveal inside a
 * Reveal moves frame for frame. Clips only while moving, so focus rings
 * show once it's open; a Reveal already there on first paint (inside
 * AnimatePresence initial={false}) never animates, so it starts unclipped. Spacing goes inside (`className`), so nothing is
 * left over when it unmounts.
 * ───────────────────────────────────────────────────────── */

export const Reveal = ({
  children,
  className,
  enter = MOTION.reveal.enter,
  exit,
  swap = false,
  tall = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Open duration, seconds. */
  enter?: number;
  /** Close duration, seconds. */
  exit?: number;
  // Trades places with another Reveal (one leaves as the other arrives):
  // both run at the enter duration, so their heights cross smoothly and
  // the rows below move one way only.
  swap?: boolean;
  /** Tall content: EASE_OUT_QUAD for height and fade, quick fade. */
  tall?: boolean;
}) => {
  const reduce = useReducedMotion();
  const exitDuration = exit ?? (swap ? enter : MOTION.reveal.exit);
  // Clip only while it moves. Rows already there on first paint never
  // animate, so they must start unclipped (or stay clipped for good).
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
      animate={{
        height: "auto",
        opacity: 1,
        transition: timing(enter, true),
      }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: exitDuration } }
          : { height: 0, opacity: 0, transition: timing(exitDuration, false) }
      }
      onAnimationStart={() => setMoving(!reduce)}
      onAnimationComplete={() => setMoving(false)}
      style={{ overflow: moving ? "hidden" : "visible" }}
    >
      <div className={className}>{children}</div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────
 * SWAP SPACE: one thing replaced by another in the same place (the
 * secondary email ↔ "Add secondary email").
 *
 *   contents   crossfade in place, top-aligned: the old one leaves the
 *              layout at once (popLayout), so the new one never travels
 *              out 120ms ease-out · in 160ms ease-out, 40ms later
 *   space      height old → new, 210ms ease-in-out, clipped meanwhile,
 *              then back to auto so later changes inside follow on
 *              their own
 *   reduced motion: the crossfade only, the height snaps
 * ───────────────────────────────────────────────────────── */

export const SwapSpace = ({
  children,
  swapKey,
}: {
  children: React.ReactNode;
  swapKey: string;
}) => {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  // The last height at rest, read before a swap changes it.
  const settled = useRef<number | null>(null);
  const moving = useRef(false);
  const lastKey = useRef(swapKey);

  useEffect(() => {
    const el = scope.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!moving.current) {
        settled.current = el.offsetHeight;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scope]);

  useLayoutEffect(() => {
    const el = scope.current;
    const from = settled.current;
    if (lastKey.current === swapKey) {
      return;
    }
    lastKey.current = swapKey;
    if (!el || from === null || reduce) {
      return;
    }
    // The leaving content is already out of the flow: this is the new size.
    const to = el.offsetHeight;
    if (to === from) {
      return;
    }
    moving.current = true;
    // Pin the old height before paint, so no frame shows the new one early.
    el.style.height = `${from}px`;
    el.style.overflow = "hidden";
    const run = async () => {
      await animate(
        el,
        { height: [`${from}px`, `${to}px`] },
        { duration: MOTION.reveal.enter, ease: EASE_IN_OUT }
      );
      el.style.height = "";
      el.style.overflow = "";
      moving.current = false;
      settled.current = el.offsetHeight;
    };
    run();
  }, [swapKey, reduce, animate, scope]);

  return (
    <div ref={scope} className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={swapKey}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: {
              delay: MOTION.swapSpace.inDelay,
              duration: MOTION.swapSpace.in,
              ease: EASE_OUT,
            },
          }}
          exit={{
            opacity: 0,
            transition: { duration: MOTION.swapSpace.out, ease: EASE_OUT },
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
