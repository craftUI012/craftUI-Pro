"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { EmailField } from "./email-field";
import type { EmailSettings } from "./email-field";
import { EASE_OUT, MOTION, wait } from "./motion";
import {
  AvatarField,
  BioField,
  UsernameField,
  useUsernameStatus,
} from "./profile-fields";
import type { UsernameStatus } from "./profile-fields";
import { SaveBar } from "./save-bar";
import type { SaveState } from "./save-bar";
import { DEFAULT_SETTINGS_NAV, SettingsNav } from "./settings-nav";
import type { SettingsNavGroup, SettingsNavigateHandler } from "./settings-nav";
import { SignInMethods } from "./sign-in-methods";
import type { SignInSettings } from "./sign-in-methods";
import { RING } from "./surface";

/* ─────────────────────────────────────────────────────────
 * PROFILE SETTINGS
 *
 * A settings page: the nav on the left (a pill row on phones), then two
 * groups of rows with a label on the left and the control on the right.
 *
 *   Profile               photo, full name, username, bio. These go
 *                         through the save bar, which shows only while
 *                         something changed.
 *   Sign-in & security    email, sign-in methods. These apply on their
 *                         own: emails change once a link is confirmed.
 *
 * TYPE: 3 sizes, 2 weights, 4 roles. Nothing else.
 *   title   18px / 500, tight   group titles, avatar initials
 *   label   14px / 500          row labels, values, buttons
 *   body    14px / 400          descriptions, nav, inputs, save bar
 *   meta    12px / 400          group labels, hints, counter, dates
 *   Colour carries state, never size or weight. Inputs are 16px on
 *   phones (shadcn's default, so iOS doesn't zoom).
 *
 * LAYOUT: a 14rem label column, 2rem gap and 24rem controls, so the panel
 * (40rem) ends on the controls' right edge. Rows are grouped by space
 * alone (48px apart), no dividers. Each label
 * sits on the first line of its control. Below lg each row stacks.
 * ───────────────────────────────────────────────────────── */

/** The profile fields the save bar saves together. */
export interface ProfileValues {
  /** Photo URL, or `null` to show initials. */
  avatar: string | null;
  /** Full name, e.g. "Sam Davies". */
  name: string;
  /** Username without the prefix, e.g. "samdavies": 3–20 lowercase letters, numbers or _. */
  username: string;
  /** A line or two about the person. */
  bio: string;
}

export interface ProfileSettingsProps {
  /** The profile as it's saved now. Defaults to a demo profile (Sam Davies). */
  defaultValues?: ProfileValues;
  /**
   * Saves the changed profile. Resolve once it's stored; reject to keep the
   * changes and show "Changes not saved". Defaults to a 0.9s demo save.
   */
  onSave?: (values: ProfileValues) => Promise<void>;
  /**
   * Resolves `true` when a username is free. Called 450ms after typing
   * stops. Defaults to a demo where admin, acme, root, sam and support are
   * taken.
   */
  checkUsername?: (username: string) => Promise<boolean>;
  /**
   * Uploads a picked photo and resolves to its URL, which goes into the
   * profile on Save. Defaults to a local preview URL (nothing is uploaded).
   */
  uploadAvatar?: (file: File) => Promise<string>;
  /** The primary and secondary email, and what to call when they change. Defaults to a demo. */
  emails?: EmailSettings;
  /** Passkeys and sign-in providers, and what to call when they change. Defaults to a demo. */
  signIn?: SignInSettings;
  /** Your product's name, used in the descriptions ("across Acme"). Defaults to "Acme". */
  productName?: string;
  /** Shown before the username: your profile URL. Defaults to "acme.com/". */
  usernamePrefix?: string;
  /** Longest bio, in characters. Defaults to 160. */
  bioMaxLength?: number;
  /** Largest photo, in megabytes. Defaults to 2. */
  avatarMaxMb?: number;
  /** The settings nav, in groups. Defaults to Account and Workspace. */
  nav?: SettingsNavGroup[];
  /** Id of the current nav item. Defaults to "profile". */
  activeItem?: string;
  /**
   * Runs before a nav link is followed: route with your router here. While
   * there are unsaved changes the block stays and nudges the save bar.
   */
  onNavigate?: SettingsNavigateHandler;
  /** Extra classes for the root element. */
  className?: string;
}

/* ─────────────────────────────────────────────────────────
 * DEMO DEFAULTS (module level, so they're stable between renders)
 * ───────────────────────────────────────────────────────── */

const DEMO_PROFILE: ProfileValues = {
  avatar: "/images/testimonials/sam-davies.jpg",
  bio: "Product designer at Acme. Building calm software for busy teams.",
  name: "Sam Davies",
  username: "samdavies",
};

const DEMO_TAKEN = new Set(["acme", "admin", "root", "sam", "support"]);

const demoSave = async () => {
  await wait(900);
};

const demoCheckUsername = async (username: string) => {
  await wait(300);
  return !DEMO_TAKEN.has(username);
};

