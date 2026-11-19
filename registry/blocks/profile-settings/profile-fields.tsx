"use client";

import {
  Alert02Icon,
  Camera01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { EASE_OUT, MOTION, Reveal } from "./motion";
import { PHOTO_INSET, RING, RING_BUTTON } from "./surface";

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/* ─────────────────────────────────────────────────────────
 * PHOTO
 * Click the photo or drop an image on it. A new photo crossfades in
 * (0.96 → 1, 200ms ease-out); without one, the initials show. While an
 * image is dragged over it, it grows 4% and rings (150ms).
 * ───────────────────────────────────────────────────────── */

export const AvatarPhoto = ({
  className,
  name,
  src,
}: {
  className?: string;
  name: string;
  src: string | null;
}) => {
  const reduce = useReducedMotion();
  return (
    <Avatar className={cn("size-16", className)}>
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
            transition={{ duration: MOTION.swap, ease: EASE_OUT }}
          />
        ) : null}
      </AnimatePresence>
      {/* Inset ring + soft inner shadow: the photo's edge reads crisply. */}
      <span aria-hidden className={PHOTO_INSET} />
    </Avatar>
  );
};

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export const AvatarField = ({
  maxMb,
  name,
  onPick,
  onRemove,
  src,
}: {
  maxMb: number;
  name: string;
  onPick: (file: File) => void;
  onRemove: () => void;
  src: string | null;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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
    setError(null);
    onPick(file);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Change photo"
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
          "group/photo focus-visible:ring-ring/50 relative shrink-0 rounded-full outline-none focus-visible:ring-[3px]",
          // Children ignore the pointer, so dragging across them doesn't
          // flicker between dragover and dragleave.
          "transition-[scale,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [&>*]:pointer-events-none",
          dragging &&
            "ring-primary ring-offset-background scale-[1.04] ring-2 ring-offset-2 motion-reduce:scale-100"
        )}
      >
        <AvatarPhoto name={name} src={src} />
        {/* Hover hint, only where there's a real hover. */}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100 motion-reduce:transition-none">
          <HugeiconsIcon
            icon={Camera01Icon}
            strokeWidth={1.75}
            className="size-5"
          />
        </span>
      </button>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={RING_BUTTON}
            onClick={() => inputRef.current?.click()}
          >
            Upload photo
          </Button>
          {/* Comes and goes with the photo: a 150ms fade, no movement. */}
          <AnimatePresence initial={false}>
            {src ? (
              <motion.span
                key="remove"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: MOTION.status, ease: EASE_OUT }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={onRemove}
                >
                  Remove
                </Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <p
          className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {error ?? `PNG, JPG or WebP, up to ${maxMb} MB.`}
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
 * USERNAME
 * A prefix + input that read as one field. Availability is checked
 * after typing stops; the status icon crossfades (150ms, no movement:
 * it changes as you type). Nothing shows under the field until the
 * username changes.
 * ───────────────────────────────────────────────────────── */

export type UsernameStatus =
  | "unchanged"
  | "invalid"
  | "checking"
  | "available"
  | "taken"
  | "error";

export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

/** Availability of a username draft: debounced, ignores the saved one. */
export const useUsernameStatus = (
  draft: string,
  saved: string,
  check: (username: string) => Promise<boolean>,
  debounceMs: number
): UsernameStatus => {
  const [checked, setChecked] = useState<{
    available: boolean | null;
    value: string;
  } | null>(null);
  // The latest `check`, so an inline function passed in doesn't restart
  // the check (and loop) on every render.
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  }, [check]);

  useEffect(() => {
    if (draft === saved || !USERNAME_RULE.test(draft)) {
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const available = await checkRef.current(draft);
        if (!stale) {
          setChecked({ available, value: draft });
        }
      } catch {
        if (!stale) {
          setChecked({ available: null, value: draft });
        }
      }
    }, debounceMs);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [draft, saved, debounceMs]);

  if (draft === saved) {
    return "unchanged";
  }
  if (!USERNAME_RULE.test(draft)) {
    return "invalid";
  }
  if (checked?.value !== draft) {
    return "checking";
  }
  if (checked.available === null) {
    return "error";
  }
  return checked.available ? "available" : "taken";
};

