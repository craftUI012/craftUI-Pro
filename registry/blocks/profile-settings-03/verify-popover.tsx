"use client";

import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { CodeInput } from "./code-input";
import { EASE_OUT, EASE_OUT_QUAD, POPOVER_MOTION } from "./motion";
import { PhoneField } from "./phone-field";
import type { PhoneCountry } from "./phone-field";
import { StatusButton } from "./status-button";
import { FLOAT, RING, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * CHANGE WITH CODE: changing the email or phone in place, in a popover
 * anchored to the field. Two steps:
 *
 *   1  enter     the new address or number → Send code
 *   2  code      the 6-digit code sent to it → Verify & change
 *                "Resend in 30s" counts down, then "Resend code"
 *                a wrong code shakes the boxes and says what to do
 *
 * Origin-aware: the popover grows out of the "Change …" link that opened
 * it (--transform-origin), scale 0.95 → 1 + fade,
 * 150ms ease-out; it closes in 100ms. Between the steps the content
 * crossfades (out 100ms, in 150ms) and the popover's height eases to the
 * new step's: 200ms on a quadratic ease-out (0.5, 1, 0.89, 1), which
 * moves from the first frame alongside the crossfade instead of
 * ease-in-out's slow start reading as a second step.
 * The submit button is a StatusButton: its label rolls up to a spinner
 * while the code is sent or checked (spinner only, fixed width).
 * Everything resets when the popover opens, not as it closes, so the
 * closing fade shows the step you were on.
 * Reduced motion: fades only.
 * ───────────────────────────────────────────────────────── */

const RESEND_AFTER = 30;
const CODE_LENGTH = 6;

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isNationalNumber = (value: string) =>
  /^\d{4,14}$/.test(value.replaceAll(/[\s()-]/g, ""));

/** What a change-with-code popover calls. */
export interface CodeFlow {
  /** Sends a code to the new email or number. Reject to show "Code not sent". */
  onSendCode: (value: string) => Promise<void>;
  /** Checks the code for the new value; resolve `false` for a wrong code. */
  onVerifyCode: (value: string, code: string) => Promise<boolean>;
}

// The height follows the current step's content (measured), so switching
// steps eases instead of snapping. A callback ref, not a mount effect: the
// popover's content mounts only when it opens, long after this component
// does, so an effect would find no node and never measure.
const useContentHeight = () => {
  const [height, setHeight] = useState<number | "auto">("auto");
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) {
      // Closed: the next open starts from its natural height, no ease.
      setHeight("auto");
      return;
    }
    const watcher = new ResizeObserver(() => setHeight(el.offsetHeight));
    watcher.observe(el);
    observer.current = watcher;
  }, []);
  return { height, ref };
};

// The country whose code starts a number ("+91 98765…" → IN). The first
// listed country wins a shared code (+1 → US before CA).
const countryOf = (value: string, countries: PhoneCountry[]) => {
  const dial = value.trim().split(/\s+/)[0] ?? "";
  return (
    countries.find((item) => item.dial === dial)?.code ??
    countries[0]?.code ??
    "US"
  );
};

const LINK_BUTTON =
  "text-foreground focus-visible:ring-ring/50 rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px]";

const StepIntro = ({
  next,
  noun,
  onEdit,
  step,
  titleId,
  unit,
}: {
  next: string;
  noun: string;
  onEdit: () => void;
  step: "enter" | "code";
  titleId: string;
  unit: string;
}) => (
  <div className="flex flex-col gap-1">
    <p id={titleId} className="text-sm font-medium">
      {step === "enter" ? `Change ${noun}` : `Verify ${noun}`}
    </p>
    <p className="text-muted-foreground text-sm text-pretty">
      {step === "enter" ? (
        `We'll send a ${CODE_LENGTH}-digit code to the new ${unit} to confirm it's yours.`
      ) : (
        <>
          Enter the code sent to <span className="text-foreground">{next}</span>
          .{" "}
          <button type="button" onClick={onEdit} className={LINK_BUTTON}>
            Edit
          </button>
        </>
      )}
    </p>
  </div>
);

const NewValueInput = ({
  countries,
  country,
  email,
  error,
  errorId,
  kind,
  number,
  onCountry,
  onEmail,
  onNumber,
  phoneId,
}: {
  countries: PhoneCountry[];
  country: string;
  email: string;
  error: string | null;
  errorId: string;
  kind: "email" | "phone";
  number: string;
  onCountry: (code: string) => void;
  onEmail: (value: string) => void;
  onNumber: (value: string) => void;
  phoneId: string;
}) =>
  kind === "email" ? (
    <Input
      type="email"
      autoComplete="email"
      placeholder="name@example.com"
      aria-label="New email address"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      value={email}
      onChange={(event) => onEmail(event.target.value)}
      className={RING}
    />
  ) : (
    <PhoneField
      id={phoneId}
      countries={countries}
      country={country}
      number={number}
      invalid={Boolean(error)}
      describedBy={error ? errorId : undefined}
      onCountryChange={onCountry}
      onNumberChange={onNumber}
    />
  );

const CodeStep = ({
  code,
  codeRef,
  error,
  errorId,
  id,
  onCode,
  onResend,
  resendIn,
  shakeKey,
}: {
  code: string;
  codeRef: React.RefObject<HTMLInputElement | null>;
  error: string | null;
  errorId: string;
  id: string;
  onCode: (value: string) => void;
  onResend: () => void;
  resendIn: number;
  shakeKey: number;
}) => (
  <div className="flex flex-col gap-2">
    <CodeInput
      ref={codeRef}
      id={id}
      length={CODE_LENGTH}
      value={code}
      onChange={onCode}
      invalid={Boolean(error)}
      describedBy={error ? errorId : undefined}
      shakeKey={shakeKey}
    />
    <p
      aria-live="polite"
      className="text-muted-foreground text-xs tabular-nums"
    >
      {resendIn > 0 ? (
        `Didn't get a code? Resend in ${resendIn}s`
      ) : (
        <button type="button" onClick={onResend} className={LINK_BUTTON}>
          Resend code
        </button>
      )}
    </p>
  </div>
);

