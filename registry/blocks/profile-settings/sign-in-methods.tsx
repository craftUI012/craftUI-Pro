"use client";

import {
  ArrowDown01Icon,
  FingerPrintIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import type * as React from "react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { Reveal } from "./motion";
import { StatusButton, useButtonState } from "./status-button";
import { CARD, FLOAT, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * SIGN-IN METHODS: every way into the account besides email (which has
 * its own row above, so it isn't repeated here).
 *
 *   passkeys    count, opens to the list; Add passkey / Remove
 *   connected   provider, account, "Last used …", ⋯ → Disconnect <name>;
 *               most recently used first, one connected just now on top
 *   more        "More sign-in options" opens the providers not connected
 *               yet, each with Connect
 *
 * Type: names are 14/500, accounts 14/400 muted, "Last used" 12/400.
 * Logos are each provider's own mark. Buttons are outline: the page's
 * only filled button is Save.
 * Surfaces: every row is its own ringed card, 8px apart (no dividers);
 * "More sign-in options" is a quiet text toggle, not a row.
 * Motion: lists open with Reveal; a provider moving between lists leaves
 * one and enters the other with paired timing; chevrons turn in 150ms.
 * Add passkey, Remove and Connect are StatusButtons: the label rolls to a
 * spinner (fixed width), Add passkey then to "✓ Added". Each card in a
 * folding list keeps 1px of room so its ring isn't clipped mid-fold.
 * ───────────────────────────────────────────────────────── */

/** A sign-in provider, connected or not. */
export interface SignInProvider {
  /**
   * Unique id, e.g. "google". "google", "github", "apple", "microsoft" and
   * "gitlab" get their logo built in.
   */
  id: string;
  /** Name shown in the list, e.g. "Google". */
  name: string;
  /** The account it's connected to, e.g. "sam@gmail.com". Leave out when not connected. */
  account?: string;
  /** Day it last signed the person in, as YYYY-MM-DD. `null` when connected but not used yet. */
  lastUsed?: string | null;
  /** Your own logo (about 20px), for a provider without a built-in one. */
  logo?: React.ReactNode;
}

/** A passkey registered on the account. */
export interface Passkey {
  /** Unique id. */
  id: string;
  /** The device or password manager it lives in, e.g. "MacBook Pro". */
  name: string;
  /** Day it was added, as YYYY-MM-DD. */
  added: string;
  /** Day it last signed the person in, as YYYY-MM-DD, or `null` if never. */
  lastUsed: string | null;
}

/** The sign-in methods the block shows, and what it calls when they change. */
export interface SignInSettings {
  /** Every provider you offer; the connected ones have an `account`. */
  providers: SignInProvider[];
  /** The passkeys registered on the account. */
  passkeys: Passkey[];
  /** Connects a provider (open its sign-in window); resolves to the account it connected. */
  onConnect: (id: string) => Promise<string>;
  /** Disconnects a provider. */
  onDisconnect: (id: string) => Promise<void> | void;
  /** Registers a new passkey (run the browser's WebAuthn prompt); resolves to it. */
  onAddPasskey: () => Promise<Passkey>;
  /** Removes a passkey. */
  onRemovePasskey: (id: string) => Promise<void> | void;
}

/* ─────────────────────────────────────────────────────────
 * LOGOS: drawn inline (no image files). Google, Microsoft and GitLab in
 * their brand colours; GitHub and Apple are one-colour marks, so they
 * follow the text colour in light and dark.
 * ───────────────────────────────────────────────────────── */

interface LogoProps {
  className?: string;
}

const GoogleLogo = ({ className }: LogoProps) => (
  <svg viewBox="0 0 48 48" aria-hidden className={className}>
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

const GitHubLogo = ({ className }: LogoProps) => (
  <svg viewBox="0 0 16 16" aria-hidden className={className}>
    <path
      fill="currentColor"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);

const AppleLogo = ({ className }: LogoProps) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className}>
    <path
      fill="currentColor"
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
    />
  </svg>
);

const MicrosoftLogo = ({ className }: LogoProps) => (
  <svg viewBox="0 0 21 21" aria-hidden className={className}>
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

const GitLabLogo = ({ className }: LogoProps) => (
  <svg viewBox="0 0 25 24" aria-hidden className={className}>
    <path
      fill="#E24329"
      d="m24.507 9.5-.034-.09L21.082.562a.896.896 0 0 0-1.694.091l-2.29 7.01H7.825L5.535.653a.898.898 0 0 0-1.694-.09L.451 9.411.416 9.5a6.297 6.297 0 0 0 2.09 7.278l.012.01.03.022 5.16 3.867 2.56 1.935 1.554 1.176a1.051 1.051 0 0 0 1.268 0l1.555-1.176 2.56-1.935 5.197-3.89.014-.01A6.297 6.297 0 0 0 24.507 9.5Z"
    />
    <path
      fill="#FC6D26"
      d="m24.507 9.5-.034-.09a11.44 11.44 0 0 0-4.56 2.051l-7.447 5.632 4.742 3.584 5.197-3.89.014-.01A6.297 6.297 0 0 0 24.507 9.5Z"
    />
    <path
      fill="#FCA326"
      d="m7.707 20.677 2.56 1.935 1.555 1.176a1.051 1.051 0 0 0 1.268 0l1.555-1.176 2.56-1.935-4.743-3.584-4.755 3.584Z"
    />
    <path
      fill="#FC6D26"
      d="M5.01 11.461a11.43 11.43 0 0 0-4.56-2.05L.416 9.5a6.297 6.297 0 0 0 2.09 7.278l.012.01.03.022 5.16 3.867 4.745-3.584-7.444-5.632Z"
    />
  </svg>
);

const LOGOS: Record<string, (props: LogoProps) => React.ReactNode> = {
  apple: AppleLogo,
  github: GitHubLogo,
  gitlab: GitLabLogo,
  google: GoogleLogo,
  microsoft: MicrosoftLogo,
};

const LOGO_BOX =
  "text-foreground flex size-5 shrink-0 items-center justify-center";

const ProviderLogo = ({ provider }: { provider: SignInProvider }) => {
  const Logo = LOGOS[provider.id];
  if (provider.logo) {
    return <span className={LOGO_BOX}>{provider.logo}</span>;
  }
  return Logo ? (
    <Logo className="text-foreground size-5 shrink-0" />
  ) : (
    <span className={LOGO_BOX} />
  );
};

/* ─────────────────────────────────────────────────────────
 * DATES AND COUNTS (Intl, never hand-built)
 * ───────────────────────────────────────────────────────── */

// "Nov 13" this year, "Oct 24, 2024" before it. UTC, so the server and
// the browser agree.
const SHORT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const LONG = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});
const formatDay = (iso: string, today: string) => {
  if (iso === today) {
    return "today";
  }
  const format = iso.slice(0, 4) === today.slice(0, 4) ? SHORT : LONG;
  return format.format(new Date(`${iso}T00:00:00Z`));
};

// One whole message per plural category, never a ternary "s".
const PLURAL = new Intl.PluralRules("en-US");
const PASSKEY_COUNT: Partial<
  Record<Intl.LDMLPluralRule, (count: number) => string>
> = {
  one: () => "1 passkey",
  other: (count) => `${count} passkeys`,
};
const passkeyCount = (count: number) =>
  (PASSKEY_COUNT[PLURAL.select(count)] ?? PASSKEY_COUNT.other)?.(count) ?? "";

/* ─────────────────────────────────────────────────────────
 * ROW: logo, name over detail, then the right side (meta + action).
 * ───────────────────────────────────────────────────────── */

const MethodRow = ({
  card = true,
  detail,
  logo,
  name,
  right,
}: {
  // Its own ringed card; off when it sits inside one (the passkeys card).
  card?: boolean;
  detail: React.ReactNode;
  logo: React.ReactNode;
  name: string;
  right: React.ReactNode;
}) => (
  <div
    className={cn(card && CARD, "flex min-h-16 items-center gap-3 px-4 py-3")}
  >
    {logo}
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="text-sm font-medium">{name}</p>
      <div className="text-muted-foreground min-w-0 truncate text-sm">
        {detail}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-3">{right}</div>
  </div>
);

// The disclosure chevron: 180° in 150ms, ease-out (it answers a click).
const Chevron = ({ open }: { open: boolean }) => (
  <HugeiconsIcon
    icon={ArrowDown01Icon}
    strokeWidth={1.75}
    className={cn(
      "size-4 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
      open && "rotate-180"
    )}
  />
);

/* ─────────────────────────────────────────────────────────
 * PASSKEYS
 * ───────────────────────────────────────────────────────── */

// One saved passkey. Remove rolls to a spinner; on success the row folds
// away, so there's no "done" state.
const PasskeyItem = ({
  onRemove,
  passkey,
  today,
}: {
  onRemove: () => Promise<void>;
  passkey: Passkey;
  today: string;
}) => {
  const [state, run] = useButtonState();
  return (
    <div className="flex items-center gap-3 py-1.5 pr-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{passkey.name}</p>
        <p className="text-muted-foreground text-xs">
          Added {formatDay(passkey.added, today)}
          {passkey.lastUsed
            ? ` · Last used ${formatDay(passkey.lastUsed, today)}`
            : " · Not used yet"}
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
        onClick={() => run(onRemove, false)}
        className="text-muted-foreground hover:text-foreground"
      />
    </div>
  );
};

const PasskeysRow = ({
  initial,
  onAdd,
  onRemove,
  today,
}: {
  initial: Passkey[];
  onAdd: () => Promise<Passkey>;
  onRemove: (id: string) => Promise<void> | void;
  today: string;
}) => {
  const [passkeys, setPasskeys] = useState(initial);
  const [open, setOpen] = useState(false);
  const [state, run] = useButtonState();
  const listId = useId();

  const add = () =>
    run(async () => {
      const passkey = await onAdd();
      setPasskeys((current) => [...current, passkey]);
      setOpen(true);
    });

  const remove = async (id: string) => {
    await onRemove(id);
    setPasskeys((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className={CARD}>
      <MethodRow
        card={false}
        logo={
          <HugeiconsIcon
            icon={FingerPrintIcon}
            strokeWidth={1.75}
            className="text-foreground size-5 shrink-0"
          />
        }
        name="Passkeys"
        detail={
          passkeys.length === 0 ? (
            "Sign in with your fingerprint or face"
          ) : (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((value) => !value)}
              className="hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-[3px]"
            >
              {passkeyCount(passkeys.length)}
              <Chevron open={open} />
            </button>
          )
        }
        right={
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
        }
      />
      <AnimatePresence initial={false}>
        {open && passkeys.length > 0 ? (
          <Reveal key="passkeys">
            {/* Indented to the names above: 1rem + logo + gap. */}
            <div id={listId} className="flex flex-col pb-2 pl-12">
              <AnimatePresence initial={false}>
                {passkeys.map((passkey) => (
                  <Reveal key={passkey.id}>
                    <PasskeyItem
                      passkey={passkey}
                      today={today}
                      onRemove={() => remove(passkey.id)}
                    />
                  </Reveal>
                ))}
              </AnimatePresence>
            </div>
          </Reveal>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
 * THE LIST
 * ───────────────────────────────────────────────────────── */

// Most recently used first; one connected just now (no use yet) on top.
const byLastUsed = (a: SignInProvider, b: SignInProvider) =>
  (b.lastUsed ?? "9999").localeCompare(a.lastUsed ?? "9999");

export const SignInMethods = ({ settings }: { settings: SignInSettings }) => {
  const [providers, setProviders] = useState(settings.providers);
  const [moreOpen, setMoreOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const moreId = useId();
  const headingId = useId();
  // The day dates are written against ("today", or a year for older ones).
  // Read after mount, never while rendering: server rendering (and Next's
  // cacheComponents prerender) can't depend on the current time. Until
  // then dates show with their year.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const connected = providers
    .filter((provider) => provider.account)
    .toSorted(byLastUsed);
  const available = providers.filter((provider) => !provider.account);

  const connect = async (id: string) => {
    setConnecting(id);
    try {
      const account = await settings.onConnect(id);
      setProviders((current) =>
        current.map((provider) =>
          provider.id === id
            ? { ...provider, account, lastUsed: null }
            : provider
        )
      );
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (id: string) => {
    await settings.onDisconnect(id);
    setProviders((current) =>
      current.map((provider) =>
        provider.id === id
          ? { ...provider, account: undefined, lastUsed: undefined }
          : provider
      )
    );
    // Show where it went: it's now under More sign-in options.
    setMoreOpen(true);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 py-6">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-sm font-medium">
          Sign-in methods
        </h3>
        <p className="text-muted-foreground text-sm">
          Ways to sign in besides your email.
        </p>
      </div>

      {/* A stack of ringed cards, 8px apart. The gap lives inside each
          item (pb-2) so it folds away with a row; 1px of room on every
          side keeps rings unclipped while rows move. */}
      <div className="-mx-px -mt-px -mb-2 flex flex-col">
        <div className="px-px pt-px pb-2">
          <PasskeysRow
            initial={settings.passkeys}
            onAdd={settings.onAddPasskey}
            onRemove={settings.onRemovePasskey}
            today={today}
          />
        </div>

        <AnimatePresence initial={false}>
          {connected.map((provider) => (
            <Reveal key={provider.id} swap className="px-px pt-px pb-2">
              <MethodRow
                logo={<ProviderLogo provider={provider} />}
                name={provider.name}
                detail={provider.account}
                right={
                  <>
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      {provider.lastUsed
                        ? `Last used ${formatDay(provider.lastUsed, today)}`
                        : "Connected just now"}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`More actions for ${provider.name}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <HugeiconsIcon
                            icon={MoreHorizontalIcon}
                            strokeWidth={1.75}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={FLOAT}>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => disconnect(provider.id)}
                        >
                          Disconnect {provider.name}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                }
              />
            </Reveal>
          ))}
        </AnimatePresence>
      </div>

      {available.length > 0 ? (
        <div className="flex flex-col">
          {/* A quiet text toggle, not a row: the cards above are the list. */}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((value) => !value)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 self-start rounded-sm text-sm outline-none focus-visible:ring-[3px]"
          >
            More sign-in options
            <Chevron open={moreOpen} />
          </button>
          <AnimatePresence initial={false}>
            {moreOpen ? (
              <Reveal
                key="more"
                className="pt-2"
                // ~220px of cards: the tall timing (no slow start).
                enter={0.26}
                exit={0.18}
                tall
              >
                <div id={moreId} className="-mx-px -mt-px -mb-2 flex flex-col">
                  <AnimatePresence initial={false}>
                    {available.map((provider) => (
                      <Reveal
                        key={provider.id}
                        swap
                        className="px-px pt-px pb-2"
                      >
                        <MethodRow
                          logo={<ProviderLogo provider={provider} />}
                          name={provider.name}
                          detail="Not connected"
                          right={
                            <StatusButton
                              type="button"
                              variant="outline"
                              size="sm"
                              className={RING_BUTTON}
                              aria-label={
                                connecting === provider.id
                                  ? undefined
                                  : `Connect ${provider.name}`
                              }
                              disabled={
                                connecting !== null &&
                                connecting !== provider.id
                              }
                              state={
                                connecting === provider.id ? "busy" : "idle"
                              }
                              labels={{ busy: "Connecting…", idle: "Connect" }}
                              onClick={() => connect(provider.id)}
                            />
                          }
                        />
                      </Reveal>
                    ))}
                  </AnimatePresence>
                </div>
              </Reveal>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </section>
  );
};
