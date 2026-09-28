"use client";

import { Blocks, Component, LayoutTemplate, SearchIcon, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { LogoMark } from "@/components/logo";
import { ModeSwitcher } from "@/components/mode-switcher";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { SponsorLink } from "@/components/sponsor-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { TYPE } from "@/constants/typography";
import { useIsMac } from "@/hooks/use-is-mac";
import { cn } from "@/lib/utils";

import { JumpList, useCommandK, useJumpResults } from "./shared";
import type { NavVariantProps } from "./shared";

const LIBRARY_ICONS: Record<LibraryId, typeof Component> = {
  blocks: Blocks,
  components: Component,
  templates: LayoutTemplate,
};

// DOCK: axis = placement. Navigation leaves the top of the page entirely. A
// floating dock sits bottom-centre, where thumbs reach on phones. The top
// keeps only a quiet brand line, so the index starts right away. Library
// buttons stack an icon over a label; the active one gets a lit pill that
// slides between them. Search is a spotlight dialog: ⌘K, / or the dock button
// opens it, it filters the grid behind it live, and it offers jump-to results.
export const DockNav = ({
  active,
  children,
  libraries,
  onActiveChange,
  onQueryChange,
  query,
  searchItems,
}: NavVariantProps) => {
  const [spotlight, setSpotlight] = useState(false);
  const isMac = useIsMac();
  const jump = useJumpResults(searchItems, query);
  const activeIndex = Math.max(
    0,
    libraries.findIndex((library) => library.id === active)
  );
  const placeholder = libraries[activeIndex]?.searchPlaceholder ?? "Search…";

  useCommandK(useCallback(() => setSpotlight(true), []));

  return (
    <>
      <header className="container flex h-14 items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="size-5" />
          <span className={TYPE.cardHeader}>craftUI Pro</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <SponsorLink />
          <ModeSwitcher />
        </div>
      </header>

      {/* Room for the dock so the last row of cards clears it. */}
      <div className="pb-24">{children}</div>

      <nav
        aria-label="Library"
        className="bg-background/85 shadow-floating animate-in fade-in slide-in-from-bottom-4 fill-mode-both ease-out-strong fixed bottom-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5 backdrop-blur-md duration-300 motion-reduce:animate-none"
      >
        <div className="relative grid grid-cols-3">
          <span
            aria-hidden
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
            className="bg-accent absolute inset-y-0 left-0 w-1/3 rounded-xl transition-transform duration-250 ease-out-strong motion-reduce:transition-none"
          />
          {libraries.map((library) => {
            const Icon = LIBRARY_ICONS[library.id];
            const selected = library.id === active;
            return (
              <button
                key={library.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onActiveChange(library.id)}
                className={cn(
                  "focus-visible:ring-ring/50 relative flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-[color,scale] duration-150 ease-out outline-none focus-visible:ring-[3px] active:scale-[0.96] motion-reduce:active:scale-100",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span className={TYPE.cardCaption}>{library.label}</span>
              </button>
            );
          })}
        </div>
        <span aria-hidden className="bg-border mx-1 h-8 w-px" />
        <button
          type="button"
          onClick={() => setSpotlight(true)}
          className={cn(
            "focus-visible:ring-ring/50 hover:text-foreground relative flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-[color,scale] duration-150 ease-out outline-none focus-visible:ring-[3px] active:scale-[0.96] motion-reduce:active:scale-100",
            query ? "text-brand-text" : "text-muted-foreground"
          )}
        >
          <SearchIcon aria-hidden className="size-5" />
          <span className={TYPE.cardCaption}>
            {query ? "Filtered" : "Search"}
          </span>
        </button>
        {/* While a filter is on, a clear button pops in so the grid can be
            reset without reopening the spotlight. */}
        {query && (
          <button
            type="button"
            aria-label={`Clear search “${query}”`}
            onClick={() => onQueryChange("")}
            className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 animate-in fade-in zoom-in-90 flex size-8 items-center justify-center rounded-full transition-colors duration-150 ease-out-strong outline-none focus-visible:ring-[3px] motion-reduce:animate-none"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </nav>

      <Dialog open={spotlight} onOpenChange={setSpotlight} sounds>
        <DialogContent
          showCloseButton={false}
          className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Filters the grid as you type. Arrow keys and Enter jump to a result.
          </DialogDescription>
          <label className="border-border/60 flex h-12 items-center gap-3 border-b px-4">
            <SearchIcon
              aria-hidden
              className="text-muted-foreground size-4 shrink-0"
            />
            <span className="sr-only">{placeholder}</span>
            <input
              autoFocus
              type="search"
              value={query}
              placeholder={placeholder}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                jump.onKeyDown(event);
                // Enter either jumps (with results) or keeps the filter and
                // shows the grid; either way the spotlight closes.
                if (event.key === "Enter") {
                  setSpotlight(false);
                }
              }}
              className={cn(
                TYPE.cardBody,
                "placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
              )}
            />
            <Kbd aria-hidden>esc</Kbd>
          </label>
          <JumpList
            id="dock-jump"
            query={query}
            results={jump.results}
            highlight={jump.highlight}
            onHighlight={jump.setHighlight}
            onPick={() => setSpotlight(false)}
          />
          {!query.trim() && (
            <p
              className={cn(
                TYPE.cardCaption,
                "text-muted-foreground px-4 py-5"
              )}
            >
              Type to filter {libraries[activeIndex]?.label.toLowerCase()}, or
              jump straight to any item. Open this anytime with{" "}
              {isMac ? "⌘" : "Ctrl"} K.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
