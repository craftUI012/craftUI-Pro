"use client";

import { Notification03Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { HandleField } from "./handle-field";
import { DoneNote, EASE_OUT, Reveal, wait } from "./motion";
import { DEFAULT_PHONE_COUNTRIES } from "./phone-field";
import type { PhoneCountry } from "./phone-field";
import {
  BioField,
  DEFAULT_ACCENTS,
  DEFAULT_PRIVACY_OPTIONS,
  LookField,
  PrivacySwitches,
} from "./profile-extras";
import type { AccentColor, PrivacyOption, ProfileLook } from "./profile-extras";
import { DEFAULT_RAIL, SettingsRail } from "./settings-rail";
import type { RailGroup, RailNavigateHandler } from "./settings-rail";
import { DEFAULT_SOCIAL_NETWORKS, SocialLinks } from "./social-links";
import type { SocialNetwork } from "./social-links";
import { StatusButton } from "./status-button";
import { PHOTO_INSET, RING, RING_BUTTON } from "./surface";
import { ChangeWithCode } from "./verify-popover";
import type { CodeFlow } from "./verify-popover";

/* ─────────────────────────────────────────────────────────
 * PROFILE SETTINGS 03: a settings page where the email and phone change
 * in place, verified by a one-time code.
 *
 *   top bar     where you are, notifications
 *   rail        the settings pages as text links on thin rails
 *   page        title, underline tabs, then rows: a label and what it's
 *               for on the left, the fields on the right
 *                 photo   saves as soon as it's picked or removed
 *                 name    its own Save / Cancel, only once it changes
 *                 handle  chosen in a popover (current, suggested, own)
 *                 bio     its own Save / Cancel
 *                 email   "Change email address" → code → verified
 *                 phone   "Change phone number"  → code → verified
 *                 social  one row per network, each saved on its own
 *                 look    cover image + accent colour
 *                 privacy switches, each saved as it flips
 *
 * TYPE: 3 sizes, 2 weights, 4 roles (title 18/500, label 14/500, body
 * 14/400, meta 12/400; code digits use the title role).
 * SURFACES: shadow rings, never rules (surface.ts). Rows are grouped by
 * space alone (64px between them); the tabs keep only the current tab's
 * 2px underline (a state, not a divider); the rail column is set apart by
 * a faint tint instead of a border, and the top bar by nothing at all.
 * MOTION: rare and purposeful (each part's file says how):
 *   name actions   open below the fields, 210ms (height ease-in-out)
 *   verified note  fades in under the field, 150ms ease-out
 *   popover        origin-aware, from the "Change …" link
 *   buttons        async buttons are StatusButtons: the label rolls up to
 *                  a spinner (spinner only, fixed width), then back
 *   remove         the photo's Remove fades in and out (150ms)
 *   reduced motion: fades only
 * ───────────────────────────────────────────────────────── */

/** The person's details as they're saved now. */
export interface PersonalInfo {
  /** Photo URL, or `null` to show initials. */
  avatar: string | null;
  /** First name, e.g. "Sam". */
  firstName: string;
  /** Last name, e.g. "Davies". */
  lastName: string;
  /** The verified email they sign in with. */
  email: string;
  /** The verified phone number, with its country code, e.g. "+91 98765 42121". */
  phone: string;
  /** Handle without the @, e.g. "samdavies". */
  handle: string;
  /** A line or two about the person. */
  bio: string;
  /** Usernames (or a web address for "website") by network id, e.g. { x: "samdavies" }. */
  socials: Record<string, string>;
  /** The profile's cover image and accent colour. */
  look: ProfileLook;
  /** What the profile shows, by option id, e.g. { likes: false }. */
  privacy: Record<string, boolean>;
}

/** One tab under the page title. */
export interface PageTab {
  /** Unique id; matched against `activeTab`. */
  id: string;
  /** Text on the tab. */
  label: string;
  /** Where the tab goes. */
  href: string;
}

export interface ProfileSettings03Props {
  /** The details as they're saved now. Defaults to a demo person (Sam Davies). */
  defaultValues?: PersonalInfo;
  /** Saves a changed name. Reject to keep it and show "Name not saved". Defaults to a 0.7s demo save. */
  onSaveName?: (firstName: string, lastName: string) => Promise<void>;
  /**
   * Stores a picked photo and resolves to its URL; `null` removes it. The
   * photo saves straight away. Defaults to a local preview (nothing is
   * uploaded).
   */
  onPhotoChange?: (file: File | null) => Promise<string | null>;
  /**
   * Sends and checks codes for a new email. Defaults to a demo: any code
   * works except 000000.
   */
  emailFlow?: CodeFlow;
  /** The same for a new phone number. Defaults to the same demo. */
  phoneFlow?: CodeFlow;
  /** Saves a new handle. Defaults to a 0.7s demo save. */
  onSaveHandle?: (handle: string) => Promise<void>;
  /**
   * Resolves `true` when a handle is free (called 400ms after typing
   * stops). Defaults to a demo where admin, acme, sam and support are taken.
   */
  checkHandle?: (handle: string) => Promise<boolean>;
  /** Handles offered in the chooser. Defaults to two made from the name. */
  handleSuggestions?: string[];
  /** Saves the bio. Defaults to a 0.7s demo save. */
  onSaveBio?: (bio: string) => Promise<void>;
  /** Longest bio, in characters. Defaults to 160. */
  bioMaxLength?: number;
  /** The networks in Social links, in order. Defaults to X, Instagram, LinkedIn, GitHub, YouTube, TikTok, Bluesky and Website. */
  socialNetworks?: SocialNetwork[];
  /** Saves one social link (empty removes it). Defaults to a 0.6s demo save. */
  onSaveSocial?: (networkId: string, value: string) => Promise<void>;
  /** Accent colours offered. Defaults to nine. */
  accents?: AccentColor[];
  /** Saves the cover and accent colour. Defaults to a 0.7s demo save. */
  onSaveLook?: (look: ProfileLook) => Promise<void>;
  /** Uploads a picked cover image and resolves to its URL. Defaults to a local preview (nothing is uploaded). */
  uploadCover?: (file: File) => Promise<string>;
  /** The switches under Privacy. Defaults to likes, subscriber badge and subscriptions. */
  privacyOptions?: PrivacyOption[];
  /** Saves one privacy switch as soon as it's flipped; reject to flip it back. Defaults to a 0.4s demo save. */
  onPrivacyChange?: (optionId: string, value: boolean) => Promise<void>;
  /** Countries in the phone code list. Defaults to 44 common ones. */
  phoneCountries?: PhoneCountry[];
  /** The page title. Defaults to "General settings". */
  title?: string;
  /** The tabs under the title. Defaults to Personal information, Defaults and Appearance. */
  tabs?: PageTab[];
  /** Id of the current tab. Defaults to "personal". */
  activeTab?: string;
  /**
   * Shows the top bar and the settings rail around the page. Set `false`
   * to render only the page inside your own layout. Defaults to `true`.
   */
  shell?: boolean;
  /** The settings rail's groups. Defaults to General, Schedules, Billing and more. */
  rail?: RailGroup[];
  /** Id of the current rail page. Defaults to "personal". */
  activeRailItem?: string;
  /** Runs before a rail link or tab is followed: route with your router here. */
  onNavigate?: RailNavigateHandler;
  /** Unread notifications; above 0 puts a dot on the bell. Defaults to 2. */
  unread?: number;
  /** Largest photo, in megabytes. Defaults to 2. */
  avatarMaxMb?: number;
  /** Extra classes for the root element. */
  className?: string;
}

/* ─────────────────────────────────────────────────────────
 * DEMO DEFAULTS (module level, so they're stable between renders)
 * ───────────────────────────────────────────────────────── */

const DEMO_INFO: PersonalInfo = {
  avatar: "/images/testimonials/sam-davies.jpg",
  bio: "Product designer at Acme. Writing about calm software, small teams and the craft of saying less.",
  email: "sam@acme.com",
  firstName: "Sam",
  handle: "samdavies",
  lastName: "Davies",
  look: { accent: "#4F46E5", cover: null },
  phone: "+91 98765 42121",
  privacy: { badge: true, likes: false, subscriptions: true },
  socials: { github: "samdavies", linkedin: "sam-davies", x: "samdavies" },
};

const DEMO_TAKEN_HANDLES = new Set(["acme", "admin", "sam", "support"]);
const demoCheckHandle = async (handle: string) => {
  await wait(300);
  return !DEMO_TAKEN_HANDLES.has(handle);
};
const demoSave = async () => {
  await wait(650);
};
const demoQuickSave = async () => {
  await wait(400);
};

const DEMO_FLOW: CodeFlow = {
  onSendCode: async () => {
    await wait(700);
  },
  onVerifyCode: async (_value, code) => {
    await wait(700);
    return code !== "000000";
  },
};

const demoSaveName = async () => {
  await wait(700);
};

const DEFAULT_TABS: PageTab[] = [
  { href: "#personal", id: "personal", label: "Personal information" },
  { href: "#defaults", id: "defaults", label: "Defaults" },
  { href: "#appearance", id: "appearance", label: "Appearance" },
];

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

// Wide screens open the change popover to the field's left, like a note in
// the margin; narrow ones under the link. Read after mount (it's closed on
// the server render).
const useWide = () => {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
};

/* ─────────────────────────────────────────────────────────
 * PIECES
 * ───────────────────────────────────────────────────────── */

const Row = ({
  children,
  description,
  label,
}: {
  children: React.ReactNode;
  description: string;
  label: string;
}) => (
  <div className="grid gap-4 py-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="text-muted-foreground max-w-80 text-sm text-pretty">
        {description}
      </p>
    </div>
    <div className="flex min-w-0 flex-col gap-2">{children}</div>
  </div>
);

const FieldLabel = ({
  children,
  htmlFor,
}: {
  children: string;
  htmlFor: string;
}) => (
  <label htmlFor={htmlFor} className="text-sm font-medium">
    {children}
  </label>
);

const UnderlineTabs = ({
  active,
  onNavigate,
  tabs,
}: {
  active: string;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  tabs: PageTab[];
}) => (
  <nav
    aria-label="Sections"
    // No full-width rule under the tabs: only the current tab's 2px
    // underline, which is a state.
    className="flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {tabs.map((tab) => {
      const current = tab.id === active;
      return (
        <a
          key={tab.id}
          href={tab.href}
          aria-current={current ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "focus-visible:ring-ring/50 shrink-0 border-b-2 pb-3 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px]",
            current
              ? "border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground border-transparent"
          )}
        >
          {tab.label}
        </a>
      );
    })}
  </nav>
);

