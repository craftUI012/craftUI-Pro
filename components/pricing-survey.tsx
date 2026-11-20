"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { posthog } from "posthog-js";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TYPE } from "@/constants/typography";
import { useAccess } from "@/hooks/use-access";
import { trackEvent } from "@/lib/events";
import {
  CHECKOUT_BUSY_EVENT,
  CHECKOUT_LEFT_KEY,
  OPINIONS,
  WANT_MORE,
} from "@/lib/feedback";
import type { Opinion, SurveyTrigger, WantMore } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────
 * PRICING EXIT SURVEY: three optional questions, once per visitor, only for
 * people who aren't signed in (so haven't paid). Answers go to
 * app/api/feedback and show on the admin panel's Feedback page.
 *
 * Opens on whichever comes first:
 *   exit intent             desktop only (a fine pointer), after 10s on the
 *                           page: the pointer leaves through the top edge,
 *                           toward the tabs or address bar
 *   returned_from_checkout  back on /pricing within 30 min of leaving for
 *                           Dodo's checkout (a buyer who paid lands on the
 *                           success page instead), on any device
 *
 * Never while the checkout button is sending someone to Dodo, never over
 * another open dialog, and never twice: the "seen" mark is saved the moment
 * it opens, so closing it counts too.
 * ───────────────────────────────────────────────────────── */

const SURVEY = {
  // How long someone reads the page before leaving counts as exit intent.
  dwellMs: 10_000,
  // How long after leaving for Dodo a return to /pricing counts as unpaid.
  returnWindowMs: 30 * 60_000,
  // localStorage, per browser; bump the version to ask everyone again.
  seenKey: "pricing-survey:v1",
  // The thank-you note's time on screen before the dialog closes.
  thanksMs: 1200,
};

// Storage can be blocked (private windows, strict settings): then the
// survey stays closed rather than risk showing on every visit.
const readSeen = () => {
  try {
    return localStorage.getItem(SURVEY.seenKey) !== null;
  } catch {
    return true;
  }
};

const markSeen = () => {
  try {
    localStorage.setItem(SURVEY.seenKey, new Date().toISOString());
  } catch {
    // Nothing to do: readSeen already treats blocked storage as seen.
  }
};

// Did they leave for Dodo recently? Read once: the mark is removed.
const takeCheckoutReturn = () => {
  try {
    const left = Number(sessionStorage.getItem(CHECKOUT_LEFT_KEY));
    sessionStorage.removeItem(CHECKOUT_LEFT_KEY);
    return left > 0 && Date.now() - left < SURVEY.returnWindowMs;
  } catch {
    return false;
  }
};

const anotherDialogOpen = () =>
  document.querySelector('[role="dialog"][data-state="open"]') !== null;