const DEMO_EMAILS: EmailSettings = {
  onRemoveSecondary: async () => {
    await wait(300);
  },
  onResendLink: async () => {
    await wait(450);
  },
  onSendLink: async () => {
    await wait(900);
  },
  primary: { address: "sam@acme.com", verified: true },
  secondary: { address: "sam.davies@gmail.com", verified: false },
};

const DEMO_ACCOUNTS: Record<string, string> = {
  apple: "sam.davies@icloud.com",
  gitlab: "samdavies",
  microsoft: "sam.davies@outlook.com",
};

const DEMO_SIGN_IN: SignInSettings = {
  onAddPasskey: async () => {
    await wait(900);
    return {
      added: new Date().toISOString().slice(0, 10),
      id: `passkey-${Date.now()}`,
      lastUsed: null,
      name: "This device",
    };
  },
  onConnect: async (id) => {
    await wait(900);
    return DEMO_ACCOUNTS[id] ?? "samdavies";
  },
  onDisconnect: async () => {
    await wait(300);
  },
  onRemovePasskey: async () => {
    await wait(300);
  },
  passkeys: [
    {
      added: "2026-09-02",
      id: "passkey-1",
      lastUsed: "2026-11-17",
      name: "MacBook Pro",
    },
  ],
  providers: [
    {
      account: "sam.davies@gmail.com",
      id: "google",
      lastUsed: "2026-11-13",
      name: "Google",
    },
    {
      account: "samdavies",
      id: "github",
      lastUsed: "2024-10-24",
      name: "GitHub",
    },
    { id: "apple", name: "Apple" },
    { id: "microsoft", name: "Microsoft" },
    { id: "gitlab", name: "GitLab" },
  ],
};

/* ─────────────────────────────────────────────────────────
 * FORM STATE
 * ───────────────────────────────────────────────────────── */

const KEYS: (keyof ProfileValues)[] = ["avatar", "name", "username", "bio"];

const USERNAME_PROBLEM: Partial<Record<UsernameStatus, string>> = {
  checking: "Checking username…",
  error: "Unable to check your username. Try again.",
  invalid: "Use 3–20 lowercase letters, numbers or _",
  taken: "Choose a different username",
};

const useProfileForm = ({
  checkUsername,
  initial,
  onSave,
}: {
  checkUsername: (username: string) => Promise<boolean>;
  initial: ProfileValues;
  onSave: (values: ProfileValues) => Promise<void>;
}) => {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveFailed, setSaveFailed] = useState(false);
  // Bumped each time someone tries to leave with unsaved changes.
  const [nudges, setNudges] = useState(0);
  const usernameStatus = useUsernameStatus(
    draft.username,
    saved.username,
    checkUsername,
    450
  );

  const changed = (key: keyof ProfileValues) => draft[key] !== saved[key];
  const changedCount = KEYS.filter(changed).length;

  let problem: string | null = null;
  if (draft.name.trim() === "") {
    problem = "Add your name";
  } else if (changed("username")) {
    problem = USERNAME_PROBLEM[usernameStatus] ?? null;
  }
  if (!problem && saveFailed) {
    problem = "Changes not saved. Check your connection and try again.";
  }

  const set = <K extends keyof ProfileValues>(
    key: K,
    value: ProfileValues[K]
  ) => {
    setSaveFailed(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const snapshot = draft;
    setSaveState("saving");
    setSaveFailed(false);
    try {
      await onSave(snapshot);
    } catch {
      setSaveFailed(true);
      setSaveState("idle");
      return;
    }
    setSaved(snapshot);
    setSaveState("saved");
    await wait(MOTION.savedHold);
    setSaveState("idle");
  };

  return {
    changed,
    changedCount,
    discard: () => {
      setSaveFailed(false);
      setDraft(saved);
    },
    draft,
    nudge: () => setNudges((count) => count + 1),
    nudges,
    problem,
    save,
    saveState,
    saved,
    set,
    usernameStatus,
  };
};

/* ─────────────────────────────────────────────────────────
 * ROW: label (+ description) on the left, control on the right.
 * ───────────────────────────────────────────────────────── */

// How far each label moves down to sit on its control's first line.
const OFFSET = {
  // The email's 12px "Primary · Verified" line: the control moves down
  // 2px instead (see controlOffset).
  email: "",
  // 36px control, 20px line: (36 - 20) / 2.
  field: "lg:pt-2",
  // The Upload photo row, centred beside the 64px photo.
  photo: "lg:pt-2.5",
  // Textarea: 1px border + 8px padding.
  textarea: "lg:pt-[0.5625rem]",
} as const;

// A changed row's label gets a small dot (150ms ease-out; it appears once
// per edit, not per keystroke).
const ChangedDot = ({ show }: { show: boolean }) => {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.span
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.status, ease: EASE_OUT }}
          className="bg-primary size-1.5 shrink-0 rounded-full"
        >
          <span className="sr-only">(changed)</span>
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
};

