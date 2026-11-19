"use client";

import {
  Bookmark01Icon,
  CheckmarkBadge01Icon,
  FavouriteIcon,
  ImageUpload01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { DoneNote, EASE_OUT, Reveal } from "./motion";
import { RollingLabel, StatusButton } from "./status-button";
import { CARD, LIFT, RING, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * PROFILE EXTRAS: bio, the profile's look, and what it shows.
 *
 *   bio        a few lines, counter while writing; its own Save / Cancel
 *   look       cover image (or a wash of the accent colour) + an accent
 *              colour; the preview follows at once, Save / Cancel below
 *   privacy    switches for what appears on the profile; each saves as
 *              soon as it's flipped, a failure flips it back
 *
 * MOTION
 *   save       a StatusButton: the label rolls up to a spinner while
 *              saving (spinner only, fixed width), then the actions fold
 *   cover      "Upload cover" ↔ "Replace cover" rolls in one fixed-width
 *              button; "Use colour" fades in and out (150ms)
 *   switches   press-stretch: the thumb widens 16 → 20px while held,
 *              toward where it's going; 200ms ease-out travel. Rows are
 *              ringed cards 8px apart (no dividers); no status icons, a
 *              screen-reader line says "… Saved."
 * ───────────────────────────────────────────────────────── */

// Switch microinteractions, written out in full so Tailwind sees them.
// Track inner width 30px (w-8 minus the 1px border each side).
// Checked: 30 - 16 = 14px; pressed (20px thumb): 30 - 20 = 10px.
const SWITCH_MOTION = [
  "[&_[data-slot=switch-thumb]]:transition-[translate,width,background-color]",
  "[&_[data-slot=switch-thumb]]:duration-200",
  "[&_[data-slot=switch-thumb]]:ease-[cubic-bezier(0.23,1,0.32,1)]",
  "[&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[14px]",
  "active:[&_[data-slot=switch-thumb]]:w-5",
  "active:[&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[10px]",
  "motion-reduce:[&_[data-slot=switch-thumb]]:transition-none",
  "motion-reduce:active:[&_[data-slot=switch-thumb]]:w-4",
  "motion-reduce:active:[&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[14px]",
].join(" ");

const SaveActions = ({
  busy,
  disabled,
  failed,
  failedText,
  onCancel,
  submitLabel = "Save",
}: {
  busy: boolean;
  disabled?: boolean;
  failed: boolean;
  failedText: string;
  onCancel: () => void;
  submitLabel?: string;
}) => (
  <Reveal className="flex flex-col gap-2 pt-1">
    {failed ? (
      <p aria-live="polite" className="text-destructive text-xs">
        {failedText}
      </p>
    ) : null}
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={RING_BUTTON}
        disabled={busy}
        onClick={onCancel}
      >
        Cancel
      </Button>
      <StatusButton
        type="submit"
        size="sm"
        // Busy stays at full colour (aria-disabled), not dimmed.
        disabled={!busy && disabled}
        state={busy ? "busy" : "idle"}
        labels={{ busy: "Saving…", idle: submitLabel }}
      />
    </div>
  </Reveal>
);

// Shared save flow for a small form: busy, failed, saved stamp.
const useSave = <T,>(save: (value: T) => Promise<void>) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [doneStamp, setDoneStamp] = useState(0);
  const run = async (value: T) => {
    setBusy(true);
    setFailed(false);
    try {
      await save(value);
    } catch {
      setBusy(false);
      setFailed(true);
      return false;
    }
    setBusy(false);
    setDoneStamp(Date.now());
    return true;
  };
  return { busy, doneStamp, failed, run, setFailed };
};

/* ─────────────────────────────────────────────────────────
 * BIO
 * ───────────────────────────────────────────────────────── */

export const BioField = ({
  initial,
  max,
  onSave,
}: {
  initial: string;
  max: number;
  onSave: (bio: string) => Promise<void>;
}) => {
  const id = useId();
  const [stored, setStored] = useState(initial);
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const { busy, doneStamp, failed, run, setFailed } = useSave(onSave);
  const dirty = value !== stored;
  const showCount = focused || value.length >= max - 20;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (dirty && !busy && (await run(value.trim()))) {
          setStored(value.trim());
          setValue(value.trim());
        }
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        Bio
      </label>
      <div className="relative">
        <Textarea
          id={id}
          value={value}
          maxLength={max}
          rows={4}
          placeholder="A line or two about you"
          aria-describedby={`${id}-count`}
          onChange={(event) => setValue(event.target.value)}
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
      <AnimatePresence initial={false}>
        {dirty ? (
          <SaveActions
            key="actions"
            busy={busy}
            failed={failed}
            failedText="Bio not saved. Check your connection and try again."
            submitLabel="Save bio"
            onCancel={() => {
              setValue(stored);
              setFailed(false);
            }}
          />
        ) : null}
      </AnimatePresence>
      <DoneNote stamp={doneStamp} hideAfter={2000}>
        Saved
      </DoneNote>
    </form>
  );
};

