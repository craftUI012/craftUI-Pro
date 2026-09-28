"use client";

import {
  Blocks,
  BookOpen,
  Component,
  LayoutDashboard,
  LayoutTemplate,
  LogIn,
  Newspaper,
  Rocket,
  SearchIcon,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { LogoMark } from "@/components/logo";
import { ModeSwitcher } from "@/components/mode-switcher";
import {
  SITE_NAV,
  useAccountLink,
} from "@/components/new-hero-section/browse/browse-top-bar";
import type { LibraryTab } from "@/components/new-hero-section/browse/browse-top-bar";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { SiteSettings } from "@/components/site-settings";
import { SponsorLink } from "@/components/sponsor-link";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

const LIBRARY_ICONS: Record<LibraryId, typeof Component> = {
  blocks: Blocks,
  components: Component,
  templates: LayoutTemplate,
};

// Pricing lives in the top bar's site nav now (SITE_NAV), so it's not
// repeated here.
const RESOURCE_LINKS = [
  { href: ROUTES.DOCS, icon: BookOpen, label: "Docs" },
  { href: ROUTES.DOCS_INSTALLATION, icon: Rocket, label: "Installation" },
] as const;

// Icons for the drawer's copy of the top bar's site nav.
const SITE_NAV_ICONS: Record<(typeof SITE_NAV)[number]["href"], typeof Tag> = {
  [ROUTES.BLOG]: Newspaper,
  [ROUTES.PRICING]: Tag,
};

// Height of one row (h-8), which the sliding highlight steps by.
const ROW_REM = 2;

// Alignment grid shared by every row in the rail: icon | text | count. The
// fixed 1rem icon column puts every icon on one vertical line and every label
// on the next. The brand row and the drawer search use the same left inset
// (group padding + row padding = px-3.5) so they line up too.
const ROW_GRID = "grid grid-cols-[1rem_1fr_auto] items-center gap-x-2.5";
const ROW = cn(
  ROW_GRID,
  "focus-visible:ring-ring/50 relative h-8 rounded-md px-2.5 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-[3px] motion-reduce:transition-none"
);

// Type: two sizes and two weights in the whole rail.
//   group labels  cardDescription              0.875rem · 400
//   items         cardCaption                  0.75rem  · 400
//   selected item cardCaption + font-medium    0.75rem  · 500
// Labels and items share a weight and differ only in size; the selected item
// steps up one weight (Tailwind's --font-weight-medium, since no TYPE role is
// 0.75rem at 500). The brand name is cardLabel (0.875rem · 500), which reuses
// the same two sizes and weights.
//
// Selected colour: the strong brand blue in light mode (8.8:1 on white). In
// dark mode that blue is only 2.2:1 on the dark rail, so the text and icon
// switch to foreground (near-white). The left bar follows the text colour.

interface RailProps {
  active: LibraryId;
  libraries: LibraryTab[];
  onActiveChange: (id: LibraryId) => void;
}

// One subsection: its label, then its rows. The label starts on the icon
// column, so it reads as the heading for the rows under it. The tint is on
// the whole sidebar (see BrowseRail), not per group.
const RailGroup = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <nav aria-label={label} className="flex flex-col p-1">
    <p
      className={cn(
        TYPE.cardDescription,
        "text-muted-foreground px-2.5 pt-2 pb-1"
      )}
    >
      {label}
    </p>
    {children}
  </nav>
);

