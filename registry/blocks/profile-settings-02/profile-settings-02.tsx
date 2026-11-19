"use client";

import {
  Delete02Icon,
  Upload04Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import type * as React from "react";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { AppShell, DEMO_APP_SHELL } from "./app-shell";
import type { AppShellSettings } from "./app-shell";
import { EASE_IN_OUT, EASE_OUT, wait } from "./motion";
import { DEFAULT_PHONE_COUNTRIES, PhoneField } from "./phone-field";
import type { PhoneCountry } from "./phone-field";
import { DEFAULT_SETTINGS_TABS, SettingsTabs } from "./settings-tabs";
import type { SettingsTab, SettingsTabNavigateHandler } from "./settings-tabs";
import { StatusButton, useButtonState } from "./status-button";
import type { ButtonState } from "./status-button";
import { LIFT, PHOTO_INSET, RING, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * PROFILE SETTINGS 02: a settings page with tabs on top and the profile
 * in one centred card: photo, identity fields, an overview, connected
 * info, and Cancel / Update profile at the foot of the card.
 *
 * TYPE: 3 sizes, 2 weights, 4 roles.
 *   title   18px / 500, tight   "Settings", "Personal details"
 *   label   14px / 500          field labels, buttons
 *   body    14px / 400          descriptions, inputs, tabs
 *   meta    12px / 400          section labels (uppercase), hints, counter
 *
 * SURFACES: shadow rings, not borders (surface.ts). No rules anywhere:
 * the card's sections are split by space (32px), panels by a muted tint.
 *
 * MOTION (rare, purposeful):
 *   photo         new one crossfades in, 0.96 → 1, 200ms ease-out
 *   drop target   photo grows 4% + rings while an image is over it, 150ms
 *   upload        with your own uploadAvatar: Upload photo rolls to a
 *                 spinner while it uploads (status-button.tsx)
 *   remove        Remove fades in once there's a photo, out when gone
 *                 (150ms ease-out, 0.96 → 1)
 *   update        StatusButton: label rolls up (200ms ease-out) to a
 *                 spinner only, then "✓ Saved", back after 1.1s; one
 *                 fixed width for every state (⌘S hint sized in)
 *   leave dirty   footer shakes once (360ms ease-in-out) + says why
 *   reduced motion: fades only
 * ───────────────────────────────────────────────────────── */

/** The fields the card saves together. */
export interface ProfileCardValues {
  /** Photo URL, or `null` to show initials. */
  avatar: string | null;
  /** Full name, e.g. "Sam Davies". */
  name: string;
  /** The email shown on the profile, e.g. "sam@acme.com". */
  email: string;
  /** Job title, e.g. "Head of Automation". */
  jobTitle: string;
  /** Company or team name. */
  company: string;
  /** A few lines about the person, shown on their profile. */
  overview: string;
  /** The email of the connected Google account. Empty for none. */
  connectedEmail: string;
  /** Two-letter country code of the phone number, e.g. "IN" for +91. */
  phoneCountry: string;
  /** Phone number without the country code, e.g. "98765 43210". */
  phone: string;
}

export interface ProfileSettings02Props {
  /** The profile as it's saved now. Defaults to a demo profile (Sam Davies). */
  defaultValues?: ProfileCardValues;
  /**
   * Saves the changed profile. Resolve once it's stored; reject to keep the
   * changes and show "Changes not saved". Defaults to a 0.9s demo save.
   */
  onSave?: (values: ProfileCardValues) => Promise<void>;
  /**
   * Uploads a picked photo and resolves to its URL, saved with the rest.
   * Defaults to a local preview URL (nothing is uploaded).
   */
  uploadAvatar?: (file: File) => Promise<string>;
  /** Page title above the tabs. Defaults to "Settings". */
  title?: string;
  /** Line under the title. Defaults to "Manage your profile, security and notifications." */
  description?: string;
  /** The settings pages shown as tabs. Defaults to General, Personal details, Password & security, Notifications and Billing. */
  tabs?: SettingsTab[];
  /** Id of the current tab. Defaults to "profile". */
  activeTab?: string;
  /**
   * Runs before a tab link is followed: route with your router here. With
   * unsaved changes the block stays and asks to save or cancel first.
   */
  onNavigate?: SettingsTabNavigateHandler;
  /** Largest photo, in megabytes. Defaults to 2. */
  avatarMaxMb?: number;
  /** Longest overview, in characters. Defaults to 280. */
  overviewMaxLength?: number;
  /** Countries in the phone code list, in order. Defaults to 44 common ones. */
  phoneCountries?: PhoneCountry[];
  /**
   * Wraps the page in an app (sidebar + top bar), the full picture. Set
   * `false` to render only the settings page inside your own layout.
   * Defaults to `true`.
   */
  shell?: boolean;
  /** The app's sidebar and top bar. Defaults to a demo workspace (Acme). */
  app?: AppShellSettings;
  /** Extra classes for the root element. */
  className?: string;
}

/* ─────────────────────────────────────────────────────────
 * DEMO DEFAULTS (module level, so they're stable between renders)
 * ───────────────────────────────────────────────────────── */

const DEMO_VALUES: ProfileCardValues = {
  avatar: "/images/testimonials/sam-davies.jpg",
  company: "Acme",
  connectedEmail: "sam.davies@gmail.com",
  email: "sam@acme.com",
  jobTitle: "Head of Automation",
  name: "Sam Davies",
  overview:
    "Building AI-powered workflows that help teams move faster. Previously at a fintech startup. Based in Bengaluru.",
  phone: "98765 43210",
  phoneCountry: "IN",
};

const demoSave = async () => {
  await wait(900);
};

/* ─────────────────────────────────────────────────────────
 * SMALL PIECES
 * ───────────────────────────────────────────────────────── */

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
// A national number: digits with optional spaces, dashes or brackets,
// 4 to 14 digits once those are taken out.
const isPhone = (value: string) => {
  const digits = value.replaceAll(/[\s()-]/g, "");
  return /^\d{4,14}$/.test(digits);
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

// Section label: meta size, uppercase, a little tracking.
const Eyebrow = ({ children, id }: { children: string; id?: string }) => (
  <h3 id={id} className="text-muted-foreground text-xs tracking-wide uppercase">
    {children}
  </h3>
);

const Field = ({
  children,
  error,
  htmlFor,
  label,
  className,
}: {
  children: React.ReactNode;
  error?: string | null;
  htmlFor: string;
  label: string;
  className?: string;
}) => (
  <div className={cn("flex min-w-0 flex-col gap-2", className)}>
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {label}
    </label>
    {children}
    {error ? (
      <p id={`${htmlFor}-error`} className="text-destructive text-xs">
        {error}
      </p>
    ) : null}
  </div>
);

// The Gmail mark, in its own colours.
const GmailMark = () => (
  <svg viewBox="0 3 24 18.5" aria-hidden className="size-4 shrink-0">
    <path
      fill="#4285F4"
      d="M1.636 21.002h3.819v-9.273L0 7.638v11.727c0 .904.732 1.637 1.636 1.637z"
    />
    <path
      fill="#34A853"
      d="M18.545 21.002h3.819A1.636 1.636 0 0 0 24 19.365V7.638l-5.455 4.091z"
    />
    <path
      fill="#FBBC04"
      d="M18.545 4.638v7.091L24 7.638V5.457c0-2.023-2.309-3.178-3.927-1.964z"
    />
    <path
      fill="#EA4335"
      d="M5.455 11.729V4.638L12 9.548l6.545-4.91v7.091L12 16.638z"
    />
    <path
      fill="#C5221F"
      d="M0 5.457v2.181l5.455 4.091V4.638L3.927 3.493C2.309 2.279 0 3.434 0 5.457z"
    />
  </svg>
);

// An input with something fixed at its start (a logo, a flag). The box
// draws the ring and focus; the input inside is bare.
const AdornedInput = ({
  adornment,
  invalid,
  ...props
}: React.ComponentProps<typeof Input> & {
  adornment: React.ReactNode;
  invalid?: boolean;
}) => (
  <div
    className={cn(
      RING,
      "dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center gap-2 rounded-md bg-transparent pl-3 transition-[color,box-shadow] focus-within:ring-[3px]",
      invalid && "border-destructive"
    )}
  >
    {adornment}
    <Input
      {...props}
      aria-invalid={invalid}
      // Override: the box around it draws the ring and focus.
      className="h-full min-w-0 flex-1 border-0 bg-transparent pl-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
    />
  </div>
);

/* ─────────────────────────────────────────────────────────
 * PHOTO PANEL
 * ───────────────────────────────────────────────────────── */

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

const PhotoPanel = ({
  maxMb,
  name,
  onPick,
  onRemove,
  src,
  uploads,
}: {
  maxMb: number;
  name: string;
  onPick: (file: File) => Promise<void>;
  onRemove: () => void;
  src: string | null;
  /** True with your own uploadAvatar: show a spinner while it runs. */
  uploads: boolean;
}) => {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // No "done" state: success shows in place, as the new photo.
  const [uploadState, run] = useButtonState();

  const take = async (file: File | undefined) => {
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
    setError(null);
    if (!uploads) {
      await onPick(file);
      return;
    }
    if (!(await run(() => onPick(file), false))) {
      setError("Photo not uploaded. Try again.");
    }
  };

  return (
    <div className="bg-muted/50 flex items-center gap-4 rounded-xl p-3">
      <button
        type="button"
        aria-label="Change photo"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          take(event.dataTransfer.files[0]);
        }}
        className={cn(
          "focus-visible:ring-ring/50 relative shrink-0 rounded-full outline-none focus-visible:ring-[3px]",
          // A white rim lifts the photo off the muted panel.
          "ring-background shadow-[0_1px_3px_oklch(0_0_0/0.12)] ring-[3px]",
          "transition-[scale,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [&>*]:pointer-events-none",
          dragging && "ring-primary scale-[1.04] motion-reduce:scale-100"
        )}
      >
        <Avatar className="size-14">
          <AvatarFallback className="bg-background text-muted-foreground text-lg font-medium">
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
          {/* Inset ring + soft inner shadow: the photo's edge reads crisply. */}
          <span aria-hidden className={PHOTO_INSET} />
        </Avatar>
      </button>
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <p className="text-sm font-medium">Profile photo</p>
          <p
            aria-live="polite"
            className={cn(
              "text-xs",
              error ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {error ?? `Square image, at least 200×200px, up to ${maxMb} MB.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusButton
            type="button"
            variant="outline"
            size="sm"
            className={RING_BUTTON}
            icon={Upload04Icon}
            state={uploadState}
            labels={{ busy: "Uploading photo…", idle: "Upload photo" }}
            onClick={() => inputRef.current?.click()}
          />
          <AnimatePresence initial={false} mode="popLayout">
            {src ? (
              <motion.span
                key="remove"
                initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  // Override: the destructive colour on the ring button.
                  className={cn(
                    RING_BUTTON,
                    "text-destructive hover:text-destructive"
                  )}
                  onClick={onRemove}
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />
                  Remove
                </Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
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
 * FORM STATE
 * ───────────────────────────────────────────────────────── */

type SaveState = "idle" | "saving" | "saved";

const SAVE_LABELS = { busy: "Saving…", done: "Saved", idle: "Update profile" };
const BUTTON_STATE: Record<SaveState, ButtonState> = {
  idle: "idle",
  saved: "done",
  saving: "busy",
};
type FieldKey = keyof ProfileCardValues;

const KEYS: FieldKey[] = [
  "avatar",
  "name",
  "email",
  "jobTitle",
  "company",
  "overview",
  "connectedEmail",
  "phone",
  "phoneCountry",
];

// What's wrong with each field, if anything (shown under the field).
const fieldErrors = (values: ProfileCardValues) => ({
  connectedEmail:
    values.connectedEmail !== "" && !isEmail(values.connectedEmail)
      ? "Enter an email like name@example.com"
      : null,
  email: isEmail(values.email) ? null : "Enter an email like name@example.com",
  name: values.name.trim() === "" ? "Add your name" : null,
  phone:
    values.phone !== "" && !isPhone(values.phone)
      ? "Enter the number without the country code, like 98765 43210"
      : null,
});

// One whole message per plural category (never a ternary "s").
const PLURAL = new Intl.PluralRules("en-US");
const UNSAVED: Partial<Record<Intl.LDMLPluralRule, (count: number) => string>> =
  {
    one: () => "1 unsaved change",
    other: (count) => `${count} unsaved changes`,
  };
const unsavedMessage = (count: number) =>
  (UNSAVED[PLURAL.select(count)] ?? UNSAVED.other)?.(count) ?? "";

/* ─────────────────────────────────────────────────────────
 * FORM STATE: saved vs draft, validation, save / cancel, the footer's
 * message, and the guard against leaving with unsaved changes.
 * ───────────────────────────────────────────────────────── */

const footerMessage = ({
  changedCount,
  failed,
  hasErrors,
  state,
  warned,
}: {
  changedCount: number;
  failed: boolean;
  hasErrors: boolean;
  state: SaveState;
  warned: boolean;
}) => {
  if (state === "saved") {
    return "Changes saved";
  }
  if (changedCount === 0) {
    return "";
  }
  if (warned) {
    return "Save or cancel your changes first";
  }
  if (failed) {
    return "Changes not saved. Check your connection and try again.";
  }
  if (hasErrors) {
    return "Fix the highlighted fields to save";
  }
  return unsavedMessage(changedCount);
};

const useProfileCard = ({
  defaultValues,
  onSave,
  uploadAvatar,
}: {
  defaultValues: ProfileCardValues;
  onSave: (values: ProfileCardValues) => Promise<void>;
  uploadAvatar?: (file: File) => Promise<string>;
}) => {
  const reduce = useReducedMotion();
  const [footerRef, animate] = useAnimate<HTMLDivElement>();
  const [saved, setSaved] = useState(defaultValues);
  const [draft, setDraft] = useState(defaultValues);
  const [state, setState] = useState<SaveState>("idle");
  const [failed, setFailed] = useState(false);
  const [warned, setWarned] = useState(false);
  const previewUrls = useRef<string[]>([]);

  const changedCount = KEYS.filter((key) => draft[key] !== saved[key]).length;
  const dirty = changedCount > 0;
  const errors = fieldErrors(draft);
  const hasErrors = Object.values(errors).some(Boolean);
  const canSave = dirty && !hasErrors && state === "idle";

  const set = <K extends FieldKey>(key: K, value: ProfileCardValues[K]) => {
    setFailed(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!canSave) {
      return;
    }
    const snapshot = draft;
    setState("saving");
    setFailed(false);
    try {
      await onSave(snapshot);
    } catch {
      setFailed(true);
      setState("idle");
      return;
    }
    setSaved(snapshot);
    setState("saved");
    await wait(1100);
    setState("idle");
  };

  // Local preview URLs made for the default upload, freed on unmount.
  useEffect(
    () => () => {
      for (const url of previewUrls.current) {
        URL.revokeObjectURL(url);
      }
    },
    []
  );

  // ⌘S / Ctrl+S saves while there are changes.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  // The warning clears once the changes are saved or cancelled.
  useEffect(() => {
    if (!dirty) {
      setWarned(false);
    }
  }, [dirty]);

  return {
    canSave,
    cancel: () => {
      setFailed(false);
      setWarned(false);
      setDraft(saved);
    },
    dirty,
    draft,
    errors,
    footerRef,
    message: footerMessage({ changedCount, failed, hasErrors, state, warned }),
    // Leaving with unsaved changes: the footer shakes once and says why.
    nudge: () => {
      setWarned(true);
      if (!reduce && footerRef.current) {
        animate(
          footerRef.current,
          { x: [0, -8, 7, -5, 3, 0] },
          { duration: 0.36, ease: EASE_IN_OUT }
        );
      }
    },
    pickPhoto: async (file: File) => {
      if (uploadAvatar) {
        set("avatar", await uploadAvatar(file));
        return;
      }
      const url = URL.createObjectURL(file);
      previewUrls.current.push(url);
      set("avatar", url);
    },
    save,
    set,
    state,
    warned,
  };
};

type ProfileCardForm = ReturnType<typeof useProfileCard>;

/* ─────────────────────────────────────────────────────────
 * OVERVIEW: the counter sits in the corner and shows only while you
 * write, or within 20 characters of the limit (150ms fade).
 * ───────────────────────────────────────────────────────── */

const OverviewInput = ({
  id,
  max,
  onChange,
  value,
}: {
  id: string;
  max: number;
  onChange: (value: string) => void;
  value: string;
}) => {
  const [focused, setFocused] = useState(false);
  const showCount = focused || value.length >= max - 20;
  return (
    <div className="relative">
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        rows={3}
        aria-describedby={`${id}-count`}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Overrides: the ring, and room for the counter.
        className={cn(RING, "resize-none pb-7")}
      />
      <p
        id={`${id}-count`}
        className={cn(
          "text-muted-foreground pointer-events-none absolute right-3 bottom-2 text-xs tabular-nums transition-opacity duration-150 ease-out motion-reduce:transition-none",
          showCount ? "opacity-100" : "opacity-0"
        )}
      >
        {value.length}/{max}
      </p>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
 * FOOTER: the message on the left, Cancel / Update profile on the right.
 * The shake (leaving with unsaved changes) moves only this strip.
 * ───────────────────────────────────────────────────────── */

const CardFooter = ({ form }: { form: ProfileCardForm }) => {
  const { canSave, dirty, state } = form;
  // "⌘" on Apple devices, "Ctrl" elsewhere (read after mount).
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) {
      setMod("⌘");
    }
  }, []);

  return (
    <div
      ref={form.footerRef}
      className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-xl p-2 sm:flex-nowrap"
    >
      <p
        aria-live="polite"
        className={cn(
          "min-w-0 flex-1 px-2 text-xs",
          form.warned && dirty ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {form.message}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={RING_BUTTON}
        disabled={!dirty || state !== "idle"}
        onClick={form.cancel}
      >
        Cancel
      </Button>
      {/* Spinner only while saving, "✓ Saved" when done; the ⌘S hint is
          sized in with the idle words, so the width never changes. */}
      <StatusButton
        type="submit"
        size="sm"
        disabled={!canSave && state === "idle"}
        state={BUTTON_STATE[state]}
        labels={SAVE_LABELS}
        suffix={
          // Override: readable on the filled button; hidden on touch.
          <Kbd className="bg-primary-foreground/15 text-primary-foreground/80 hidden shadow-none sm:inline-flex">
            {mod}S
          </Kbd>
        }
      />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
 * THE BLOCK
 * ───────────────────────────────────────────────────────── */

export const ProfileSettings02 = ({
  activeTab = "profile",
  app = DEMO_APP_SHELL,
  avatarMaxMb = 2,
  className,
  defaultValues = DEMO_VALUES,
  description = "Manage your profile, security and notifications.",
  onNavigate,
  onSave = demoSave,
  overviewMaxLength = 280,
  phoneCountries = DEFAULT_PHONE_COUNTRIES,
  tabs = DEFAULT_SETTINGS_TABS,
  shell = true,
  title = "Settings",
  uploadAvatar,
}: ProfileSettings02Props) => {
  const id = useId();
  const form = useProfileCard({ defaultValues, onSave, uploadAvatar });
  const { draft, errors, set } = form;

  const fieldId = (key: string) => `${id}-${key}`;
  const describedBy = (key: keyof typeof errors) =>
    errors[key] ? `${fieldId(key)}-error` : undefined;

  // Leaving with unsaved changes (a tab or a sidebar link): stay, say why.
  const guard = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (form.dirty) {
      event.preventDefault();
      form.nudge();
      return true;
    }
    return false;
  };

  const page = (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>

      {/* The tabs ride in their own white strip, above the card. */}
      <div className={cn(LIFT, "bg-card rounded-2xl p-1.5")}>
        <SettingsTabs
          tabs={tabs}
          active={activeTab}
          onNavigate={(event, tab) => {
            if (!guard(event)) {
              onNavigate?.(event, tab);
            }
          }}
        />
      </div>

      <form
        aria-labelledby={`${id}-title`}
        onSubmit={(event) => {
          event.preventDefault();
          form.save();
        }}
        className={cn(
          LIFT,
          "bg-card text-card-foreground mx-auto flex w-full max-w-[36rem] flex-col gap-8 rounded-2xl p-4 sm:p-6"
        )}
      >
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={UserCircleIcon}
              strokeWidth={1.75}
              className="text-muted-foreground size-5"
            />
            <h2
              id={`${id}-title`}
              className="text-lg font-medium tracking-tight"
            >
              Personal details
            </h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Your personal information, as your team sees it.
          </p>
        </header>

        <section
          aria-labelledby={`${id}-identity`}
          className="flex flex-col gap-4"
        >
          <Eyebrow id={`${id}-identity`}>Avatar & identity</Eyebrow>
          <PhotoPanel
            maxMb={avatarMaxMb}
            name={draft.name}
            src={draft.avatar}
            onPick={form.pickPhoto}
            uploads={Boolean(uploadAvatar)}
            onRemove={() => set("avatar", null)}
          />
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            <Field
              label="Full name"
              htmlFor={fieldId("name")}
              error={errors.name}
            >
              <Input
                id={fieldId("name")}
                value={draft.name}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={describedBy("name")}
                onChange={(event) => set("name", event.target.value)}
                className={RING}
              />
            </Field>
            <Field
              label="Email address"
              htmlFor={fieldId("email")}
              error={errors.email}
            >
              <Input
                id={fieldId("email")}
                type="email"
                value={draft.email}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={describedBy("email")}
                onChange={(event) => set("email", event.target.value)}
                className={RING}
              />
            </Field>
            <Field label="Job title" htmlFor={fieldId("jobTitle")}>
              <Input
                id={fieldId("jobTitle")}
                value={draft.jobTitle}
                autoComplete="organization-title"
                onChange={(event) => set("jobTitle", event.target.value)}
                className={RING}
              />
            </Field>
            <Field label="Company" htmlFor={fieldId("company")}>
              <Input
                id={fieldId("company")}
                value={draft.company}
                autoComplete="organization"
                onChange={(event) => set("company", event.target.value)}
                className={RING}
              />
            </Field>
            <Field
              label="Profile overview"
              htmlFor={fieldId("overview")}
              className="sm:col-span-2"
            >
              <OverviewInput
                id={fieldId("overview")}
                max={overviewMaxLength}
                value={form.draft.overview}
                onChange={(value) => form.set("overview", value)}
              />
            </Field>
          </div>
        </section>

        <section
          aria-labelledby={`${id}-connected`}
          className="flex flex-col gap-4"
        >
          <Eyebrow id={`${id}-connected`}>Connected info</Eyebrow>
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
            <Field
              label="Connected email"
              htmlFor={fieldId("connectedEmail")}
              error={errors.connectedEmail}
            >
              <AdornedInput
                id={fieldId("connectedEmail")}
                type="email"
                value={draft.connectedEmail}
                placeholder="name@gmail.com"
                adornment={<GmailMark />}
                invalid={Boolean(errors.connectedEmail)}
                aria-describedby={describedBy("connectedEmail")}
                onChange={(event) => set("connectedEmail", event.target.value)}
              />
            </Field>
            <Field
              label="Phone number"
              htmlFor={fieldId("phone")}
              error={errors.phone}
            >
              <PhoneField
                id={fieldId("phone")}
                countries={phoneCountries}
                country={draft.phoneCountry}
                number={draft.phone}
                invalid={Boolean(errors.phone)}
                describedBy={describedBy("phone")}
                onCountryChange={(code) => set("phoneCountry", code)}
                onNumberChange={(value) => set("phone", value)}
              />
            </Field>
          </div>
        </section>

        <CardFooter form={form} />
      </form>
    </div>
  );

  if (!shell) {
    return (
      <div data-slot="profile-settings-02" className={className}>
        {page}
      </div>
    );
  }

  return (
    <div
      data-slot="profile-settings-02"
      className={cn("overflow-hidden rounded-2xl", LIFT, className)}
    >
      <AppShell
        title={title}
        app={{
          ...app,
          onNavigate: (event) => {
            if (!guard(event)) {
              app.onNavigate?.(event);
            }
          },
        }}
      >
        <div className="p-4 sm:p-6 lg:p-8">{page}</div>
      </AppShell>
    </div>
  );
};

export default ProfileSettings02;
