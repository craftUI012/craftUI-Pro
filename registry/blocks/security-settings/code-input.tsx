"use client";

import { motion, useAnimate, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { RING } from "./surface";

/* ─────────────────────────────────────────────────────────
 * CODE INPUT: a one-time code in six boxes.
 *
 * One real input sits over the boxes (transparent), so the browser's
 * one-time-code autofill, paste and screen readers all see one field; the
 * boxes only draw it. Digits only. The box being typed into gets the
 * focus ring, with a blinking caret while it's empty.
 *
 *   typing     no motion (it happens every keystroke)
 *   caret      blinks once a second (steps, not a fade); still under
 *              reduced motion
 *   wrong code the boxes shake once: x 0,-8,7,-5,3,0, 360ms ease-in-out;
 *              reduced motion: no shake, the message alone
 * ───────────────────────────────────────────────────────── */

const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;

export const CodeInput = ({
  describedBy,
  id,
  invalid,
  length = 6,
  onChange,
  ref,
  shakeKey,
  value,
}: {
  describedBy?: string;
  id: string;
  invalid?: boolean;
  length?: number;
  onChange: (value: string) => void;
  ref?: React.Ref<HTMLInputElement>;
  // Bump to shake the boxes (a wrong code).
  shakeKey: number;
  value: string;
}) => {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);

  useEffect(() => {
    if (shakeKey === 0 || reduce || !scope.current) {
      return;
    }
    animate(
      scope.current,
      { x: [0, -8, 7, -5, 3, 0] },
      { duration: 0.36, ease: EASE_IN_OUT }
    );
  }, [shakeKey, reduce, animate, scope]);

  return (
    <div ref={scope} className="relative w-fit">
      <div aria-hidden className="flex gap-2">
        {Array.from({ length }, (_, index) => {
          const digit = value[index] ?? "";
          const isActive = focused && index === active;
          return (
            <div
              // The boxes are positions, not list items: index is stable.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots.
              key={index}
              className={cn(
                RING,
                "bg-background flex size-10 items-center justify-center rounded-md text-lg font-medium tabular-nums transition-[box-shadow,border-color] duration-150",
                isActive && "border-ring ring-ring/50 ring-[3px]",
                invalid && "border-destructive"
              )}
            >
              {digit}
              {isActive && digit === "" ? (
                <motion.span
                  className="bg-foreground h-5 w-px"
                  animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    times: [0, 0.5, 0.5, 1],
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replaceAll(/\D/g, "").slice(0, length))
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        // Over the boxes, invisible: the boxes draw what it holds. 16px so
        // iOS doesn't zoom in.
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  );
};
