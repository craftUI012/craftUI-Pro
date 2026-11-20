"use client";

import {
  Alert02Icon,
  AtIcon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import { DoneNote, POPOVER_MOTION, Reveal } from "./motion";
import { StatusButton } from "./status-button";
import { FLOAT, RING, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * HANDLE: "@samdavies", changed by choosing in a popover:
 *
 *   ◉ @samdavies       Current handle
 *   ○ @sam.davies      Suggested
 *   ○ [@ your own    ] Checking… / Available / Taken
 *   [Cancel] [Update handle]
 *
 * Typing your own selects it; availability is checked 400ms after typing
 * stops. Update is on only for a different handle that's free. The
 * popover grows out of "Edit handle" (origin-aware, 150ms ease-out).
 *
 *   radios        a shadow ring, not shadcn's grey border (call site)
 *   availability  its line folds open under the field (Reveal, 210ms)
 *                 rather than pushing the buttons down in one jump
 *   update        a StatusButton: label rolls up to a spinner while saving
 *   reset         on open, not on close, so the closing fade is calm
 * ───────────────────────────────────────────────────────── */

const HANDLE_RULE = /^[a-z0-9._]{3,30}$/;

type Status = "idle" | "invalid" | "checking" | "available" | "taken";

const STATUS_TEXT: Record<Exclude<Status, "idle">, string> = {
  available: "Available",
  checking: "Checking…",
  invalid: "3–30 characters: lowercase letters, numbers, dots or _",
  taken: "Taken. Try another one.",
};

const STATUS_ICON: Partial<Record<Status, typeof Alert02Icon>> = {
  available: CheckmarkCircle02Icon,
  checking: Loading03Icon,
  invalid: Alert02Icon,
  taken: Alert02Icon,
};

// The custom handle's availability: debounced, the latest check wins.
const useAvailability = (
  value: string,
  current: string,
  check: (handle: string) => Promise<boolean>
): Status => {
  const [result, setResult] = useState<{ value: string; free: boolean }>();
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  }, [check]);
  useEffect(() => {
    if (!HANDLE_RULE.test(value) || value === current) {
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      const free = await checkRef.current(value).catch(() => false);
      if (!stale) {
        setResult({ free, value });
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [value, current]);

  if (value === "" || value === current) {
    return "idle";
  }
  if (!HANDLE_RULE.test(value)) {
    return "invalid";
  }
  if (result?.value !== value) {
    return "checking";
  }
  return result.free ? "available" : "taken";
};

const Option = ({
  hint,
  id,
  label,
  value,
}: {
  hint: string;
  id: string;
  label: string;
  value: string;
}) => (
  <label
    htmlFor={id}
    className="hover:bg-accent/60 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5"
  >
    <RadioGroupItem
      id={id}
      value={value}
      // Override: a shadow ring, not shadcn's grey border.
      className={cn(RING, "dark:border-transparent")}
    />
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium">@{label}</span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </span>
  </label>
);

export const HandleField = ({
  check,
  current,
  onSave,
  side,
  suggestions,
}: {
  check: (handle: string) => Promise<boolean>;
  current: string;
  onSave: (handle: string) => Promise<void>;
  side: "left" | "bottom";
  suggestions: string[];
}) => {
  const id = useId();
  const [handle, setHandle] = useState(current);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(current);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [doneStamp, setDoneStamp] = useState(0);
  const status = useAvailability(custom, handle, check);
  const offered = suggestions.filter((item) => item !== handle);
  const picked = choice === "custom" ? custom : choice;
  const canUpdate =
    picked !== handle &&
    picked !== "" &&
    (choice !== "custom" || status === "available");
  const icon = STATUS_ICON[status];

  const close = () => setOpen(false);

  // Fresh on open; untouched while closing, so the fade-out doesn't flash.
  const openFresh = () => {
    setChoice(handle);
    setCustom("");
    setFailed(false);
    setOpen(true);
  };

  const update = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onSave(picked);
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    setBusy(false);
    setHandle(picked);
    setDoneStamp(Date.now());
    setOpen(false);
  };

  return (
    <>
      <label htmlFor={`${id}-handle`} className="text-sm font-medium">
        Handle
      </label>
      <div
        className={cn(
          RING,
          "bg-muted/40 dark:bg-muted/20 flex h-9 items-center rounded-md"
        )}
      >
        <span className="text-muted-foreground pl-3 text-sm select-none">
          @
        </span>
        <Input
          id={`${id}-handle`}
          value={handle}
          readOnly
          // Override: the box around it draws the ring.
          className="h-full min-w-0 flex-1 border-0 bg-transparent pl-0.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <Popover
        open={open}
        onOpenChange={(value) => (value ? openFresh() : close())}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex w-fit items-center gap-2 rounded-sm text-sm outline-none focus-visible:ring-[3px]"
            />
          }
        >
          <HugeiconsIcon
            icon={PencilEdit02Icon}
            strokeWidth={1.75}
            className="size-4"
          />
          Edit handle
        </PopoverTrigger>
        <PopoverContent
          side={side}
          align={side === "left" ? "center" : "start"}
          sideOffset={side === "left" ? 16 : 8}
          className={cn(FLOAT, POPOVER_MOTION, "w-80 rounded-xl p-4")}
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canUpdate && !busy) {
                update();
              }
            }}
          >
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <HugeiconsIcon
                  icon={AtIcon}
                  strokeWidth={1.75}
                  className="text-muted-foreground size-4"
                />
                Edit your handle
              </p>
              <p className="text-muted-foreground text-sm text-pretty">
                How people find and mention you.
              </p>
            </div>
            <RadioGroup
              value={choice}
              onValueChange={setChoice}
              aria-label="Handle"
              className="gap-0.5"
            >
              <Option
                id={`${id}-current`}
                value={handle}
                label={handle}
                hint="Current handle"
              />
              {offered.map((item) => (
                <Option
                  key={item}
                  id={`${id}-${item}`}
                  value={item}
                  label={item}
                  hint="Suggested"
                />
              ))}
              <div className="flex items-start gap-3 rounded-md px-2 py-1.5">
                <RadioGroupItem
                  id={`${id}-custom`}
                  value="custom"
                  aria-label="Your own handle"
                  className={cn(RING, "mt-2.5 dark:border-transparent")}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div
                    className={cn(
                      RING,
                      "dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center rounded-md bg-transparent focus-within:ring-[3px]",
                      (status === "taken" || status === "invalid") &&
                        "border-destructive"
                    )}
                  >
                    <span className="text-muted-foreground pl-3 text-sm select-none">
                      @
                    </span>
                    <Input
                      value={custom}
                      placeholder="your-handle"
                      aria-label="Your own handle"
                      autoCapitalize="none"
                      spellCheck={false}
                      onFocus={() => setChoice("custom")}
                      onChange={(event) => {
                        setCustom(event.target.value.toLowerCase().trim());
                        setChoice("custom");
                      }}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pl-0.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
                    />
                    <span className="flex w-8 justify-center">
                      {icon ? (
                        <HugeiconsIcon
                          icon={icon}
                          strokeWidth={1.75}
                          className={cn(
                            "size-4",
                            status === "available" &&
                              "text-emerald-600 dark:text-emerald-400",
                            (status === "taken" || status === "invalid") &&
                              "text-destructive",
                            status === "checking" &&
                              "text-muted-foreground animate-[spin_700ms_linear_infinite] motion-reduce:animate-none"
                          )}
                        />
                      ) : null}
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {status === "idle" ? null : (
                      <Reveal key="status" className="pt-1.5">
                        <p
                          aria-live="polite"
                          className={cn(
                            "text-xs",
                            status === "taken" || status === "invalid"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {STATUS_TEXT[status]}
                        </p>
                      </Reveal>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </RadioGroup>
            {failed ? (
              <p aria-live="polite" className="text-destructive text-xs">
                Handle not updated. Check your connection and try again.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={RING_BUTTON}
                onClick={close}
              >
                Cancel
              </Button>
              <StatusButton
                type="submit"
                size="sm"
                // Busy stays at full colour (aria-disabled), not dimmed.
                disabled={!busy && !canUpdate}
                state={busy ? "busy" : "idle"}
                labels={{ busy: "Updating handle…", idle: "Update handle" }}
              />
            </div>
          </form>
        </PopoverContent>
      </Popover>
      <DoneNote stamp={doneStamp}>Handle updated</DoneNote>
    </>
  );
};
