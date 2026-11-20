"use client";

import {
  CheckmarkCircle02Icon,
  CreditCardIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useBillingActions } from "./actions";
import { FADE_ONLY, MOTION, SWAP_IN, TIMING, hold } from "./billing-motion";
import { CardMark } from "./brand-marks";
import {
  detectBrand,
  expiryError,
  formatNumber,
  luhn,
  maskExpiry,
  numberLength,
} from "./card-data";
import type { SavedCard } from "./card-data";
import { LIFT } from "./surface";

/* ─────────────────────────────────────────────────────────
 * ADD CARD: the empty slot turns into the form, in place.
 *
 *   type      the logo appears the moment the first digits say the
 *             brand (4 → Visa, 51–55 → Mastercard, 34/37 → Amex):
 *             icon cross-fade, spring 0.3 bounce 0. Spaces go in as
 *             you type (Amex groups 4-6-5).
 *   submit    checks run first (length, checksum, date, code)
 *   verify    "Verifying with your bank…" over the form while
 *             actions.verifyCard runs (3-D Secure), then ✓ Card added
 *             for 0.5s, then the slot becomes the card.
 *   declined  verifyCard rejects: back to the form with its message
 *             under the number (the demo declines 4000 0000 0000 0002).
 * ───────────────────────────────────────────────────────── */

const RING =
  "border border-transparent shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_1px_2px_-1px_oklch(0_0_0/0.06),0_2px_4px_0_oklch(0_0_0/0.04)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1)]";
const FIELD = cn(RING, "bg-background dark:bg-card h-8 tabular-nums");

type Stage = "form" | "verifying" | "added";

interface Errors {
  number?: string;
  expires?: string;
  cvc?: string;
  postcode?: string;
}

const check = (fields: {
  digits: string;
  expires: string;
  cvc: string;
  postcode: string;
}): Errors => {
  const brand = detectBrand(fields.digits);
  const codeLength = brand === "amex" ? 4 : 3;
  const errors: Errors = {};
  if (fields.digits.length !== numberLength(brand) || !luhn(fields.digits)) {
    errors.number = "Check the card number.";
  }
  const expiry = expiryError(fields.expires);
  if (expiry) {
    errors.expires = expiry;
  }
  if (fields.cvc.length !== codeLength) {
    errors.cvc = `Enter the ${codeLength}-digit code.`;
  }
  if (!fields.postcode.trim()) {
    errors.postcode = "Enter your postcode.";
  }
  return errors;
};

