"use client";

import { FingerPrintIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Reveal } from "./motion";
import { StatusButton, useButtonState } from "./status-button";
import { CARD, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * PASSKEYS ROW: sign in with a fingerprint, face or device PIN.
 *
 *   ☝ Passkeys                                   [Add passkey]
 *     Sign in with your fingerprint or face instead of a password.
 *       MacBook Pro · Added Sep 2                     Remove
 *
 * The saved passkeys sit under the row, indented to its text. Add runs
 * your WebAuthn prompt ("Waiting for your device…" meanwhile); a removed
 * one folds away (Reveal) so the card never jumps.
 * ───────────────────────────────────────────────────────── */

/** A passkey registered on the account. */
export interface Passkey {
  /** Unique id. */
  id: string;
  /** The device or password manager it lives in, e.g. "MacBook Pro". */
  name: string;
  /** When it was added, already formatted, e.g. "Sep 2". */
  added: string;
}

const PasskeyItem = ({
  onRemove,
  passkey,
}: {
  onRemove: () => Promise<void>;
  passkey: Passkey;
}) => {
  // No "done" state: on success the row folds away.
  const [state, run] = useButtonState();
  const [failed, setFailed] = useState(false);
  const remove = async () => {
    setFailed(false);
    setFailed(!(await run(onRemove, false)));
  };
  return (
    <div className="flex min-h-10 items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm">{passkey.name}</p>
        <p
          aria-live="polite"
          className={
            failed
              ? "text-destructive text-xs"
              : "text-muted-foreground text-xs"
          }
        >
          {failed ? "Not removed. Try again." : `Added ${passkey.added}`}
        </p>
      </div>
      <StatusButton
        type="button"
        variant="ghost"
        size="sm"
        state={state}
        labels={{ busy: "Removing…", idle: "Remove" }}
        aria-label={
          state === "idle" ? `Remove ${passkey.name} passkey` : undefined
        }
        onClick={remove}
        className="text-muted-foreground hover:text-foreground"
      />
    </div>
  );
};

export const PasskeysRow = ({
  onAdd,
  onRemove,
  passkeys,
}: {
  onAdd: () => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  passkeys: Passkey[];
}) => {
  const [state, run] = useButtonState();
  const [failed, setFailed] = useState(false);

  const add = async () => {
    setFailed(false);
    setFailed(!(await run(onAdd)));
  };

  return (
    <div className={cn(CARD, "flex flex-col gap-1 px-4 py-3")}>
      <div className="flex min-h-10 items-center gap-3">
        <HugeiconsIcon
          icon={FingerPrintIcon}
          strokeWidth={1.75}
          className="text-muted-foreground size-5 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-sm font-medium">Passkeys</p>
          <p
            aria-live="polite"
            className={
              failed
                ? "text-destructive text-xs"
                : "text-muted-foreground text-xs text-pretty"
            }
          >
            {failed
              ? "Passkey not added. Try again."
              : "Sign in with your fingerprint, face or device PIN."}
          </p>
        </div>
        <StatusButton
          type="button"
          variant="outline"
          size="sm"
          className={RING_BUTTON}
          state={state}
          labels={{
            busy: "Waiting for device…",
            done: "Added",
            idle: "Add passkey",
          }}
          onClick={add}
        />
      </div>
      {passkeys.length > 0 ? (
        <div className="flex flex-col pl-8">
          <AnimatePresence initial={false}>
            {passkeys.map((passkey) => (
              <Reveal key={passkey.id}>
                <PasskeyItem
                  passkey={passkey}
                  onRemove={() => onRemove(passkey.id)}
                />
              </Reveal>
            ))}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
};
