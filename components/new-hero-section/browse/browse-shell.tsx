"use client";

import { usePathname, useRouter } from "next/navigation";
import type * as React from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { BrowseQueryContext } from "@/components/new-hero-section/browse/browse-context";
import {
  BrowseRail,
  BrowseRailDrawer,
  filterDocsMenu,
} from "@/components/new-hero-section/browse/browse-rail";
import type {
  RailData,
  RailMode,
} from "@/components/new-hero-section/browse/browse-rail";
import { BrowseTopBar } from "@/components/new-hero-section/browse/browse-top-bar";
import type { LibraryTab } from "@/components/new-hero-section/browse/browse-top-bar";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { ROUTES } from "@/constants/routes";

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

// The active library, for the browse page's panels (browse-panels.tsx).
const BrowseLibraryContext = createContext<LibraryId>("components");
export const useActiveLibrary = () => use(BrowseLibraryContext);

// Which menu the rail shows comes from the URL: anything under
// ROUTES.HOME_NEW_DOCS is the docs view, everything else is browse.
const modeOf = (pathname: string): RailMode =>
  pathname.startsWith(ROUTES.HOME_NEW_DOCS) ? "docs" : "browse";

// Client shell, rendered by app/homepage-new/layout.tsx. Because it lives in
// the layout, the rail and top bar stay mounted when the route changes
// between the browse page and the docs pages, so the rail can animate from
// one menu to the other instead of the whole page reloading.
//
// It owns the navigation state: the active library, the search query (which
// filters the grid in browse and the docs menu in docs) and whether the phone
// drawer is open. `children` is the route's content, placed under the top
// bar.
export const BrowseShell = ({
  children,
  libraries,
  railData,
}: {
  children: React.ReactNode;
  libraries: LibraryTab[];
  railData: RailData;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const mode = modeOf(pathname);
  const [active, setActive] = useState<LibraryId>(
    libraries[0]?.id ?? "components"
  );
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const topBarInput = useRef<HTMLInputElement>(null);
  const drawerInput = useRef<HTMLInputElement>(null);

  // A query typed in one view means nothing in the other, so switching views
  // starts with an empty search.
  const [lastMode, setLastMode] = useState(mode);
  if (mode !== lastMode) {
    setLastMode(mode);
    setQuery("");
  }

  const placeholder =
    mode === "docs"
      ? "Search docs…"
      : (libraries.find((library) => library.id === active)
          ?.searchPlaceholder ?? "Search…");

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

  // In docs, Enter in the search opens the first matching page, then clears
  // the search so the full docs menu is back while reading.
  const onSubmitSearch = () => {
    if (mode !== "docs") {
      return;
    }
    const [first] = filterDocsMenu(railData.docs, query);
    if (first) {
      setDrawerOpen(false);
      setQuery("");
      router.push(first.href);
    }
  };

  const rail = {
    active,
    libraries,
    mode,
    onActiveChange: setActive,
    pathname,
    query,
    railData,
  };

  return (
    <BrowseLibraryContext value={active}>
      <BrowseQueryContext value={query}>
        <div className="flex min-h-svh">
          <BrowseRail {...rail} />

          <div className="min-w-0 flex-1">
            <BrowseTopBar
              active={active}
              drawerOpen={drawerOpen}
              inputRef={topBarInput}
              libraries={libraries}
              mode={mode}
              placeholder={placeholder}
              query={query}
              onMenuOpen={() => setDrawerOpen(true)}
              onQueryChange={setQuery}
              onSubmitSearch={onSubmitSearch}
            />
            {children}
          </div>

          <BrowseRailDrawer
            {...rail}
            inputRef={drawerInput}
            open={drawerOpen}
            placeholder={placeholder}
            onOpenChange={setDrawerOpen}
            onQueryChange={setQuery}
            onSubmitSearch={onSubmitSearch}
          />
        </div>
      </BrowseQueryContext>
    </BrowseLibraryContext>
  );
};