// One question: a fieldset, so screen readers announce the question with
// each answer.
const Question = ({
  children,
  legend,
}: {
  children: ReactNode;
  legend: string;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className={cn(TYPE.cardLabel, "mb-2 font-medium")}>
      {legend}{" "}
      <span className="text-muted-foreground font-normal">Pick any</span>
    </legend>
    {children}
  </fieldset>
);

// An answer chip: a tick appears when it's picked, so the choice reads
// without relying on colour.
const Chip = ({
  label,
  on,
  value,
}: {
  label: string;
  on: boolean;
  value: string;
}) => (
  <ToggleGroupItem
    value={value}
    className="rounded-full px-3 active:scale-[0.97] motion-reduce:active:scale-100 data-pressed:bg-accent"
  >
    {on ? <Icon icon={Tick02Icon} /> : null}
    {label}
  </ToggleGroupItem>
);

type Status = "idle" | "sending" | "sent" | "error";

export const PricingSurvey = () => {
  const { ready, signedIn } = useAccess();
  const eligible = ready && !signedIn;
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<SurveyTrigger>("exit_intent");
  const [wantMore, setWantMore] = useState<WantMore[]>([]);
  const [opinion, setOpinion] = useState<Opinion[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const checkoutBusy = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const emailId = useId();
  const emailHintId = useId();

  const show = useCallback((reason: SurveyTrigger) => {
    if (checkoutBusy.current || readSeen() || anotherDialogOpen()) {
      return;
    }
    markSeen();
    setTrigger(reason);
    setOpen(true);
    trackEvent({ name: "survey_shown", properties: { trigger: reason } });
  }, []);

  useEffect(() => {
    const onBusy = (event: Event) => {
      checkoutBusy.current = (event as CustomEvent<boolean>).detail === true;
    };
    window.addEventListener(CHECKOUT_BUSY_EVENT, onBusy);
    return () => window.removeEventListener(CHECKOUT_BUSY_EVENT, onBusy);
  }, []);

  // Back from Dodo: a fresh load, or the page restored from the browser's
  // back-forward cache exactly as it was left.
  useEffect(() => {
    if (!eligible) {
      return;
    }
    const check = () => {
      if (takeCheckoutReturn()) {
        show("returned_from_checkout");
      }
    };
    check();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkoutBusy.current = false;
        check();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [eligible, show]);

  // Exit intent, desktop only: phones have no pointer to leave with.
  useEffect(() => {
    if (!eligible || !window.matchMedia("(pointer: fine)").matches) {
      return;
    }
    const armedAt = Date.now() + SURVEY.dwellMs;
    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget || event.clientY > 0 || Date.now() < armedAt) {
        return;
      }
      show("exit_intent");
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [eligible, show]);

  // Closing without sending: Esc, a click outside, or "No thanks".
  const handleOpenChange = (next: boolean) => {
    if (next) {
      return;
    }
    setOpen(false);
    if (status !== "sent") {
      trackEvent({ name: "survey_dismissed", properties: { trigger } });
    }
  };

  const hasAnswer = wantMore.length > 0 || opinion.length > 0 || email.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasAnswer || status === "sending") {
      return;
    }
    setStatus("sending");
    try {
      const response = await fetch("/api/feedback", {
        body: JSON.stringify({
          distinctId: posthog.get_distinct_id?.() || undefined,
          email: email.trim() || undefined,
          opinion,
          trigger,
          wantMore,
          website: honeypot.current?.value || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      // 429: they already answered from this browser; thank them anyway.
      if (!response.ok && response.status !== 429) {
        throw new Error("Not stored");
      }
      setStatus("sent");
      trackEvent({
        name: "survey_submitted",
        properties: {
          has_email: Boolean(email.trim()),
          opinion: opinion.join(","),
          trigger,
          want_more: wantMore.join(","),
        },
      });
      setTimeout(() => setOpen(false), SURVEY.thanksMs);
    } catch {
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-6 data-[state=closed]:duration-150 sm:max-w-[26rem]"
      >
        {status === "sent" ? (
          <DialogHeader>
            <DialogTitle>Thanks, that helps</DialogTitle>
            <DialogDescription>
              {email.trim()
                ? "We'll email you when what you asked for ships."
                : "It goes straight into what we build next."}
            </DialogDescription>
          </DialogHeader>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Before you go</DialogTitle>
              <DialogDescription>
                Three quick questions, all optional. It shapes what we build
                next.
              </DialogDescription>
            </DialogHeader>

            <Question legend="What do you want more of?">
              <ToggleGroup
                multiple
                variant="outline"
                size="sm"
                spacing={2}
                value={wantMore}
                onValueChange={(next) => setWantMore(next as WantMore[])}
                className="flex-wrap"
              >
                {WANT_MORE.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    on={wantMore.includes(option.value)}
                    value={option.value}
                  />
                ))}
              </ToggleGroup>
            </Question>

            <Question legend="What do you think of the library?">
              <ToggleGroup
                multiple
                variant="outline"
                size="sm"
                spacing={2}
                value={opinion}
                onValueChange={(next) => setOpinion(next as Opinion[])}
                className="flex-wrap"
              >
                {OPINIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    on={opinion.includes(option.value)}
                    value={option.value}
                  />
                ))}
              </ToggleGroup>
            </Question>

            <div className="flex flex-col gap-2">
              <label
                htmlFor={emailId}
                className={cn(TYPE.cardLabel, "font-medium")}
              >
                Email{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Input
                id={emailId}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={emailHintId}
              />
              <p
                id={emailHintId}
                className={cn(TYPE.cardCaption, "text-muted-foreground")}
              >
                We'll tell you when what you asked for ships.
              </p>
            </div>

            {/* Bot trap: off screen, out of the tab order, hidden from
                screen readers. People never fill it; bots often do. */}
            <input
              ref={honeypot}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[100vw] size-px opacity-0"
            />

            <DialogFooter className="items-center gap-2 sm:gap-2">
              {status === "error" ? (
                <p
                  role="status"
                  className={cn(TYPE.cardCaption, "text-destructive mr-auto")}
                >
                  Couldn't send. Try again.
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                No thanks
              </Button>
              <Button
                type="submit"
                disabled={!hasAnswer}
                aria-disabled={status === "sending"}
                className="active:scale-[0.97] motion-reduce:active:scale-100"
              >
                {status === "sending" ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
