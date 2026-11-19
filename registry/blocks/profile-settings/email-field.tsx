"use client";

import {
  CheckmarkCircle02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import type * as React from "react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { Reveal, SwapSpace } from "./motion";
import { RollingLabel, StatusButton, useButtonState } from "./status-button";
import type { ButtonState } from "./status-button";
import { RING } from "./surface";

/* ─────────────────────────────────────────────────────────
 * EMAIL: a primary and an optional secondary address.
 *
 * Each reads as a field with a pen inside it; the line above says which
 * one it is and whether it's verified (plain meta text, the tick is the
 * only colour). Not part of the profile's save: an address only changes
 * once a link sent to it is confirmed.
 *
 *   primary     change → link sent; the old address stays the sign-in
 *               until the new one is confirmed
 *   secondary   change or add → the new address shows as Not verified
 *               with Resend link; Remove is in its edit state
 *   Esc in the field cancels and puts focus back on the pen
 *
 * BUTTONS: Send link and Remove roll to a spinner at a fixed width
 * (StatusButton); "Resend link" rolls to a spinner, then "✓ Link sent".
 * ───────────────────────────────────────────────────────── */

/** One email address on the account. */
export interface EmailAddress {
  /** The address, e.g. "sam@acme.com". */
  address: string;
  /** Whether the person has confirmed it from the link sent to it. */
  verified: boolean;
}

export type EmailKind = "primary" | "secondary";

/** The emails the block shows, and what it calls when they change. */
export interface EmailSettings {
  /** The address the person signs in with. */
  primary: EmailAddress;
  /** An optional second address, for account recovery. `null` for none. */
  secondary: EmailAddress | null;
  /** Sends a confirmation link to a new primary or secondary address. */
  onSendLink: (kind: EmailKind, address: string) => Promise<void>;
  /** Sends the confirmation link again to an unverified address. */
  onResendLink: (address: string) => Promise<void>;
  /** Removes the secondary address. */
  onRemoveSecondary: () => Promise<void> | void;
}

const KIND_LABEL: Record<EmailKind, string> = {
  primary: "Primary",
  secondary: "Secondary",
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// The input look, shared by the read-only field and the edit field.
const FIELD_BOX = `${RING} dark:bg-input/30 flex h-9 items-center rounded-md bg-transparent`;

const LINK_BUTTON =
  "text-foreground focus-visible:ring-ring/50 rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px]";

// Which address, and its state, as plain meta text: "Primary · Verified"
// or "Secondary · Not verified · Resend link".
const LabelLine = ({
  email,
  heading,
  onResend,
  resend,
}: {
  email: EmailAddress | null;
  heading: React.ReactNode;
  onResend: () => void;
  resend: ButtonState;
}) => (
  <div className="text-muted-foreground mb-1.5 flex flex-wrap items-center gap-x-1.5 text-xs">
    {heading}
    {email ? (
      <>
        <span aria-hidden>·</span>
        {email.verified ? (
          <span className="flex items-center gap-1">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              strokeWidth={2}
              className="size-3 text-emerald-600 dark:text-emerald-400"
            />
            Verified
          </span>
        ) : (
          <>
            <span>Not verified</span>
            <span aria-hidden>·</span>
            {/* Rolls: Resend link → spinner → ✓ Link sent (it stays sent). */}
            <button
              type="button"
              aria-disabled={resend !== "idle" || undefined}
              onClick={resend === "idle" ? onResend : undefined}
              className={cn(
                LINK_BUTTON,
                resend !== "idle" && "cursor-default no-underline"
              )}
            >
              <RollingLabel
                state={resend}
                labels={{
                  busy: "Sending link…",
                  done: "Link sent",
                  idle: "Resend link",
                }}
              />
            </button>
            <span aria-live="polite" className="sr-only">
              {resend === "done" ? "Link sent" : ""}
            </span>
          </>
        )}
      </>
    ) : null}
  </div>
);

const EmailSlot = ({
  email,
  kind,
  onAdded,
  onRemove,
  onResendLink,
  onSendLink,
}: {
  email: EmailAddress | null;
  kind: EmailKind;
  onAdded?: (email: EmailAddress) => void;
  onRemove?: () => Promise<void> | void;
  onResendLink: (address: string) => Promise<void>;
  onSendLink: (kind: EmailKind, address: string) => Promise<void>;
}) => {
  const adding = email === null;
  const [mode, setMode] = useState<"view" | "edit" | "pending">(
    adding ? "edit" : "view"
  );
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState<ButtonState>("idle");
  const [removing, runRemove] = useButtonState();
  const penRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const label = KIND_LABEL[kind];
  const editing = mode === "edit";
  const valid = isEmail(next) && next !== email?.address;

  const close = () => {
    setMode("view");
    setNext("");
    setError(null);
    if (adding) {
      onRemove?.();
      return;
    }
    // After the field swaps back, return focus to its pen.
    requestAnimationFrame(() => penRef.current?.focus());
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSendLink(kind, next);
    } catch {
      setError("Link not sent. Check the address and try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
    if (kind === "primary") {
      setMode("pending");
      return;
    }
    onAdded?.({ address: next, verified: false });
    setResend("idle");
    setMode("view");
    setNext("");
  };

  const resendLink = async () => {
    if (!email) {
      return;
    }
    setResend("busy");
    try {
      await onResendLink(email.address);
    } catch {
      setResend("idle");
      return;
    }
    setResend("done");
  };

  return (
    // One form around the slot: the field swaps in place (same box, same
    // size, no motion); only the parts that come and go below it animate.
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (editing && valid && !busy) {
          send();
        }
      }}
    >
      <LabelLine
        email={editing ? null : email}
        heading={
          editing ? (
            <label htmlFor={inputId}>
              {adding ? `${label} email` : `New ${label.toLowerCase()} email`}
            </label>
          ) : (
            <span>{label}</span>
          )
        }
        onResend={resendLink}
        resend={resend}
      />

      {editing ? (
        <div
          className={cn(
            FIELD_BOX,
            "focus-within:border-ring focus-within:ring-ring/50 transition-[color,box-shadow] focus-within:ring-[3px]",
            error && "border-destructive"
          )}
        >
          <Input
            id={inputId}
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={next}
            aria-invalid={Boolean(error)}
            onChange={(event) => setNext(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                // Cancels this edit only (not the page's discard).
                event.stopPropagation();
                close();
              }
            }}
            // biome-ignore lint/a11y/noAutofocus: opened by the user's click.
            autoFocus
            // Override: the box around it draws the border and ring.
            className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      ) : (
        <div className={cn(FIELD_BOX, "pr-0.5 pl-3")}>
          <span className="min-w-0 flex-1 truncate text-sm">
            {email?.address}
          </span>
          <Button
            ref={penRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Change ${label.toLowerCase()} email`}
            onClick={() => setMode("edit")}
            // Override: quiet until hovered; a smaller box inside the field.
            className="text-muted-foreground hover:text-foreground size-8"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.75} />
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {editing ? (
          <Reveal key="actions" swap className="flex flex-col gap-1.5 pt-2">
            {error ? (
              <p className="text-destructive text-xs" aria-live="polite">
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <StatusButton
                type="submit"
                size="sm"
                // Busy stays full colour (aria-disabled), not dimmed.
                disabled={!busy && !valid}
                state={busy ? "busy" : "idle"}
                labels={{ busy: "Sending link…", idle: "Send link" }}
              />
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              {kind === "secondary" && !adding ? (
                <StatusButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  // Override: pushed to the far end, destructive colour.
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
                  state={removing}
                  labels={{ busy: "Removing…", idle: "Remove" }}
                  onClick={() =>
                    runRemove(() => Promise.resolve(onRemove?.()), false)
                  }
                />
              ) : null}
            </div>
          </Reveal>
        ) : null}
        {mode === "pending" ? (
          <Reveal key="pending" swap className="pt-1.5">
            <p
              className="text-muted-foreground text-xs text-pretty"
              aria-live="polite"
            >
              We sent a link to <span className="text-foreground">{next}</span>.{" "}
              {email?.address} stays your sign-in until you confirm.{" "}
              <button type="button" onClick={close} className={LINK_BUTTON}>
                Cancel change
              </button>
            </p>
          </Reveal>
        ) : null}
      </AnimatePresence>
    </form>
  );
};

export const EmailField = ({ emails }: { emails: EmailSettings }) => {
  const [secondary, setSecondary] = useState(emails.secondary);
  // Adding a secondary opens an empty slot in edit mode.
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);

  const remove = async () => {
    await emails.onRemoveSecondary();
    setSecondary(null);
    setAdding(false);
    requestAnimationFrame(() => addRef.current?.focus());
  };

  return (
    <div className="flex flex-col">
      <EmailSlot
        kind="primary"
        email={emails.primary}
        onSendLink={emails.onSendLink}
        onResendLink={emails.onResendLink}
      />
      {/* The secondary slot and "Add secondary email" swap in place. The
        gap lives inside (pt-4), so it's part of what crossfades. */}
      <SwapSpace swapKey={secondary || adding ? "secondary" : "add"}>
        {secondary || adding ? (
          <div className="pt-4">
            <EmailSlot
              kind="secondary"
              email={secondary}
              onSendLink={emails.onSendLink}
              onResendLink={emails.onResendLink}
              onAdded={(email) => {
                setSecondary(email);
                setAdding(false);
              }}
              onRemove={
                // Cancelling an add just closes the empty slot.
                secondary
                  ? remove
                  : () => {
                      setAdding(false);
                      requestAnimationFrame(() => addRef.current?.focus());
                    }
              }
            />
          </div>
        ) : (
          <div className="pt-4">
            <Button
              ref={addRef}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdding(true)}
              // Override: sits on the field's left edge, like a row of its own.
              className="text-muted-foreground hover:text-foreground -ml-2.5"
            >
              <HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.75} />
              Add secondary email
            </Button>
          </div>
        )}
      </SwapSpace>
    </div>
  );
};
