"use client";

import {
  Blocks,
  BookOpen,
  Component,
  History,
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

import { MENU_BUTTON_CLS } from "@/components/docs-sidebar";
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
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// The rail uses the same design as the /docs sidebar
// (components/docs-sidebar.tsx): the shadcn Sidebar primitives,
// MENU_BUTTON_CLS rows (text only, the selected one filled with `accent`),
// muted group labels, no background (a fading hairline on the right instead),
// and soft fades where the list scrolls under its edges.
//
// Plus an icon on every row, on one alignment grid. The menu buttons' own
// padding (p-2), their fixed 1rem icon slot ([&>svg]:size-4) and gap-2 put
// every icon on one vertical line and every label on the next. The group
// labels (px-2) start on the icon line. The brand, the Changelog button, the
// drawer's search and the Sponsor heart are inset to the same two lines.
// MENU_BUTTON_CLS gives rows a 1px transparent border, so those extras carry
// one too (border-transparent) instead of a hard-coded 1px nudge.

// View data for the rail, worked out on the server (see new-home.tsx).
export interface RailData {
  // The newest items across every library.
  // WHEN WE SHIP REAL DATA: item.meta.publishedAt.
  whatsNew: { key: string; name: string; href: string; library: LibraryId }[];
}

// Pricing lives in the top bar's site nav (SITE_NAV), so it's not repeated
// here.
const RESOURCE_LINKS = [
  { href: ROUTES.DOCS, icon: BookOpen, label: "Docs" },
  { href: ROUTES.DOCS_INSTALLATION, icon: Rocket, label: "Installation" },
] as const;

const LIBRARY_ICONS: Record<LibraryId, typeof Component> = {
  blocks: Blocks,
  components: Component,
  templates: LayoutTemplate,
};

const LibraryIcon = ({ id }: { id: LibraryId }) => {
  const Icon = LIBRARY_ICONS[id];
  return <Icon aria-hidden />;
};

// Icons for the drawer's copy of the top bar's site nav.
const SITE_NAV_ICONS: Record<(typeof SITE_NAV)[number]["href"], typeof Tag> = {
  [ROUTES.BLOG]: Newspaper,
  [ROUTES.PRICING]: Tag,
};

interface RailProps {
  active: LibraryId;
  libraries: LibraryTab[];
  onActiveChange: (id: LibraryId) => void;
  railData: RailData;
}

// One docs-style group: a muted label over a menu.
const RailGroup = ({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) => (
  <SidebarGroup className={className}>
    <SidebarGroupLabel className="text-muted-foreground border-l border-transparent font-medium">
      {label}
    </SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>{children}</SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

// A link row, exactly like a docs sidebar page link. The stretched span
// widens the hit area to the full menu width while the visible pill hugs
// the text (w-fit in MENU_BUTTON_CLS).
const RailLink = ({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: typeof Component;
  label: string;
  onNavigate?: () => void;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild className={MENU_BUTTON_CLS}>
      <Link href={href} transitionTypes={["nav-forward"]} onClick={onNavigate}>
        <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
        <Icon aria-hidden />
        <span>{label}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

// Everything the sidebar and the phone drawer both show:
//
//   brand                 pinned
//   [search]              drawer only
//   ─ scrolls ───────────────────
//   Library               the three libraries; the selected one is active
//   Resources             Docs, Installation
//   What's new            the newest items
//   [Changelog]           a button, not a row
//   Site                  drawer only (the top bar's nav on phones)
//   ──────────────────────────────
//   Sponsor · theme · settings   pinned
const RailBody = ({
  active,
  libraries,
  onActiveChange,
  onNavigate,
  railData,
  search,
  showSiteNav = false,
  wide = false,
}: RailProps & {
  // Called after a pick, so the drawer can close.
  onNavigate?: () => void;
  search?: React.ReactNode;
  showSiteNav?: boolean;
  // The drawer is wider than the desktop rail, so its column widens with it
  // (15rem instead of the docs sidebar's 12rem) and the search fits.
  wide?: boolean;
}) => {
  const account = useAccountLink();

  return (
    // SidebarProvider supplies the context the Sidebar* primitives read.
    // `contents` keeps its wrapper div out of the layout.
    <SidebarProvider className="contents">
      <div
        className={cn(
          "flex h-full flex-col",
          wide
            ? "[--sidebar-menu-width:--spacing(60)]"
            : "[--sidebar-menu-width:--spacing(48)]"
        )}
      >
        {/* Brand (and the drawer's search) sit in the menu's centred column.
            pt-2.5 + the h-9 row centres "craftUI Pro" on the top bar's
            middle line (header height 3.5rem → 1.75rem). */}
        <div className="mx-auto flex w-(--sidebar-menu-width) shrink-0 flex-col gap-3 px-2 pt-2.5">
          <Link
            href={ROUTES.HOME}
            transitionTypes={["nav-back"]}
            className={cn(
              TYPE.cardLabel,
              "text-foreground focus-visible:ring-ring/50 flex h-9 items-center gap-2 rounded-md border border-transparent px-2 outline-none focus-visible:ring-[3px]"
            )}
          >
            <LogoMark className="size-4" />
            {SITE.NAME}
          </Link>
          {search}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Top fade, as in the docs sidebar: rows scroll under it. */}
          <div className="from-background via-background/80 to-background/50 pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b blur-xs" />
          <div className="no-scrollbar mx-auto flex w-(--sidebar-menu-width) min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
            {/* pt-6.5 puts "Library" on the same line as the index's first
                label, "Categories" (same 12px · 500 style), given the brand
                row above (pt-2.5 + h-9) and the content column's md:pt-6
                (browse-shell.tsx). Change one side, change the other. */}
            <RailGroup label="Library" className="pt-6.5">
              {libraries.map((library) => (
                <SidebarMenuItem key={library.id}>
                  <SidebarMenuButton
                    className={MENU_BUTTON_CLS}
                    isActive={library.id === active}
                    aria-pressed={library.id === active}
                    onClick={() => {
                      onActiveChange(library.id);
                      onNavigate?.();
                    }}
                  >
                    <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                    <LibraryIcon id={library.id} />
                    <span>{library.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </RailGroup>

            <RailGroup label="Resources">
              {RESOURCE_LINKS.map((link) => (
                <RailLink key={link.href} {...link} onNavigate={onNavigate} />
              ))}
            </RailGroup>

            {railData.whatsNew.length > 0 && (
              <RailGroup label="What's new">
                {railData.whatsNew.map((item) => (
                  <RailLink
                    key={item.key}
                    href={item.href}
                    icon={LIBRARY_ICONS[item.library]}
                    label={item.name}
                    onNavigate={onNavigate}
                  />
                ))}
              </RailGroup>
            )}

            {/* Changelog is a button, not a menu row: the one call to action
                in the list. px-1.5 + the button's own padding put its icon on
                the icon line; gap-2 puts its text on the label line. */}
            <div className="px-1.5 pt-2 pb-4">
              <Button
                asChild
                variant="outline"
                size="sm"
                sound="click"
                data-icon="inline-start"
                className="gap-2 border border-transparent"
              >
                <Link
                  href={ROUTES.CHANGELOG}
                  transitionTypes={["nav-forward"]}
                  onClick={onNavigate}
                >
                  <History aria-hidden />
                  Changelog
                </Link>
              </Button>
            </div>

            {showSiteNav && (
              <RailGroup label="Site">
                {SITE_NAV.map((link) => (
                  <RailLink
                    key={link.href}
                    {...link}
                    icon={SITE_NAV_ICONS[link.href]}
                    onNavigate={onNavigate}
                  />
                ))}
                <RailLink
                  {...account}
                  icon={
                    account.href === ROUTES.DASHBOARD ? LayoutDashboard : LogIn
                  }
                  onNavigate={onNavigate}
                />
              </RailGroup>
            )}
          </div>
          {/* Bottom fade, as in the docs sidebar. */}
          <div className="from-background via-background/80 to-background/50 pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t blur-xs" />
        </div>

        {/* Footer: pinned to the bottom, in the menu's column. px-1 plus the
            Sponsor button's own padding puts the heart on the icon line.
            Below sm the Sponsor link is an icon-only 2rem square (heart
            centred, not padded), so the inset grows to px-2. */}
        <div className="mx-auto flex w-(--sidebar-menu-width) shrink-0 items-center gap-1 border-l border-transparent px-1 pb-4 max-sm:px-2">
          <SponsorLink />
          <div className="ml-auto flex items-center gap-1">
            <ModeSwitcher />
            <SiteSettings />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

// Desktop sidebar: sticky, full height, beside the content column. No fill;
// the right edge is the docs sidebar's fading hairline.
export const BrowseRail = (props: RailProps) => (
  <aside className="bg-background animate-in fade-in slide-in-from-left-2 fill-mode-both ease-out-strong text-sidebar-foreground sticky top-0 hidden h-svh w-64 shrink-0 duration-300 md:block motion-reduce:animate-none">
    <div
      aria-hidden
      className="via-border absolute top-12 right-0 bottom-0 w-px bg-linear-to-b from-transparent to-transparent"
    />
    <RailBody {...props} />
  </aside>
);

// Phone drawer: the same rail, sliding in from the left over a dimmed page
// (250ms ease-out-strong, transform and opacity only). It stays mounted so it
// can animate both ways, and it's inert while closed. Escape, the scrim, the
// close button or picking anything closes it.
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
          "bg-background text-sidebar-foreground shadow-elevated fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-250 ease-out-strong motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          onClick={() => onOpenChange(false)}
          className="absolute top-2.5 right-3 z-20"
        >
          <X aria-hidden className="size-5" />
        </Button>
        <RailBody
          {...props}
          showSiteNav
          wide
          onNavigate={() => onOpenChange(false)}
          search={
            <label className="bg-surface dark:bg-card text-surface-foreground focus-within:ring-ring/50 flex h-8 items-center gap-2 rounded-md border border-transparent px-2 transition-shadow duration-150 focus-within:ring-[3px]">
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
                  }
                }}
                className={cn(
                  TYPE.cardLabel,
                  "text-foreground placeholder:text-surface-foreground/60 min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
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