const Row = ({
  changed = false,
  children,
  description,
  htmlFor,
  label,
  offset,
}: {
  changed?: boolean;
  children: React.ReactNode;
  description: string;
  htmlFor?: string;
  label: string;
  offset: keyof typeof OFFSET;
}) => {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className="grid gap-3 py-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,24rem)] lg:gap-8">
      <div className={cn("flex flex-col gap-1", OFFSET[offset])}>
        <Label
          htmlFor={htmlFor}
          className="flex items-center gap-2 text-sm font-medium"
        >
          {label}
          <ChangedDot show={changed} />
        </Label>
        <p className="text-muted-foreground text-sm text-pretty">
          {description}
        </p>
      </div>
      <div className={cn("min-w-0", offset === "email" && "lg:pt-0.5")}>
        {children}
      </div>
    </div>
  );
};

const GroupHeader = ({
  description,
  title,
}: {
  description: string;
  title: string;
}) => (
  <header className="flex flex-col gap-1">
    <h2 className="text-lg font-medium tracking-tight">{title}</h2>
    <p className="text-muted-foreground text-sm">{description}</p>
  </header>
);

/* ─────────────────────────────────────────────────────────
 * THE BLOCK
 * ───────────────────────────────────────────────────────── */

export const ProfileSettings = ({
  activeItem = "profile",
  avatarMaxMb = 2,
  bioMaxLength = 160,
  checkUsername = demoCheckUsername,
  className,
  defaultValues = DEMO_PROFILE,
  emails = DEMO_EMAILS,
  nav = DEFAULT_SETTINGS_NAV,
  onNavigate,
  onSave = demoSave,
  productName = "Acme",
  signIn = DEMO_SIGN_IN,
  uploadAvatar,
  usernamePrefix = "acme.com/",
}: ProfileSettingsProps) => {
  const id = useId();
  const form = useProfileForm({
    checkUsername,
    initial: defaultValues,
    onSave,
  });

  // Local preview URLs made for the default upload, freed on unmount.
  const previewUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of previewUrls.current) {
        URL.revokeObjectURL(url);
      }
    },
    []
  );

  const pickPhoto = async (file: File) => {
    if (uploadAvatar) {
      form.set("avatar", await uploadAvatar(file));
      return;
    }
    const url = URL.createObjectURL(file);
    previewUrls.current.push(url);
    form.set("avatar", url);
  };

  return (
    <div
      data-slot="profile-settings"
      className={cn(
        "flex flex-col gap-6 md:flex-row md:gap-10 lg:gap-14",
        className
      )}
    >
      <SettingsNav
        active={activeItem}
        groups={nav}
        onNavigate={(event, item) => {
          // Leaving with unsaved changes: stay, and nudge the save bar.
          if (form.changedCount > 0) {
            event.preventDefault();
            form.nudge();
            return;
          }
          onNavigate?.(event, item);
        }}
      />

      <div className="min-w-0 flex-1">
        <div className="max-w-[40rem]">
          <GroupHeader
            title="Profile"
            description={`How you appear to your team across ${productName}.`}
          />
          <Row
            label="Photo"
            description={`Shown next to your name across ${productName}.`}
            offset="photo"
            changed={form.changed("avatar")}
          >
            <AvatarField
              maxMb={avatarMaxMb}
              name={form.draft.name}
              src={form.draft.avatar}
              onPick={pickPhoto}
              onRemove={() => form.set("avatar", null)}
            />
          </Row>
          <Row
            label="Full name"
            description="Used in comments, mentions and invites."
            htmlFor={`${id}-name`}
            offset="field"
            changed={form.changed("name")}
          >
            <Input
              id={`${id}-name`}
              value={form.draft.name}
              onChange={(event) => form.set("name", event.target.value)}
              autoComplete="name"
              aria-invalid={form.draft.name.trim() === ""}
              // Override: a shadow ring instead of the border.
              className={RING}
            />
          </Row>
          <Row
            label="Username"
            description="Your profile link and @mention handle."
            htmlFor={`${id}-username`}
            offset="field"
            changed={form.changed("username")}
          >
            <UsernameField
              id={`${id}-username`}
              prefix={usernamePrefix}
              saved={form.saved.username}
              status={form.usernameStatus}
              value={form.draft.username}
              onChange={(value) => form.set("username", value)}
            />
          </Row>
          <Row
            label="Bio"
            description="A line or two about you, shown on your profile."
            htmlFor={`${id}-bio`}
            offset="textarea"
            changed={form.changed("bio")}
          >
            <BioField
              id={`${id}-bio`}
              max={bioMaxLength}
              value={form.draft.bio}
              onChange={(value) => form.set("bio", value)}
            />
          </Row>

          {/* Second group: how you get in. Nothing here goes through Save. */}
          <div className="mt-10">
            <GroupHeader
              title="Sign-in & security"
              description="How you get into your account. Changes here apply right away."
            />
          </div>
          <Row
            label="Email"
            description="Primary is for sign-in. Secondary is for recovery."
            offset="email"
          >
            <EmailField emails={emails} />
          </Row>
          <SignInMethods settings={signIn} />

          <SaveBar
            changedCount={form.changedCount}
            nudges={form.nudges}
            problem={form.problem}
            state={form.saveState}
            onDiscard={form.discard}
            onSave={form.save}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
