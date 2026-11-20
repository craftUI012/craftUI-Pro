"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { EASE } from "./billing-motion";

/* ─────────────────────────────────────────────────────────
 * ODOMETER: a formatted number whose digits roll to the new value.
 *
 *   $24  →  $19      each digit is a 0–9 column; the column slides so the
 *                    new digit shows, passing the ones between (2 → 1 rolls
 *                    one step, 4 → 9 rolls five). Unchanged digits stay put.
 *
 *   roll      450ms EASE_OUT_QUAD: starts at once, settles without a tail
 *   columns   keyed from the right, so $9 → $19 adds a column on the left
 *             instead of shifting every digit
 *   width     tabular figures, so every digit is the same width and the
 *             number never jiggles while it rolls
 *   reduced   no roll: digits swap in place
 *   a11y      the columns are hidden; screen readers get the plain text
 * ───────────────────────────────────────────────────────── */

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const Column = ({ digit }: { digit: number }) => {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block h-[1lh] overflow-hidden">
      <motion.span
        className="flex flex-col"
        initial={false}
        animate={{ y: `${-digit * 10}%` }}
        transition={
          reduce ? { duration: 0 } : { duration: 0.45, ease: EASE.outQuad }
        }
      >
        {DIGITS.map((each) => (
          <span key={each} className="h-[1lh]">
            {each}
          </span>
        ))}
      </motion.span>
    </span>
  );
};

export const Odometer = ({
  className,
  text,
}: {
  className?: string;
  /** The value, already formatted, e.g. "$1,275". */
  text: string;
}) => {
  const chars = [...text];
  return (
    <span className={cn("relative inline-flex tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        {chars.map((char, index) => {
          // Keyed from the right: the ones digit is always "0".
          const key = chars.length - 1 - index;
          return /\d/.test(char) ? (
            <Column key={`d${key}`} digit={Number(char)} />
          ) : (
            // whitespace-pre: a space inside a flex row would collapse.
            <span key={`c${key}`} className="whitespace-pre">
              {char}
            </span>
          );
        })}
      </span>
    </span>
  );
};
