"use client";

import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

import { EASE_IN_OUT, EASE_OUT, MOTION } from "./motion";
import { StatusButton } from "./status-button";
import type { ButtonState } from "./status-button";
import { FLOAT } from "./surface";

/* ─────────────────────────────────────────────────────────
 * SAVE BAR: only while something changed.
 *
 *    dirty               rises 12px + fades in          220ms ease-out
 *    Save / ⌘S           label rolls up to the spinner   200ms ease-out
 *    saved               rolls to "✓ Saved"; the button keeps one width
 *    +1100ms             sinks out                      180ms ease-out
 *    leave while dirty   shakes x 0,-8,7,-5,3,0         360ms ease-in-out
 *                        "Save or discard…" for 2.4s
 *    Esc                 in a field: leaves the field; else discards
 *    reduced motion      no rise, no shake: fades and the message only
 * ───────────────────────────────────────────────────────── */

export type SaveState = "idle" | "saving" | "saved";

// The bar's save state, as the button's: saving spins, saved shows ✓.
const BUTTON_STATE: Record<SaveState, ButtonState> = {
  idle: "idle",
  saved: "done",
  saving: "busy",
};

// One whole message per plural category (never a ternary "s").
const UNSAVED: Partial<Record<Intl.LDMLPluralRule, (count: number) => string>> =
  {
    one: () => "1 unsaved change",
    other: (count) => `${count} unsaved changes`,
  };
const PLURAL = new Intl.PluralRules("en-US");
const unsavedMessage = (count: number) =>
  (UNSAVED[PLURAL.select(count)] ?? UNSAVED.other)?.(count) ?? "";

// "⌘" on Apple devices, "Ctrl" elsewhere. Read after mount (the bar only
// shows after an edit, so there's no server render to mismatch).
const useModKey = () => {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) {
      setMod("⌘");
    }
  }, []);
  return mod;
};

// Fixed width (the widest of "Save changes ⌘S" and "✓ Saved"): the label
// rolls, the button never resizes. Busy shows the spinner only.
const SaveButton = ({
  disabled,
  onClick,
  shortcut,
  state,
}: {
  disabled?: boolean;
  onClick: () => void;
  shortcut: string;
  state: SaveState;
}) => (
  <StatusButton
    type="button"
    size="sm"
    disabled={disabled}
    state={BUTTON_STATE[state]}
    labels={{ busy: "Saving…", done: "Saved", idle: "Save changes" }}
    trailing={
      // Override: readable on the filled button; hidden on touch screens.
      <Kbd className="bg-primary-foreground/15 text-primary-foreground/80 hidden shadow-none sm:inline-flex">
        {shortcut}
      </Kbd>
    }
    onClick={() => {
      if (state === "idle") {
        onClick();
      }
    }}
  />
);

export const SaveBar = ({
  changedCount,
  nudges,
  onDiscard,
  onSave,
  problem,
  state,
}: {
  changedCount: number;
  nudges: number;
  onDiscard: () => void;
  onSave: () => void;
  problem: string | null;
  state: SaveState;
}) => {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const mod = useModKey();
  const [warned, setWarned] = useState(false);
  const dirty = changedCount > 0;
  const visible = dirty || state !== "idle";
  const canSave = dirty && state === "idle" && !problem;

  // Someone tried to leave: shake once and say why.
  useEffect(() => {
    if (nudges === 0) {
      return;
    }
    setWarned(true);
    if (!reduce && scope.current) {
      animate(
        scope.current,
        { x: [0, -8, 7, -5, 3, 0] },
        { duration: MOTION.nudge, ease: EASE_IN_OUT }
      );
    }
    const timer = setTimeout(() => setWarned(false), MOTION.nudgeHold);
    return () => clearTimeout(timer);
  }, [nudges, reduce, animate, scope]);

  // The warning is about the pending edits: once saved or discarded, gone.
  useEffect(() => {
    if (!dirty || state !== "idle") {
      setWarned(false);
    }
  }, [dirty, state]);

  // Shortcuts, only while there's something to save.
  useEffect(() => {
    if (!dirty || state !== "idle") {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (canSave) {
          onSave();
        }
        return;
      }
      if (event.key === "Escape") {
        // First Esc leaves the field you're typing in; the next discards.
        const field = document.activeElement;
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement
        ) {
          field.blur();
          return;
        }
        onDiscard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, state, canSave, onSave, onDiscard]);

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  let message = problem ?? unsavedMessage(changedCount);
  if (warned && dirty) {
    message = "Save or discard your changes first";
  }
  if (state === "saved") {
    message = "Changes saved";
  }

  return (
    <div className="pointer-events-none sticky bottom-4 z-10 mt-8 flex justify-center">
      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.bar.rise }
            }
            animate={{
              opacity: 1,
              transition: { duration: MOTION.bar.enter, ease: EASE_OUT },
              y: 0,
            }}
            exit={{
              opacity: 0,
              transition: { duration: MOTION.bar.exit, ease: EASE_OUT },
              y: reduce ? 0 : MOTION.bar.rise,
            }}
            className="pointer-events-auto w-full sm:w-auto"
          >
            {/* The shake moves this inner box; the outer one rises in. */}
            <div
              ref={scope}
              role="region"
              aria-label="Unsaved changes"
              className={cn(
                FLOAT,
                "bg-popover text-popover-foreground flex items-center gap-3 rounded-xl p-2 pl-4 sm:w-[33rem]"
              )}
            >
              <p
                className={cn(
                  "flex-1 text-sm",
                  warned && dirty ? "text-foreground" : "text-muted-foreground"
                )}
                aria-live="polite"
              >
                {message}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={state !== "idle"}
                onClick={onDiscard}
              >
                Discard
                <Kbd className="hidden sm:inline-flex">Esc</Kbd>
              </Button>
              <SaveButton
                state={state}
                shortcut={`${mod}S`}
                disabled={Boolean(problem)}
                onClick={onSave}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
