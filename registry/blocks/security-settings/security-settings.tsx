"use client";

import { useReducedMotion } from "motion/react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { flash, wait } from "./motion";
import type { Passkey } from "./passkeys";
import { DEFAULT_PHONE_COUNTRIES } from "./phone-field";
import type { PhoneCountry } from "./phone-field";
import { DEFAULT_SECURITY_ALERTS, SecurityAlerts } from "./security-alerts";
import type { SecurityAlert } from "./security-alerts";
import { SecurityCheckup } from "./security-checkup";
import type { CheckupItem, CheckupStatus } from "./security-checkup";
import { SessionsSection } from "./sessions";
import type { Session } from "./sessions";
import { DEFAULT_SETTINGS_NAV, SettingsNav } from "./settings-nav";
import type { SettingsNavGroup, SettingsNavigateHandler } from "./settings-nav";
import { SignInMethods } from "./sign-in-methods";
import { SetupDialog } from "./two-factor";
import type { TwoFactorFlow, TwoFactorMethod } from "./two-factor";

/* ─────────────────────────────────────────────────────────
 * SECURITY SETTINGS: the Security page of a settings area.
 *
 *   checkup        right column from xl (top of the page below): a ring
 *                  and each protection with a status badge, done (green),
 *                  recommended (yellow) or at risk (red), and its fix
 *   how you sign   one card (sign-in-methods.tsx): password (changed in
 *   in             place, strength meter), authenticator app and text
 *                  message (set up in a dialog: QR → code → recovery
 *                  codes), recovery codes, passkeys (add, remove)
 *   sessions       where you're signed in; sign out one or all others
 *   alerts         emails about sign-ins and account changes
 *
 * Same family as profile-settings: the settings nav on the left (a pill
 * row on phones), 40rem of content, sections split by space alone (no rules: noise).
 * TYPE: 3 sizes, 2 weights, 4 roles (title 18/500, label 14/500, body
 * 14/400, meta 12/400); codes use the mono font at body size.
 * SURFACES: shadow rings, not borders (surface.ts).
 * MOTION: rare and purposeful; each part's file says how.
 * ───────────────────────────────────────────────────────── */

/** The account's security as it is now. */
export interface SecurityState {
  /** When the password last changed, as an ISO date. */
  passwordChangedAt: string;
  /** Whether the authenticator app is set up. */
  authenticatorApp: boolean;
  /** The phone that gets text-message codes, or `null` when that's off. */
  smsPhone: string | null;
  /** Recovery codes still unused. */
  recoveryCodesLeft: number;
  /** The passkeys registered. */
  passkeys: Passkey[];
  /** Everywhere the account is signed in. */
  sessions: Session[];
  /** Which email alerts are on, by alert id. */
  alerts: Record<string, boolean>;
}

export interface SecuritySettingsProps {
  /** The account's security as it is now. Defaults to a demo account. */
  defaultState?: SecurityState;
  /**
   * Everything two-factor needs: the `otpauth://` link and secret for the
   * QR code, and the calls that check codes, text codes, make recovery
   * codes and turn a method off. Defaults to a demo where any code works
   * except 000000.
   */
  twoFactor?: TwoFactorFlow;
  /**
   * Changes the password. Reject with an Error whose message is shown, e.g.
   * "That isn't your current password." Defaults to a 0.8s demo.
   */
  onChangePassword?: (
    current: string,
    next: string,
    signOutOthers: boolean
  ) => Promise<void>;
  /** Registers a passkey (run the browser's WebAuthn prompt) and resolves to it. Defaults to a demo. */
  onAddPasskey?: () => Promise<Passkey>;
  /** Removes a passkey. Defaults to a demo. */
  onRemovePasskey?: (id: string) => Promise<void>;
  /** Signs one session out. Defaults to a demo. */
  onSignOutSession?: (id: string) => Promise<void>;
  /** Signs out every session except this one. Defaults to a demo. */
  onSignOutOtherSessions?: () => Promise<void>;
  /** The email alerts offered. Defaults to new sign-ins, account changes and two-factor changes. */
  alerts?: SecurityAlert[];
  /** Saves one alert as soon as it's flipped; reject to flip it back. Defaults to a demo. */
  onAlertChange?: (id: string, value: boolean) => Promise<void>;
  /** How many recovery codes a fresh set has. Defaults to 10. */
  recoveryCodesTotal?: number;
  /** The signed-in person; a new password may not contain their name or email. Defaults to the demo person. */
  user?: { name: string; email: string };
  /** Your product's name, used in the copy and the recovery-codes file. Defaults to "Acme". */
  productName?: string;
  /** Countries for the text-message phone number. Defaults to 44 common ones. */
  phoneCountries?: PhoneCountry[];
  /** The settings nav, in groups. Defaults to Account and Workspace. */
  nav?: SettingsNavGroup[];
  /** Id of the current nav item. Defaults to "security". */
  activeItem?: string;
  /** Runs before a nav link is followed: route with your router here. */
  onNavigate?: SettingsNavigateHandler;
  /** Extra classes for the root element. */
  className?: string;
}

