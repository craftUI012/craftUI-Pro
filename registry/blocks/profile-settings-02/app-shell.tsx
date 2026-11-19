"use client";

import {
  Analytics01Icon,
  ArrowDown01Icon,
  DashboardSquare01Icon,
  Fire02Icon,
  FlashIcon,
  GitBranchIcon,
  HelpCircleIcon,
  LayoutTemplateIcon,
  Logout01Icon,
  Menu01Icon,
  Notification03Icon,
  PaintBoardIcon,
  Plug01Icon,
  PlusSignIcon,
  Settings02Icon,
  SidebarLeft01Icon,
  SparklesIcon,
  Tick02Icon,
  StarIcon,
  UnfoldMoreIcon,
  UserAdd01Icon,
  UserGroupIcon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence } from "motion/react";
import type * as React from "react";
import { useId, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { Reveal } from "./motion";
import { FLOAT, LIFT, PHOTO_INSET, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * APP SHELL: the app around the settings page, so the block shows the
 * full picture: a sidebar (brand, nav, recent runs, usage, account) and a
 * top bar (where you are, Ask AI, notifications).
 *
 *   lg and up   sidebar beside the page; its toggle folds it away (width
 *               15rem → 0, 200ms ease-in-out) and the top bar's brings it
 *               back. Folded, it's inert (out of the Tab order).
 *   below lg    the sidebar opens as a sheet from the menu button.
 *   groups      each heading folds its links open and closed (FoldGroup).
 *
 * Badges and run colours are the only colour; everything else is the
 * page's 4 type roles. No rules anywhere: the sidebar and top bar sit on
 * the background, the page on a muted tint, and the change of colour is
 * the edge (menus' separators are space, the sheet has no edge border).
 * ───────────────────────────────────────────────────────── */

/** One link in the app's sidebar. */
export interface ShellNavItem {
  /** Unique id; matched against `activeItem` to mark the current page. */
  id: string;
  /** Text in the sidebar, e.g. "Dashboard". */
  label: string;
  /** A Hugeicons icon from `@hugeicons/core-free-icons`. */
  icon: typeof DashboardSquare01Icon;
  /** Where the link goes. */
  href: string;
  /** A short count at the right, e.g. "28" or "35+". */
  badge?: string;
  /** The badge's colour: "info" (blue) or "success" (green). Defaults to "info". */
  badgeTone?: "info" | "success";
  /** Marks a busy or trending page with a small flame. */
  hot?: boolean;
}

/** A labelled group of sidebar links, e.g. "Workspace". */
export interface ShellNavGroup {
  /** Small heading above the group. */
  label: string;
  /** The links in the group, in order. */
  items: ShellNavItem[];
}

/** A recent run listed in the sidebar. */
export interface ShellRun {
  /** Unique id. */
  id: string;
  /** The run's name, e.g. "Lead scoring pipeline". */
  name: string;
  /** Where it opens. */
  href: string;
  /** Its icon's background colour, any CSS colour, e.g. "#F59E0B". */
  color: string;
  /** Whether it's starred. */
  starred?: boolean;
}

/** A workspace the person can switch to. */
export interface ShellWorkspace {
  /** Unique id. */
  id: string;
  /** Its name, e.g. "Globex". */
  name: string;
  /** Its logo, about 24px. Defaults to a monogram of `name`. */
  logo?: React.ReactNode;
}

/** The sidebar and top bar around the settings page. */
export interface AppShellSettings {
  /** Product name next to the logo, e.g. "Acme". */
  brandName: string;
  /** Your logo, about 24px. Defaults to a monogram of `brandName`. */
  logo?: React.ReactNode;
  /**
   * Workspaces in the brand menu at the top of the sidebar; the current
   * one is `brandName`. Leave out for a plain brand row.
   */
  workspaces?: ShellWorkspace[];
  /** Switches to another workspace. */
  onSwitchWorkspace?: (id: string) => void;
  /** Opens your invite flow. */
  onInvite?: () => void;
  /** Starts creating a workspace. */
  onNewWorkspace?: () => void;
  /** The sidebar's link groups. */
  groups: ShellNavGroup[];
  /** Id of the current sidebar link. */
  activeItem: string;
  /** Recent runs listed under the links; empty hides the list. */
  runs: ShellRun[];
  /** A usage meter above the account, e.g. 891 of 1000 runs. Leave out to hide. */
  usage?: { used: number; limit: number; note: string };
  /** The signed-in person. */
  user: { name: string; email: string; avatar: string | null };
  /** Unread notifications; above 0 puts a dot on the bell. */
  unread: number;
  /** Runs before a sidebar link is followed: route with your router here. */
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Opens your assistant. */
  onAskAi?: () => void;
  /** Opens the upgrade flow. */
  onUpgrade?: () => void;
  /** Signs the person out. */
  onSignOut?: () => void;
  /** Starts a new run. */
  onNewRun?: () => void;
}

export const DEMO_APP_SHELL: AppShellSettings = {
  activeItem: "settings",
  brandName: "Acme",
  groups: [
    {
      items: [
        {
          href: "#dashboard",
          icon: DashboardSquare01Icon,
          id: "dashboard",
          label: "Dashboard",
        },
        {
          badge: "28",
          href: "#library",
          icon: GitBranchIcon,
          id: "library",
          label: "Workflow library",
        },
        {
          hot: true,
          href: "#canvas",
          icon: WorkflowSquare03Icon,
          id: "canvas",
          label: "Workflow canvas",
        },
        {
          href: "#templates",
          icon: LayoutTemplateIcon,
          id: "templates",
          label: "Templates",
        },
        {
          href: "#analytics",
          icon: Analytics01Icon,
          id: "analytics",
          label: "Analytics",
        },
        {
          badge: "35+",
          badgeTone: "success",
          href: "#team",
          icon: UserGroupIcon,
          id: "team",
          label: "Team members",
        },
        {
          href: "#integrations",
          icon: Plug01Icon,
          id: "integrations",
          label: "Integrations",
        },
      ],
      label: "Workspace",
    },
    {
      items: [
        {
          href: "#settings",
          icon: Settings02Icon,
          id: "settings",
          label: "Settings",
        },
        {
          href: "#help",
          icon: HelpCircleIcon,
          id: "help",
          label: "Help & support",
        },
        {
          href: "#appearance",
          icon: PaintBoardIcon,
          id: "appearance",
          label: "Appearance",
        },
      ],
      label: "Profile",
    },
  ],
  runs: [
    {
      color: "#F43F5E",
      href: "#run-1",
      id: "run-1",
      name: "Email support router",
    },
    {
      color: "#F59E0B",
      href: "#run-2",
      id: "run-2",
      name: "Lead scoring pipeline",
      starred: true,
    },
    {
      color: "#06B6D4",
      href: "#run-3",
      id: "run-3",
      name: "Weekly report generator",
    },
    { color: "#F97316", href: "#run-4", id: "run-4", name: "HubSpot sync" },
  ],
  unread: 3,
  usage: { limit: 1000, note: "Upgrade for unlimited runs", used: 891 },
  user: {
    avatar: "/images/testimonials/sam-davies.jpg",
    email: "sam@acme.com",
    name: "Sam Davies",
  },
  workspaces: [
    { id: "acme", name: "Acme" },
    { id: "globex", name: "Globex" },
  ],
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

const NUMBER = new Intl.NumberFormat("en-US");

/* ─────────────────────────────────────────────────────────
 * SIDEBAR
 * ───────────────────────────────────────────────────────── */

const BADGE_TONE = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
} as const;

// A group heading that folds its links open and closed.
//   chevron   turns 90° in 150ms, ease-out (it answers a click)
//   links     fold by height on Reveal's tall curve (EASE_OUT_QUAD):
//             open 260ms, close 180ms. A 7-link group travels ~230px;
//             ease-in-out's slow start (1% in the first frame, then a
//             rush) read as two steps, the quad curve moves from frame
//             one and settles without a tail. The fade rides the same
//             curve, no delay, so links never squeeze.
//   reduced motion: a fade only. Clipped only while moving, so focus
//   rings show once it's open.
const FoldGroup = ({
  action,
  children,
  label,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) => {
  const [open, setOpen] = useState(true);
  const contentId = useId();
  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          onClick={() => setOpen((value) => !value)}
          // Label first, on the links' icon line; the chevron at the far
          // right, down when open, pointing right when folded.
          // The chevron sits in a 16px box, 6px from the edge: on the same
          // right edge and centre line as every icon in that column.
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex h-7 flex-1 items-center gap-2 rounded-md pr-1.5 pl-2 text-left text-xs outline-none focus-visible:ring-[3px]"
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="flex size-4 shrink-0 items-center justify-center">
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={1.75}
              className={cn(
                "size-3.5 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                !open && "-rotate-90"
              )}
            />
          </span>
        </button>
        {action}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <Reveal
            key="links"
            id={contentId}
            enter={0.26}
            exit={0.18}
            tall
            className="flex flex-col gap-0.5 pt-0.5"
          >
            {children}
          </Reveal>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const NavLink = ({
  current,
  item,
  onNavigate,
}: {
  current: boolean;
  item: ShellNavItem;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) => (
  <a
    href={item.href}
    aria-current={current ? "page" : undefined}
    onClick={onNavigate}
    className={cn(
      // Right padding 6px: badges and the flame end on the same edge as the
      // star, + and fold icons (16px glyphs centred in 28px buttons).
      "focus-visible:ring-ring/50 flex h-8 items-center gap-2.5 rounded-md pr-1.5 pl-2 text-sm outline-none focus-visible:ring-[3px]",
      current
        ? "bg-accent text-foreground"
        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
    )}
  >
    <HugeiconsIcon icon={item.icon} strokeWidth={1.75} className="size-4" />
    <span className="min-w-0 flex-1 truncate">{item.label}</span>
    {item.badge ? (
      <span
        className={cn(
          "rounded-full px-1.5 text-xs tabular-nums",
          BADGE_TONE[item.badgeTone ?? "info"]
        )}
      >
        {item.badge}
      </span>
    ) : null}
    {item.hot ? (
      <HugeiconsIcon
        icon={Fire02Icon}
        strokeWidth={1.75}
        className="size-4 text-orange-500"
        aria-label="Busy"
      />
    ) : null}
  </a>
);

const Runs = ({
  onNavigate,
  onNewRun,
  runs,
}: {
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onNewRun?: () => void;
  runs: ShellRun[];
}) => {
  const [starred, setStarred] = useState(
    () => new Set(runs.filter((run) => run.starred).map((run) => run.id))
  );
  return (
    <FoldGroup
      label="Workflow runs"
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="New run"
          onClick={onNewRun}
          // The star buttons' size, so it sits on their column.
          className="text-muted-foreground hover:text-foreground size-7"
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.75} />
        </Button>
      }
    >
      {runs.map((run) => {
        const isStarred = starred.has(run.id);
        return (
          <div key={run.id} className="group/run flex items-center">
            <a
              href={run.href}
              onClick={onNavigate}
              className="text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:ring-ring/50 flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-sm outline-none focus-visible:ring-[3px]"
            >
              <span
                aria-hidden
                className="flex size-4 shrink-0 items-center justify-center rounded-[0.3125rem] text-white"
                style={{ backgroundColor: run.color }}
              >
                <HugeiconsIcon
                  icon={WorkflowSquare03Icon}
                  strokeWidth={2}
                  className="size-2.5"
                />
              </span>
              <span className="truncate">{run.name}</span>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-pressed={isStarred}
              aria-label={`Star ${run.name}`}
              onClick={() =>
                setStarred((current) => {
                  const next = new Set(current);
                  if (next.has(run.id)) {
                    next.delete(run.id);
                  } else {
                    next.add(run.id);
                  }
                  return next;
                })
              }
              className={cn(
                "size-7 shrink-0",
                isStarred
                  ? "text-amber-500 hover:text-amber-500 [&_path]:fill-current"
                  : "text-muted-foreground/70 hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={StarIcon} strokeWidth={1.75} />
            </Button>
          </div>
        );
      })}
    </FoldGroup>
  );
};

const UsageCard = ({
  onUpgrade,
  usage,
}: {
  onUpgrade?: () => void;
  usage: NonNullable<AppShellSettings["usage"]>;
}) => {
  const share = Math.min(1, usage.used / usage.limit);
  return (
    <div className={cn(LIFT, "bg-card flex flex-col gap-2 rounded-xl p-3")}>
      <div className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
        <HugeiconsIcon
          icon={FlashIcon}
          strokeWidth={1.75}
          className="text-muted-foreground size-4"
        />
        {NUMBER.format(usage.used)}/{NUMBER.format(usage.limit)}
      </div>
      <div
        role="meter"
        aria-label="Runs used"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        className="bg-muted h-1 overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full",
            share >= 0.85 ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">{usage.note}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onUpgrade}
        className="w-full"
      >
        Upgrade
      </Button>
    </div>
  );
};

const Account = ({
  onSignOut,
  user,
}: {
  onSignOut?: () => void;
  user: AppShellSettings["user"];
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="hover:bg-accent/60 focus-visible:ring-ring/50 flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none focus-visible:ring-[3px]"
      >
        <Avatar className="relative size-8">
          {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {initialsOf(user.name)}
          </AvatarFallback>
          <span aria-hidden className={PHOTO_INSET} />
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {user.email}
          </span>
        </span>
        <HugeiconsIcon
          icon={UnfoldMoreIcon}
          strokeWidth={1.75}
          className="text-muted-foreground size-4"
        />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="top" className={cn(FLOAT, "w-56")}>
      <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
        Signed in as {user.email}
      </DropdownMenuLabel>
      <DropdownMenuSeparator className="bg-transparent" />
      <DropdownMenuItem onSelect={onSignOut}>
        <HugeiconsIcon icon={Logout01Icon} strokeWidth={1.75} />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const Monogram = ({ name }: { name: string }) => (
  <span
    aria-hidden
    className="bg-foreground text-background flex size-6 items-center justify-center rounded-md text-xs font-medium"
  >
    {initialsOf(name).slice(0, 1)}
  </span>
);

// Menus keep their separators (the role stays) but drawn as space, not a
// rule: <DropdownMenuSeparator className="bg-transparent" />.

// The brand row as a menu: switch workspace, invite people, start a new
// one. Without `workspaces` it stays a plain brand row. The demo switches
// the name shown here; pass `onSwitchWorkspace` to switch for real.
const WorkspaceSwitcher = ({ app }: { app: AppShellSettings }) => {
  const [current, setCurrent] = useState(app.brandName);
  const workspaces = app.workspaces ?? [];
  const active = workspaces.find((space) => space.name === current);
  const brand = (
    <>
      {active?.logo ?? app.logo ?? <Monogram name={current} />}
      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
        {current}
      </span>
    </>
  );
  if (workspaces.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">{brand}</div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Workspace: ${current}. Switch workspace`}
          className="hover:bg-accent/60 focus-visible:ring-ring/50 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1 outline-none focus-visible:ring-[3px]"
        >
          {brand}
          <HugeiconsIcon
            icon={UnfoldMoreIcon}
            strokeWidth={1.75}
            className="text-muted-foreground size-4 shrink-0"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn(FLOAT, "w-56")}>
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.map((space) => (
          <DropdownMenuItem
            key={space.id}
            onSelect={() => {
              setCurrent(space.name);
              app.onSwitchWorkspace?.(space.id);
            }}
          >
            {space.logo ?? <Monogram name={space.name} />}
            <span className="flex-1 truncate">{space.name}</span>
            {space.name === current ? (
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-transparent" />
        <DropdownMenuItem onSelect={app.onInvite}>
          <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={1.75} />
          Invite people
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={app.onNewWorkspace}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.75} />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SidebarContent = ({
  app,
  inSheet = false,
  onCollapse,
}: {
  app: AppShellSettings;
  /** In the sheet: keep the brand row clear of the sheet's close button. */
  inSheet?: boolean;
  onCollapse?: () => void;
}) => (
  // Brand pinned at the top, usage and account pinned at the bottom; the
  // links and runs between scroll when the window is too short for them
  // all (a short laptop, or the docs preview's fixed height).
  <div className="flex h-full w-60 flex-col">
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 p-3",
        // The sheet's close button sits 16–32px from the right edge.
        inSheet && "pr-10"
      )}
    >
      <WorkspaceSwitcher app={app} />
      {onCollapse ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Hide sidebar"
          onClick={onCollapse}
          className="text-muted-foreground hover:text-foreground size-7"
        >
          <HugeiconsIcon icon={SidebarLeft01Icon} strokeWidth={1.75} />
        </Button>
      ) : null}
    </div>

    <div
      data-sidebar-scroll
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-width:thin]"
    >
      <nav aria-label="Main" className="flex flex-col gap-5">
        {app.groups.map((group) => (
          <FoldGroup key={group.label} label={group.label}>
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                current={item.id === app.activeItem}
                onNavigate={app.onNavigate}
              />
            ))}
          </FoldGroup>
        ))}
      </nav>

      <div className="flex-1" />

      {app.runs.length > 0 ? (
        <Runs
          runs={app.runs}
          onNavigate={app.onNavigate}
          onNewRun={app.onNewRun}
        />
      ) : null}
    </div>

    <div className="flex shrink-0 flex-col gap-3 p-3">
      {app.usage ? (
        <UsageCard usage={app.usage} onUpgrade={app.onUpgrade} />
      ) : null}
      <Account user={app.user} onSignOut={app.onSignOut} />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
 * TOP BAR + SHELL
 * ───────────────────────────────────────────────────────── */

export const AppShell = ({
  app,
  children,
  title,
}: {
  app: AppShellSettings;
  children: React.ReactNode;
  title: string;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="bg-background flex h-full min-h-[52rem] w-full overflow-hidden">
      <aside
        aria-label="Sidebar"
        inert={collapsed}
        className={cn(
          "hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.645,0.045,0.355,1)] motion-reduce:transition-none lg:block",
          collapsed ? "w-0" : "w-60"
        )}
      >
        <SidebarContent app={app} onCollapse={() => setCollapsed(true)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* No rule under the bar: the page below sits on a muted tint,
            the bar and sidebar on the background, and that change of
            colour is the edge. */}
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4">
          {/* Phones and tablets: the sidebar opens as a sheet. */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Open sidebar"
                className="text-muted-foreground hover:text-foreground lg:hidden"
              >
                <HugeiconsIcon icon={Menu01Icon} strokeWidth={1.75} />
              </Button>
            </SheetTrigger>
            {/* Override: no edge rule; the sheet's own shadow lifts it. */}
            <SheetContent
              side="left"
              className="w-60 gap-0 border-r-0 p-0 sm:max-w-60"
            >
              <SheetTitle className="sr-only">{app.brandName}</SheetTitle>
              <SheetDescription className="sr-only">
                Main navigation
              </SheetDescription>
              <SidebarContent app={app} inSheet />
            </SheetContent>
          </Sheet>
          {/* Desktop, sidebar folded: bring it back. The slot grows from 0
            to the button's width and fades in on the sidebar's own timeline
            (200ms ease-in-out), so the breadcrumb slides over as the
            sidebar folds instead of jumping. While hidden, -mr-2 cancels
            the bar's 8px gap and the slot is inert (out of the Tab order). */}
          <div
            inert={!collapsed}
            className={cn(
              "hidden transition-[grid-template-columns,opacity,margin] duration-200 ease-[cubic-bezier(0.645,0.045,0.355,1)] motion-reduce:transition-none lg:grid",
              collapsed
                ? "mr-0 grid-cols-[1fr] opacity-100"
                : "-mr-2 grid-cols-[0fr] opacity-0"
            )}
          >
            <div className="min-w-0 overflow-hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Show sidebar"
                onClick={() => setCollapsed(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={SidebarLeft01Icon} strokeWidth={1.75} />
              </Button>
            </div>
          </div>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <HugeiconsIcon
              icon={Settings02Icon}
              strokeWidth={1.75}
              className="text-muted-foreground size-4 shrink-0"
            />
            <span className="truncate">{title}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={app.onAskAi}
            className={RING_BUTTON}
          >
            <HugeiconsIcon icon={SparklesIcon} strokeWidth={1.75} />
            Ask AI
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={
              app.unread > 0
                ? `Notifications, ${app.unread} unread`
                : "Notifications"
            }
            className={cn(RING_BUTTON, "relative")}
          >
            <HugeiconsIcon icon={Notification03Icon} strokeWidth={1.75} />
            {app.unread > 0 ? (
              <span
                aria-hidden
                className="ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500 ring-2"
              />
            ) : null}
          </Button>
        </header>
        <main className="bg-muted/40 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
