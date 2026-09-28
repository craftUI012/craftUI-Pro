"use client";

import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BrowseQueryContext } from "@/components/new-hero-section/browse/browse-context";
import {
  BrowseRail,
  BrowseRailDrawer,
} from "@/components/new-hero-section/browse/browse-rail";
import type { RailData } from "@/components/new-hero-section/browse/browse-rail";
import { BrowseTopBar } from "@/components/new-hero-section/browse/browse-top-bar";
import type { LibraryTab } from "@/components/new-hero-section/browse/browse-top-bar";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";

// Matches Tailwind's `md`, where the rail replaces the drawer.
const DESKTOP_QUERY = "(min-width: 48rem)";

// ⌘K / Ctrl+K anywhere, or "/" when not typing.
const useSearchShortcut = (onTrigger: () => void) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";
      const commandK =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (commandK || (event.key === "/" && !typing)) {
        event.preventDefault();
        onTrigger();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
};

// Client shell. It owns the page's navigation state: the active library, the
// search query and whether the phone drawer is open.
// Layout: the rail on the left (desktop), then the content column with the
// top bar over the panels.
// On phones the rail becomes a drawer opened from the top bar.
//
// `panels` holds one index + grid per library, server-rendered. Every panel
// is in the HTML; the inactive ones are `hidden`, so their lazy images don't
// load until the library is picked.
export const BrowseShell = ({
  libraries,
  panels,
  railData,
}: {
  libraries: LibraryTab[];
  panels: Record<LibraryId, React.ReactNode>;
  railData: RailData;
}) => {
  const [active, setActive] = useState<LibraryId>(
    libraries[0]?.id ?? "components"
  );
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const topBarInput = useRef<HTMLInputElement>(null);
  const drawerInput = useRef<HTMLInputElement>(null);
  const placeholder =
    libraries.find((library) => library.id === active)?.searchPlaceholder ??
    "Search…";

  // Desktop focuses the top-bar search; phones open the drawer and focus its
  // search once it's on screen.
  useSearchShortcut(
    useCallback(() => {
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        topBarInput.current?.focus();
        return;
      }
      setDrawerOpen(true);
      requestAnimationFrame(() => drawerInput.current?.focus());
    }, [])
  );

  const rail = { active, libraries, onActiveChange: setActive, railData };

  return (
    <BrowseQueryContext value={query}>
      <div className="flex min-h-svh">
        <BrowseRail {...rail} />

        <div className="min-w-0 flex-1">
          <BrowseTopBar
            active={active}
            drawerOpen={drawerOpen}
            inputRef={topBarInput}
            libraries={libraries}
            query={query}
            onMenuOpen={() => setDrawerOpen(true)}
            onQueryChange={setQuery}
          />
          {/* md:pt-6 is paired with the rail's Library group padding
              (browse-rail.tsx) so "Library" and "Categories" share a
              baseline. Change one side, change the other. */}
          <main className="container flex flex-col gap-16 pt-8 pb-24 md:gap-20 md:pt-6">
            {libraries.map((library) => (
              <div
                key={library.id}
                hidden={library.id !== active}
                className="flex flex-col gap-16 md:gap-24"
              >
                {panels[library.id]}
              </div>
            ))}
          </main>
        </div>

        <BrowseRailDrawer
          {...rail}
          inputRef={drawerInput}
          open={drawerOpen}
          placeholder={placeholder}
          query={query}
          onQueryChange={setQuery}
          onOpenChange={setDrawerOpen}
        />
      </div>
    </BrowseQueryContext>
  );
};