/* ─────────────────────────────────────────────────────────
 * DEMO DEFAULTS (module level, so they're stable between renders)
 * ───────────────────────────────────────────────────────── */

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const DEMO_STATE: SecurityState = {
  alerts: { "account-changes": true, "new-sign-in": true, "two-factor": false },
  authenticatorApp: false,
  passkeys: [{ added: "Sep 2", id: "pk-1", name: "MacBook Pro" }],
  passwordChangedAt: ago(214 * DAY),
  recoveryCodesLeft: 0,
  sessions: [
    {
      browser: "Chrome",
      current: true,
      device: "desktop",
      id: "s-1",
      ip: "103.21.58.12",
      lastActive: ago(0),
      location: "Bengaluru, India",
      os: "macOS",
    },
    {
      browser: "Safari",
      device: "phone",
      id: "s-2",
      ip: "49.207.8.21",
      lastActive: ago(2 * HOUR),
      location: "Bengaluru, India",
      os: "iOS",
    },
    {
      browser: "Firefox",
      device: "desktop",
      id: "s-3",
      ip: "91.64.120.7",
      lastActive: ago(6 * DAY),
      location: "Berlin, Germany",
      os: "Windows",
      unrecognized: true,
    },
    {
      browser: "Chrome",
      device: "tablet",
      id: "s-4",
      ip: "106.51.77.140",
      lastActive: ago(21 * DAY),
      location: "Mumbai, India",
      os: "Android",
    },
  ],
  smsPhone: null,
};

const BASE32 = "abcdefghijkmnpqrstuvwxyz23456789";
const randomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (byte) => BASE32[byte % 32]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
};

const demoCheck = async (code: string) => {
  await wait(700);
  return code !== "000000";
};

const DEMO_TWO_FACTOR: TwoFactorFlow = {
  generateCodes: async () => {
    await wait(400);
    return Array.from({ length: 10 }, randomCode);
  },
  otpauthUrl:
    "otpauth://totp/Acme:sam%40acme.com?secret=JBSWY3DPEHPK3PXP&issuer=Acme",
  secret: "JBSWY3DPEHPK3PXP",
  sendSms: async () => {
    await wait(700);
  },
  turnOff: async () => {
    await wait(500);
  },
  verifyApp: demoCheck,
  verifySms: (_phone, code) => demoCheck(code),
};

const later = (ms: number) => async () => {
  await wait(ms);
};

const DEFAULT_PROPS = {
  activeItem: "security",
  alerts: DEFAULT_SECURITY_ALERTS,
  defaultState: DEMO_STATE,
  nav: DEFAULT_SETTINGS_NAV,
  onAddPasskey: async (): Promise<Passkey> => {
    await wait(900);
    return { added: "today", id: `pk-${Date.now()}`, name: "This device" };
  },
  onAlertChange: later(400),
  onChangePassword: later(800),
  onRemovePasskey: later(300),
  onSignOutOtherSessions: later(700),
  onSignOutSession: later(500),
  phoneCountries: DEFAULT_PHONE_COUNTRIES,
  productName: "Acme",
  recoveryCodesTotal: 10,
  twoFactor: DEMO_TWO_FACTOR,
  user: { email: "sam@acme.com", name: "Sam Davies" },
};

