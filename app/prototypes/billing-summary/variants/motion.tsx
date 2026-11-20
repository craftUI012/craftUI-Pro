"use client";

import { motion, PresenceContext, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useContext, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * MOTION: the curves this block uses, and Reveal.
 *
 *   EASE_OUT       cubic-bezier(0.23, 1, 0.32, 1)  entrances, labels
 *   EASE_IN_OUT    cubic-bezier(0.645, 0.045, 0.355, 1)  small heights
 *   EASE_OUT_QUAD  cubic-bezier(0.5, 1, 0.89, 1)  rolls and fills: speed
 *                  falls in a straight line, no slow start, no tail
 *   SLIDE          spring 0.3s, bounce 0, for pills that slide
 * ───────────────────────────────────────────────────────── */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;
export const EASE_OUT_QUAD = [0.5, 1, 0.89, 1] as const;
export const SLIDE = { bounce: 0, duration: 0.3, type: "spring" } as const;

// Height 0 → auto with a fade; clipped only while it moves. Rows present
// on first paint (inside AnimatePresence initial={false}) start unclipped.
// `tall` for big panels: EASE_OUT_QUAD, quicker fade, no delay.
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
