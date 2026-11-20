"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

import { MOTION, TIMING } from "./billing-motion";

/* ─────────────────────────────────────────────────────────
 * UNDO TOAST: removing a card takes it out at once; this offers it
 * back for 5s. The bar under it is the time left (linear: it's a
 * clock) and pauses while the pointer or focus is on the toast, so
 * nobody loses it while reaching for Undo.
 * ───────────────────────────────────────────────────────── */

export const UndoToast = ({
  message,
  detail,
  onUndo,
  onDone,
}: {
  message: string;
  detail?: string;
  onUndo: () => void;
  onDone: () => void;
}) => {
  const reduce = useReducedMotion();
  const bar = useRef<HTMLSpanElement>(null);
  const timer = useRef<Animation | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const element = bar.current;
    if (!element) {
      return;
    }
    const animation = element.animate(
      [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      { duration: TIMING.undoFor, easing: "linear", fill: "forwards" }
    );
    animation.onfinish = () => done.current();
    timer.current = animation;
    return () => animation.cancel();
  }, []);

  const pause = () => timer.current?.pause();
  const resume = () => timer.current?.play();

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, transition: MOTION.enter, y: 0 }}
      exit={{ opacity: 0, transition: MOTION.exit, y: reduce ? 0 : 4 }}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className="bg-foreground text-background relative flex max-w-md items-center gap-3 overflow-hidden rounded-xl py-2 pr-2 pl-3.5"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{message}</span>
        {detail ? (
          <span className="text-background/70 text-xs text-pretty">
            {detail}
          </span>
        ) : null}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onUndo}
        className="text-background hover:bg-background/15 hover:text-background ml-auto h-7 px-2.5"
      >
        Undo
      </Button>
      <span
        ref={bar}
        aria-hidden
        className="bg-background/40 absolute inset-x-0 bottom-0 h-0.5 origin-left"
      />
    </motion.div>
  );
};
