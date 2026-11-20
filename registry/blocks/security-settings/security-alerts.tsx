"use client";

import { useId, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { CARD } from "./surface";

/* ─────────────────────────────────────────────────────────
 * SECURITY ALERTS: emails about account changes. Each switch is named for
 * its ON state and saves as soon as it flips; a failure flips it back.
 *
 * SWITCH MICROINTERACTIONS (overrides on shadcn's switch, at the call site)
 *   press     the thumb stretches 16 → 20px while held, toward where it's
 *             going (iOS-style "got it"); release and it travels
 *   travel    200ms ease-out for the slide and the stretch
 *   saving    nothing visible: the switch itself is the feedback. Screen
 *             readers hear "… on. Saved."; a failure flips it back and
 *             says so under the list.
 *   reduced   no stretch, no slide (the thumb jumps)
 * ───────────────────────────────────────────────────────── */

// Track inner width 30px (w-8 minus the 1px border each side).
// Checked: 30 - 16 = 14px; pressed (20px thumb): 30 - 20 = 10px.
// Written out in full (not built from a variable) so Tailwind sees them.
const SWITCH_MOTION = [
  "[&_[data-slot=switch-thumb]]:transition-[translate,width,background-color]",
  "[&_[data-slot=switch-thumb]]:duration-200",
  "[&_[data-slot=switch-thumb]]:ease-[cubic-bezier(0.23,1,0.32,1)]",
  "[&_[data-slot=switch-thumb][data-checked]]:translate-x-[14px]",
  "active:[&_[data-slot=switch-thumb]]:w-5",
  "active:[&_[data-slot=switch-thumb][data-checked]]:translate-x-[10px]",
  "motion-reduce:[&_[data-slot=switch-thumb]]:transition-none",
  "motion-reduce:active:[&_[data-slot=switch-thumb]]:w-4",
  "motion-reduce:active:[&_[data-slot=switch-thumb][data-checked]]:translate-x-[14px]",
].join(" ");

/** An email alert the person can turn on or off. */
export interface SecurityAlert {
  /** Unique id, also the key in the saved values. */
  id: string;
  /** What it does when on, e.g. "Email me about new sign-ins". */
  label: string;
  /** One line on when it's sent. */
  description: string;
}

export const DEFAULT_SECURITY_ALERTS: SecurityAlert[] = [
  {
    description:
      "When someone signs in from a device or place we haven't seen.",
    id: "new-sign-in",
    label: "Email me about new sign-ins",
  },
  {
    description: "When your password, email or phone number changes.",
    id: "account-changes",
    label: "Email me about account changes",
  },
  {
    description: "When two-factor is turned off or recovery codes are remade.",
    id: "two-factor",
    label: "Email me about two-factor changes",
  },
];

export const SecurityAlerts = ({
  alerts,
  initial,
  onChange,
}: {
  alerts: SecurityAlert[];
  initial: Record<string, boolean>;
  onChange: (id: string, value: boolean) => Promise<void>;
}) => {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [failed, setFailed] = useState<string | null>(null);
  const [announced, setAnnounced] = useState("");

  const flip = async (alert: SecurityAlert, value: boolean) => {
    setFailed(null);
    setValues((current) => ({ ...current, [alert.id]: value }));
    try {
      await onChange(alert.id, value);
    } catch {
      setValues((current) => ({ ...current, [alert.id]: !value }));
      setFailed(`"${alert.label}" not saved. Try again.`);
      return;
    }
    setAnnounced(`${alert.label}: ${value ? "on" : "off"}. Saved.`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(CARD, "flex items-center gap-3 px-4 py-3")}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <label
                htmlFor={`${id}-${alert.id}`}
                className="text-sm font-medium"
              >
                {alert.label}
              </label>
              <p className="text-muted-foreground text-xs">
                {alert.description}
              </p>
            </div>
            <Switch
              id={`${id}-${alert.id}`}
              checked={values[alert.id] ?? false}
              onCheckedChange={(value) => flip(alert, value)}
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