type Settings = typeof DEFAULT_PROPS & SecuritySettingsProps;

const resolve = (props: SecuritySettingsProps): Settings => ({
  ...DEFAULT_PROPS,
  ...Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined)
  ),
});

/* ─────────────────────────────────────────────────────────
 * PIECES
 * ───────────────────────────────────────────────────────── */

const MONTHS = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

// "Last changed 3 months ago"; under a month, in days.
const changedLabel = (days: number) => {
  if (days < 1) {
    return "Changed today";
  }
  if (days < 30) {
    return `Last changed ${MONTHS.format(-days, "day")}`;
  }
  return `Last changed ${MONTHS.format(-Math.floor(days / 30), "month")}`;
};

// A password older than this is flagged "Recommended" in the checkup.
const PASSWORD_MAX_DAYS = 180;

// A section of the page: its heading (focusable, so the checkup can move
// focus to it), one line on what it's for, then its content.
const Section = ({
  children,
  description,
  id,
  sectionRef,
  title,
}: {
  children: React.ReactNode;
  description: string;
  id: string;
  sectionRef?: React.Ref<HTMLElement>;
  title: string;
}) => (
  <section
    ref={sectionRef}
    aria-labelledby={`${id}-title`}
    className="flex scroll-mt-6 flex-col gap-4 py-8"
  >
    <div className="flex flex-col gap-1">
      <h3
        id={`${id}-title`}
        tabIndex={-1}
        className="focus-visible:ring-ring/50 w-fit rounded-sm text-sm font-medium outline-none focus-visible:ring-[3px]"
      >
        {title}
      </h3>
      <p className="text-muted-foreground text-sm text-pretty">{description}</p>
    </div>
    {children}
  </section>
);

// The checkup's five items, each with its status: done (green),
// recommended (yellow) or at risk (red), and the fix that clears it.
const buildCheckup = ({
  addPasskey,
  codesLeft,
  codesTotal,
  goTo,
  openSetup,
  passkeys,
  passwordDays,
  passwordLabel,
  twoFactorOn,
  unfamiliar,
}: {
  addPasskey: () => void;
  codesLeft: number;
  codesTotal: number;
  goTo: (key: string, highlight?: string) => void;
  openSetup: () => void;
  passkeys: number;
  passwordDays: number;
  passwordLabel: string;
  twoFactorOn: boolean;
  unfamiliar: string | null;
}): CheckupItem[] => {
  const oldPassword = passwordDays > PASSWORD_MAX_DAYS;
  let codes: CheckupStatus = "recommended";
  if (twoFactorOn) {
    codes = codesLeft > 0 ? "done" : "risk";
  }
  return [
    {
      action: { label: "Turn on", onClick: openSetup },
      hint: twoFactorOn ? "On" : "Off: a stolen password is enough to get in",
      id: "two-factor",
      label: "Two-factor authentication",
      status: twoFactorOn ? "done" : "risk",
    },
    {
      action: {
        label: "Review",
        onClick: () => goTo("sessions", "unfamiliar"),
      },
      hint: unfamiliar
        ? `A sign-in from ${unfamiliar}`
        : "No sign-ins from unfamiliar places",
      id: "sessions",
      label: "Unfamiliar sign-ins",
      status: unfamiliar ? "risk" : "done",
    },
    {
      action: {
        label: twoFactorOn ? "Make new codes" : "Set up",
        onClick: twoFactorOn ? () => goTo("sign-in", "codes") : openSetup,
      },
      hint: twoFactorOn
        ? `${codesLeft} of ${codesTotal} left`
        : "You get them when you turn on two-factor",
      id: "codes",
      label: "Recovery codes",
      status: codes,
    },
    {
      action: {
        label: "Change password",
        onClick: () => goTo("sign-in", "password"),
      },
      hint: oldPassword
        ? `${passwordLabel}. Time for a new one.`
        : passwordLabel,
      id: "password",
      label: "Password",
      status: oldPassword ? "recommended" : "done",
    },
    {
      action: { label: "Add passkey", onClick: addPasskey },
      hint:
        passkeys > 0
          ? `${passkeys} added`
          : "Sign in with your fingerprint or face",
      id: "passkey",
      label: "Passkey",
      status: passkeys > 0 ? "done" : "recommended",
    },
  ];
};