// What the sidebar and the phone drawer both show: the brand, the libraries,
// the resource links, and a footer with Sponsor, the theme toggle and
// settings. The search and the site nav + CTAs live in the top bar
// (browse-top-bar.tsx). The top bar has no room for them on phones, so the
// drawer adds its own search and a Site group (Pricing, Blog, Sign in).
const RailBody = ({
  active,
  libraries,
  onActiveChange,
  onNavigate,
  search,
  showSiteNav = false,
}: RailProps & {
  // Called after a pick, so the drawer can close.
  onNavigate?: () => void;
  search?: React.ReactNode;
  showSiteNav?: boolean;
}) => {
  const account = useAccountLink();
  const rowLink = cn(
    ROW,
    TYPE.cardCaption,
    "text-muted-foreground hover:text-foreground hover:bg-background/60"
  );
  const activeIndex = Math.max(
    0,
    libraries.findIndex((library) => library.id === active)
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link
        href={ROUTES.HOME}
        transitionTypes={["nav-back"]}
        className={cn(
          ROW_GRID,
          TYPE.cardLabel,
          "text-foreground focus-visible:ring-ring/50 h-9 rounded-md px-3.5 outline-none focus-visible:ring-[3px]"
        )}
      >
        <LogoMark className="size-4" />
        <span>{SITE.NAME}</span>
      </Link>

      {search}

      <RailGroup label="Library">
        <div className="relative flex flex-col">
          {/* The selected row's card slides between rows (transform only),
              with a bar in the text colour on its left edge. */}
          <span
            aria-hidden
            style={{ transform: `translateY(${activeIndex * ROW_REM}rem)` }}
            className="bg-background shadow-border absolute inset-x-0 top-0 h-8 rounded-md transition-transform duration-250 ease-out-strong motion-reduce:transition-none"
          >
            <span className="bg-brand dark:bg-foreground absolute top-2 bottom-2 left-0 w-0.5 rounded-full" />
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
                  ROW,
                  selected
                    ? cn(
                        TYPE.cardCaption,
                        "text-brand dark:text-foreground font-medium"
                      )
                    : cn(
                        TYPE.cardCaption,
                        "text-muted-foreground hover:text-foreground"
                      )
                )}
              >
                <Icon aria-hidden className="size-4" />
                <span>{library.label}</span>
                {/* Counts stay regular weight and muted, even when selected. */}
                <span
                  className={cn(
                    TYPE.cardCaption,
                    "text-muted-foreground tabular-nums"
                  )}
                >
                  {library.count}
                </span>
              </button>
            );
          })}
        </div>
      </RailGroup>

      <RailGroup label="Resources">
        {RESOURCE_LINKS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            transitionTypes={["nav-forward"]}
            onClick={onNavigate}
            className={rowLink}
          >
            <Icon aria-hidden className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
      </RailGroup>

      {showSiteNav && (
        <RailGroup label="Site">
          {SITE_NAV.map(({ href, label }) => {
            const Icon = SITE_NAV_ICONS[href];
            return (
              <Link
                key={href}
                href={href}
                transitionTypes={["nav-forward"]}
                onClick={onNavigate}
                className={rowLink}
              >
                <Icon aria-hidden className="size-4" />
                <span>{label}</span>
              </Link>
            );
          })}
          <Link
            href={account.href}
            transitionTypes={["nav-forward"]}
            onClick={onNavigate}
            className={rowLink}
          >
            {account.href === ROUTES.DASHBOARD ? (
              <LayoutDashboard aria-hidden className="size-4" />
            ) : (
              <LogIn aria-hidden className="size-4" />
            )}
            <span>{account.label}</span>
          </Link>
        </RailGroup>
      )}

      {/* Footer: pinned to the bottom. px-0.5 lines the Sponsor heart up with
          the icon column (the rows' 0.875rem inset = 0.125rem + the Sponsor
          button's own 0.75rem padding). */}
      <div className="mt-auto flex items-center gap-1 px-0.5">
        <SponsorLink />
        <div className="ml-auto flex items-center gap-1">
          <ModeSwitcher />
          <SiteSettings />
        </div>
      </div>
    </div>
  );
};

// Desktop sidebar: sticky, full height, beside the content column.
export const BrowseRail = (props: RailProps) => (
  <aside className="border-border/60 bg-surface animate-in fade-in slide-in-from-left-2 fill-mode-both ease-out-strong sticky top-0 hidden h-svh w-64 shrink-0 border-r duration-300 md:block motion-reduce:animate-none">
    <RailBody {...props} />
  </aside>
);

// Phone drawer: the same rail, sliding in from the left over a dimmed page
// (250ms ease-out-strong, transform and opacity only). It stays mounted so it
// can animate both ways, and it's inert while closed. Escape, the scrim, the
// close button or picking a library closes it.
export const BrowseRailDrawer = ({
  inputRef,
  onOpenChange,
  onQueryChange,
  open,
  placeholder,
  query,
  ...props
}: RailProps & {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  open: boolean;
  placeholder: string;
  query: string;
}) => {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <div className="md:hidden" inert={!open}>
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
        className={cn(
          "bg-foreground/20 fixed inset-0 z-50 transition-opacity duration-250 ease-out-strong motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        id="browse-rail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          "bg-surface shadow-elevated fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-250 ease-out-strong motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3"
        >
          <X aria-hidden className="size-5" />
        </Button>
        <RailBody
          {...props}
          showSiteNav
          onNavigate={() => onOpenChange(false)}
          search={
            <label
              className={cn(
                ROW_GRID,
                "bg-background shadow-border focus-within:ring-ring/50 h-9 rounded-lg px-3.5 transition-shadow duration-150 focus-within:ring-[3px]"
              )}
            >
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
                  }
                }}
                className={cn(
                  TYPE.cardCaption,
                  "placeholder:text-muted-foreground min-w-0 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
                )}
              />
              <Kbd aria-hidden className={cn(query && "hidden")}>
                /
              </Kbd>
            </label>
          }
        />
      </aside>
    </div>
  );
};
