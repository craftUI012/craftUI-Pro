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
import {
  AnimatePresence,
  LayoutGroup,
  LazyMotion,
  MotionConfig,
  m,
  useReducedMotion,
} from "motion/react";
import type { Transition, Variants } from "motion/react";
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
// browse-shell.tsx); switching crossfades between them (see RailMenus).

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
// switches to the docs menu rather than leaving for /docs.
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

// ─── Motion ────────────────────────────────────────────────────────────────
//
// Vercel-style menu switch, following the animation guidelines:
// - the menus crossfade in place with a short sideways shift (12px), not a
//   full-width slide: small travel, so it reads as smooth, not as a page;
// - a true crossfade: both menus start at the same moment with the same
//   duration (240ms) and curve (a calm decelerate), so their opacities always
//   add up to 1 and the rail never goes blank mid-switch (staggered or
//   unequal fades leave a moment where neither is visible). Forward in from
//   the right, back in from the left. Only the leaving menu blurs (3px), so
//   the arriving one is sharp and readable at once. The middle content
//   doesn't animate (it swaps in place), so the rail is the only thing
//   moving;
// - the whole menu moves together; no row stagger, so every row is clickable
//   the moment it lands;
// - AnimatePresence popLayout takes the leaving menu out of the layout, so
//   the scroll area only ever measures the menu that's arriving;
// - keyboard-driven switches (search + Enter) are instant, and reduced motion
//   turns it all off.

// A calm decelerate: Vercel's Geist `--ease-out`, cubic-bezier(0, 0, .2, 1)
// (read from vercel.com's CSS). Gentler than ease-out-quint, which does
// most of its movement at once and read as snappy for a menu swap.
const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1];
// One duration for both sides of the crossfade (paired elements share
// timing), and no delay on the arriving menu.
const SWITCH_S = 0.24;
const SHIFT_PX = 8;

// 1 going into docs (deeper, arrives from the right), -1 coming back.
type Direction = 1 | -1;

const menuVariants: Variants = {
  center: {
    filter: "blur(0px)",
    opacity: 1,
    transition: { duration: SWITCH_S, ease: EASE_OUT },
    x: 0,
  },
  // The arriving menu starts on the side it's coming from, unblurred.
  enter: (direction: Direction) => ({
    filter: "blur(0px)",
    opacity: 0,
    x: SHIFT_PX * direction,
  }),
  // The leaving menu drifts the other way. `custom` comes from
  // AnimatePresence, so a menu that's already exiting still gets the new
  // direction.
  exit: (direction: Direction) => ({
    filter: "blur(3px)",
    opacity: 0,
    transition: { duration: SWITCH_S, ease: EASE_OUT },
    x: -SHIFT_PX * direction,
  }),
};

// The shared active pill: something already on screen moving to a new row,
// so a spring with no bounce (interruptible if you click again mid-move).
const PILL_TRANSITION: Transition = {
  bounce: 0,
  duration: 0.25,
  type: "spring",
};

// domMax carries layout animations (the pill's layoutId). Loaded lazily, the
// same way as the components strip.
const loadMotionFeatures = async () => {
  const { domMax } = await import("motion/react");
  return domMax;
};

// ─── Rows and groups ───────────────────────────────────────────────────────

