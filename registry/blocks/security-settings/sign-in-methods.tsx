"use client";

import { cn } from "@/lib/utils";

import { PasskeysRow } from "./passkeys";
import type { Passkey } from "./passkeys";
import { PasswordRow } from "./password-field";
import { TwoFactorRows } from "./two-factor";
import type { TwoFactorFlow, TwoFactorMethod } from "./two-factor";

/* ─────────────────────────────────────────────────────────
 * SIGN-IN METHODS: every way into the account, in one card.
 *
 *   🔒 Password            Last changed 7 months ago     [Change password]
 *   ▦  Authenticator app   Second step: a 6-digit code…  [Set up]
 *   💬 Text message        Second step: a code by text   [Set up]
 *   🔑 Recovery codes      10 of 10 left                 [Make new codes]
 *   ☝  Passkeys            Fingerprint, face or PIN      [Add passkey]
 *        MacBook Pro · Added Sep 2                        Remove
 *
 * One list, read top to bottom: what you type, the second step, then the
 * way to skip both. Each row is its own ringed card, 8px apart (no rules);
 * rows share the icon column;
 * anything a row opens (the password form, saved passkeys) indents to the
 * row's text. Recovery codes appear once two-factor is on.
 * ───────────────────────────────────────────────────────── */

export interface SignInMethodsProps {
  /** "Last changed 3 months ago". */
  passwordLabel: string;
  /** Words a new password may not contain (name, email). */
  personal: string[];
  onChangePassword: (
    current: string,
    next: string,
    signOutOthers: boolean
  ) => Promise<void>;
  /** After a change; `signOutOthers` when the person ticked "Sign out of other devices". */
  onPasswordChanged: (signOutOthers: boolean) => void;
  appOn: boolean;
  smsPhone: string | null;
  codesLeft: number;
  codesTotal: number;
  flow: TwoFactorFlow;
  product: string;
  onOpenSetup: (method: TwoFactorMethod) => void;
  onTurnedOff: (method: TwoFactorMethod) => void;
  onNewCodes: (codes: string[]) => void;
  passkeys: Passkey[];
  onAddPasskey: () => Promise<void>;
  onRemovePasskey: (id: string) => Promise<void>;
  className?: string;
}

export const SignInMethods = ({
  className,
  passkeys,
  onAddPasskey,
  onRemovePasskey,
  passwordLabel,
  personal,
  onChangePassword,
  onPasswordChanged,
  ...twoFactor
}: SignInMethodsProps) => (
  <div className={cn("flex flex-col gap-2", className)}>
    <PasswordRow
      lastChangedLabel={passwordLabel}
      personal={personal}
      onChange={onChangePassword}
      onChanged={onPasswordChanged}
    />
    <TwoFactorRows {...twoFactor} />
    <PasskeysRow
      passkeys={passkeys}
      onAdd={onAddPasskey}
      onRemove={onRemovePasskey}
    />
  </div>
);