/* ─────────────────────────────────────────────────────────
 * PHOTO: saves as soon as it's picked or removed.
 * ───────────────────────────────────────────────────────── */

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

const PhotoRow = ({
  maxMb,
  name,
  onChange,
  src,
}: {
  maxMb: number;
  name: string;
  onChange: (file: File | null) => Promise<void>;
  src: string | null;
}) => {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which button is waiting: its label rolls to a spinner meanwhile.
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  const apply = async (file: File | null) => {
    setError(null);
    setStatus(null);
    setBusy(file ? "upload" : "remove");
    try {
      await onChange(file);
      setStatus(file ? "Photo updated" : "Photo removed");
    } catch {
      setError("Photo not saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const take = (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError("Choose a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Choose an image under ${maxMb} MB.`);
      return;
    }
    apply(file);
  };

  return (
    <div className="flex items-center gap-4 pt-8 pb-8">
      <Avatar className="relative size-16">
        <AvatarFallback className="bg-muted text-muted-foreground text-lg font-medium">
          {initialsOf(name)}
        </AvatarFallback>
        <AnimatePresence initial={false}>
          {src ? (
            <motion.img
              key={src}
              src={src}
              alt=""
              className="absolute inset-0 size-full object-cover"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            />
          ) : null}
        </AnimatePresence>
        <span aria-hidden className={PHOTO_INSET} />
      </Avatar>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <StatusButton
            type="button"
            size="sm"
            state={busy === "upload" ? "busy" : "idle"}
            labels={{ busy: "Uploading picture…", idle: "Upload picture" }}
            onClick={() => {
              if (!busy) {
                inputRef.current?.click();
              }
            }}
          />
          {/* Remove fades in once there's a photo, out when it's gone. */}
          <AnimatePresence initial={false}>
            {src ? (
              <motion.span
                key="remove"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                <StatusButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className={RING_BUTTON}
                  state={busy === "remove" ? "busy" : "idle"}
                  labels={{ busy: "Removing picture…", idle: "Remove" }}
                  onClick={() => {
                    if (!busy) {
                      apply(null);
                    }
                  }}
                />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <p
          aria-live="polite"
          className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {error ?? status ?? `Square image, up to ${maxMb} MB.`}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
 * NAME: its own Save / Cancel, only once it changes.
 * ───────────────────────────────────────────────────────── */

const NameFields = ({
  initialFirst,
  initialLast,
  onSave,
}: {
  initialFirst: string;
  initialLast: string;
  onSave: (firstName: string, lastName: string) => Promise<void>;
}) => {
  const id = useId();
  const [saved, setSaved] = useState({
    first: initialFirst,
    last: initialLast,
  });
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const dirty = first !== saved.first || last !== saved.last;
  const invalid = first.trim() === "";

  const save = async () => {
    setState("saving");
    try {
      await onSave(first.trim(), last.trim());
    } catch {
      setState("failed");
      return;
    }
    setSaved({ first: first.trim(), last: last.trim() });
    setFirst(first.trim());
    setLast(last.trim());
    setState("idle");
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !invalid && state !== "saving") {
          save();
        }
      }}
    >
      <FieldLabel htmlFor={`${id}-first`}>First name</FieldLabel>
      <Input
        id={`${id}-first`}
        value={first}
        autoComplete="given-name"
        aria-invalid={invalid}
        onChange={(event) => setFirst(event.target.value)}
        className={RING}
      />
      <div className="mt-2">
        <FieldLabel htmlFor={`${id}-last`}>Last name</FieldLabel>
      </div>
      <Input
        id={`${id}-last`}
        value={last}
        autoComplete="family-name"
        onChange={(event) => setLast(event.target.value)}
        className={RING}
      />
      <AnimatePresence initial={false}>
        {dirty ? (
          <Reveal key="actions" className="flex flex-col gap-2 pt-2">
            {invalid || state === "failed" ? (
              <p aria-live="polite" className="text-destructive text-xs">
                {invalid
                  ? "Add your first name"
                  : "Name not saved. Check your connection and try again."}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={RING_BUTTON}
                disabled={state === "saving"}
                onClick={() => {
                  setFirst(saved.first);
                  setLast(saved.last);
                  setState("idle");
                }}
              >
                Cancel
              </Button>
              <StatusButton
                type="submit"
                size="sm"
                // Busy stays at full colour (aria-disabled), not dimmed.
                disabled={state !== "saving" && invalid}
                state={state === "saving" ? "busy" : "idle"}
                labels={{ busy: "Saving name…", idle: "Save name" }}
              />
            </div>
          </Reveal>
        ) : null}
      </AnimatePresence>
    </form>
  );
};

/* ─────────────────────────────────────────────────────────
 * EMAIL / PHONE: read-only until changed with a code.
 * ───────────────────────────────────────────────────────── */

const VerifiedField = ({
  countries,
  flow,
  initial,
  kind,
  label,
  wide,
}: {
  countries: PhoneCountry[];
  flow: CodeFlow;
  initial: string;
  kind: "email" | "phone";
  label: string;
  wide: boolean;
}) => {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [verifiedStamp, setVerifiedStamp] = useState(0);
  return (
    <>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        readOnly
        // Read-only: muted fill; it changes through the code flow below.
        className={cn(RING, "bg-muted/40 dark:bg-muted/20")}
      />
      <ChangeWithCode
        kind={kind}
        current={value}
        flow={flow}
        countries={countries}
        side={wide ? "left" : "bottom"}
        onChanged={(next) => {
          setValue(next);
          setVerifiedStamp(Date.now());
        }}
      />
      <DoneNote stamp={verifiedStamp}>Verified just now</DoneNote>
    </>
  );
};

/* ─────────────────────────────────────────────────────────
 * TOP BAR
 * ───────────────────────────────────────────────────────── */

const TopBar = ({ unread }: { unread: number }) => (
  <header className="flex h-14 shrink-0 items-center gap-2 px-4 sm:px-6">
    <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
      <HugeiconsIcon
        icon={Settings02Icon}
        strokeWidth={1.75}
        className="text-muted-foreground size-4 shrink-0"
      />
      <span className="truncate">Settings</span>
    </p>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={
        unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
      }
      className="text-muted-foreground hover:text-foreground relative"
    >
      <HugeiconsIcon icon={Notification03Icon} strokeWidth={1.75} />
      {unread > 0 ? (
        <span
          aria-hidden
          className="ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500 ring-2"
        />
      ) : null}
    </Button>
  </header>
);

/* ─────────────────────────────────────────────────────────
 * THE BLOCK
 * ───────────────────────────────────────────────────────── */

// Every prop with its default filled in (one place, so the component
// below reads `settings.x` instead of thirty default parameters).
const DEFAULT_PROPS = {
  accents: DEFAULT_ACCENTS,
  activeRailItem: "personal",
  activeTab: "personal",
  avatarMaxMb: 2,
  bioMaxLength: 160,
  checkHandle: demoCheckHandle,
  defaultValues: DEMO_INFO,
  emailFlow: DEMO_FLOW,
  onPrivacyChange: demoQuickSave,
  onSaveBio: demoSave,
  onSaveHandle: demoSave,
  onSaveLook: demoSave,
  onSaveName: demoSaveName,
  onSaveSocial: demoSave,
  phoneCountries: DEFAULT_PHONE_COUNTRIES,
  phoneFlow: DEMO_FLOW,
  privacyOptions: DEFAULT_PRIVACY_OPTIONS,
  rail: DEFAULT_RAIL,
  shell: true,
  socialNetworks: DEFAULT_SOCIAL_NETWORKS,
  tabs: DEFAULT_TABS,
  title: "General settings",
  unread: 2,
};

type Settings = typeof DEFAULT_PROPS & ProfileSettings03Props;

const resolve = (props: ProfileSettings03Props): Settings => ({
  ...DEFAULT_PROPS,
  ...Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined)
  ),
});

// The page itself: title, tabs and every row.
const PersonalPage = ({
  avatar,
  changePhoto,
  settings,
  wide,
}: {
  avatar: string | null;
  changePhoto: (file: File | null) => Promise<void>;
  settings: Settings;
  wide: boolean;
}) => {
  const {
    accents,
    activeTab,
    avatarMaxMb,
    bioMaxLength,
    checkHandle,
    defaultValues,
    emailFlow,
    handleSuggestions,
    onNavigate,
    onPrivacyChange,
    onSaveBio,
    onSaveHandle,
    onSaveLook,
    onSaveName,
    onSaveSocial,
    phoneCountries,
    phoneFlow,
    privacyOptions,
    socialNetworks,
    tabs,
    title,
    uploadCover,
  } = settings;
  const fullName = `${defaultValues.firstName} ${defaultValues.lastName}`;
  return (
    <div className="max-w-[48rem]">
      <h1 className="text-lg font-medium tracking-tight">{title}</h1>
      <div className="mt-6">
        <UnderlineTabs
          tabs={tabs}
          active={activeTab}
          onNavigate={(event) => {
            const tab = tabs.find(
              (item) => item.href === event.currentTarget.getAttribute("href")
            );
            if (tab && onNavigate) {
              onNavigate(event, tab);
            }
          }}
        />
      </div>
      <PhotoRow
        maxMb={avatarMaxMb}
        name={fullName}
        src={avatar}
        onChange={changePhoto}
      />
      <Row
        label="Name"
        description="How you appear on schedules, comments and invites. Your last name is optional."
      >
        <NameFields
          initialFirst={defaultValues.firstName}
          initialLast={defaultValues.lastName}
          onSave={onSaveName}
        />
      </Row>
      <Row
        label="Handle"
        description="Your profile address and how people mention you, like @samdavies."
      >
        <HandleField
          current={defaultValues.handle}
          check={checkHandle}
          onSave={onSaveHandle}
          side={wide ? "left" : "bottom"}
          suggestions={
            handleSuggestions ?? [
              `${defaultValues.firstName}.${defaultValues.lastName}`.toLowerCase(),
              `${defaultValues.firstName}${defaultValues.lastName}_`.toLowerCase(),
            ]
          }
        />
      </Row>
      <Row
        label="Bio"
        description="Shown under your name on your profile and next to your posts."
      >
        <BioField
          initial={defaultValues.bio}
          max={bioMaxLength}
          onSave={onSaveBio}
        />
      </Row>
      <Row
        label="Email address"
        description="Where sign-in links, receipts and schedule updates go. A new address is confirmed with a code."
      >
        <VerifiedField
          kind="email"
          label="Email"
          initial={defaultValues.email}
          flow={emailFlow}
          countries={phoneCountries}
          wide={wide}
        />
      </Row>
      <Row
        label="Phone number"
        description="For sign-in codes and urgent alerts. A new number is confirmed with a code by text message."
      >
        <VerifiedField
          kind="phone"
          label="Phone number"
          initial={defaultValues.phone}
          flow={phoneFlow}
          countries={phoneCountries}
          wide={wide}
        />
      </Row>
      <Row
        label="Social links"
        description="Where else people can find you. Only the ones you fill in show on your profile."
      >
        <SocialLinks
          networks={socialNetworks}
          values={defaultValues.socials}
          onSave={onSaveSocial}
        />
      </Row>
      <Row
        label="Profile look"
        description="The cover across the top of your profile, and the colour of its links and buttons."
      >
        <LookField
          accents={accents}
          initial={defaultValues.look}
          maxMb={avatarMaxMb}
          onSave={onSaveLook}
          uploadCover={uploadCover}
        />
      </Row>
      <Row
        label="Privacy"
        description="What appears on your profile and in other people's feeds."
      >
        <PrivacySwitches
          options={privacyOptions}
          initial={defaultValues.privacy}
          onChange={onPrivacyChange}
        />
      </Row>
    </div>
  );
};

export const ProfileSettings03 = (props: ProfileSettings03Props) => {
  const settings = resolve(props);
  const {
    activeRailItem,
    className,
    defaultValues,
    onNavigate,
    onPhotoChange,
    rail,
    shell,
    unread,
  } = settings;
  const wide = useWide();
  const [avatar, setAvatar] = useState(defaultValues.avatar);
  const previewUrls = useRef<string[]>([]);

  // Local preview URLs made for the default photo handler, freed on unmount.
  useEffect(
    () => () => {
      for (const url of previewUrls.current) {
        URL.revokeObjectURL(url);
      }
    },
    []
  );

  const changePhoto = async (file: File | null) => {
    if (onPhotoChange) {
      setAvatar(await onPhotoChange(file));
      return;
    }
    await wait(500);
    if (!file) {
      setAvatar(null);
      return;
    }
    const url = URL.createObjectURL(file);
    previewUrls.current.push(url);
    setAvatar(url);
  };

  const page = (
    <PersonalPage
      settings={settings}
      wide={wide}
      avatar={avatar}
      changePhoto={changePhoto}
    />
  );

  if (!shell) {
    return (
      <div data-slot="profile-settings-03" className={className}>
        {page}
      </div>
    );
  }

  return (
    <div
      data-slot="profile-settings-03"
      className={cn(
        RING,
        "bg-background flex min-h-[52rem] flex-col overflow-hidden rounded-2xl",
        className
      )}
    >
      <TopBar unread={unread} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* A faint tint, not a border, sets the rail column apart. */}
        <div className="shrink-0 px-4 pt-4 sm:px-6 lg:rounded-tr-xl lg:bg-muted/30 lg:px-6 lg:py-8">
          <SettingsRail
            groups={rail}
            active={activeRailItem}
            onNavigate={onNavigate}
          />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-12">
          {page}
        </main>
      </div>
    </div>
  );
};

export default ProfileSettings03;