/* ─────────────────────────────────────────────────────────
 * THE BLOCK
 * ───────────────────────────────────────────────────────── */

// The page's live state and the checkup worked out from it.
const useSecurity = (settings: Settings) => {
  const { defaultState } = settings;
  const [appOn, setAppOn] = useState(defaultState.authenticatorApp);
  const [smsPhone, setSmsPhone] = useState(defaultState.smsPhone);
  const [codesLeft, setCodesLeft] = useState(defaultState.recoveryCodesLeft);
  const [passkeys, setPasskeys] = useState(defaultState.passkeys);
  const [sessions, setSessions] = useState(defaultState.sessions);
  const [setup, setSetup] = useState<TwoFactorMethod | null>(null);
  // Kept after closing, so the dialog's closing fade shows the same method.
  const [setupMethod, setSetupMethod] = useState<TwoFactorMethod>("app");
  const openSetup = (method: TwoFactorMethod) => {
    setSetupMethod(method);
    setSetup(method);
  };
  const [changedAt, setChangedAt] = useState(defaultState.passwordChangedAt);
  // Relative time needs the clock: read it after mount, so the server
  // render and the first browser render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const passwordDays =
    now === null ? 0 : Math.floor((now - new Date(changedAt).getTime()) / DAY);
  const passwordLabel =
    now === null ? "Last changed" : changedLabel(passwordDays);
  const markPasswordChanged = () => {
    setChangedAt(new Date().toISOString());
    setNow(Date.now());
  };

  return {
    appOn,
    codesLeft,
    markPasswordChanged,
    openSetup,
    passkeys,
    passwordDays,
    passwordLabel,
    sessions,
    setAppOn,
    setCodesLeft,
    setPasskeys,
    setSessions,
    setSetup,
    setSmsPhone,
    setup,
    setupMethod,
    smsPhone,
  };
};

