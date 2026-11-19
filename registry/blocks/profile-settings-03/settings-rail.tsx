"use client";

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { FLOAT, RING } from "./surface";

/* ─────────────────────────────────────────────────────────
 * SETTINGS RAIL: the settings pages as text links in labelled groups.
 * The current page is a 2px bar at its left edge and foreground text, no
 * fill, no weight change; hovering shows a faint bar. No full-height
 * hairline down each group (a rule is noise): the bar is a state, so it
 * stays. No icons: the labels carry it. The menu below lg separates its
 * groups with space, not separators.
 *
 *   lg and up   the rail column, beside the page
 *   below lg    one "Current page ⌄" menu that lists every group
 *
 * No motion: people move between settings pages often.
 * ───────────────────────────────────────────────────────── */

/** One settings page in the rail. */
export interface RailItem {
  /** Unique id; matched against `active` to mark the current page. */
  id: string;
  /** Text in the rail, e.g. "Two-factor authentication". */
  label: string;
  /** Where it goes, e.g. "/settings/security". */
  href: string;
}

/** A labelled group of settings pages, e.g. "Billing". */
export interface RailGroup {
  /** Small heading above the group. */
  label: string;
  /** The pages in the group, in order. */
  items: RailItem[];
}

/**
 * Runs before a rail link is followed. Call `event.preventDefault()` to
 * stay on the page, or route with your own router.
 */
export type RailNavigateHandler = (
  event: React.MouseEvent<HTMLAnchorElement> | Event,
  item: RailItem
) => void;

export const DEFAULT_RAIL: RailGroup[] = [
  {
    items: [
      { href: "#personal", id: "personal", label: "Personal information" },
      { href: "#defaults", id: "defaults", label: "Defaults" },
      { href: "#appearance", id: "appearance", label: "Appearance" },
    ],
    label: "General",
  },
  {
    items: [
      { href: "#display", id: "display", label: "Display" },
      {
        href: "#schedule-alerts",
        id: "schedule-alerts",
        label: "Notifications & actions",
      },
    ],
    label: "Schedules",
  },
  {
    items: [
      { href: "#invoices", id: "invoices", label: "Invoices" },
      { href: "#subscription", id: "subscription", label: "Subscription" },
      {
        href: "#payment-methods",
        id: "payment-methods",
        label: "Payment methods",
      },
    ],
    label: "Billing",
  },
  {
    items: [
      { href: "#2fa", id: "2fa", label: "Two-factor authentication" },
      { href: "#encryption", id: "encryption", label: "Data encryption" },
    ],
    label: "Privacy & security",
  },
  {
    items: [
      { href: "#roles", id: "roles", label: "Roles" },
      { href: "#team", id: "team", label: "Team" },
    ],
    label: "Permissions",
  },
  {
    items: [
      { href: "#apps", id: "apps", label: "Third-party apps" },
      { href: "#api", id: "api", label: "API access" },
    ],
    label: "Integrations",
  },
  {
    items: [
      { href: "#inbox", id: "inbox", label: "Email & in-app" },
      { href: "#alerts", id: "alerts", label: "Custom alerts" },
    ],
    label: "Notifications",
  },
];

export const SettingsRail = ({
  active,
  groups,
  onNavigate,
}: {
  active: string;
  groups: RailGroup[];
  onNavigate?: RailNavigateHandler;
}) => {
  const current = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === active);

  return (
    <>
      <nav
        aria-label="Settings"
        className="hidden w-56 shrink-0 flex-col gap-6 lg:flex"
      >
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs">{group.label}</p>
            <div className="flex flex-col">
              {group.items.map((item) => {
                const isCurrent = item.id === active;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={(event) => onNavigate?.(event, item)}
                    className={cn(
                      "focus-visible:ring-ring/50 relative flex h-8 items-center rounded-r-md border-l-2 pl-3 text-sm outline-none focus-visible:ring-[3px]",
                      isCurrent
                        ? "border-foreground text-foreground"
                        : "text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground border-transparent"
                    )}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Below lg: the current page as a menu of every page. */}
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                RING,
                "bg-background focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md px-3 text-sm outline-none focus-visible:ring-[3px] sm:w-72"
              )}
            >
              <span className="truncate">
                <span className="text-muted-foreground">Settings / </span>
                {current?.label}
              </span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={1.75}
                className="text-muted-foreground size-4 shrink-0"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(
              FLOAT,
              "max-h-[70vh] w-(--radix-dropdown-menu-trigger-width) overscroll-contain"
            )}
          >
            {groups.map((group, index) => (
              <DropdownMenuGroup key={group.label}>
                <DropdownMenuLabel
                  className={cn(
                    "text-muted-foreground text-xs font-normal",
                    index > 0 && "mt-2"
                  )}
                >
                  {group.label}
                </DropdownMenuLabel>
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.id} asChild>
                    <a
                      href={item.href}
                      onClick={(event) => onNavigate?.(event, item)}
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.id === active ? (
                        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
                      ) : null}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};
