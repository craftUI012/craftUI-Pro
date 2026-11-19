"use client";

import {
  CheckmarkCircle02Icon,
  DashedLineCircleIcon,
  LockPasswordIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import type * as React from "react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { DoneNote, EASE_OUT, Reveal } from "./motion";
import { StatusButton } from "./status-button";
import { CARD, RING, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * PASSWORD: when it last changed, and changing it in place.
 *
 *   Last changed 3 months ago                [Change password]
 *   ── opens (Reveal, 210ms) ──
 *   Current password  [••••••••  👁]
 *   New password      [••••••••  👁]
 *   ▰▰▰▱ Good
 *   ✓ At least 12 characters   ✓ Upper and lower case
 *   ○ A number or symbol       ✓ Not your name or email
 *   Confirm           [••••••••  👁]
 *   ☑ Sign out of other devices
 *                               [Cancel] [Update password]
 *
 * The meter and checklist follow every keystroke with no motion (typing
 * is never animated); colour carries the strength, and the word says it
 * too, so it isn't colour alone.
 * ───────────────────────────────────────────────────────── */

const RULES = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (value: string) => value.length >= 12,
  },
  {
    id: "case",
    label: "Upper and lower case",
    test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  {
    id: "symbol",
    label: "A number or symbol",
    test: (value: string) => /[\d\W_]/.test(value),
  },
] as const;

const STRENGTH = [
  { label: "Too weak", tone: "bg-destructive" },
  { label: "Weak", tone: "bg-destructive" },
  { label: "Fair", tone: "bg-amber-500" },
  { label: "Good", tone: "bg-emerald-500" },
  { label: "Strong", tone: "bg-emerald-500" },
] as const;

// 0–4: one point per rule met, one for 16+ characters; never more than 1
// while it includes the person's name or email.
const scoreOf = (value: string, personal: boolean) => {
  if (value === "") {
    return 0;
  }
  const met = RULES.filter((rule) => rule.test(value)).length;
  const score = Math.min(4, met + (value.length >= 16 ? 1 : 0));
  return personal ? Math.min(score, 1) : score;
};

const includesPersonal = (value: string, words: string[]) => {
  const lower = value.toLowerCase();
  return words.some(
    (word) => word.length >= 3 && lower.includes(word.toLowerCase())
  );
};

const PasswordInput = ({
  autoComplete,
  describedBy,
  id,
  inputRef,
  invalid,
  label,
  onChange,
  value,
}: {
  autoComplete: string;
  describedBy?: string;
  id: string;
  inputRef?: React.Ref<HTMLInputElement>;
  invalid?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          RING,
          "dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center rounded-md bg-transparent pr-0.5 transition-[color,box-shadow] focus-within:ring-[3px]",
          invalid && "border-destructive"
        )}
      >
        <Input
          ref={inputRef}
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          // Override: the box around it draws the ring and focus.
          className="h-full min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            shown
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          aria-pressed={shown}
          onClick={() => setShown((was) => !was)}
          className="text-muted-foreground hover:text-foreground size-8"
        >
          <HugeiconsIcon
            icon={shown ? ViewOffSlashIcon : ViewIcon}
            strokeWidth={1.75}
          />
        </Button>
      </div>
    </div>
  );
};

const Rule = ({ label, met }: { label: string; met: boolean }) => (
  <li className="text-muted-foreground flex items-center gap-1.5 text-xs">
    <HugeiconsIcon
      icon={met ? CheckmarkCircle02Icon : DashedLineCircleIcon}
      strokeWidth={2}
      className={cn(
        "size-3.5 shrink-0",
        met && "text-emerald-600 dark:text-emerald-400"
      )}
    />
    <span className={cn(met && "text-foreground")}>{label}</span>
    <span className="sr-only">{met ? "(done)" : "(not yet)"}</span>
  </li>
);

const StrengthMeter = ({ score }: { score: number }) => {
  const level = STRENGTH[score] ?? STRENGTH[0];
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="grid flex-1 grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 rounded-full",
              step <= score ? level.tone : "bg-muted"
            )}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="text-muted-foreground w-16 text-right text-xs"
      >
        {level.label}
      </p>
    </div>
  );
};

