"use client";

import { motion, PresenceContext, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useContext, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * MOTION: the block's shared curves and the height reveal.
 *
 *   EASE_OUT        (0.23, 1, 0.32, 1)      answers to a click: icons,
 *                                           fades, label rolls
 *   EASE_IN_OUT     (0.645, 0.045, 0.355, 1) on-screen moves, small heights
 *   EASE_OUT_QUAD   (0.5, 1, 0.89, 1)        tall reveals: speed falls in a
 *                   straight line from 2× average to 0, so it moves from
 *                   the first frame (12% at 16ms over 260ms), never jumps
 *                   more than 12% a frame, and has no creeping tail. One
 *                   continuous motion, never "two steps".
 * ───────────────────────────────────────────────────────── */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;
export const EASE_OUT_QUAD = [0.5, 1, 0.89, 1] as const;

export const wait = (ms: number) =>
  // oxlint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// Something opening in place: height 0 → auto with a fade. Small rows:
// 210ms open / 150ms close, ease-in-out. Taller content (`tall`, with
// `enter` / `exit` in seconds): EASE_OUT_QUAD for height and fade, the
// fade with no delay (in over the first 60% of the open, out over the
// first half of the close), so the content never squeezes.
// Clipped only while it moves; rows already there on first paint (inside
// AnimatePresence initial={false}) never animate, so they start
// unclipped. Reduced motion: the fade only.
export const Reveal = ({
  children,
  className,
  enter = 0.21,
  exit = 0.15,
  id,
  tall = false,
}: {
  children: React.ReactNode;
  className?: string;
  enter?: number;
  exit?: number;
  /** Id for the moving box, e.g. for a toggle's aria-controls. */
  id?: string;
  tall?: boolean;
}) => {
  const reduce = useReducedMotion();
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
      id={id}
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