const SUBMIT_LABEL = {
  code: { busy: "Verifying…", idle: "Verify & change" },
  enter: { busy: "Sending code…", idle: "Send code" },
} as const;

const StepActions = ({
  busy,
  canSubmit,
  onCancel,
  step,
}: {
  busy: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  step: "enter" | "code";
}) => (
  <div className="flex justify-end gap-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={RING_BUTTON}
      onClick={onCancel}
    >
      Cancel
    </Button>
    <StatusButton
      type="submit"
      size="sm"
      // Busy stays at full colour (aria-disabled), not dimmed.
      disabled={!busy && !canSubmit}
      state={busy ? "busy" : "idle"}
      labels={SUBMIT_LABEL[step]}
    />
  </div>
);

export const ChangeWithCode = ({
  countries,
  current,
  flow,
  kind,
  onChanged,
  side,
}: {
  countries?: PhoneCountry[];
  current: string;
  flow: CodeFlow;
  kind: "email" | "phone";
  onChanged: (value: string) => void;
  side: "left" | "bottom";
}) => {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [email, setEmail] = useState("");
  // A new number starts in the current number's country (its +code).
  const startCountry = countryOf(current, countries ?? []);
  const [country, setCountry] = useState(startCountry);
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const { height, ref: contentRef } = useContentHeight();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const errorId = `${baseId}-error`;

  const noun = kind === "email" ? "email address" : "phone number";
  const dial = countries?.find((item) => item.code === country)?.dial ?? "";
  const next = kind === "email" ? email.trim() : `${dial} ${number.trim()}`;
  const validNext =
    kind === "email"
      ? isEmail(next) && next !== current
      : isNationalNumber(number) && next !== current;

  // The resend countdown, a tick a second while the code step is open.
  useEffect(() => {
    if (!open || step !== "code" || resendIn <= 0) {
      return;
    }
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, step, resendIn]);

  const reset = () => {
    setStep("enter");
    setCountry(startCountry);
    setEmail("");
    setNumber("");
    setCode("");
    setError(null);
    setBusy(false);
    setResendIn(0);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await flow.onSendCode(next);
    } catch {
      setBusy(false);
      setError(`Code not sent. Check the ${noun} and try again.`);
      return;
    }
    setBusy(false);
    setCode("");
    setResendIn(RESEND_AFTER);
    setStep("code");
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const ok = await flow.onVerifyCode(next, code).catch(() => false);
    setBusy(false);
    if (!ok) {
      setError("That code doesn't match. Check the latest one and try again.");
      setShakeKey((value) => value + 1);
      setCode("");
      codeRef.current?.focus();
      return;
    }
    onChanged(next);
    setOpen(false);
  };

  const submit = () => {
    if (busy) {
      return;
    }
    if (step === "enter" && validNext) {
      send();
    }
    if (step === "code" && code.length === CODE_LENGTH) {
      verify();
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        // Fresh on open; untouched while closing, so the fade-out shows
        // the step you were on instead of flashing back to the first.
        if (value) {
          reset();
        }
        setOpen(value);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex w-fit items-center gap-2 rounded-sm text-sm outline-none focus-visible:ring-[3px]"
          />
        }
      >
        <HugeiconsIcon
          icon={PencilEdit02Icon}
          strokeWidth={1.75}
          className="size-4"
        />
        Change {noun}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={side === "left" ? "center" : "start"}
        sideOffset={side === "left" ? 16 : 8}
        aria-labelledby={titleId}
        // Overrides: the block's float shadow, origin-aware motion, and
        // no padding (the measured content carries it).
        className={cn(
          FLOAT,
          POPOVER_MOTION,
          "w-80 overflow-hidden rounded-xl p-0"
        )}
      >
        <motion.div
          animate={{ height }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT_QUAD }
          }
        >
          <div ref={contentRef}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.form
                key={step}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.15, ease: EASE_OUT },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.1, ease: EASE_OUT },
                }}
                className="flex flex-col gap-4 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <StepIntro
                  step={step}
                  noun={noun}
                  unit={kind === "email" ? "address" : "number"}
                  next={next}
                  titleId={titleId}
                  onEdit={() => {
                    setStep("enter");
                    setError(null);
                  }}
                />
                {step === "enter" ? (
                  <NewValueInput
                    kind={kind}
                    phoneId={`${baseId}-phone`}
                    countries={countries ?? []}
                    email={email}
                    onEmail={setEmail}
                    country={country}
                    onCountry={setCountry}
                    number={number}
                    onNumber={setNumber}
                    error={error}
                    errorId={errorId}
                  />
                ) : (
                  <CodeStep
                    codeRef={codeRef}
                    id={`${baseId}-code`}
                    code={code}
                    onCode={(value) => {
                      setCode(value);
                      setError(null);
                    }}
                    error={error}
                    errorId={errorId}
                    shakeKey={shakeKey}
                    resendIn={resendIn}
                    onResend={send}
                  />
                )}
                {error ? (
                  <p
                    id={errorId}
                    aria-live="polite"
                    className="text-destructive -mt-2 text-xs"
                  >
                    {error}
                  </p>
                ) : null}
                <StepActions
                  step={step}
                  busy={busy}
                  canSubmit={
                    step === "enter" ? validNext : code.length === CODE_LENGTH
                  }
                  onCancel={() => setOpen(false)}
                />
              </motion.form>
            </AnimatePresence>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
};
