"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { BrandSlot } from "./add-card-form";
import { CardMark } from "./brand-marks";
import type { CardBrand } from "./brand-marks";
import {
  describe,
  detectBrand,
  expiryError,
  formatNumber,
  luhn,
  maskExpiry,
  numberLength,
} from "./card-data";
import type { SavedCard } from "./card-data";
import { StatusButton, useButtonState } from "./status-button";
import { LIFT } from "./surface";
import { SWITCH_MOTION } from "./ui";

/* ─────────────────────────────────────────────────────────
 * CARD EDITOR, in the card's own slot:
 *
 *   [VISA]                                   Backup (•—)
 *   Card number  [•••• •••• •••• 4242      ▭]
 *   Expiry [01/27]           CVC [123]
 *   Name on card [Maya Chen] Nickname [optional]
 *                                    Cancel  [Update]
 *
 *   number     left empty keeps the card (its last four show as the
 *              placeholder); typing a new one replaces it, with the
 *              same live brand logo and checks as Add card
 *   CVC        needed only with a new number
 *   backup     top right; the default card shows its Default pill
 * ───────────────────────────────────────────────────────── */

const RING =
  "border border-transparent shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_1px_2px_-1px_oklch(0_0_0/0.06),0_2px_4px_0_oklch(0_0_0/0.04)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1)]";
const FIELD = cn(RING, "bg-background dark:bg-card h-8 tabular-nums");

export interface CardEdit {
  name: string;
  nickname: string;
  expires: string;
  backup: boolean;
  /** Set when a new number was entered: the card it now is. */
  number?: { brand: CardBrand; last4: string };
}

interface Errors {
  number?: string;
  expires?: string;
  cvc?: string;
  name?: string;
}

const check = (fields: {
  digits: string;
  expires: string;
  cvc: string;
  name: string;
}): Errors => {
  const errors: Errors = {};
  if (fields.digits) {
    const brand = detectBrand(fields.digits);
    if (fields.digits.length !== numberLength(brand) || !luhn(fields.digits)) {
      errors.number = "Check the card number.";
    }
    const codeLength = brand === "amex" ? 4 : 3;
    if (fields.cvc.length !== codeLength) {
      errors.cvc = `Enter the ${codeLength}-digit code.`;
    }
  }
  const expiry = expiryError(fields.expires);
  if (expiry) {
    errors.expires = expiry;
  }
  if (!fields.name.trim()) {
    errors.name = "Enter the name on the card.";
  }
  return errors;
};

const Hint = ({ id, text }: { id: string; text?: string }) =>
  text ? (
    <p id={id} className="text-destructive text-xs text-pretty">
      {text}
    </p>
  ) : null;

export const CardEditor = ({
  card,
  isDefault,
  isBackup,
  onCancel,
  onUpdate,
}: {
  card: SavedCard;
  isDefault: boolean;
  isBackup: boolean;
  onCancel: () => void;
  onUpdate: (next: CardEdit) => void;
}) => {
  const id = useId();
  const [digits, setDigits] = useState("");
  const [expires, setExpires] = useState(card.expires);
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState(card.name);
  const [nickname, setNickname] = useState(card.nickname ?? "");
  const [backup, setBackup] = useState(isBackup);
  const [errors, setErrors] = useState<Errors>({});
  const [state, run] = useButtonState(700);
  const typed = detectBrand(digits);
  const brand = digits ? typed : card.brand;
  // Editing a field clears its message; the rest wait for Update.
  const clear = (key: keyof Errors) =>
    setErrors((value) => {
      const { [key]: _, ...rest } = value;
      return rest;
    });
  const describedBy = (key: keyof Errors) =>
    errors[key] ? `${id}-${key}-error` : undefined;

  return (
    <form
      noValidate
      aria-label={`Edit ${describe(card)}`}
      className={cn(
        LIFT,
        "bg-background dark:bg-muted flex min-h-32 flex-col gap-2.5 rounded-xl p-4 sm:aspect-[1.7] sm:min-h-auto"
      )}
      onSubmit={async (event) => {
        event.preventDefault();
        if (state !== "idle") {
          return;
        }
        const found = check({ cvc, digits, expires, name });
        setErrors(found);
        if (Object.keys(found).length > 0) {
          return;
        }
        if (await run(() => Promise.resolve())) {
          onUpdate({
            backup,
            expires,
            name: name.trim(),
            nickname: nickname.trim(),
            number:
              digits && typed
                ? { brand: typed, last4: digits.slice(-4) }
                : undefined,
          });
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {brand ? <CardMark brand={brand} /> : <span className="h-6" />}
        {isDefault ? (
          <span className="bg-primary/10 text-primary dark:bg-primary/25 rounded-full px-2 py-0.5 text-xs dark:text-blue-200">
            Default
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Label htmlFor={`${id}-backup`} className="text-xs font-normal">
              Backup
            </Label>
            <Switch
              id={`${id}-backup`}
              checked={backup}
              onCheckedChange={setBackup}
              aria-describedby={`${id}-backup-note`}
              className={SWITCH_MOTION}
            />
            <span id={`${id}-backup-note`} className="sr-only">
              If the default card fails, we'll try this one.
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-number`} className="text-xs font-normal">
          Card number
        </Label>
        <div className="relative">
          <Input
            id={`${id}-number`}
            autoFocus
            value={formatNumber(digits, typed)}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder={`•••• •••• •••• ${card.last4}`}
            aria-invalid={errors.number ? true : undefined}
            aria-describedby={describedBy("number")}
            onChange={(event) => {
              const next = event.target.value.replaceAll(/\D/g, "");
              setDigits(next.slice(0, numberLength(detectBrand(next))));
              clear("number");
            }}
            className={cn(FIELD, "pr-12")}
          />
          <BrandSlot brand={digits ? typed : null} />
        </div>
        <Hint id={`${id}-number-error`} text={errors.number} />
      </div>

      <div className="grid grid-cols-2 gap-2">
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
            onChange={(event) => {
              setExpires(maskExpiry(event.target.value));
              clear("expires");
            }}
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
            onChange={(event) => {
              setCvc(
                event.target.value
                  .replaceAll(/\D/g, "")
                  .slice(0, brand === "amex" ? 4 : 3)
              );
              clear("cvc");
            }}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-name`} className="text-xs font-normal">
            Name on card
          </Label>
          <Input
            id={`${id}-name`}
            value={name}
            autoComplete="cc-name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name")}
            onChange={(event) => {
              setName(event.target.value);
              clear("name");
            }}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-nick`} className="text-xs font-normal">
            Nickname <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`${id}-nick`}
            value={nickname}
            placeholder="Company card"
            maxLength={24}
            onChange={(event) => setNickname(event.target.value)}
            className={FIELD}
          />
        </div>
      </div>
      <Hint id={`${id}-expires-error`} text={errors.expires} />
      <Hint id={`${id}-cvc-error`} text={errors.cvc} />
      <Hint id={`${id}-name-error`} text={errors.name} />

      <div className="mt-auto flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <StatusButton
          type="submit"
          size="sm"
          state={state}
          labels={{ busy: "Updating…", done: "Updated", idle: "Update" }}
        />
      </div>
    </form>
  );
};