// One docs-style group: a muted label over a menu.
const RailGroup = ({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) => (
  <SidebarGroup className={className}>
    {label && (
      <SidebarGroupLabel className="text-muted-foreground border-l border-transparent font-medium">
        {label}
      </SidebarGroupLabel>
    )}
    <SidebarGroupContent>
      <SidebarMenu>{children}</SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

// The active row's fill is one shared element that glides between rows
// (layoutId, one per menu so it never flies across a switch). The buttons'
// own active fill is turned off so the pill is the only one. `isolate` keeps
// the pill (z-index -1) inside the row, above the rail's background.
const ACTIVE_ROW_CLS =
  "isolate data-[active=true]:border-transparent data-[active=true]:bg-transparent";

const ActivePill = ({ mode }: { mode: RailMode }) => (
  <m.span
    aria-hidden
    layoutId={`rail-active-${mode}`}
    // A numeric radius lets Motion undo the scale distortion while the pill
    // changes width. 8 = rounded-md (--radius 0.625rem − 2px).
    style={{ borderRadius: 8 }}
    className="bg-accent border-accent absolute inset-0 -z-10 border"
  />
);

// A link row, exactly like a docs sidebar page link. The stretched span
// widens the hit area to the full menu width while the visible pill hugs
// the text (w-fit in MENU_BUTTON_CLS).
const RailLink = ({
  href,
  icon: Icon,
  isActive = false,
  label,
  mode,
  navBack = false,
  onNavigate,
}: {
  href: string;
  icon: typeof Component;
  isActive?: boolean;
  label: string;
  mode: RailMode;
  navBack?: boolean;
  onNavigate?: () => void;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      className={cn(MENU_BUTTON_CLS, ACTIVE_ROW_CLS)}
      isActive={isActive}
    >
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        transitionTypes={[navBack ? "nav-back" : "nav-forward"]}
        onClick={onNavigate}
      >
        {isActive && <ActivePill mode={mode} />}
        <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
        <Icon aria-hidden />
        <span>{label}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

interface MenuProps {
  active: LibraryId;
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
  libraries,
  onActiveChange,
  onNavigate,
  railData,
  showSiteNav,
}: MenuProps) => {
  const account = useAccountLink();

  return (
    <>
      {/* pt-6.5 puts "Library" on the same line as the index's first label,
          "Categories" (same 12px · 500 style), given the brand row above
          (pt-2.5 + h-9) and the browse page's md:pt-6 (browse-panels.tsx).
          Change one side, change the other. */}
      <RailGroup label="Library" className="pt-6.5">
        {libraries.map((library) => {
          const Icon = LIBRARY_ICONS[library.id];
          const selected = library.id === active;
          return (
            <SidebarMenuItem key={library.id}>
              <SidebarMenuButton
                className={cn(MENU_BUTTON_CLS, ACTIVE_ROW_CLS)}
                isActive={selected}
                aria-pressed={selected}
                onClick={() => {
                  onActiveChange(library.id);
                  onNavigate?.();
                }}
              >
                {selected && <ActivePill mode="browse" />}
                <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                <Icon aria-hidden />
                <span>{library.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </RailGroup>

      <RailGroup label="Resources">
        {RESOURCE_LINKS.map((link) => (
          <RailLink
            key={link.href}
            {...link}
            mode="browse"
            onNavigate={onNavigate}
          />
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
              mode="browse"
              onNavigate={onNavigate}
            />
          ))}
        </RailGroup>
      )}

      {/* Changelog is a button, not a menu row: the one call to action in
          the list. px-1.5 + the button's own padding put its icon on the icon
          line; gap-2 puts its text on the label line. */}
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
              mode="browse"
              onNavigate={onNavigate}
            />
          ))}
          <RailLink
            {...account}
            icon={account.href === ROUTES.DASHBOARD ? LayoutDashboard : LogIn}
            mode="browse"
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
const DocsMenuView = ({ onNavigate, pathname, query, railData }: MenuProps) => {
  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const sections = railData.docs.sections.filter((link) => matches(link.name));
  const groups = railData.docs.groups
    .map((group) => ({
      ...group,
      pages: group.pages.filter((page) => matches(page.name)),
    }))
    .filter((group) => group.pages.length > 0);

  return (
    <>
      <RailGroup className="pt-6.5 pb-0">
        <RailLink
          href={ROUTES.HOME_NEW}
          icon={ArrowLeft}
          label="Library"
          mode="docs"
          navBack
          onNavigate={onNavigate}
        />
      </RailGroup>

      {sections.length > 0 && (
        <RailGroup label="Sections">
          {sections.map((link) => (
            <RailLink
              key={link.href}
              href={link.href}
              icon={DOCS_SECTION_ICONS[link.icon]}
              label={link.name}
              mode="docs"
              isActive={
                link.match === "exact"
                  ? pathname === link.href
                  : pathname.startsWith(link.href)
              }
              onNavigate={onNavigate}
            />
          ))}
        </RailGroup>
      )}

      {groups.map((group) => (
        <RailGroup key={group.id} label={group.label}>
          {group.pages.map((page) => (
            <RailLink
              key={page.href}
              href={page.href}
              icon={group.kind === "components" ? Component : FileText}
              label={page.name}
              mode="docs"
              isActive={pathname === page.href}
              onNavigate={onNavigate}
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

// ─── Menu switch ───────────────────────────────────────────────────────────

// Direction of the latest switch, updated during render (React's "store
// info from previous renders" pattern) so the switch that caused it already
// has it. The first render doesn't animate (initial={false}), so its value
// doesn't matter.
const useDirection = (mode: RailMode): Direction => {
  const [direction, setDirection] = useState<Direction>(1);
  const [previous, setPrevious] = useState(mode);
  if (previous !== mode) {
    setPrevious(mode);
    setDirection(mode === "docs" ? 1 : -1);
  }
  return direction;
};

// The menu in view, swapped by AnimatePresence when the mode changes. When
// focus was in the menu that's leaving (you activated one of its rows), it
// moves to the new menu's first row, so keyboard users aren't dropped at the
// top of the page. It has to be checked against the leaving menu, not just
// "is focus lost": with popLayout that menu stays mounted for its 240ms exit,
// so the focused row is still connected when the switch happens.
const RailMenus = ({
  instant,
  mode,
  ...props
}: MenuProps & { instant: boolean; mode: RailMode }) => {
  const reduce = useReducedMotion() ?? false;
  const direction = useDirection(mode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const View = mode === "docs" ? DocsMenuView : BrowseMenu;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const pane = scrollRef.current;
    const incoming = pane?.querySelector<HTMLElement>(`[data-menu="${mode}"]`);
    const focused = document.activeElement;
    const inLeavingMenu =
      focused instanceof HTMLElement &&
      Boolean(pane?.contains(focused)) &&
      !incoming?.contains(focused);
    if (incoming && (inLeavingMenu || focused === document.body)) {
      incoming
        .querySelector<HTMLElement>("a, button")
        ?.focus({ preventScroll: true });
    }
  }, [mode]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Top fade, as in the docs sidebar: rows scroll under it. */}
      <div className="from-background via-background/80 to-background/50 pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b blur-xs" />
      <div
        ref={scrollRef}
        className="no-scrollbar relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        {/* Default transition for everything inside: the pill's glide.
            Instant when the switch came from the keyboard (search + Enter):
            keyboard actions don't animate. The menu variants carry their own
            timing. */}
        <MotionConfig transition={instant ? { duration: 0 } : PILL_TRANSITION}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <m.div
              key={mode}
              data-menu={mode}
              custom={direction}
              variants={menuVariants}
              initial={instant || reduce ? false : "enter"}
              animate="center"
              exit={instant || reduce ? undefined : "exit"}
              // Each menu arrives scrolled to the top.
              onAnimationStart={() => scrollRef.current?.scrollTo({ top: 0 })}
              className="mx-auto flex w-(--sidebar-menu-width) flex-col"
            >
              <View {...props} />
            </m.div>
          </AnimatePresence>
        </MotionConfig>
      </div>
      {/* Bottom fade, as in the docs sidebar. */}
      <div className="from-background via-background/80 to-background/50 pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t blur-xs" />
    </div>
  );
};

// ─── Rail body ─────────────────────────────────────────────────────────────

interface RailProps {
  active: LibraryId;
  // Skip the switch animation (set when the switch came from the keyboard).
  instant: boolean;
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
//   ─ menu ───────────────────────
//   Browse or Docs menu   scrolls
//   ──────────────────────────────
//   Sponsor · theme · settings   pinned
const RailBody = ({
  layoutScope,
  onNavigate,
  search,
  showSiteNav = false,
  wide = false,
  ...props
}: RailProps & {
  // Namespaces the active pill's layoutId. The drawer is always mounted (only
  // hidden on desktop), so without separate scopes the desktop pill and the
  // drawer's pill share one layoutId and Motion crossfades the visible one
  // out.
  layoutScope: "rail" | "drawer";
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
    <LazyMotion features={loadMotionFeatures}>
      <MotionConfig reducedMotion="user">
        <LayoutGroup id={layoutScope}>
          <div
            className={cn(
              "flex h-full flex-col",
              wide
                ? "[--sidebar-menu-width:--spacing(60)]"
                : "[--sidebar-menu-width:--spacing(48)]"
            )}
          >
            {/* Brand (and the drawer's search) sit in the menu's centred
              column. pt-2.5 + the h-9 row centres "craftUI Pro" on the top
              bar's middle line (header height 3.5rem → 1.75rem). */}
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

            <RailMenus
              {...props}
              showSiteNav={showSiteNav}
              onNavigate={onNavigate}
            />

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
        </LayoutGroup>
      </MotionConfig>
    </LazyMotion>
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
    <RailBody {...props} layoutScope="rail" />
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
          layoutScope="drawer"
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
