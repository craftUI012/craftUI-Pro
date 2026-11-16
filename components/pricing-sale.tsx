"use client";

import {
  ArrowRight01Icon,
  Cancel01Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CheckoutButton } from "@/components/checkout-button";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import type { SaleInfo } from "@/lib/billing/sale";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

// The sale (lib/billing/sale.ts) on the site:
//   SaleStrip           a slim primary bar under the navbar on every page
//                       (components/new-hero-section/browse/browse-shell.tsx)
//   SaleCoupon          the pricing page's ticket under its heading
//   SaleCheckoutButton  the sale plan's button, which copies the code on
//                       the same click so the buyer lands on Dodo's
//                       checkout with it ready to paste
// Each shows the code to copy; the strip and coupon count down and hide
// themselves when the sale ends.

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * Read top-to-bottom. Each `at` value is ms after mount.
 *
 *    0ms   coupon hidden
 *  120ms   coupon fades in, y 8 → 0
 *  520ms   countdown fades in, then ticks every second
 *          (a changed digit rolls down, the old one out the bottom)
 *
 * On copy:
 *    0ms   copy icon blurs out (scale 1 → 0.4), tick blurs in
 *    0ms   label "Copy code" → "Copied"
 * 1800ms   back to the copy icon
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // tick icon returns to the copy icon (after the click)
  copiedReset: 1800,
  // countdown appears and starts ticking
  countdownIn: 520,
  // coupon fades / rises in
  couponEnter: 120,
};

const COUPON = {
  // px the coupon rises from
  offsetY: 8,
  spring: { damping: 30, stiffness: 300, type: "spring" as const },
};

const COPY_ICON = {
  // px blur on the outgoing / incoming icon
  blur: 4,
  // icon scale while hidden
  initialScale: 0.4,
  spring: { bounce: 0, duration: 0.3, type: "spring" as const },
};

const DIGIT = {
  spring: { damping: 30, stiffness: 400, type: "spring" as const },
};

/* ── Countdown ────────────────────────────────────────── */

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const split = (ms: number): Remaining => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    total,
  };
};

