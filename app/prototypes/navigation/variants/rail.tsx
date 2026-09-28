"use client";

import {
  Blocks,
  Component,
  LayoutTemplate,
  Menu,
  SearchIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LogoMark } from "@/components/logo";
import { ModeSwitcher } from "@/components/mode-switcher";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { SiteSettings } from "@/components/site-settings";
import { SponsorLink } from "@/components/sponsor-link";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { TYPE } from "@/constants/typography";
import { useIsMac } from "@/hooks/use-is-mac";
import { cn } from "@/lib/utils";

import { SITE_LINKS, useCommandK } from "./shared";
import type { NavVariantProps } from "./shared";

const LIBRARY_ICONS: Record<LibraryId, typeof Component> = {
  blocks: Blocks,
  components: Component,
  templates: LayoutTemplate,
};

// Height of one library row (h-9), which the sliding indicator steps by.
const ROW_REM = 2.25;

// The rail's contents, shared by the desktop sidebar and the phone drawer.
const RailBody = ({
  active,
  inputRef,
  libraries,
  onActiveChange,
  onNavigate,
  onQueryChange,
  query,
  showFooter = true,
  showSearch = true,
}: Omit<NavVariantProps, "children" | "searchItems"> & {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onNavigate?: () => void;
  // On desktop both live in the top bar instead, so the rail skips them.
  showFooter?: boolean;
  showSearch?: boolean;
}) => {
  const activeIndex = Math.max(
    0,
    libraries.findIndex((library) => library.id === active)
  );
  const placeholder = libraries[activeIndex]?.searchPlaceholder ?? "Search…";

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link
        href="/"
        className="focus-visible:ring-ring/50 flex items-center gap-2 rounded-md px-2 py-1 outline-none focus-visible:ring-[3px]"
      >
        <LogoMark className="size-5" />
        <span className={TYPE.cardHeader}>craftUI Pro</span>
      </Link>

      {showSearch && (
        <label className="bg-surface dark:bg-card focus-within:ring-ring/50 flex h-8 items-center gap-2 rounded-md px-2.5 transition-shadow duration-150 focus-within:ring-[3px]">
          <SearchIcon
            aria-hidden
            className="text-muted-foreground size-4 shrink-0"
          />
          <span className="sr-only">{placeholder}</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onQueryChange("");
                event.currentTarget.blur();
              }
            }}
            className={cn(
              TYPE.cardLabel,
              "placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
            )}
          />
          <Kbd aria-hidden className={cn(query && "hidden")}>
            /
          </Kbd>
        </label>
      )}

      <nav aria-label="Library" className="flex flex-col gap-2">
        <p className={cn(TYPE.cardCaption, "text-muted-foreground px-2")}>
          Library
        </p>
        <div className="relative flex flex-col">
          {/* Active row background slides between rows (transform only). */}
          <span
            aria-hidden
            style={{ transform: `translateY(${activeIndex * ROW_REM}rem)` }}
            className="bg-accent absolute inset-x-0 top-0 h-9 rounded-md transition-transform duration-250 ease-out-strong motion-reduce:transition-none"
          >
            <span className="bg-brand-text absolute top-2 bottom-2 left-0 w-0.5 rounded-full" />
          </span>
          {libraries.map((library) => {
            const Icon = LIBRARY_ICONS[library.id];
            const selected = library.id === active;
            return (
              <button
                key={library.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onActiveChange(library.id);
                  onNavigate?.();
                }}
                className={cn(
                  TYPE.cardLabel,
                  "focus-visible:ring-ring/50 relative flex h-9 items-center gap-2.5 rounded-md px-3 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="flex-1">{library.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {library.count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <nav aria-label="Resources" className="flex flex-col gap-2">
        <p className={cn(TYPE.cardCaption, "text-muted-foreground px-2")}>
          Resources
        </p>
        <div className="flex flex-col">
          {SITE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                TYPE.cardLabel,
                "text-muted-foreground hover:text-foreground hover:bg-accent/60 focus-visible:ring-ring/50 flex h-9 items-center rounded-md px-3 transition-colors duration-150 outline-none focus-visible:ring-[3px]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      {showFooter && (
        <div className="mt-auto flex items-center gap-1">
          <SponsorLink />
          <div className="ml-auto flex items-center gap-1">
            <ModeSwitcher />
            <SiteSettings />
          </div>
        </div>
      )}
    </div>
  );
};

// Top-bar search, matching /homepage-new's (the site header's docs search
// look: h-8, bg-surface, text-sm, ⌘K hint). It filters the grid as you type,
// and Escape clears it.
const TopBarSearch = ({
  inputRef,
  onQueryChange,
  placeholder,
  query,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  placeholder: string;
  query: string;
}) => {
  const isMac = useIsMac();
  return (
    <search className="hidden md:flex">
      <label className="bg-surface dark:bg-card text-surface-foreground focus-within:ring-ring/50 relative flex h-8 w-56 items-center gap-2 rounded-md pr-2 pl-2.5 text-sm transition-shadow duration-150 ease-out focus-within:ring-[3px] lg:w-64 xl:w-72">
        <SearchIcon aria-hidden className="size-4 shrink-0 opacity-60" />
        <span className="sr-only">{placeholder}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onQueryChange("");
              event.currentTarget.blur();
            }
          }}
          className="text-foreground placeholder:text-surface-foreground/60 min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <span aria-hidden className={cn("flex gap-1", query && "hidden")}>
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd className="aspect-square">K</Kbd>
        </span>
      </label>
    </search>
  );
};

