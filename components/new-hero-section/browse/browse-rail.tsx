"use client";

import {
  ArrowLeft,
  Blocks,
  BookOpen,
  Component,
  FileText,
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
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { MENU_BUTTON_CLS } from "@/components/docs-sidebar";
import { LogoMark } from "@/components/logo";
import { ModeSwitcher } from "@/components/mode-switcher";
import {
  SITE_NAV,
  useAccountLink,
} from "@/components/new-hero-section/browse/browse-top-bar";
import type { LibraryTab } from "@/components/new-hero-section/browse/browse-top-bar";
import type {
  DocsMenu,
  DocsMenuLink,
  DocsSectionIcon,
} from "@/components/new-hero-section/data/docs-menu";
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
// MENU_BUTTON_CLS rows (the selected one filled with `accent`), muted group
// labels, no background (a fading hairline on the right instead), and soft
// fades where the list scrolls under its edges.
//
// Plus an icon on every row, on one alignment grid. The menu buttons' own
// padding (p-2), their fixed 1rem icon slot ([&>svg]:size-4) and gap-2 put
// every icon on one vertical line and every label on the next. The group
// labels (px-2) start on the icon line. The brand, the Changelog button, the
// drawer's search and the Sponsor heart are inset to the same two lines.
// MENU_BUTTON_CLS gives rows a 1px transparent border, so those extras carry
// one too (border-transparent) instead of a hard-coded 1px nudge.
//
// Two menus share the rail: Browse (libraries, resources, what's new) and
// Docs (the /docs sidebar's sections and pages). The URL picks one (see
// browse-shell.tsx); switching slides between them (see MenuTrack).

export type RailMode = "browse" | "docs";

// View data for the rail, worked out on the server (see new-home.tsx).
export interface RailData {
  docs: DocsMenu;
  // The newest items across every library.
  // WHEN WE SHIP REAL DATA: item.meta.publishedAt.
  whatsNew: { key: string; name: string; href: string; library: LibraryId }[];
}

// Every docs page whose name matches the query, in menu order. Used to filter
// the docs menu and, on Enter, to open the first match (browse-shell.tsx).
export const filterDocsMenu = (docs: DocsMenu, query: string) => {
  const q = query.trim().toLowerCase();
  const all: DocsMenuLink[] = [
    ...docs.sections,
    ...docs.groups.flatMap((group) => group.pages),
  ];
  return q ? all.filter((link) => link.name.toLowerCase().includes(q)) : all;
};

// The browse menu's Docs links open the docs inside this shell, so the rail
// flips to the docs menu rather than leaving for /docs.
const RESOURCE_LINKS = [
  { href: ROUTES.HOME_NEW_DOCS, icon: BookOpen, label: "Docs" },
  {
    href: `${ROUTES.HOME_NEW_DOCS}/installation`,
    icon: Rocket,
    label: "Installation",
  },
] as const;

const LIBRARY_ICONS: Record<LibraryId, typeof Component> = {
  blocks: Blocks,
  components: Component,
  templates: LayoutTemplate,
};

const DOCS_SECTION_ICONS: Record<DocsSectionIcon, typeof Component> = {
  components: Component,
  installation: Rocket,
  introduction: BookOpen,
  llms: FileText,
};

// Icons for the drawer's copy of the top bar's site nav.
const SITE_NAV_ICONS: Record<(typeof SITE_NAV)[number]["href"], typeof Tag> = {
  [ROUTES.BLOG]: Newspaper,
  [ROUTES.PRICING]: Tag,
};

// ─── Switch animation ──────────────────────────────────────────────────────

// Track slide, and each incoming row's fade + 0.75rem slide. Rows start a
// little after the track so they arrive as it settles, one step apart.
const TRACK_MS = 300;
const ROW_START_MS = 90;
const ROW_STAGGER_MS = 24;
// Past this many rows the rest arrive together, so a long menu never waits.
const MAX_STAGGER_ROWS = 10;

// How the incoming menu's rows enter: from the right when going into docs
// (deeper), from the left when coming back. `null` until the first switch,
// so a page that loads straight into either menu doesn't animate.
type Entrance = { direction: "left" | "right"; generation: number } | null;

const useMenuEntrance = (mode: RailMode): Entrance => {
  const [entrance, setEntrance] = useState<Entrance>(null);
  const previous = useRef(mode);
  useEffect(() => {
    if (previous.current === mode) {
      return;
    }
    previous.current = mode;
    setEntrance((current) => ({
      direction: mode === "docs" ? "right" : "left",
      generation: (current?.generation ?? 0) + 1,
    }));
  }, [mode]);
  return entrance;
};

// Props every row takes so it can join the entrance.
interface RowMotion {
  // Position in its menu, for the stagger.
  order: number;
  entrance: Entrance;
}

const rowMotion = ({ entrance, order }: RowMotion) =>
  entrance
    ? {
        className: cn(
          "animate-in fade-in fill-mode-both ease-out-strong duration-300 motion-reduce:animate-none",
          entrance.direction === "right"
            ? "slide-in-from-right-3"
            : "slide-in-from-left-3"
        ),
        style: {
          animationDelay: `${ROW_START_MS + Math.min(order, MAX_STAGGER_ROWS) * ROW_STAGGER_MS}ms`,
        },
      }
    : { className: undefined, style: undefined };

// ─── Rows and groups ───────────────────────────────────────────────────────

// One docs-style group: a muted label over a menu.
const RailGroup = ({
  children,
  className,
  label,
  motion,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  motion?: RowMotion;
}) => {
  const { className: enter, style } = motion
    ? rowMotion(motion)
    : { className: undefined, style: undefined };
  return (
    <SidebarGroup className={className}>
      {label && (
        <SidebarGroupLabel
          style={style}
          className={cn(
            "text-muted-foreground border-l border-transparent font-medium",
            enter
          )}
        >
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

// A link row, exactly like a docs sidebar page link. The stretched span
// widens the hit area to the full menu width while the visible pill hugs
// the text (w-fit in MENU_BUTTON_CLS).
const RailLink = ({
  entrance,
  href,
  icon: Icon,
  isActive = false,
  label,
  navBack = false,
  onNavigate,
  order,
}: RowMotion & {
  href: string;
  icon: typeof Component;
  isActive?: boolean;
  label: string;
  navBack?: boolean;
  onNavigate?: () => void;
}) => {
  const { className, style } = rowMotion({ entrance, order });
  return (
    <SidebarMenuItem className={className} style={style}>
      <SidebarMenuButton
        asChild
        className={MENU_BUTTON_CLS}
        isActive={isActive}
      >
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
          transitionTypes={[navBack ? "nav-back" : "nav-forward"]}
          onClick={onNavigate}
        >
          <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
          <Icon aria-hidden />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

interface MenuProps {
  active: LibraryId;
  entrance: Entrance;
  libraries: LibraryTab[];
  onActiveChange: (id: LibraryId) => void;
  onNavigate?: () => void;
  pathname: string;
  query: string;
  railData: RailData;
  showSiteNav: boolean;
}

// ─── Browse menu ───────────────────────────────────────────────────────────

//   Library        the three libraries; the selected one is active
//   Resources      Docs, Installation (they open the docs menu)
//   What's new     the newest items
//   [Changelog]    a button, not a row
//   Site           drawer only (the top bar's nav on phones)
const BrowseMenu = ({
  active,
  entrance,
  libraries,
  onActiveChange,
  onNavigate,
  railData,
  showSiteNav,
}: MenuProps) => {
  const account = useAccountLink();
  // Running row count for the stagger, top to bottom: libraries, resources,
  // what's new, then the Changelog button.
  let order = 0;
  const next = () => {
    const current = order;
    order += 1;
    return { entrance, order: current };
  };
  const changelogOrder =
    // Library label + rows, Resources label + rows, What's new label + rows.
    1 +
    libraries.length +
    1 +
    RESOURCE_LINKS.length +
    (railData.whatsNew.length > 0 ? 1 + railData.whatsNew.length : 0);
  const changelogMotion = rowMotion({ entrance, order: changelogOrder });

  return (
    <>
      {/* pt-6.5 puts "Library" on the same line as the index's first label,
          "Categories" (same 12px · 500 style), given the brand row above
          (pt-2.5 + h-9) and the browse page's md:pt-6 (browse-panels.tsx).
          Change one side, change the other. */}
      <RailGroup label="Library" className="pt-6.5" motion={next()}>
        {libraries.map((library) => {
          const Icon = LIBRARY_ICONS[library.id];
          const { className, style } = rowMotion(next());
          return (
            <SidebarMenuItem
              key={library.id}
              className={className}
              style={style}
            >
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
                <Icon aria-hidden />
                <span>{library.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </RailGroup>

      <RailGroup label="Resources" motion={next()}>
        {RESOURCE_LINKS.map((link) => (
          <RailLink
            key={link.href}
            {...link}
            {...next()}
            onNavigate={onNavigate}
          />
        ))}
      </RailGroup>

      {railData.whatsNew.length > 0 && (
        <RailGroup label="What's new" motion={next()}>
          {railData.whatsNew.map((item) => (
            <RailLink
              key={item.key}
              href={item.href}
              icon={LIBRARY_ICONS[item.library]}
              label={item.name}
              onNavigate={onNavigate}
              {...next()}
            />
          ))}
        </RailGroup>
      )}

      {/* Changelog is a button, not a menu row: the one call to action in
          the list. px-1.5 + the button's own padding put its icon on the icon
          line; gap-2 puts its text on the label line. */}
      <div
        style={changelogMotion.style}
        className={cn("px-1.5 pt-2 pb-4", changelogMotion.className)}
      >
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
        <RailGroup label="Site" motion={next()}>
          {SITE_NAV.map((link) => (
            <RailLink
              key={link.href}
              {...link}
              {...next()}
              icon={SITE_NAV_ICONS[link.href]}
              onNavigate={onNavigate}
            />
          ))}
          <RailLink
            {...account}
            {...next()}
            icon={account.href === ROUTES.DASHBOARD ? LayoutDashboard : LogIn}
            onNavigate={onNavigate}
          />
        </RailGroup>
      )}
    </>
  );
};

// ─── Docs menu ─────────────────────────────────────────────────────────────

//   ← Library      back to the browse menu (and the browse page)
//   Sections       Introduction, Installation, Components, llms.txt
//   <folders>      the docs folders' pages, as in the /docs sidebar
//
// The top-bar search filters it by page name while you're in docs.
const DocsMenuView = ({
  entrance,
  onNavigate,
  pathname,
  query,
  railData,
}: MenuProps) => {
  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const sections = railData.docs.sections.filter((link) => matches(link.name));
  const groups = railData.docs.groups
    .map((group) => ({
      ...group,
      pages: group.pages.filter((page) => matches(page.name)),
    }))
    .filter((group) => group.pages.length > 0);

  let order = 0;
  const next = () => {
    const current = order;
    order += 1;
    return { entrance, order: current };
  };

  return (
    <>
      <RailGroup className="pt-6.5 pb-0">
        <RailLink
          href={ROUTES.HOME_NEW}
          icon={ArrowLeft}
          label="Library"
          navBack
          onNavigate={onNavigate}
          {...next()}
        />
      </RailGroup>

      {sections.length > 0 && (
        <RailGroup label="Sections" motion={next()}>
          {sections.map((link) => (
            <RailLink
              key={link.href}
              href={link.href}
              icon={DOCS_SECTION_ICONS[link.icon]}
              label={link.name}
              isActive={
                link.match === "exact"
                  ? pathname === link.href
                  : pathname.startsWith(link.href)
              }
              onNavigate={onNavigate}
              {...next()}
            />
          ))}
        </RailGroup>
      )}

      {groups.map((group) => (
        <RailGroup key={group.id} label={group.label} motion={next()}>
          {group.pages.map((page) => (
            <RailLink
              key={page.href}
              href={page.href}
              icon={group.kind === "components" ? Component : FileText}
              label={page.name}
              isActive={pathname === page.href}
              onNavigate={onNavigate}
              {...next()}
            />
          ))}
        </RailGroup>
      ))}

      {q && sections.length === 0 && groups.length === 0 && (
        <p
          role="status"
          className={cn(
            TYPE.cardCaption,
            "text-muted-foreground border-l border-transparent px-4 py-2"
          )}
        >
          No docs pages match “{query.trim()}”.
        </p>
      )}
    </>
  );
};

// ─── Track ─────────────────────────────────────────────────────────────────

// Both menus side by side in a 200%-wide track; the mode moves it by half
// (transform only, 300ms ease-out-strong). Each menu scrolls on its own. The
// hidden one is inert and faded, and its rows replay their entrance the next
// time it comes in (keyed by the entrance generation). Reduced motion keeps
// the switch instant.
const MenuTrack = ({
  mode,
  ...props
}: Omit<MenuProps, "entrance"> & { mode: RailMode }) => {
  const entrance = useMenuEntrance(mode);
  const panes: { id: RailMode; View: typeof BrowseMenu }[] = [
    { View: BrowseMenu, id: "browse" },
    { View: DocsMenuView, id: "docs" },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Top fade, as in the docs sidebar: rows scroll under it. */}
      <div className="from-background via-background/80 to-background/50 pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b blur-xs" />
      <div
        style={{
          transform: mode === "docs" ? "translateX(-50%)" : "translateX(0)",
          transitionDuration: `${TRACK_MS}ms`,
        }}
        className="ease-out-strong flex h-full w-[200%] transition-transform motion-reduce:transition-none"
      >
        {panes.map(({ View, id }) => {
          const shown = id === mode;
          return (
            <div
              key={id}
              inert={!shown}
              aria-hidden={!shown}
              className={cn(
                "no-scrollbar ease-out-strong h-full w-1/2 overflow-x-hidden overflow-y-auto overscroll-contain transition-opacity duration-200 motion-reduce:transition-none",
                shown ? "opacity-100" : "opacity-0"
              )}
            >
              <div
                // Replays the rows' entrance each time this menu comes in.
                key={shown ? (entrance?.generation ?? 0) : "idle"}
                className="mx-auto flex w-(--sidebar-menu-width) flex-col"
              >
                <View {...props} entrance={shown ? entrance : null} />
              </div>
            </div>
          );
        })}
      </div>
      {/* Bottom fade, as in the docs sidebar. */}
      <div className="from-background via-background/80 to-background/50 pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t blur-xs" />
    </div>
  );
};

// ─── Rail body ─────────────────────────────────────────────────────────────

interface RailProps {
  active: LibraryId;
  libraries: LibraryTab[];
  mode: RailMode;
  onActiveChange: (id: LibraryId) => void;
  pathname: string;
  query: string;
  railData: RailData;
}

// Everything the sidebar and the phone drawer both show:
//
//   brand                 pinned
//   [search]              drawer only
//   ─ menu track ─────────────────
//   Browse or Docs menu   scrolls
//   ──────────────────────────────
//   Sponsor · theme · settings   pinned
const RailBody = ({
  mode,
  onNavigate,
  search,
  showSiteNav = false,
  wide = false,
  ...props
}: RailProps & {
  // Called after a pick, so the drawer can close.
  onNavigate?: () => void;
  search?: React.ReactNode;
  showSiteNav?: boolean;
  // The drawer is wider than the desktop rail, so its column widens with it
  // (15rem instead of the docs sidebar's 12rem) and the search fits.
  wide?: boolean;
}) => (
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
          pt-2.5 + the h-9 row centres "craftUI Pro" on the top bar's middle
          line (header height 3.5rem → 1.75rem). */}
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

      <MenuTrack
        {...props}
        mode={mode}
        showSiteNav={showSiteNav}
        onNavigate={onNavigate}
      />

      {/* Footer: pinned to the bottom, in the menu's column. px-1 plus the
          Sponsor button's own padding puts the heart on the icon line. Below
          sm the Sponsor link is an icon-only 2rem square (heart centred, not
          padded), so the inset grows to px-2. */}
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
  onSubmitSearch,
  open,
  placeholder,
  ...props
}: RailProps & {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSubmitSearch: () => void;
  open: boolean;
  placeholder: string;
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

  const { query } = props;

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
                  } else if (event.key === "Enter") {
                    onSubmitSearch();
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