// Null until mounted, so the server HTML and the first client render agree.
const useCountdown = (endsAt: string) => {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  useEffect(() => {
    const end = Date.parse(endsAt);
    const tick = () => setRemaining(split(end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
};

const pad = (value: number) => String(value).padStart(2, "0");

// "3d 04:12:09", or "04:12:09" on the last day.
const formatRemaining = (r: Remaining | null) =>
  r === null
    ? "--:--:--"
    : `${r.days > 0 ? `${r.days}d ` : ""}${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`;

// Each character in its own cell; a changed digit rolls down.
const RollingText = ({
  className,
  text,
}: {
  className?: string;
  text: string;
}) => {
  const reduced = useReducedMotion();
  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      {[...text].map((char, index) => (
        <span
          // The cell stays; its digit changes.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
          key={index}
          aria-hidden
          className="relative inline-flex overflow-hidden"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={char}
              initial={reduced ? { opacity: 0 } : { y: "-100%" }}
              animate={reduced ? { opacity: 1 } : { y: 0 }}
              exit={reduced ? { opacity: 0 } : { y: "100%" }}
              transition={DIGIT.spring}
              className="inline-block whitespace-pre"
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
};

/* ── Copy ─────────────────────────────────────────────── */

type CopySource = "coupon" | "plan_card" | "strip";

const useCopyCode = (code: string, source: CopySource) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    trackEvent({
      name: "discount_code_copied",
      properties: { code, source },
    });
    setCopied(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setCopied(false), TIMING.copiedReset);
  }, [code, source]);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);
  return { copied, copy };
};

const CopyGlyph = ({ copied }: { copied: boolean }) => {
  const reduced = useReducedMotion();
  const hidden = reduced
    ? { opacity: 0 }
    : {
        filter: `blur(${COPY_ICON.blur}px)`,
        opacity: 0,
        scale: COPY_ICON.initialScale,
      };
  const shown = reduced
    ? { opacity: 1 }
    : { filter: "blur(0px)", opacity: 1, scale: 1 };
  return (
    <span className="relative inline-grid size-4 place-items-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={copied ? "tick" : "copy"}
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={COPY_ICON.spring}
          className="inline-grid place-items-center"
        >
          <Icon icon={copied ? Tick02Icon : Copy01Icon} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const CopiedAnnouncer = ({
  code,
  copied,
}: {
  code: string;
  copied: boolean;
}) => (
  <span aria-live="polite" className="sr-only">
    {copied ? `Code ${code} copied` : ""}
  </span>
);

/* ── Coupon ───────────────────────────────────────────── */

// The two half-circle cuts at the ends of the tear line. Each is a circle
// in the page colour with its own border, centred on the card's outer
// edge and clipped to the half that falls inside the card, so it covers
// the card's border there and draws the curved edge of the cut. Positions
// are from the stub (the tear line is its top border on phones, its left
// border from md); the 1px and 0.5px offsets centre the circle on the
// card's border and on the 1px tear line.
const NOTCHES = [
  // phones: left and right ends of the horizontal tear line
  "md:hidden -left-[calc(1px+0.625rem)] top-[calc(0.5px-0.625rem)] [clip-path:inset(0_0_0_50%)]",
  "md:hidden -right-[calc(1px+0.625rem)] top-[calc(0.5px-0.625rem)] [clip-path:inset(0_50%_0_0)]",
  // md up: top and bottom ends of the vertical tear line
  "hidden md:block -top-[calc(1px+0.625rem)] left-[calc(0.5px-0.625rem)] [clip-path:inset(50%_0_0_0)]",
  "hidden md:block -bottom-[calc(1px+0.625rem)] left-[calc(0.5px-0.625rem)] [clip-path:inset(0_0_50%_0)]",
];

// A ticket: the offer on the left, a dashed tear line with a cut at each
// end, and the code with a Copy button on the stub. Hides itself when the
// countdown reaches zero.
export const SaleCoupon = ({ sale }: { sale: SaleInfo }) => {
  const [stage, setStage] = useState(0);
  const remaining = useCountdown(sale.endsAt);
  const { copied, copy } = useCopyCode(sale.code, "coupon");

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), TIMING.couponEnter),
      setTimeout(() => setStage(2), TIMING.countdownIn),
    ];
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, []);

  if (remaining?.total === 0) {
    return null;
  }

  return (
    <motion.section
      aria-label={`${sale.name} offer`}
      initial={{ opacity: 0, y: COUPON.offsetY }}
      animate={{
        opacity: stage >= 1 ? 1 : 0,
        y: stage >= 1 ? 0 : COUPON.offsetY,
      }}
      transition={COUPON.spring}
      className="w-full max-w-3xl"
    >
      <div className="bg-card text-card-foreground grid rounded-xl border md:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-3 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Badge>{sale.name}</Badge>
            <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
              {sale.planName} only
            </span>
          </div>
          <h2 className={cn(TYPE.headingPanel, "tracking-tight")}>
            {sale.percentOff}% off {sale.planName}
          </h2>
          <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
            Pay{" "}
            <span className="text-foreground font-medium">
              {sale.salePriceLabel}
            </span>{" "}
            once instead of{" "}
            <s className="decoration-muted-foreground/60">{sale.priceLabel}</s>.
            Every section, block and illustration, and everything we ship next.
          </p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 2 ? 1 : 0 }}
            className={cn(
              TYPE.cardCaption,
              "text-muted-foreground flex items-center gap-1"
            )}
          >
            Ends {sale.endsLabel}, in
            <RollingText
              className="text-foreground font-medium"
              text={formatRemaining(remaining)}
            />
          </motion.p>
        </div>

        {/* Tear line: dashed, across on phones, down from md. */}
        <div className="relative flex flex-col justify-center gap-3 border-t border-dashed p-5 md:border-t-0 md:border-l md:p-6">
          {NOTCHES.map((position) => (
            <span
              key={position}
              aria-hidden
              className={cn(
                "bg-background pointer-events-none absolute size-5 rounded-full border",
                position
              )}
            />
          ))}
          <span className={cn(TYPE.cardEyebrow, "text-muted-foreground")}>
            Your code
          </span>
          <span
            className={cn(
              TYPE.cardMetric,
              "font-mono font-medium tracking-wider"
            )}
          >
            {sale.code}
          </span>
          <Button variant="secondary" className="w-full" onClick={copy}>
            <CopyGlyph copied={copied} />
            {copied ? "Copied" : "Copy code"}
          </Button>
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            Paste it at checkout.
          </span>
          <CopiedAnnouncer code={sale.code} copied={copied} />
        </div>
      </div>
    </motion.section>
  );
};

