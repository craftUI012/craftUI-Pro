"use client";

import {
  Alert02Icon,
  LaptopIcon,
  SmartPhone01Icon,
  Tablet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ConfirmDialog } from "./confirm-dialog";
import { Reveal } from "./motion";
import { StatusButton } from "./status-button";
import { CARD, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * ACTIVE SESSIONS: everywhere the account is signed in.
 *
 *   [💻] Chrome on macOS   This device
 *        Bengaluru, India · 103.21.58.12 · Active now
 *   [📱] Firefox on Windows  ⚠ Unfamiliar location
 *        Berlin, Germany · … · Nov 12
 *        Wasn't you? Sign it out, then change your password. [Sign out]
 *
 *   [Sign out of all other sessions] → asks first, names the count
 *
 * A signed-out row folds away (Reveal, 150ms) so the list closes up
 * instead of jumping. Times are relative ("2 hours ago") once the page
 * has loaded, a plain date before, so server and browser agree.
 * ───────────────────────────────────────────────────────── */

/** One place the account is signed in. */
export interface Session {
  /** Unique id. */
  id: string;
  /** The kind of device, for its icon. */
  device: "desktop" | "phone" | "tablet";
  /** Browser or app, e.g. "Chrome". */
  browser: string;
  /** Operating system, e.g. "macOS". */
  os: string;
  /** Where it signed in from, e.g. "Bengaluru, India". */
  location: string;
  /** IP address. */
  ip: string;
  /** Last activity, as an ISO date-time. */
  lastActive: string;
  /** True for the session this page is open in. */
  current?: boolean;
  /** Marks a sign-in the person may not recognise (new country, new device). */
  unrecognized?: boolean;
}

const DEVICE_ICON = {
  desktop: LaptopIcon,
  phone: SmartPhone01Icon,
  tablet: Tablet01Icon,
} as const;

const DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const RELATIVE = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

// "Active now", "2 hours ago", "yesterday"; a week or more: "Nov 12".
const whenOf = (iso: string, now: number | null) => {
  const time = new Date(iso).getTime();
  if (now === null) {
    return DATE.format(time);
  }
  const ago = now - time;
  if (ago < 120_000) {
    return "Active now";
  }
  if (ago >= 7 * 86_400_000) {
    return DATE.format(time);
  }
  for (const [unit, size] of UNITS) {
    if (ago >= size) {
      return RELATIVE.format(-Math.floor(ago / size), unit);
    }
  }
  return "Active now";
};

// The clock, read after mount (so the server render is plain dates).
const useNow = () => {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

const PLURAL = new Intl.PluralRules("en-US");
const SESSIONS: Partial<
  Record<Intl.LDMLPluralRule, (count: number) => string>
> = {
  one: () => "1 other session",
  other: (count) => `${count} other sessions`,
};
const sessionsLabel = (count: number) =>
  (SESSIONS[PLURAL.select(count)] ?? SESSIONS.other)?.(count) ?? "";
const SIGN_OUT: Partial<
  Record<Intl.LDMLPluralRule, (count: number) => string>
> = {
  one: () => "Sign out 1 session",
  other: (count) => `Sign out ${count} sessions`,
};
const signOutLabel = (count: number) =>
  (SIGN_OUT[PLURAL.select(count)] ?? SIGN_OUT.other)?.(count) ?? "";

const SessionRow = ({
  now,
  onSignOut,
  session,
}: {
  now: number | null;
  onSignOut: () => Promise<void>;
  session: Session;
}) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      data-highlight={session.unrecognized ? "unfamiliar" : undefined}
      className={cn(CARD, "flex items-start gap-3 px-4 py-3")}
    >
      <HugeiconsIcon
        icon={DEVICE_ICON[session.device]}
        strokeWidth={1.75}
        className="text-muted-foreground mt-2.5 size-5 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
          {session.browser} on {session.os}
          {session.current ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-normal">
              This device
            </span>
          ) : null}
          {session.unrecognized ? (
            <span className="flex items-center gap-1 text-xs font-normal text-amber-700 dark:text-amber-400">
              <HugeiconsIcon
                icon={Alert02Icon}
                strokeWidth={2}
                className="size-3.5"
              />
              Unfamiliar location
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground flex flex-wrap gap-x-1 text-xs">
          {[session.location, session.ip, whenOf(session.lastActive, now)].map(
            (part, index) => (
              <span key={part} className="whitespace-nowrap">
                {index > 0 ? "· " : null}
                {part}
              </span>
            )
          )}
        </p>
        {failed ? (
          <p aria-live="polite" className="text-destructive mt-1 text-xs">
            Not signed out. Check your connection and try again.
          </p>
        ) : null}
        {session.unrecognized ? (
          <p className="text-muted-foreground mt-1 text-xs text-pretty">
            Wasn't you? Sign it out, then change your password.
          </p>
        ) : null}
      </div>
      {session.current ? null : (
        <StatusButton
          type="button"
          variant={session.unrecognized ? "outline" : "ghost"}
          size="sm"
          state={busy ? "busy" : "idle"}
          labels={{ busy: "Signing out…", idle: "Sign out" }}
          aria-label={
            busy
              ? undefined
              : `Sign out ${session.browser} on ${session.os}, ${session.location}`
          }
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            try {
              await onSignOut();
            } catch {
              setBusy(false);
              setFailed(true);
            }
          }}
          className={cn(
            session.unrecognized
              ? cn(RING_BUTTON, "text-destructive hover:text-destructive")
              : "text-muted-foreground hover:text-foreground"
          )}
        />
      )}
    </div>
  );
};

export const SessionsSection = ({
  onSignOut,
  onSignOutOthers,
  sessions,
}: {
  onSignOut: (id: string) => Promise<void>;
  onSignOutOthers: () => Promise<void>;
  sessions: Session[];
}) => {
  const now = useNow();
  const [confirming, setConfirming] = useState(false);
  const others = sessions.filter((session) => !session.current);

  return (
    <div className="flex flex-col gap-3">
      <div
        // Each session is its own card. The 8px gap lives inside each
        // Reveal (pb-2) so it folds away with the row; 1px of room on
        // every side keeps the ring unclipped while a row is moving.
        className="-mx-px -mt-px -mb-2 flex flex-col"
      >
        <AnimatePresence initial={false}>
          {sessions.map((session) => (
            <Reveal key={session.id} className="px-px pt-px pb-2">
              <SessionRow
                session={session}
                now={now}
                onSignOut={() => onSignOut(session.id)}
              />
            </Reveal>
          ))}
        </AnimatePresence>
      </div>
      {others.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(RING_BUTTON, "self-start")}
          onClick={() => setConfirming(true)}
        >
          Sign out of all other sessions
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">
          You're only signed in here.
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Sign out of ${sessionsLabel(others.length)}?`}
        body="Every device except this one will need to sign in again. Anyone using a session you don't recognise loses access straight away."
        confirmLabel={signOutLabel(others.length)}
        busyLabel="Signing out…"
        onConfirm={onSignOutOthers}
      />
    </div>
  );
};