export const SecuritySettings = (props: SecuritySettingsProps) => {
  const settings = resolve(props);
  const {
    activeItem,
    alerts,
    className,
    defaultState,
    nav,
    onAddPasskey,
    onAlertChange,
    onChangePassword,
    onNavigate,
    onRemovePasskey,
    onSignOutOtherSessions,
    onSignOutSession,
    phoneCountries,
    productName,
    recoveryCodesTotal,
    twoFactor,
    user,
  } = settings;
  const reduce = useReducedMotion();
  const state = useSecurity(settings);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const twoFactorOn = state.appOn || Boolean(state.smsPhone);
  const unfamiliar = state.sessions.find((session) => session.unrecognized);

  // Take the person to a section (from the checkup), and move focus there.
  // Take the person to a section and, if named, flash the card the fix
  // is about (`data-highlight`), so the eye lands on the right one.
  const goTo = (key: string, highlight?: string) => {
    const section = sectionRefs.current[key];
    section?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
    section?.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
    const card = highlight
      ? section?.querySelector<HTMLElement>(`[data-highlight="${highlight}"]`)
      : null;
    if (card) {
      flash(card);
    }
  };

  const addPasskey = async () => {
    const passkey = await onAddPasskey();
    state.setPasskeys((current) => [...current, passkey]);
  };

  const checkup = buildCheckup({
    addPasskey,
    codesLeft: state.codesLeft,
    codesTotal: recoveryCodesTotal,
    goTo,
    openSetup: () => state.openSetup("app"),
    passkeys: state.passkeys.length,
    passwordDays: state.passwordDays,
    passwordLabel: state.passwordLabel,
    twoFactorOn,
    unfamiliar: unfamiliar?.location ?? null,
  });

  const ref = (key: string) => (el: HTMLElement | null) => {
    sectionRefs.current[key] = el;
  };

  return (
    <div
      data-slot="security-settings"
      className={cn(
        "flex flex-col gap-6 md:flex-row md:gap-10 lg:gap-14",
        className
      )}
    >
      <SettingsNav active={activeItem} groups={nav} onNavigate={onNavigate} />

      <div className="min-w-0 flex-1">
        <header className="flex max-w-[40rem] flex-col gap-1">
          <h2 className="text-lg font-medium tracking-tight">Security</h2>
          <p className="text-muted-foreground text-sm">
            How you sign in to {productName}, and where you're signed in.
          </p>
        </header>

        {/* Below xl the checkup leads the page; from xl it sits in a
            sticky column on the right while the sections scroll. */}
        <div className="mt-6 grid items-start gap-x-10 xl:grid-cols-[minmax(0,40rem)_18rem]">
          <aside className="xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1">
            <SecurityCheckup items={checkup} />
          </aside>
          <div className="min-w-0 xl:col-start-1 xl:row-start-1 xl:-mt-8">
            <Section
              id="sign-in"
              sectionRef={ref("sign-in")}
              title="How you sign in"
              description="Your password, a second step so a stolen password isn't enough, and passkeys to skip both."
            >
              <SignInMethods
                passwordLabel={state.passwordLabel}
                personal={[
                  ...user.name.split(/\s+/),
                  user.email.split("@")[0] ?? "",
                ]}
                onChangePassword={onChangePassword}
                onPasswordChanged={(signOutOthers) => {
                  state.markPasswordChanged();
                  if (signOutOthers) {
                    state.setSessions((current) =>
                      current.filter((item) => item.current)
                    );
                  }
                }}
                appOn={state.appOn}
                smsPhone={state.smsPhone}
                codesLeft={state.codesLeft}
                codesTotal={recoveryCodesTotal}
                flow={twoFactor}
                product={productName}
                onOpenSetup={state.openSetup}
                onTurnedOff={(method) =>
                  method === "app"
                    ? state.setAppOn(false)
                    : state.setSmsPhone(null)
                }
                onNewCodes={(codes) => state.setCodesLeft(codes.length)}
                passkeys={state.passkeys}
                onAddPasskey={addPasskey}
                onRemovePasskey={async (id) => {
                  await onRemovePasskey(id);
                  state.setPasskeys((current) =>
                    current.filter((item) => item.id !== id)
                  );
                }}
              />
            </Section>
            <Section
              id="sessions"
              sectionRef={ref("sessions")}
              title="Where you're signed in"
              description="Sign out anywhere you don't recognise. If one looks wrong, change your password too."
            >
              <SessionsSection
                sessions={state.sessions}
                onSignOut={async (id) => {
                  await onSignOutSession(id);
                  state.setSessions((current) =>
                    current.filter((item) => item.id !== id)
                  );
                }}
                onSignOutOthers={async () => {
                  await onSignOutOtherSessions();
                  state.setSessions((current) =>
                    current.filter((item) => item.current)
                  );
                }}
              />
            </Section>
            <Section
              id="alerts"
              title="Security alerts"
              description={`Emails to ${user.email} when something changes.`}
            >
              <SecurityAlerts
                alerts={alerts}
                initial={defaultState.alerts}
                onChange={onAlertChange}
              />
            </Section>
          </div>
        </div>
      </div>

      <SetupDialog
        open={state.setup !== null}
        method={state.setupMethod}
        fallbackFocus={() =>
          sectionRefs.current["sign-in"]?.querySelector("h3") ?? null
        }
        flow={twoFactor}
        countries={phoneCountries}
        product={productName}
        needsCodes={!twoFactorOn}
        onOpenChange={(open) => (open ? null : state.setSetup(null))}
        onEnabled={(method, detail) => {
          if (method === "app") {
            state.setAppOn(true);
          } else {
            state.setSmsPhone(detail.phone ?? null);
          }
          if (detail.codes) {
            state.setCodesLeft(detail.codes.length);
          }
        }}
      />
    </div>
  );
};

export default SecuritySettings;