/* ─────────────────────────────────────────────────────────
 * LOOK: cover image + accent colour
 * ───────────────────────────────────────────────────────── */

/** An accent colour offered for the profile. */
export interface AccentColor {
  /** Name read out and shown on hover, e.g. "Teal". */
  name: string;
  /** The colour, any CSS colour, e.g. "#0D9488". */
  value: string;
}

/** The profile's look. */
export interface ProfileLook {
  /** Cover image URL, or `null` for a wash of the accent colour. */
  cover: string | null;
  /** The accent colour's value, e.g. "#4F46E5". */
  accent: string;
}

export const DEFAULT_ACCENTS: AccentColor[] = [
  { name: "Indigo", value: "#4F46E5" },
  { name: "Blue", value: "#2563EB" },
  { name: "Teal", value: "#0D9488" },
  { name: "Green", value: "#16A34A" },
  { name: "Amber", value: "#D97706" },
  { name: "Orange", value: "#EA580C" },
  { name: "Rose", value: "#E11D48" },
  { name: "Violet", value: "#7C3AED" },
  { name: "Graphite", value: "#3F3F46" },
];

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export const LookField = ({
  accents,
  initial,
  maxMb,
  onSave,
  uploadCover,
}: {
  accents: AccentColor[];
  initial: ProfileLook;
  maxMb: number;
  onSave: (look: ProfileLook) => Promise<void>;
  uploadCover?: (file: File) => Promise<string>;
}) => {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<string[]>([]);
  const [stored, setStored] = useState(initial);
  const [look, setLook] = useState(initial);
  const [pickError, setPickError] = useState<string | null>(null);
  const { busy, doneStamp, failed, run, setFailed } = useSave(onSave);
  const dirty = look.cover !== stored.cover || look.accent !== stored.accent;
  const accentName =
    accents.find((item) => item.value === look.accent)?.name ?? "Custom";

  // Local preview URLs made for the default upload, freed on unmount.
  useEffect(
    () => () => {
      for (const url of previewUrls.current) {
        URL.revokeObjectURL(url);
      }
    },
    []
  );

  const pick = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setPickError("Choose a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setPickError(`Choose an image under ${maxMb} MB.`);
      return;
    }
    setPickError(null);
    let url: string;
    if (uploadCover) {
      url = await uploadCover(file);
    } else {
      url = URL.createObjectURL(file);
      previewUrls.current.push(url);
    }
    setLook((current) => ({ ...current, cover: url }));
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (dirty && !busy && (await run(look))) {
          setStored(look);
        }
      }}
    >
      <p className="text-sm font-medium">Cover</p>
      {/* The preview: the cover image, or a wash of the accent colour. */}
      <div
        // bg-origin-border: the wash starts under the ring's transparent
        // border too, so it doesn't repeat its first colour along the
        // right and bottom edges.
        className={cn(
          LIFT,
          "relative aspect-[3/1] overflow-hidden rounded-xl bg-origin-border"
        )}
        style={{
          // backgroundImage, not the background shorthand: the shorthand
          // would reset background-origin and undo bg-origin-border.
          backgroundImage: `linear-gradient(135deg, ${look.accent}, color-mix(in oklch, ${look.accent} 35%, white))`,
        }}
      >
        <AnimatePresence initial={false}>
          {look.cover ? (
            <motion.img
              key={look.cover}
              src={look.cover}
              alt=""
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* One button whose words roll, at one width for both. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={RING_BUTTON}
          onClick={() => inputRef.current?.click()}
        >
          <RollingLabel
            icon={ImageUpload01Icon}
            state="idle"
            labels={{ idle: look.cover ? "Replace cover" : "Upload cover" }}
            reserve={["Replace cover", "Upload cover"]}
          />
        </Button>
        <AnimatePresence initial={false}>
          {look.cover ? (
            <motion.span
              key="use-colour"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground border border-transparent"
                onClick={() =>
                  setLook((current) => ({ ...current, cover: null }))
                }
              >
                Use colour
              </Button>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <p
        aria-live="polite"
        className={cn(
          "text-xs",
          pickError ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {pickError ?? `Wide image, 1500×500px works best, up to ${maxMb} MB.`}
      </p>

      <p className="mt-2 text-sm font-medium">Accent colour</p>
      <div
        role="radiogroup"
        aria-label="Accent colour"
        className="flex flex-wrap gap-2"
      >
        {accents.map((item) => {
          const selected = item.value === look.accent;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={item.name}
              title={item.name}
              onClick={() =>
                setLook((current) => ({ ...current, accent: item.value }))
              }
              className={cn(
                "focus-visible:ring-ring/50 flex size-7 items-center justify-center rounded-full text-white outline-none focus-visible:ring-[3px]",
                // The selection is drawn inside the swatch (a white ring
                // 2px in, plus the tick), so a picked swatch keeps its exact
                // footprint and nothing pokes past the column's left edge.
                selected
                  ? "shadow-[inset_0_0_0_2px_oklch(1_0_0/0.95),inset_0_0_0_3px_oklch(0_0_0/0.12)]"
                  : "shadow-[inset_0_0_0_1px_oklch(0_0_0/0.12)]"
              )}
              style={{ backgroundColor: item.value }}
            >
              {selected ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  strokeWidth={2.5}
                  className="size-3.5"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {accentName}: used for your profile's links and buttons.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <AnimatePresence initial={false}>
        {dirty ? (
          <SaveActions
            key="actions"
            busy={busy}
            failed={failed}
            failedText="Look not saved. Check your connection and try again."
            submitLabel="Save look"
            onCancel={() => {
              setLook(stored);
              setFailed(false);
            }}
          />
        ) : null}
      </AnimatePresence>
      <DoneNote stamp={doneStamp} hideAfter={2000}>
        Saved
      </DoneNote>
    </form>
  );
};

/* ─────────────────────────────────────────────────────────
 * PRIVACY: what shows on the profile; each switch saves at once.
 * ───────────────────────────────────────────────────────── */

/** A switch for something the profile can show. */
export interface PrivacyOption {
  /** Unique id, also the key in the saved values, e.g. "likes". */
  id: string;
  /** What it shows, stated as the ON state, e.g. "Show your likes". */
  label: string;
  /** One line on what people will see. */
  description: string;
  /** A Hugeicons icon from `@hugeicons/core-free-icons`. */
  icon: typeof FavouriteIcon;
}

export const DEFAULT_PRIVACY_OPTIONS: PrivacyOption[] = [
  {
    description: "People can see the posts you've liked.",
    icon: FavouriteIcon,
    id: "likes",
    label: "Show your likes",
  },
  {
    description: "A badge next to your name in comments.",
    icon: CheckmarkBadge01Icon,
    id: "badge",
    label: "Show subscriber badge",
  },
  {
    description: "Lists what you read on your profile.",
    icon: Bookmark01Icon,
    id: "subscriptions",
    label: "Show your subscriptions",
  },
];

export const PrivacySwitches = ({
  initial,
  onChange,
  options,
}: {
  initial: Record<string, boolean>;
  onChange: (id: string, value: boolean) => Promise<void>;
  options: PrivacyOption[];
}) => {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [failed, setFailed] = useState<string | null>(null);
  const [announced, setAnnounced] = useState("");

  const flip = async (option: PrivacyOption, value: boolean) => {
    setFailed(null);
    setValues((current) => ({ ...current, [option.id]: value }));
    try {
      await onChange(option.id, value);
      setAnnounced(`${option.label}: ${value ? "on" : "off"}. Saved.`);
    } catch {
      // Put it back, and say so.
      setValues((current) => ({ ...current, [option.id]: !value }));
      setFailed(`"${option.label}" not saved. Try again.`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <div
            key={option.id}
            className={cn(CARD, "flex items-center gap-3 px-3 py-3")}
          >
            <HugeiconsIcon
              icon={option.icon}
              strokeWidth={1.75}
              className="text-muted-foreground size-4 shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <label
                htmlFor={`${id}-${option.id}`}
                className="text-sm font-medium"
              >
                {option.label}
              </label>
              <p className="text-muted-foreground text-xs">
                {option.description}
              </p>
            </div>
            <Switch
              id={`${id}-${option.id}`}
              checked={values[option.id] ?? false}
              onCheckedChange={(value) => flip(option, value)}
              className={SWITCH_MOTION}
            />
          </div>
        ))}
      </div>
      {failed ? (
        <p aria-live="polite" className="text-destructive text-xs">
          {failed}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
};
