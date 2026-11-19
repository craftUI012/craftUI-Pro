"use client";

import {
  CreditCardIcon,
  Key01Icon,
  Notification03Icon,
  SlidersHorizontalIcon,
  SquareLock02Icon,
  UserGroupIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";
import { useLayoutEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────
 * SETTINGS NAV
 * Desktop (md and up): a column of ghost buttons in labelled groups.
 * Phones: one row of pills that scrolls sideways, the active one
 * scrolled into view. The active item changes colour and background,
 * never weight (a weight change shifts the text's width).
 * ───────────────────────────────────────────────────────── */

/** One link in the settings nav. */
export interface SettingsNavItem {
  /** Unique id; matched against `activeItem` to mark the current page. */
  id: string;
  /** Text shown in the nav, e.g. "Security". */
  label: string;
  /** A Hugeicons icon from `@hugeicons/core-free-icons`, e.g. `UserIcon`. */
  icon: typeof UserIcon;
  /** Where the link goes, e.g. "/settings/security". */
  href: string;
}

/** A labelled group of nav links, e.g. "Account". */
export interface SettingsNavGroup {
  /** Small heading above the group, e.g. "Workspace". Leave out for none. */
  label?: string;
  /** The links in the group, in order. */
  items: SettingsNavItem[];
}

/**
 * Runs before a nav link is followed. Call `event.preventDefault()` to stay
 * on the page, or route with your own router.
 */
export type SettingsNavigateHandler = (
  event: React.MouseEvent<HTMLAnchorElement>,
  item: SettingsNavItem
) => void;

export const DEFAULT_SETTINGS_NAV: SettingsNavGroup[] = [
  {
    items: [
      { href: "#profile", icon: UserIcon, id: "profile", label: "Profile" },
      {
        href: "#security",
        icon: SquareLock02Icon,
        id: "security",
        label: "Security",
      },
      {
        href: "#notifications",
        icon: Notification03Icon,
        id: "notifications",
        label: "Notifications",
      },
      {
        href: "#preferences",
        icon: SlidersHorizontalIcon,
        id: "preferences",
        label: "Preferences",
      },
    ],
    label: "Account",
  },
  {
    items: [
      {
        href: "#team",
        icon: UserGroupIcon,
        id: "team",
        label: "Team & members",
      },
      { href: "#api-keys", icon: Key01Icon, id: "api-keys", label: "API keys" },
      {
        href: "#billing",
        icon: CreditCardIcon,
        id: "billing",
        label: "Billing",
      },
    ],
    label: "Workspace",
  },
];

export const SettingsNav = ({
  active,
  groups,
  onNavigate,
}: {
  active: string;
  groups: SettingsNavGroup[];
  onNavigate?: SettingsNavigateHandler;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const items = groups.flatMap((group) => group.items);

  // Phones: bring the active pill into view without scrolling the page.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const pill = row?.querySelector<HTMLElement>("[aria-current=page]");
    if (row && pill) {
      row.scrollLeft =
        pill.offsetLeft - (row.clientWidth - pill.offsetWidth) / 2;
    }
  }, [active]);

  return (
    <>
      <nav
        aria-label="Settings"
        className="hidden w-52 shrink-0 flex-col gap-6 md:flex lg:w-56"
      >
        {groups.map((group, index) => (
          <div key={group.label ?? index} className="flex flex-col gap-0.5">
            {group.label ? (
              <p className="text-muted-foreground px-2.5 pb-1.5 text-xs">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const current = item.id === active;
              return (
                <Button
                  key={item.id}
                  asChild
                  variant="ghost"
                  size="sm"
                  // Overrides: left-aligned rows, the active one filled.
                  className={cn(
                    "h-8 justify-start gap-2.5 px-2.5 font-normal",
                    current
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <a
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={(event) => onNavigate?.(event, item)}
                  >
                    <HugeiconsIcon
                      icon={item.icon}
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    {item.label}
                  </a>
                </Button>
              );
            })}
          </div>
        ))}
      </nav>

      <nav aria-label="Settings" className="md:hidden">
        <div
          ref={rowRef}
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const current = item.id === active;
            return (
              <Button
                key={item.id}
                asChild
                variant={current ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 shrink-0 gap-2 rounded-full px-3 font-normal",
                  !current && "text-muted-foreground"
                )}
              >
                <a
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  onClick={(event) => onNavigate?.(event, item)}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    strokeWidth={1.75}
                    className="size-4"
                  />
                  {item.label}
                </a>
              </Button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
