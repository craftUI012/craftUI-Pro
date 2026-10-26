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
import { BrowseFiltersStoreProvider } from "@/components/new-hero-section/browse/browse-filters";
import type { BrowseSelections } from "@/components/new-hero-section/browse/browse-filters";
// Rail and drawer are commented out below (full-width navbar for now).
// import {
//   BrowseRail,
//   BrowseRailDrawer,
// } from "@/components/new-hero-section/browse/browse-rail";
import { filterDocsMenu } from "@/components/new-hero-section/browse/browse-rail";
import type {
  RailData,
  RailMode,
} from "@/components/new-hero-section/browse/browse-rail";
import { BrowseTopBar } from "@/components/new-hero-section/browse/browse-top-bar";
import type {
  LibraryTab,
  NavLink,
} from "@/components/new-hero-section/browse/browse-top-bar";
import {
  browseSearch,
  parseBrowseSearch,
} from "@/components/new-hero-section/browse/browse-url";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { Tabs } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { trackEvent } from "@/lib/events";

// How long the search box must sit still before a search is reported.
const SEARCH_SETTLE_MS = 1000;

// Matches Tailwind's `md`, where the navbar's inline search replaces the
// phone search row.
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

// What the shell is around comes from the URL: the browse page (/), the docs
// (anything under ROUTES.DOCS), or any other site page (pricing, sign-in,
// dashboard, the admin pages), which gets the navbar and nothing else.
type ShellMode = RailMode | "page";
const modeOf = (pathname: string): ShellMode => {
  if (pathname === ROUTES.HOME) {
    return "browse";
  }
  // Not a bare prefix check: /docs-admin isn't the docs.
  if (pathname === ROUTES.DOCS || pathname.startsWith(`${ROUTES.DOCS}/`)) {
    return "docs";
  }
  return "page";
};

// The library a docs page belongs to (/docs/<library>/...), so its navbar
// tab shows as active while reading. Other docs pages select no tab.
const libraryOfDocsPath = (pathname: string, libraries: LibraryTab[]) =>
  libraries.find(
    (library) =>
      pathname === `${ROUTES.DOCS}/${library.id}` ||
      pathname.startsWith(`${ROUTES.DOCS}/${library.id}/`)
  )?.id ?? "";

