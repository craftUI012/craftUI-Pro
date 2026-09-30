"use client";

import { Menu, SearchIcon } from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/logo";
import type { RailMode } from "@/components/new-hero-section/browse/browse-rail";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { useIsMac } from "@/hooks/use-is-mac";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export interface LibraryTab {
  id: LibraryId;
  label: string;
  searchPlaceholder: string;
}

// Site pages beside the CTAs. Also listed in the phone drawer, where the top
// bar has no room for them.
export const SITE_NAV = [
  { href: ROUTES.PRICING, label: "Pricing" },
  { href: ROUTES.BLOG, label: "Blog" },
] as const;

// The primary CTA.
const PRIMARY_CTA = { href: ROUTES.DOCS_INSTALLATION, label: "Get started" };

// Same type as the rail's menu rows (MENU_BUTTON_CLS in docs-sidebar.tsx:
// 0.8rem · 500), so the top bar's links read like the sidebar's.
const RAIL_ROW_TYPE = "text-[0.8rem] font-medium";

// "Sign in" for visitors, "Dashboard" once signed in. The session loads on
// the client, so the page itself stays static. Until it's known, it shows
// "Sign in", the more common case, so nothing shifts for most visitors.
export const useAccountLink = () => {
  const { data } = useSession();
  return data?.user
    ? { href: ROUTES.DASHBOARD, label: "Dashboard" }
    : { href: ROUTES.LOGIN, label: "Sign in" };
};

// Search field styled like the site header's docs search button (h-8,
// bg-surface, ⌘K hint), with TYPE.cardLabel text like the drawer's search.
// It's a real input: it filters the grid (browse) or the docs menu (docs) as
// you type, Enter opens the first docs match, and Escape clears it.
// Desktop only; on phones the drawer has its own.
const BrowseSearch = ({
  inputRef,
  onQueryChange,
  onSubmit,
  placeholder,
  query,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  placeholder: string;
  query: string;
}) => {
  const isMac = useIsMac();

  return (
    <search className="hidden md:flex">
      <label className="bg-surface dark:bg-card text-surface-foreground focus-within:ring-ring/50 relative flex h-8 w-56 items-center gap-2 rounded-md pr-2 pl-2.5 transition-shadow duration-150 ease-out focus-within:ring-[3px] lg:w-64 xl:w-72">
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
            } else if (event.key === "Enter") {
              onSubmit();
            }
          }}
          className={cn(
            TYPE.cardLabel,
            "text-foreground placeholder:text-surface-foreground/60 min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
          )}
        />
        {/* The hint hides once there's text, so it never covers the query. */}
        <span aria-hidden className={cn("flex gap-1", query && "hidden")}>
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd className="aspect-square">K</Kbd>
        </span>
      </label>
    </search>
  );
};

// Client component, the slim bar over the content column. Search sits on the
// left. The right holds the site navigation and the CTAs: Pricing and Blog as
// quiet ghost links in the rail's row type, a hairline, then Sign in (or Dashboard) and the primary
// "Get started". The theme toggle, settings and Sponsor live in the rail's
// footer (browse-rail.tsx).
//
// On phones: the menu button, the logo and the active library's name on the
// left, and only the primary CTA on the right. Pricing, Blog and Sign in move
// into the drawer.
export const BrowseTopBar = ({
  active,
  drawerOpen,
  inputRef,
  libraries,
  mode,
  onMenuOpen,
  onQueryChange,
  onSubmitSearch,
  placeholder,
  query,
}: {
  active: LibraryId;
  drawerOpen: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  libraries: LibraryTab[];
  mode: RailMode;
  onMenuOpen: () => void;
  onQueryChange: (query: string) => void;
  onSubmitSearch: () => void;
  placeholder: string;
  query: string;
}) => {
  const library = libraries.find((item) => item.id === active);
  const account = useAccountLink();

  return (
    <header className="bg-background/90 sticky top-0 z-40 flex h-(--header-height) items-center gap-2 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          sound="click"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="browse-rail-drawer"
          onClick={onMenuOpen}
        >
          <Menu aria-hidden className="size-5" />
        </Button>
        <LogoMark className="size-5" />
        <span className={cn(TYPE.cardHeader, "max-sm:sr-only")}>
          {mode === "docs" ? "Docs" : library?.label}
        </span>
      </div>

      <BrowseSearch
        inputRef={inputRef}
        placeholder={placeholder}
        query={query}
        onQueryChange={onQueryChange}
        onSubmit={onSubmitSearch}
      />

      <div className="ml-auto flex items-center gap-1">
        <nav aria-label="Site" className="hidden items-center gap-0.5 md:flex">
          {SITE_NAV.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="sm"
              sound="click"
              className={RAIL_ROW_TYPE}
            >
              <Link href={item.href} transitionTypes={["nav-forward"]}>
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
        <span aria-hidden className="bg-border mx-2 hidden h-4 w-px md:block" />
        <Button
          asChild
          variant="ghost"
          size="sm"
          sound="click"
          className={cn(RAIL_ROW_TYPE, "hidden md:inline-flex")}
        >
          <Link href={account.href} transitionTypes={["nav-forward"]}>
            {account.label}
          </Link>
        </Button>
        <Button asChild size="sm" sound="click" className="ml-1">
          <Link href={PRIMARY_CTA.href} transitionTypes={["nav-forward"]}>
            {PRIMARY_CTA.label}
          </Link>
        </Button>
      </div>
    </header>
  );
};