/* ── Checkout ─────────────────────────────────────────── */

// The sale plan's button: copies the code, then starts checkout. Capture
// phase, so the clipboard write happens inside the click, before the
// redirect starts.
export const SaleCheckoutButton = ({
  salePriceCents,
  sale,
  variant = "default",
}: {
  salePriceCents: number;
  sale: SaleInfo;
  variant?: "default" | "secondary";
}) => {
  const { copied, copy } = useCopyCode(sale.code, "plan_card");
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the button inside handles the keyboard; this only adds the copy
    // biome-ignore lint/a11y/useKeyWithClickEvents: as above
    <div className="w-full" onClickCapture={copy}>
      <CheckoutButton
        label={`Copy code & get ${sale.planName} for ${sale.salePriceLabel}`}
        plan={sale.plan}
        priceCents={salePriceCents}
        variant={variant}
      />
      <CopiedAnnouncer code={sale.code} copied={copied} />
    </div>
  );
};

/* ── Strip ────────────────────────────────────────────── */

const STRIP = {
  // localStorage key prefix for "closed it"; per code, so the next sale
  // shows again
  dismissKey: "sale-strip-dismissed:",
  spring: { damping: 30, stiffness: 300, type: "spring" as const },
};

const readDismissed = (code: string) => {
  try {
    return localStorage.getItem(STRIP.dismissKey + code) === "1";
  } catch {
    return false;
  }
};

const saveDismissed = (code: string) => {
  try {
    localStorage.setItem(STRIP.dismissKey + code, "1");
  } catch {
    // Storage blocked: it just shows again on the next visit.
  }
};

// The code as a chip on the primary strip: mono code, copy icon, "Copied".
const StripCodeChip = ({ code }: { code: string }) => {
  const { copied, copy } = useCopyCode(code, "strip");
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy discount code ${code}`}
      className="border-primary-foreground/45 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed pr-2 pl-2.5 font-mono text-[0.8125rem] font-medium tracking-wide transition-[background-color,scale] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100"
    >
      {code}
      <CopyGlyph copied={copied} />
      <CopiedAnnouncer code={code} copied={copied} />
    </button>
  );
};

// One line under the navbar on every page: the offer, the code to copy,
// the countdown (md up) and a link to the plans (lg up), with a close
// button. Rendered on the server so it doesn't push the page down after
// load; it collapses when closed (remembered per code) or when the sale
// ends.
export const SaleStrip = ({ sale }: { sale: SaleInfo }) => {
  const remaining = useCountdown(sale.endsAt);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (readDismissed(sale.code)) {
      setDismissed(true);
    }
  }, [sale.code]);

  const open = !dismissed && remaining?.total !== 0;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          aria-label={`${sale.name} offer`}
          exit={{ height: 0, opacity: 0 }}
          transition={STRIP.spring}
          className="bg-primary text-primary-foreground overflow-hidden"
        >
          <div
            className={cn(
              TYPE.cardBody,
              "relative flex min-h-11 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 py-2 pr-12 pl-4 sm:pl-12"
            )}
          >
            <span className="font-medium">
              {sale.name}: {sale.percentOff}% off {sale.planName}
            </span>
            <span className="text-primary-foreground/70 hidden sm:inline">
              {sale.salePriceLabel} once, with
            </span>
            <StripCodeChip code={sale.code} />
            <span className="text-primary-foreground/70 hidden items-center gap-1 md:inline-flex">
              Ends in
              <RollingText
                className="text-primary-foreground font-medium"
                text={formatRemaining(remaining)}
              />
            </span>
            <Link
              href={`${ROUTES.PRICING}#plans`}
              className="hidden items-center gap-1 font-medium underline-offset-4 hover:underline lg:inline-flex"
            >
              Get {sale.planName}
              <Icon icon={ArrowRight01Icon} />
            </Link>
            <button
              type="button"
              aria-label="Close offer"
              onClick={() => {
                saveDismissed(sale.code);
                setDismissed(true);
              }}
              className="text-primary-foreground/70 hover:text-primary-foreground absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md transition-colors"
            >
              <Icon icon={Cancel01Icon} />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