const STATUS_ICON: Partial<Record<UsernameStatus, typeof Alert02Icon>> = {
  available: CheckmarkCircle02Icon,
  checking: Loading03Icon,
  error: Alert02Icon,
  invalid: Alert02Icon,
  taken: Alert02Icon,
};

const StatusIcon = ({ status }: { status: UsernameStatus }) => {
  const icon = STATUS_ICON[status] ?? null;
  const bad = status === "taken" || status === "invalid" || status === "error";
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {icon ? (
        <motion.span
          key={status}
          initial={{ filter: "blur(2px)", opacity: 0 }}
          animate={{ filter: "blur(0px)", opacity: 1 }}
          exit={{ filter: "blur(2px)", opacity: 0 }}
          transition={{ duration: MOTION.status, ease: EASE_OUT }}
          className={cn(
            "flex",
            status === "available" && "text-emerald-600 dark:text-emerald-400",
            bad && "text-destructive",
            status === "checking" && "text-muted-foreground"
          )}
        >
          <HugeiconsIcon
            icon={icon}
            strokeWidth={1.75}
            className={cn(
              "size-4",
              status === "checking" &&
                "animate-[spin_700ms_linear_infinite] motion-reduce:animate-none"
            )}
          />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
};

const USERNAME_HINT: Record<Exclude<UsernameStatus, "unchanged">, string> = {
  available: "Available.",
  checking: "Checking…",
  error: "Unable to check right now. Try again in a moment.",
  invalid: "3–20 characters: lowercase letters, numbers and _",
  taken: "That username is taken. Try another.",
};

export const UsernameField = ({
  id,
  onChange,
  prefix,
  saved,
  status,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  prefix: string;
  saved: string;
  status: UsernameStatus;
  value: string;
}) => {
  const hintId = `${id}-hint`;
  const bad = status === "invalid" || status === "taken" || status === "error";

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          RING,
          "dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center rounded-md bg-transparent transition-[color,box-shadow] focus-within:ring-[3px]",
          bad &&
            "border-destructive focus-within:border-destructive focus-within:ring-destructive/20"
        )}
      >
        <span className="text-muted-foreground pl-3 text-sm select-none">
          {prefix}
        </span>
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          aria-invalid={bad}
          aria-describedby={status === "unchanged" ? undefined : hintId}
          autoComplete="username"
          spellCheck={false}
          // Override: the wrapper draws the border and focus ring.
          className="h-full min-w-0 flex-1 border-0 bg-transparent pl-0.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <span className="flex w-9 justify-center">
          <StatusIcon status={status} />
        </span>
      </div>
      {/* Nothing while unchanged: the prefix already says it's a link.
          The hint folds in and out (Reveal) so the rows below glide. */}
      <AnimatePresence initial={false}>
        {status === "unchanged" ? null : (
          <Reveal key="hint">
            <p
              id={hintId}
              aria-live="polite"
              className={cn(
                "text-xs text-pretty",
                bad ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {status === "available"
                ? `Available. Links to ${prefix}${saved} will stop working.`
                : USERNAME_HINT[status]}
            </p>
          </Reveal>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
 * BIO
 * The counter sits in the box's corner and shows only while you write,
 * or within 20 characters of the limit (150ms fade).
 * ───────────────────────────────────────────────────────── */

export const BioField = ({
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
  const fallbackId = useId();
  const countId = `${id || fallbackId}-count`;
  return (
    <div className="relative">
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-describedby={countId}
        // Overrides: a shadow ring instead of the border, and room at the
        // bottom for the counter.
        className={cn(RING, "resize-none pb-7")}
      />
      <p
        id={countId}
        className={cn(
          "text-muted-foreground pointer-events-none absolute right-3 bottom-2 text-xs tabular-nums transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
          showCount ? "opacity-100" : "opacity-0"
        )}
      >
        {value.length}/{max}
      </p>
    </div>
  );
};