// RAIL: axis = layout. Navigation moves from a horizontal bar to a
// vertical sidebar. Libraries become rows with icons and counts under a
// sliding highlight, and site links get their own group.
//
// A slim top bar over the content column carries the right-hand group from
// /homepage-new: ⌘K search, Sponsor, theme toggle, settings. The rail keeps
// only navigation, so nothing appears twice.
//
// On phones the bar also holds the menu button, which opens the rail (with
// its own search) as a drawer (slide + fade, 250ms ease-out-strong).
export const RailNav = ({
  active,
  children,
  libraries,
  onActiveChange,
  onQueryChange,
  query,
}: NavVariantProps) => {
  const desktopInput = useRef<HTMLInputElement>(null);
  const drawerInput = useRef<HTMLInputElement>(null);
  const [drawer, setDrawer] = useState(false);

  useCommandK(
    useCallback(() => {
      if (window.matchMedia("(min-width: 48rem)").matches) {
        desktopInput.current?.focus();
      } else {
        setDrawer(true);
        requestAnimationFrame(() => drawerInput.current?.focus());
      }
    }, [])
  );

  useEffect(() => {
    if (!drawer) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawer]);

  const shared = { active, libraries, onActiveChange, onQueryChange, query };
  const placeholder =
    libraries.find((library) => library.id === active)?.searchPlaceholder ??
    "Search…";

  return (
    <div className="flex min-h-svh">
      <aside className="border-border/60 bg-background animate-in fade-in slide-in-from-left-2 fill-mode-both ease-out-strong sticky top-0 hidden h-svh w-64 shrink-0 border-r duration-300 md:block motion-reduce:animate-none">
        <RailBody {...shared} showFooter={false} showSearch={false} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="bg-background/90 sticky top-0 z-40 flex h-(--header-height) items-center gap-2 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <Menu aria-hidden className="size-5" />
            </Button>
            <LogoMark className="size-5" />
            <span className={cn(TYPE.cardHeader, "max-sm:sr-only")}>
              {libraries.find((library) => library.id === active)?.label}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TopBarSearch
              inputRef={desktopInput}
              placeholder={placeholder}
              query={query}
              onQueryChange={onQueryChange}
            />
            <SponsorLink />
            <ModeSwitcher />
            <SiteSettings />
          </div>
        </header>
        {children}
      </div>

      {/* Phone drawer. Always mounted so it can animate both ways; inert when closed. */}
      <div className="md:hidden" inert={!drawer}>
        <div
          aria-hidden
          onClick={() => setDrawer(false)}
          className={cn(
            "bg-foreground/20 fixed inset-0 z-50 transition-opacity duration-250 ease-out-strong motion-reduce:transition-none",
            drawer ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            "bg-background shadow-elevated fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-250 ease-out-strong motion-reduce:transition-none",
            drawer ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="absolute top-3 right-3"
          >
            <X aria-hidden className="size-5" />
          </Button>
          <RailBody
            {...shared}
            inputRef={drawerInput}
            showFooter={false}
            onNavigate={() => setDrawer(false)}
          />
        </aside>
      </div>
    </div>
  );
};