// Client shell, rendered by app/(home)/layout.tsx and app/(app)/layout.tsx,
// so every page has the same navbar. Because it lives in the layout, the
// navbar stays mounted when the route changes between the browse page and
// the docs pages.
//
// It owns the navigation state: the active library, the search query (which
// filters the grid in browse and the docs menu in docs) and whether the
// phone search row is open. `children` is the route's content, placed under
// the navbar.
//
// The whole shell is one shadcn <Tabs>: the navbar holds the TabsList (one
// trigger per library) and the browse page's panels are its TabsContent
// (browse-panels.tsx), so the triggers and panels are wired together
// (roving focus, arrow keys, aria-controls). On a docs page there are no
// panels; picking a tab goes back to the browse page on that library.
//
// The left rail (and its phone drawer) is commented out for now, in favour
// of the full-width navbar. Uncomment the rail pieces below to bring it back.
export const BrowseShell = ({
  children,
  defaultLibrary,
  devLinks = [],
  libraries,
  railData,
}: {
  children: React.ReactNode;
  // The library the browse page opens on (the first one with items).
  defaultLibrary?: LibraryId;
  // Development-only links for the navbar (new-home.tsx decides).
  devLinks?: NavLink[];
  libraries: LibraryTab[];
  railData: RailData;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const mode = modeOf(pathname);
  const [active, setActive] = useState<LibraryId>(
    defaultLibrary ?? libraries[0]?.id ?? "components"
  );
  const [query, setQuery] = useState("");

  // A search is reported once typing settles, not per keystroke: what people
  // look for, and in which library.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      return;
    }
    const timer = window.setTimeout(() => {
      trackEvent({
        name: "search_performed",
        properties: { library: active, query: term },
      });
    }, SEARCH_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [active, query]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selections, setSelections] = useState<BrowseSelections>({});
  const firstLibrary = defaultLibrary ?? libraries[0]?.id ?? "templates";

  // The browse page's tab and filters live in its URL (browse-url.ts). When
  // the browse page shows (first load, or back from a docs page), adopt what
  // the URL asks for; from then on, mirror the state into the URL with
  // replaceState (no new history entry per click). The page is prerendered
  // with the default view, so a shared link applies its filters on hydration.
  const [urlSynced, setUrlSynced] = useState(false);
  useEffect(() => {
    if (mode !== "browse") {
      setUrlSynced(false);
      return;
    }
    const parsed = parseBrowseSearch(
      window.location.search,
      libraries,
      firstLibrary
    );
    if (parsed) {
      setActive(parsed.library);
      setSelections((current) => ({
        ...current,
        [parsed.library]: parsed.selection,
      }));
    }
    setUrlSynced(true);
  }, [mode, libraries, firstLibrary]);
  useEffect(() => {
    if (!urlSynced || mode !== "browse") {
      return;
    }
    const search = browseSearch(
      window.location.search,
      active,
      selections[active] ?? {},
      libraries,
      firstLibrary
    );
    if (search !== window.location.search) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${search}${window.location.hash}`
      );
    }
  }, [urlSynced, mode, active, selections, libraries, firstLibrary]);
  // Rail only (commented out with it): the next rail switch is instant when
  // it comes from the keyboard (search + Enter).
  // const [drawerOpen, setDrawerOpen] = useState(false);
  // const [instant, setInstant] = useState(false);
  // useEffect(() => {
  //   const onPointerDown = () => setInstant(false);
  //   document.addEventListener("pointerdown", onPointerDown);
  //   return () => document.removeEventListener("pointerdown", onPointerDown);
  // }, []);
  const topBarInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);

  // A query typed in one view means nothing in the other, so switching views
  // starts with an empty search.
  const [lastMode, setLastMode] = useState(mode);
  if (mode !== lastMode) {
    setLastMode(mode);
    setQuery("");
  }

  // Off the browse page there's no grid to filter, so the search finds docs
  // pages (every item has one).
  const searchesDocs = mode !== "browse";
  const placeholder = searchesDocs
    ? "Search docs…"
    : (libraries.find((library) => library.id === active)?.searchPlaceholder ??
      "Search…");

  // Desktop focuses the navbar search; phones open the search row and focus
  // it once it's on screen.
  const openSearch = useCallback(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      topBarInput.current?.focus();
      return;
    }
    setSearchOpen(true);
    requestAnimationFrame(() => phoneInput.current?.focus());
  }, []);
  useSearchShortcut(openSearch);

  // Browse: the tab is the active library. Docs: the library of the page
  // being read, if any. Other pages: none. Picking a tab from docs or another
  // page goes back to browse on that library. The library goes in the URL
  // because another page's layout has its own shell, so this state doesn't
  // carry over.
  const tabByMode: Record<ShellMode, string> = {
    browse: active,
    docs: libraryOfDocsPath(pathname, libraries),
    page: "",
  };
  const tab = tabByMode[mode];
  const onTabChange = (value: string) => {
    setActive(value as LibraryId);
    if (mode !== "browse") {
      router.push(
        `${ROUTES.HOME}${browseSearch("", value as LibraryId, {}, libraries, firstLibrary)}`
      );
    }
  };

  // Off the browse page, Enter in the search opens the first matching docs
  // page, then clears the search so the full docs menu is back while reading.
  const onSubmitSearch = () => {
    if (!searchesDocs) {
      return;
    }
    const [first] = filterDocsMenu(railData.docs, query);
    if (first) {
      setSearchOpen(false);
      setQuery("");
      router.push(first.href);
    }
  };

  // Rail only (commented out with it).
  // const rail = {
  //   active,
  //   instant,
  //   libraries,
  //   mode,
  //   onActiveChange: setActive,
  //   pathname,
  //   query,
  //   railData,
  // };

  return (
    <BrowseLibraryContext value={active}>
      <BrowseQueryContext value={query}>
        <BrowseFiltersStoreProvider
          selections={selections}
          setSelections={setSelections}
        >
          <Tabs
            value={tab}
            onValueChange={onTabChange}
            className="min-h-svh gap-0"
          >
            {/* <BrowseRail {...rail} /> */}

            {/* A column, so a site page's main can grow and keep its
                footer at the bottom of a short page. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <BrowseTopBar
                devLinks={devLinks}
                inputRef={topBarInput}
                libraries={libraries}
                phoneInputRef={phoneInput}
                placeholder={placeholder}
                query={query}
                searchOpen={searchOpen}
                onQueryChange={setQuery}
                onSearchOpenChange={setSearchOpen}
                onSubmitSearch={onSubmitSearch}
              />
              {children}
            </div>

            {/* <BrowseRailDrawer
            {...rail}
            inputRef={drawerInput}
            open={drawerOpen}
            placeholder={placeholder}
            onOpenChange={setDrawerOpen}
            onQueryChange={setQuery}
            onSubmitSearch={onSubmitSearch}
          /> */}
          </Tabs>
        </BrowseFiltersStoreProvider>
      </BrowseQueryContext>
    </BrowseLibraryContext>
  );
};