export const PasswordRow = ({
  lastChangedLabel,
  onChange,
  onChanged,
  personal,
}: {
  lastChangedLabel: string;
  /** Runs after a successful change (date, and other sessions if ticked). */
  onChanged?: (signOutOthers: boolean) => void;
  onChange: (
    current: string,
    next: string,
    signOutOthers: boolean
  ) => Promise<void>;
  personal: string[];
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [doneStamp, setDoneStamp] = useState(0);
  const changeRef = useRef<HTMLButtonElement>(null);
  const currentRef = useRef<HTMLInputElement>(null);
  const opened = useRef(false);

  // Opening puts the cursor in "Current password"; closing (Cancel or a
  // save) hands focus back to Change, so keyboard users don't land on
  // the page body. preventScroll: the page shouldn't jump either way.
  useEffect(() => {
    if (open) {
      opened.current = true;
      currentRef.current?.focus({ preventScroll: true });
    } else if (opened.current) {
      changeRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const personalHit = includesPersonal(next, personal);
  const rules = [
    ...RULES.map((rule) => ({ label: rule.label, met: rule.test(next) })),
    { label: "Not your name or email", met: next !== "" && !personalHit },
  ];
  const allMet = rules.every((rule) => rule.met);
  // Flag it only once it can no longer match, not while it's being typed.
  const mismatch = confirm !== "" && !next.startsWith(confirm);
  const canSave = current !== "" && allMet && confirm === next && !busy;

  const reset = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setProblem(null);
  };

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onChange(current, next, signOutOthers);
    } catch (error) {
      setBusy(false);
      setProblem(
        error instanceof Error && error.message
          ? error.message
          : "Password not changed. Check your current password and try again."
      );
      return;
    }
    setBusy(false);
    reset();
    onChanged?.(signOutOthers);
    setDoneStamp(Date.now());
  };

  return (
    <div
      data-highlight="password"
      className={cn(CARD, "flex flex-col gap-3 px-4 py-3")}
    >
      <div className="flex min-h-10 items-center gap-3">
        <HugeiconsIcon
          icon={LockPasswordIcon}
          strokeWidth={1.75}
          className="text-muted-foreground size-5 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-sm font-medium">Password</p>
          <p className="text-muted-foreground text-xs">{lastChangedLabel}</p>
        </div>
        {/* Fades out while the form is open, back when it closes. */}
        <AnimatePresence initial={false}>
          {open ? null : (
            <motion.span
              key="change"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                ref={changeRef}
                className={RING_BUTTON}
                aria-label="Change password"
                onClick={() => setOpen(true)}
              >
                Change
              </Button>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="pl-8 empty:hidden">
        <DoneNote stamp={doneStamp} hideAfter={3000}>
          Password updated
        </DoneNote>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <Reveal key="form" className="pl-8" enter={0.26} exit={0.18} tall>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (canSave) {
                  save();
                }
              }}
            >
              <PasswordInput
                id={`${id}-current`}
                inputRef={currentRef}
                label="Current password"
                autoComplete="current-password"
                value={current}
                onChange={setCurrent}
              />
              <div className="flex flex-col gap-2.5">
                <PasswordInput
                  id={`${id}-new`}
                  label="New password"
                  autoComplete="new-password"
                  value={next}
                  onChange={setNext}
                  describedBy={`${id}-rules`}
                />
                <StrengthMeter score={scoreOf(next, personalHit)} />
                <ul
                  id={`${id}-rules`}
                  aria-label="Password requirements"
                  className="grid gap-1.5 sm:grid-cols-2"
                >
                  {rules.map((rule) => (
                    <Rule key={rule.label} label={rule.label} met={rule.met} />
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-1.5">
                <PasswordInput
                  id={`${id}-confirm`}
                  label="Confirm new password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={setConfirm}
                  invalid={mismatch}
                  describedBy={mismatch ? `${id}-mismatch` : undefined}
                />
                {mismatch ? (
                  <p id={`${id}-mismatch`} className="text-destructive text-xs">
                    The passwords don't match yet.
                  </p>
                ) : null}
              </div>
              <label
                htmlFor={`${id}-others`}
                className="flex items-start gap-2.5 text-sm"
              >
                <Checkbox
                  id={`${id}-others`}
                  checked={signOutOthers}
                  onCheckedChange={(value) => setSignOutOthers(value === true)}
                  // Override: a shadow ring, not shadcn's grey border.
                  className={cn(RING, "mt-0.5 dark:border-transparent")}
                />
                <span className="flex flex-col">
                  <span className="font-medium">Sign out of other devices</span>
                  <span className="text-muted-foreground text-xs">
                    Everywhere except here will need the new password.
                  </span>
                </span>
              </label>
              {problem ? (
                <p aria-live="polite" className="text-destructive text-xs">
                  {problem}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={RING_BUTTON}
                  disabled={busy}
                  onClick={reset}
                >
                  Cancel
                </Button>
                <StatusButton
                  type="submit"
                  size="sm"
                  // Busy stays at full colour (aria-disabled), not dimmed.
                  disabled={!busy && !canSave}
                  state={busy ? "busy" : "idle"}
                  labels={{ busy: "Updating…", idle: "Update password" }}
                />
              </div>
            </form>
          </Reveal>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
