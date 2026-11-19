"use client";

import type * as React from "react";
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { RING } from "./surface";

/* ─────────────────────────────────────────────────────────
 * SETTINGS TABS: the settings pages as a row of tabs in a muted track.
 * They're links (each is its own page), not in-page tabs. The current
 * one is a raised chip (background + shadow ring), never a weight change.
 * On narrow screens the row scrolls sideways, the current tab scrolled
 * into view. No motion: people switch tabs often.
 * ───────────────────────────────────────────────────────── */

/** One settings page in the tab row. */
export interface SettingsTab {
  /** Unique id; matched against `activeTab` to mark the current page. */
  id: string;
  /** Text on the tab, e.g. "Notifications". */
  label: string;
  /** Where the tab goes, e.g. "/settings/notifications". */
  href: string;
}

/**
 * Runs before a tab link is followed. Call `event.preventDefault()` to stay
 * on the page, or route with your own router.
 */
export type SettingsTabNavigateHandler = (
  event: React.MouseEvent<HTMLAnchorElement>,
  tab: SettingsTab
) => void;

export const DEFAULT_SETTINGS_TABS: SettingsTab[] = [
  { href: "#general", id: "general", label: "General" },
  { href: "#profile", id: "profile", label: "Personal details" },
  { href: "#security", id: "security", label: "Password & security" },
  { href: "#notifications", id: "notifications", label: "Notifications" },
  { href: "#billing", id: "billing", label: "Billing" },
];

export const SettingsTabs = ({
  active,
  onNavigate,
  tabs,
}: {
  active: string;
  onNavigate?: SettingsTabNavigateHandler;
  tabs: SettingsTab[];
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  // Bring the current tab into view without scrolling the page.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const tab = row?.querySelector<HTMLElement>("[aria-current=page]");
    if (row && tab && row.scrollWidth > row.clientWidth) {
      row.scrollLeft = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    }
  }, [active]);

  return (
    <nav aria-label="Settings" className="min-w-0">
      <div
        ref={rowRef}
        className="bg-muted/70 flex max-w-full gap-1 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] sm:inline-flex [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <a
              key={tab.id}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              onClick={(event) => onNavigate?.(event, tab)}
              className={cn(
                "focus-visible:ring-ring/50 flex h-8 shrink-0 items-center rounded-lg px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px]",
                current
                  ? cn(RING, "bg-background text-foreground")
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
};