/** The brand logo inside a number field; cross-fades as it changes. */
export const BrandSlot = ({ brand }: { brand: SavedCard["brand"] | null }) => {
  const reduce = useReducedMotion();
  const swap = reduce ? FADE_ONLY : SWAP_IN;
  return (
    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={brand ?? "none"}
          {...swap}
          transition={MOTION.swap}
          className="flex"
        >
          {brand ? (
            <CardMark brand={brand} className="h-5 w-7.5" />
          ) : (
            <HugeiconsIcon
              icon={CreditCardIcon}
              strokeWidth={1.75}
              className="text-muted-foreground size-4"
            />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const FieldError = ({ id, text }: { id: string; text?: string }) =>
  text ? (
    <p id={id} className="text-destructive text-xs text-pretty">
      {text}
    </p>
  ) : null;

const Verifying = ({ stage }: { stage: Stage }) => {
  const reduce = useReducedMotion();
  const swap = reduce ? FADE_ONLY : SWAP_IN;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={MOTION.enter}
      role="status"
      className="bg-background/90 dark:bg-muted/90 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl backdrop-blur-[2px]"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={stage}
          {...swap}
          transition={MOTION.swap}
          className="flex"
        >
          <HugeiconsIcon
            icon={stage === "added" ? CheckmarkCircle02Icon : Loading03Icon}
            strokeWidth={2}
            className={cn(
              "size-5",
              stage === "added"
                ? "text-emerald-600 dark:text-emerald-400"
                : "animate-[spin_600ms_linear_infinite] motion-reduce:animate-none"
            )}
          />
        </motion.span>
      </AnimatePresence>
      <p className="text-sm">
        {stage === "added" ? "Card added" : "Verifying with your bank…"}
      </p>
    </motion.div>
  );
};

export const AddCardForm = ({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (card: SavedCard) => void;
}) => {
  const id = useId();
  const [digits, setDigits] = useState("");
  const [expires, setExpires] = useState("");
  const [cvc, setCvc] = useState("");
  const [postcode, setPostcode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [stage, setStage] = useState<Stage>("form");
  const actions = useBillingActions();
  const brand = detectBrand(digits);

  const submit = async () => {
    const found = check({ cvc, digits, expires, postcode });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    setStage("verifying");
    try {
      await actions.verifyCard({
        brand: brand ?? "visa",
        cvc,
        expires,
        number: digits,
        postcode,
      });
    } catch (error) {
      setStage("form");
      setErrors({
        number:
          error instanceof Error && error.message
            ? error.message
            : "Your bank declined this card. Try another.",
      });
      return;
    }
    setStage("added");
    await hold(TIMING.doneHold);
    onAdded({
      addedBy: "Maya Chen",
      addedOn: "Nov 20",
      brand: brand ?? "visa",
      expires,
      id: `card-${digits.slice(-4)}-${Date.now()}`,
      last4: digits.slice(-4),
      name: "Maya Chen",
    });
  };

  const describedBy = (key: keyof Errors) =>
    errors[key] ? `${id}-${key}-error` : undefined;

  return (
    <form
      noValidate
      aria-label="Add a card"
      onSubmit={(event) => {
        event.preventDefault();
        if (stage === "form") {
          submit();
        }
      }}
      className={cn(
        LIFT,
        "bg-background dark:bg-muted relative flex min-h-32 flex-col gap-2.5 rounded-xl p-4 sm:aspect-[1.7] sm:min-h-auto"
      )}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-number`} className="text-xs font-normal">
          Card number
        </Label>
        <div className="relative">
          <Input
            id={`${id}-number`}
            autoFocus
            value={formatNumber(digits, brand)}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 1234 1234 1234"
            aria-invalid={errors.number ? true : undefined}
            aria-describedby={describedBy("number")}
            onChange={(event) => {
              const next = event.target.value.replaceAll(/\D/g, "");
              setDigits(next.slice(0, numberLength(detectBrand(next))));
              // A new number gets a fresh hearing.
              setErrors(({ number: _, ...rest }) => rest);
            }}
            className={cn(FIELD, "pr-12")}
          />
          <BrandSlot brand={brand} />
        </div>
        <FieldError id={`${id}-number-error`} text={errors.number} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-exp`} className="text-xs font-normal">
            Expiry
          </Label>
          <Input
            id={`${id}-exp`}
            value={expires}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            aria-invalid={errors.expires ? true : undefined}
            aria-describedby={describedBy("expires")}
            onChange={(event) => setExpires(maskExpiry(event.target.value))}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-cvc`} className="text-xs font-normal">
            CVC
          </Label>
          <Input
            id={`${id}-cvc`}
            value={cvc}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder={brand === "amex" ? "1234" : "123"}
            aria-invalid={errors.cvc ? true : undefined}
            aria-describedby={describedBy("cvc")}
            onChange={(event) =>
              setCvc(
                event.target.value
                  .replaceAll(/\D/g, "")
                  .slice(0, brand === "amex" ? 4 : 3)
              )
            }
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-zip`} className="text-xs font-normal">
            Postcode
          </Label>
          <Input
            id={`${id}-zip`}
            value={postcode}
            autoComplete="postal-code"
            aria-invalid={errors.postcode ? true : undefined}
            aria-describedby={describedBy("postcode")}
            onChange={(event) => setPostcode(event.target.value.slice(0, 10))}
            className={FIELD}
          />
        </div>
      </div>
      <FieldError id={`${id}-expires-error`} text={errors.expires} />
      <FieldError id={`${id}-cvc-error`} text={errors.cvc} />
      <FieldError id={`${id}-postcode-error`} text={errors.postcode} />

      <div className="mt-auto flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Add card
        </Button>
      </div>

      <AnimatePresence>
        {stage === "form" ? null : <Verifying key="verify" stage={stage} />}
      </AnimatePresence>
    </form>
  );
};
