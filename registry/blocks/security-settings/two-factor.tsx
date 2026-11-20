"use client";

import {
  Copy01Icon,
  Download04Icon,
  Key01Icon,
  Message01Icon,
  QrCodeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import type * as React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { CodeInput } from "./code-input";
import { ConfirmDialog } from "./confirm-dialog";
import { EASE_OUT, EASE_OUT_QUAD, Reveal } from "./motion";
import { PhoneField } from "./phone-field";
import type { PhoneCountry } from "./phone-field";
import { RollingLabel, StatusButton } from "./status-button";
import { CARD, FLOAT, LIFT, RING, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * TWO-FACTOR: the second step at sign-in.
 *
 *   methods     Authenticator app · Text message, each Set up / Turn off
 *   recovery    "8 of 10 left" · Make new codes (once any method is on)
 *
 * SETUP DIALOG, one step at a time:
 *   app   1 scan the QR (or copy the key)  2 enter the 6-digit code
 *   sms   1 the phone number → Send code   2 enter the 6-digit code
 *   then, for the first method only, 3 save the recovery codes: copy all,
 *   download .txt, tick "I've saved these" before Done.
 *
 * Between steps the content crossfades (out 100ms, in 150ms) and the
 * dialog's height eases to the next step's (200ms EASE_OUT_QUAD). Turning a
 * method off asks first, because it weakens the account.
 * ───────────────────────────────────────────────────────── */

export type TwoFactorMethod = "app" | "sms";

/** What the two-factor section calls. */
export interface TwoFactorFlow {
  /** The `otpauth://` link the QR code encodes, made by your server for this account. */
  otpauthUrl: string;
  /** The same secret, for typing in by hand (shown in groups of four). */
  secret: string;
  /** Checks a code from the authenticator app; resolve `false` for a wrong one. */
  verifyApp: (code: string) => Promise<boolean>;
  /** Texts a code to a phone number (with its country code). */
  sendSms: (phone: string) => Promise<void>;
  /** Checks a texted code; resolve `false` for a wrong one. */
  verifySms: (phone: string, code: string) => Promise<boolean>;
  /** Makes a new set of recovery codes (the old ones stop working). */
  generateCodes: () => Promise<string[]>;
  /** Turns a method off. */
  turnOff: (method: TwoFactorMethod) => Promise<void>;
}

const CODE_LENGTH = 6;

const LINK_BUTTON =
  "text-foreground focus-visible:ring-ring/50 rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px]";

// The dialog's height follows the current step's content.
// The dialog's height follows the current step's content. A callback ref,
// not a mount effect: the dialog content portals in only when it opens,
// long after this component mounted, so an effect would never see it and
// the height would stay "auto" (steps would snap instead of easing).
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

const useCopied = () => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async (text: string) => {
    await navigator.clipboard?.writeText(text).catch(() => null);
    setCopied(true);
  };
  return { copied, copy };
};

/* ─────────────────────────────────────────────────────────
 * RECOVERY CODES
 * ───────────────────────────────────────────────────────── */

export const RecoveryCodes = ({
  codes,
  product,
}: {
  codes: string[];
  product: string;
}) => {
  const { copied, copy } = useCopied();
  const download = () => {
    const text = `${product} recovery codes\nEach code works once.\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${product.toLowerCase()}-recovery-codes.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label="Recovery codes"
        className={cn(
          // A tinted box, no ring: the tint is its edge.
          "bg-muted/40 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg p-4 font-mono text-sm tabular-nums"
        )}
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <StatusButton
          type="button"
          variant="outline"
          size="sm"
          className={RING_BUTTON}
          icon={Copy01Icon}
          state={copied ? "done" : "idle"}
          labels={{ done: "Copied", idle: "Copy all" }}
          onClick={() => copy(codes.join("\n"))}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={RING_BUTTON}
          onClick={download}
        >
          <HugeiconsIcon icon={Download04Icon} strokeWidth={1.75} />
          Download
        </Button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
 * SETUP DIALOG: steps
 * ───────────────────────────────────────────────────────── */

type Step = "setup" | "verify" | "codes";

const ScanStep = ({ flow }: { flow: TwoFactorFlow }) => {
  const { copied, copy } = useCopied();
  const grouped = flow.secret.match(/.{1,4}/g)?.join(" ") ?? flow.secret;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {/* The QR stays black on white in both themes, so every app reads it. */}
      <div className={cn(LIFT, "shrink-0 rounded-lg bg-white p-3")}>
        <QRCodeSVG
          value={flow.otpauthUrl}
          size={136}
          marginSize={0}
          title="QR code for your authenticator app"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-muted-foreground text-sm text-pretty">
          Can't scan it? Enter this key in the app instead.
        </p>
        <code className="bg-muted/60 rounded-md px-2.5 py-2 font-mono text-sm break-all">
          {grouped}
        </code>
        <button
          type="button"
          onClick={() => copy(flow.secret)}
          className={cn(LINK_BUTTON, "w-fit text-xs")}
        >
          <RollingLabel
            state={copied ? "done" : "idle"}
            labels={{ done: "Key copied", idle: "Copy key" }}
          />
        </button>
      </div>
    </div>
  );
};

// Text-message codes only: resend (after a 30s wait) or go back and fix
// the number. The countdown is outside any live region, so screen
// readers aren't told every second.
const RESEND_SECONDS = 30;

const useCountdown = () => {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) {
      return;
    }
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft] as const;
};

interface ResendControls {
  secondsLeft: number;
  onResend: () => void;
  onBack: () => void;
}

const ResendLine = ({ onBack, onResend, secondsLeft }: ResendControls) => (
  <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    {secondsLeft > 0 ? (
      <span className="tabular-nums">
        Resend code in 0:{String(secondsLeft).padStart(2, "0")}
      </span>
    ) : (
      <button type="button" onClick={onResend} className={LINK_BUTTON}>
        Resend code
      </button>
    )}
    <button type="button" onClick={onBack} className={LINK_BUTTON}>
      Change number
    </button>
  </p>
);

const VerifyStep = ({
  code,
  codeRef,
  error,
  id,
  onCode,
  resend,
  shakeKey,
}: {
  code: string;
  codeRef: React.RefObject<HTMLInputElement | null>;
  error: string | null;
  id: string;
  onCode: (value: string) => void;
  resend?: ResendControls;
  shakeKey: number;
}) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-sm font-medium">
      Verification code
    </label>
    <CodeInput
      ref={codeRef}
      id={id}
      length={CODE_LENGTH}
      value={code}
      onChange={onCode}
      invalid={Boolean(error)}
      describedBy={error ? `${id}-error` : undefined}
      shakeKey={shakeKey}
    />
    {error ? (
      <p
        id={`${id}-error`}
        aria-live="polite"
        className="text-destructive text-xs"
      >
        {error}
      </p>
    ) : null}
    {resend ? <ResendLine {...resend} /> : null}
  </div>
);

const PhoneStep = ({
  countries,
  country,
  error,
  id,
  number,
  onCountryChange,
  onNumberChange,
}: {
  countries: PhoneCountry[];
  country: string;
  error: string | null;
  id: string;
  number: string;
  onCountryChange: (code: string) => void;
  onNumberChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-sm font-medium">
      Phone number
    </label>
    <PhoneField
      id={id}
      countries={countries}
      country={country}
      number={number}
      invalid={Boolean(error)}
      describedBy={error ? `${id}-error` : undefined}
      onCountryChange={onCountryChange}
      onNumberChange={onNumberChange}
    />
    {error ? (
      <p
        id={`${id}-error`}
        aria-live="polite"
        className="text-destructive text-xs"
      >
        {error}
      </p>
    ) : null}
  </div>
);

const CodesStep = ({
  codes,
  id,
  onSaved,
  product,
  saved,
}: {
  codes: string[];
  id: string;
  onSaved: (saved: boolean) => void;
  product: string;
  saved: boolean;
}) => (
  <div className="flex flex-col gap-4">
    <RecoveryCodes codes={codes} product={product} />
    <label htmlFor={id} className="flex items-center gap-2.5 text-sm">
      <Checkbox
        id={id}
        checked={saved}
        onCheckedChange={(value) => onSaved(value === true)}
        // Override: a shadow ring, not shadcn's grey border.
        className={cn(RING, "dark:border-transparent")}
      />
      I've saved these codes somewhere safe
    </label>
  </div>
);

const STEP_TEXT: Record<
  TwoFactorMethod,
  Record<Step, { title: string; body: string }>
> = {
  app: {
    codes: {
      body: "Each one works once, if you ever lose your phone. Keep them somewhere safe, like a password manager.",
      title: "Save your recovery codes",
    },
    setup: {
      body: "Scan this with an authenticator app such as 1Password, Google Authenticator or Authy.",
      title: "Set up an authenticator app",
    },
    verify: {
      body: "Enter the 6-digit code the app shows for this account.",
      title: "Enter the code from the app",
    },
  },
  sms: {
    codes: {
      body: "Each one works once, if you ever lose your phone. Keep them somewhere safe, like a password manager.",
      title: "Save your recovery codes",
    },
    setup: {
      body: "We'll text a 6-digit code to this number each time you sign in.",
      title: "Set up text message codes",
    },
    verify: {
      body: "Enter the 6-digit code we just texted you.",
      title: "Enter the code we sent",
    },
  },
};

const PRIMARY_LABEL: Record<Step, { busy: string; idle: string }> = {
  codes: { busy: "Finishing…", idle: "Done" },
  setup: { busy: "Sending code…", idle: "Continue" },
  verify: { busy: "Checking…", idle: "Verify" },
};

// Whether the step's main button can run: a plausible phone number, all
// six digits, or "I've saved these" ticked.
const canContinue = ({
  code,
  method,
  number,
  saved,
  step,
}: {
  code: string;
  method: TwoFactorMethod;
  number: string;
  saved: boolean;
  step: Step;
}) => {
  if (step === "setup") {
    return (
      method === "app" || /^\d{4,14}$/.test(number.replaceAll(/[\s()-]/g, ""))
    );
  }
  if (step === "verify") {
    return code.length === CODE_LENGTH;
  }
  return saved;
};

export const SetupDialog = ({
  countries,
  fallbackFocus,
  flow,
  method,
  needsCodes,
  onEnabled,
  onOpenChange,
  open,
  product,
}: {
  countries: PhoneCountry[];
  flow: TwoFactorFlow;
  method: TwoFactorMethod;
  needsCodes: boolean;
  onEnabled: (
    method: TwoFactorMethod,
    detail: { phone?: string; codes?: string[] }
  ) => void;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close if the button that opened it is gone. */
  fallbackFocus?: () => HTMLElement | null;
  open: boolean;
  product: string;
}) => {
  const reduce = useReducedMotion();
  const id = useId();
  const [step, setStep] = useState<Step>("setup");
  const [country, setCountry] = useState(countries[0]?.code ?? "US");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const [secondsLeft, setSecondsLeft] = useCountdown();
  const { height, ref } = useContentHeight();
  const dial = countries.find((item) => item.code === country)?.dial ?? "";
  const phone = `${dial} ${number.trim()}`;
  const text = STEP_TEXT[method][step];

  const reset = () => {
    setStep("setup");
    setNumber("");
    setCode("");
    setCodes([]);
    setSaved(false);
    setBusy(false);
    setError(null);
  };

  // Start fresh each time it opens (not on close, so the closing fade
  // shows the step the person was on), and remember the button that
  // opened it. Layout effect: runs before Radix moves focus inside.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      reset();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  const close = () => onOpenChange(false);

  const toVerify = async () => {
    if (method === "sms") {
      setBusy(true);
      try {
        await flow.sendSms(phone);
      } catch {
        setBusy(false);
        setError("Code not sent. Check the number and try again.");
        return;
      }
      setBusy(false);
      setSecondsLeft(RESEND_SECONDS);
    }
    setError(null);
    setStep("verify");
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const ok = await (
      method === "app" ? flow.verifyApp(code) : flow.verifySms(phone, code)
    ).catch(() => false);
    if (!ok) {
      setBusy(false);
      setError("That code doesn't match. Check the latest one and try again.");
      setShakeKey((value) => value + 1);
      setCode("");
      codeRef.current?.focus();
      return;
    }
    if (!needsCodes) {
      setBusy(false);
      onEnabled(method, { phone: method === "sms" ? phone : undefined });
      close();
      return;
    }
    setCodes(await flow.generateCodes());
    setBusy(false);
    setStep("codes");
  };

  const finish = () => {
    onEnabled(method, {
      codes,
      phone: method === "sms" ? phone : undefined,
    });
    close();
  };

  const canPrimary = canContinue({ code, method, number, saved, step });

  const resend: ResendControls = {
    onBack: () => {
      setStep("setup");
      setCode("");
      setError(null);
    },
    onResend: async () => {
      setError(null);
      setSecondsLeft(RESEND_SECONDS);
      try {
        await flow.sendSms(phone);
      } catch {
        setSecondsLeft(0);
        setError("Code not sent. Try again in a moment.");
      }
      codeRef.current?.focus();
    },
    secondsLeft,
  };

  const primary = () => {
    if (!canPrimary || busy) {
      return;
    }
    if (step === "setup") {
      toVerify();
    } else if (step === "verify") {
      verify();
    } else {
      finish();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent
        className={cn(FLOAT, "gap-0 overflow-hidden p-0 sm:max-w-lg")}
        // Focus returns to the button that opened the dialog; once the
        // method is on, that button (Set up / Turn on) is gone, so focus
        // lands on the sign-in card instead of the page body.
        finalFocus={() =>
          opener.current?.isConnected ? true : (fallbackFocus?.() ?? true)
        }
      >
        <motion.div
          animate={{ height }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT_QUAD }
          }
        >
          <div ref={ref}>
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
                className="flex flex-col gap-5 p-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  primary();
                }}
              >
                <DialogHeader>
                  <DialogTitle className="text-lg font-medium tracking-tight">
                    {text.title}
                  </DialogTitle>
                  <DialogDescription className="text-pretty">
                    {text.body}
                  </DialogDescription>
                </DialogHeader>

                {step === "setup" && method === "app" ? (
                  <ScanStep flow={flow} />
                ) : null}
                {step === "setup" && method === "sms" ? (
                  <PhoneStep
                    id={`${id}-phone`}
                    countries={countries}
                    country={country}
                    number={number}
                    error={error}
                    onCountryChange={setCountry}
                    onNumberChange={setNumber}
                  />
                ) : null}
                {step === "verify" ? (
                  <VerifyStep
                    id={`${id}-code`}
                    code={code}
                    codeRef={codeRef}
                    error={error}
                    shakeKey={shakeKey}
                    resend={method === "sms" ? resend : undefined}
                    onCode={(value) => {
                      setCode(value);
                      setError(null);
                    }}
                  />
                ) : null}
                {step === "codes" ? (
                  <CodesStep
                    id={`${id}-saved`}
                    codes={codes}
                    product={product}
                    saved={saved}
                    onSaved={setSaved}
                  />
                ) : null}

                <div className="flex justify-end gap-2">
                  {step === "codes" ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={RING_BUTTON}
                      disabled={busy}
                      onClick={close}
                    >
                      Cancel
                    </Button>
                  )}
                  <StatusButton
                    type="submit"
                    size="sm"
                    disabled={!busy && !canPrimary}
                    state={busy ? "busy" : "idle"}
                    labels={PRIMARY_LABEL[step]}
                  />
                </div>
              </motion.form>
            </AnimatePresence>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

/* ─────────────────────────────────────────────────────────
 * METHODS LIST
 * ───────────────────────────────────────────────────────── */

const MethodRow = ({
  description,
  icon,
  label,
  on,
  onSetup,
  onTurnOff,
}: {
  description: string;
  icon: typeof QrCodeIcon;
  label: string;
  on: boolean;
  onSetup: () => void;
  onTurnOff: () => void;
}) => (
  <div className={cn(CARD, "flex min-h-16 items-center gap-3 px-4 py-3")}>
    <HugeiconsIcon
      icon={icon}
      strokeWidth={1.75}
      className="text-muted-foreground size-5 shrink-0"
    />
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="flex items-center gap-2 text-sm font-medium">
        {label}
        {/* "On" pops in: 0.6 → 1 scale with a fade, 150ms ease-out. */}
        <AnimatePresence initial={false}>
          {on ? (
            <motion.span
              key="on"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
              className="flex origin-left items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              On
            </motion.span>
          ) : null}
        </AnimatePresence>
      </p>
      <p className="text-muted-foreground text-xs text-pretty">{description}</p>
    </div>
    {/* One button: its ring fades (the button's own 150ms box-shadow
        transition) and its label rolls, at one fixed width for both. */}
    <Button
      type="button"
      variant={on ? "ghost" : "outline"}
      size="sm"
      className={
        // Ghost keeps a transparent 1px border so its box matches the
        // outline button's exactly: the swap never changes the width.
        on
          ? "text-muted-foreground hover:text-foreground border border-transparent"
          : RING_BUTTON
      }
      onClick={on ? onTurnOff : onSetup}
    >
      <RollingLabel
        state="idle"
        labels={{ idle: on ? "Turn off" : "Set up" }}
        reserve={["Set up", "Turn off"]}
      />
    </Button>
  </div>
);

const METHOD_NAME: Record<TwoFactorMethod, string> = {
  app: "authenticator app",
  sms: "text message codes",
};

export const TwoFactorRows = ({
  appOn,
  codesLeft,
  codesTotal,
  flow,
  onOpenSetup,
  onTurnedOff,
  onNewCodes,
  product,
  smsPhone,
}: {
  appOn: boolean;
  codesLeft: number;
  codesTotal: number;
  flow: TwoFactorFlow;
  onOpenSetup: (method: TwoFactorMethod) => void;
  onTurnedOff: (method: TwoFactorMethod) => void;
  onNewCodes: (codes: string[]) => void;
  product: string;
  smsPhone: string | null;
}) => {
  const [turningOff, setTurningOff] = useState<TwoFactorMethod | null>(null);
  const [confirmCodes, setConfirmCodes] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const anyOn = appOn || Boolean(smsPhone);
  const onlyOne = Number(appOn) + Number(Boolean(smsPhone)) === 1;

  // Rows only: they sit in the sign-in card next to the password and
  // passkeys. The dialogs portal out, so they add nothing to the card.
  return (
    <>
      <MethodRow
        icon={QrCodeIcon}
        label="Authenticator app"
        description="Second step: a 6-digit code from an app like 1Password."
        on={appOn}
        onSetup={() => onOpenSetup("app")}
        onTurnOff={() => setTurningOff("app")}
      />
      <MethodRow
        icon={Message01Icon}
        label="Text message"
        description={
          smsPhone
            ? `Second step: a code texted to ${smsPhone}.`
            : "Second step: a code sent by text."
        }
        on={Boolean(smsPhone)}
        onSetup={() => onOpenSetup("sms")}
        onTurnOff={() => setTurningOff("sms")}
      />
      {/* Folds in once two-factor is on, out when it's off. The wrapper's
          -8px cancels the stack's gap, so an empty slot adds no space;
          1px of room each side keeps the ring unclipped while moving. */}
      <div className="-mx-px -mt-2 -mb-px">
        <AnimatePresence initial={false}>
          {anyOn ? (
            <Reveal key="codes" className="px-px pt-2 pb-px">
              <div
                data-highlight="codes"
                className={cn(
                  CARD,
                  "flex min-h-16 items-center gap-3 px-4 py-3"
                )}
              >
                <HugeiconsIcon
                  icon={Key01Icon}
                  strokeWidth={1.75}
                  className="text-muted-foreground size-5 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-sm font-medium">Recovery codes</p>
                  <p className="text-muted-foreground text-xs">
                    {codesLeft} of {codesTotal} left
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={RING_BUTTON}
                  onClick={() => setConfirmCodes(true)}
                >
                  Make new codes
                </Button>
              </div>
            </Reveal>
          ) : null}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={turningOff !== null}
        onOpenChange={(value) => (value ? null : setTurningOff(null))}
        title={`Turn off ${turningOff ? METHOD_NAME[turningOff] : ""}?`}
        body={
          onlyOne
            ? "This is your only second step. Signing in will need just your password, which makes your account easier to break into."
            : "You'll still have your other method for signing in."
        }
        confirmLabel="Turn off"
        busyLabel="Turning off…"
        onConfirm={async () => {
          if (turningOff) {
            await flow.turnOff(turningOff);
            onTurnedOff(turningOff);
          }
        }}
      />
      <ConfirmDialog
        open={confirmCodes}
        onOpenChange={setConfirmCodes}
        title="Make new recovery codes?"
        body={`Your ${codesLeft} remaining codes stop working straight away. Save the new ones before you close the next screen.`}
        confirmLabel="Make new codes"
        busyLabel="Making codes…"
        destructive={false}
        onConfirm={async () => {
          const codes = await flow.generateCodes();
          setNewCodes(codes);
          onNewCodes(codes);
        }}
      />
      <Dialog
        open={newCodes !== null}
        onOpenChange={(value) => (value ? null : setNewCodes(null))}
      >
        <DialogContent className={cn(FLOAT, "gap-5 sm:max-w-lg")}>
          <DialogHeader>
            <DialogTitle className="text-lg font-medium tracking-tight">
              Your new recovery codes
            </DialogTitle>
            <DialogDescription>
              The old ones no longer work. Each of these works once.
            </DialogDescription>
          </DialogHeader>
          {newCodes ? (
            <RecoveryCodes codes={newCodes} product={product} />
          ) : null}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setNewCodes(null)}>
              I've saved them
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
