"use client";

import {
  Menu01Icon,
  Notification03Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import type * as React from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LIFT } from "@/registry/blocks/billing-settings/surface";

/* ─────────────────────────────────────────────────────────
 * DASHBOARD SHELL: the app around a billing page, so each variant reads
 * in place: a sidebar (brand, nav, the person) and a top bar (where you
 * are, search, notifications), the page on a muted tint.
 *
 *   lg and up   sidebar beside the page
 *   below lg    the sidebar opens as a sheet from the menu button
 *
 * No rules: the sidebar and top bar sit on the background, the page on a
 * muted tint, and the change of colour is the edge. The active link
 * changes colour and background, never weight.
 * ───────────────────────────────────────────────────────── */

export interface ShellLink {
  id: string;
  label: string;
  icon: IconSvgElement;
}

export interface ShellGroup {
  label?: string;
  items: ShellLink[];
}

export interface ShellProps {
  brand: string;
  /** Background of the brand monogram, any CSS colour. */
  brandColor: string;
  groups: ShellGroup[];
  active: string;
  /** Where the page sits, e.g. ["Settings", "Billing"]. */
  trail: string[];
  title: string;
  description: string;
  /** Buttons at the right of the page header. */
  actions?: React.ReactNode;
  user: { name: string; email: string };
  children: React.ReactNode;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Brand = ({ name, color }: { name: string; color: string }) => (
  <div className="flex items-center gap-2 px-2">
    <span
      aria-hidden
      style={{ backgroundColor: color }}
      className="flex size-6 items-center justify-center rounded-md text-xs font-medium text-white"
    >
      {name[0]}
    </span>
    <span className="text-sm font-medium">{name}</span>
  </div>
);

const Nav = ({
  groups,
  active,
  onPick,
}: {
  groups: ShellGroup[];
  active: string;
  onPick: (id: string) => void;
}) => (
  <nav aria-label="Main" className="flex flex-col gap-5">
    {groups.map((group) => (
      <div key={group.label ?? group.items[0]?.id} className="flex flex-col">
        {group.label ? (
          <p className="text-muted-foreground px-2 pb-1 text-xs">
            {group.label}
          </p>
        ) : null}
        <ul className="flex flex-col gap-0.5">
          {group.items.map((item) => {
            const current = item.id === active;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={current ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onPick(item.id);
                  }}
                  className={cn(
                    "focus-visible:ring-ring/50 flex h-8 items-center gap-2 rounded-md px-2 text-sm outline-none focus-visible:ring-[3px]",
                    "transition-[background-color,color] duration-150 ease-out",
                    current
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    strokeWidth={1.75}
                    className="size-4 shrink-0"
                  />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </nav>
);

const Person = ({ user }: { user: ShellProps["user"] }) => (
  <div className="flex items-center gap-2 px-2">
    <span
      aria-hidden
      className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium"
    >
      {initials(user.name)}
    </span>
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium">{user.name}</span>
      <span className="text-muted-foreground truncate text-xs">
        {user.email}
      </span>
    </div>
  </div>
);

const SidebarBody = ({
  props,
  active,
  onPick,
}: {
  props: ShellProps;
  active: string;
  onPick: (id: string) => void;
}) => (
  <div className="flex h-full flex-col gap-6 p-3">
    <Brand name={props.brand} color={props.brandColor} />
    <Nav groups={props.groups} active={active} onPick={onPick} />
    <div className="mt-auto">
      <Person user={props.user} />
    </div>
  </div>
);

export const DashboardShell = (props: ShellProps) => {
  // Demo: other links highlight but the page stays on billing.
  const [active, setActive] = useState(props.active);
  const [open, setOpen] = useState(false);
  const pick = (id: string) => {
    setActive(id);
    setOpen(false);
  };

  return (
    <div
      className={cn(
        LIFT,
        "bg-background flex h-[46rem] w-full overflow-hidden rounded-2xl"
      )}
    >
      <aside className="hidden w-56 shrink-0 lg:block">
        <SidebarBody props={props} active={active} onPick={pick} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3 lg:px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="size-8 lg:hidden"
              >
                <HugeiconsIcon
                  icon={Menu01Icon}
                  strokeWidth={1.75}
                  className="size-4"
                />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Pages in {props.brand}
              </SheetDescription>
              <SidebarBody props={props} active={active} onPick={pick} />
            </SheetContent>
          </Sheet>
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            {props.trail.map((step, index) => {
              const last = index === props.trail.length - 1;
              return (
                <li key={step} className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <span aria-hidden className="text-muted-foreground/60">
                      /
                    </span>
                  ) : null}
                  <span
                    aria-current={last ? "page" : undefined}
                    className={cn(
                      "truncate",
                      last ? "font-medium" : "text-muted-foreground"
                    )}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Search"
              className="size-8"
            >
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={1.75}
                className="size-4"
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Notifications, 2 unread"
              className="relative size-8"
            >
              <HugeiconsIcon
                icon={Notification03Icon}
                strokeWidth={1.75}
                className="size-4"
              />
              <span
                aria-hidden
                className="bg-primary absolute top-1.5 right-1.5 size-1.5 rounded-full"
              />
            </Button>
          </div>
        </header>

        <main className="bg-muted/50 dark:bg-muted/20 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-tl-2xl max-lg:rounded-t-2xl">
          <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="text-lg font-medium">{props.title}</h1>
                <p className="text-muted-foreground text-sm text-pretty">
                  {props.description}
                </p>
              </div>
              {props.actions ? (
                <div className="flex shrink-0 gap-2">{props.actions}</div>
              ) : null}
            </div>
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
};
