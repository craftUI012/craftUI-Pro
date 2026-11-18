"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CodeIcon,
  CreditCardIcon,
  GitBranchIcon,
  GridViewIcon,
  Home01Icon,
  InboxIcon,
  Menu01Icon,
  Notification01Icon,
  PackageIcon,
  Search01Icon,
  Settings01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import type { IconSvg } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";
import { Calendar } from "@/registry/isometric/calendar";
import { CardReader } from "@/registry/isometric/card-reader";
import { CloudUpload } from "@/registry/isometric/cloud-upload";
import { DeliveryTruck } from "@/registry/isometric/delivery-truck";
import { Key } from "@/registry/isometric/key";
import { MagnifyingGlass } from "@/registry/isometric/magnifying-glass";
import { Mailbox } from "@/registry/isometric/mailbox";
import { Server } from "@/registry/isometric/server";

// "What you get" on /skills/isometrics: a horizontal strip of product
// screens from different fields (payments, deployments, support, commerce,
// developer tools, scheduling, search, files), each with an isometric empty
// state in its content area. Cards share one height and vary in width; each
// takes its own colour, and the object takes it too through `tone`.
//
// The screens are pictures, not UI: inert, real words only on the page
// title and the empty state, quiet bars everywhere else. Each window runs
// off its card's right or bottom edge; only filler is cut, never the empty
// state. Objects play as their card scrolls into view and again on hover.

const ART_ONLY = { actionLabel: "", description: "", heading: "" } as const;

/* ─────────────────────────────── Parts ─────────────────────────────── */

/** A placeholder line standing in for words the story doesn't need. */
const Bar = ({ w, className }: { w: number | string; className?: string }) => (
  <span
    className={cn(
      "bg-foreground/10 block h-1.5 shrink-0 rounded-full",
      className
    )}
    style={{ width: w }}
  />
);

/** The product window: one surface, one shadow, cut by the card. */
const Window = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "bg-background border-border/70 absolute overflow-hidden rounded-xl border shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-12px_rgb(0_0_0/0.18)]",
      className
    )}
  >
    {children}
  </div>
);

/** The empty state at product size: the object, a heading, a line, an action. */
const Empty = ({
  art,
  title,
  line,
  action,
  tone,
  outline = false,
  invert = false,
  className,
}: {
  art: React.ReactNode;
  title: string;
  line: string;
  action: string;
  tone?: string;
  outline?: boolean;
  /** Foreground on background: the dark card's white button. */
  invert?: boolean;
  className?: string;
}) => (
  <div className={cn("flex flex-col items-center px-6 text-center", className)}>
    {art}
    <p className="text-foreground mt-3 text-sm font-medium">{title}</p>
    <p className="text-muted-foreground mt-1 max-w-60 text-xs leading-relaxed text-balance">
      {line}
    </p>
    <Button
      className={cn(
        "mt-4 text-xs",
        tone && !outline && "text-white",
        invert &&
          "bg-foreground text-background hover:bg-foreground shadow-none"
      )}
      size="sm"
      style={
        tone && !outline
          ? {
              backgroundColor: tone,
              // The button's own ring and lift, in its colour, not the site's.
              boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.18), 0 0 0 1px color-mix(in oklab, ${tone} 82%, black), 0 1px 2px rgb(0 0 0 / 0.12)`,
            }
          : undefined
      }
      tabIndex={-1}
      variant={outline ? "outline" : "default"}
    >
      {action}
    </Button>
  </div>
);

/** A row in a sidebar: an icon and a bar, or a label when it's selected. */
const NavRow = ({
  icon,
  w,
  label,
  tone,
}: {
  icon: IconSvg;
  w?: number;
  label?: string;
  tone?: string;
}) => (
  <div
    className={cn(
      "flex items-center gap-2.5 rounded-md px-2 py-1.5",
      label &&
        "bg-background shadow-[0_1px_2px_rgb(0_0_0/0.06)] dark:bg-white/5"
    )}
  >
    <span
      className={cn("flex", label ? "" : "text-muted-foreground/70")}
      style={label && tone ? { color: tone } : undefined}
    >
      <Icon icon={icon} />
    </span>
    {label ? (
      <span className="text-foreground text-xs font-medium">{label}</span>
    ) : (
      <Bar w={w ?? 56} />
    )}
  </div>
);

/** A tab row: the first tab real and underlined, the rest bars. */
const Tabs = ({
  label,
  tone,
  bars,
  className,
}: {
  label: string;
  tone: string;
  bars: number[];
  className?: string;
}) => (
  <div
    className={cn(
      "border-border flex items-end gap-5 border-b px-5",
      className
    )}
  >
    <span
      className="text-foreground border-b-2 pb-2 text-xs font-medium"
      style={{ borderColor: tone }}
    >
      {label}
    </span>
    {bars.map((w) => (
      <span className="flex h-[1.875rem] items-center pb-2" key={w}>
        <Bar w={w} />
      </span>
    ))}
  </div>
);

/* ─────────────────────────────── Screens ───────────────────────────── */

interface Shot {
  id: string;
  field: string;
  line: string;
  tone: string;
  /** Card width from md up (phones take most of the screen). */
  width: string;
  /** Always dark: the strip's one inverted card. */
  dark?: boolean;
  screen: (active: boolean | undefined, tone: string) => React.ReactNode;
}

const RIGHT = "top-0 left-6 -right-px -bottom-6";

// The payments dashboard's icon rail; the second is the page shown.
const RAIL: [string, IconSvg][] = [
  ["home", Home01Icon],
  ["payments", CreditCardIcon],
  ["customers", UserGroupIcon],
  ["products", PackageIcon],
];

const SHOTS: Shot[] = [
  {
    field: "Payments",
    id: "payments",
    line: "Before the first sale.",
    screen: (active, tone) => (
      <Window className={cn(RIGHT, "flex")}>
        <div className="border-border bg-surface/70 flex w-12 shrink-0 flex-col items-center gap-1 border-r py-3 dark:bg-white/[0.02]">
          {RAIL.map(([name, icon]) => (
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-md",
                name === "payments"
                  ? "bg-background shadow-[0_1px_2px_rgb(0_0_0/0.06)] dark:bg-white/5"
                  : "text-muted-foreground/70"
              )}
              key={name}
              style={name === "payments" ? { color: tone } : undefined}
            >
              <Icon icon={icon} />
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-4 px-5 pt-4">
            <p className="text-foreground text-base font-semibold tracking-tight">
              Payments
            </p>
            <span className="border-border flex h-7 w-20 items-center justify-center rounded-md border">
              <Bar w={40} />
            </span>
          </div>
          <Tabs bars={[52, 64, 44]} className="mt-3" label="All" tone={tone} />
          <div className="border-border flex gap-10 border-b px-5 py-2.5">
            <Bar className="bg-foreground/[0.07]" w={44} />
            <Bar className="bg-foreground/[0.07]" w={68} />
            <Bar className="bg-foreground/[0.07]" w={36} />
          </div>
          <div className="flex flex-1 items-center justify-center pb-6">
            <Empty
              action="Create payment link"
              art={
                <CardReader
                  {...ART_ONLY}
                  active={active}
                  artClassName="w-24"
                  title="A card reader waiting for a first payment"
                  tone={tone}
                />
              }
              line="Payments you accept will show up here."
              title="No payments yet"
              tone={tone}
            />
          </div>
        </div>
      </Window>
    ),
    tone: "#2563eb",
    width: "md:w-[42rem]",
  },
  {
    dark: true,
    field: "Deployments",
    id: "deployments",
    line: "Ready for the first push.",
    screen: (active, tone) => (
      <Window className={cn(RIGHT, "bg-card flex flex-col")}>
        <div className="flex items-center gap-2 px-5 pt-4 text-xs">
          <span className="bg-foreground/20 size-4 rounded-full" />
          <span className="text-foreground font-medium">storefront</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="border-border text-muted-foreground flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.6875rem]">
            <Icon className="size-3" icon={GitBranchIcon} />
            main
          </span>
        </div>
        <Tabs
          bars={[56, 40, 48]}
          className="mt-4"
          label="Deployments"
          tone="var(--foreground)"
        />
        <div className="flex flex-1 items-center justify-center pb-6">
          <Empty
            action="Connect Git"
            art={
              <Server
                {...ART_ONLY}
                active={active}
                artClassName="w-24"
                title="A server waiting for its first deployment"
                tone={tone}
              />
            }
            invert
            line="Push to main and your first deployment builds here."
            title="No deployments yet"
          />
        </div>
      </Window>
    ),
    tone: "#22c55e",
    width: "md:w-[34rem]",
  },
  {
    field: "Support",
    id: "support",
    line: "Inbox zero, earned.",
    screen: (active, tone) => (
      <Window className={cn(RIGHT, "flex")}>
        <div className="border-border bg-surface/70 hidden w-48 shrink-0 flex-col border-r p-3 md:flex dark:bg-white/[0.02]">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-foreground text-sm font-semibold">Inbox</span>
            <span className="bg-foreground/[0.06] text-muted-foreground rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums">
              0
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            <NavRow icon={InboxIcon} label="Open" tone={tone} />
            <NavRow icon={UserGroupIcon} w={64} />
            <NavRow icon={Notification01Icon} w={48} />
          </div>
          <div className="mt-4 flex flex-col gap-2.5 px-2">
            <Bar className="bg-foreground/[0.07]" w={36} />
            <Bar w={72} />
            <Bar w={56} />
            <Bar w={64} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center pb-6">
          <Empty
            action="View closed"
            art={
              <Mailbox
                {...ART_ONLY}
                active={active}
                artClassName="w-24"
                title="An empty mailbox: every conversation answered"
                tone={tone}
              />
            }
            line="Every conversation has a reply. Nice work."
            outline
            title="Inbox zero"
          />
        </div>
      </Window>
    ),
    tone: "#ea580c",
    width: "md:w-[38rem]",
  },
  {
    field: "Commerce",
    id: "commerce",
    line: "Orders on the way.",
    screen: (active, tone) => (
      <Window className="top-0 -bottom-6 left-1/2 flex w-[17rem] -translate-x-1/2 flex-col rounded-[1.75rem]">
        <div className="text-muted-foreground flex items-center justify-between px-4 pt-4">
          <Icon icon={Menu01Icon} />
          <span className="text-foreground text-sm font-semibold">Orders</span>
          <Icon icon={Search01Icon} />
        </div>
        <div className="bg-foreground/[0.05] mx-4 mt-4 grid grid-cols-2 rounded-lg p-0.5 text-xs">
          <span className="bg-background text-foreground rounded-md py-1.5 text-center font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)] dark:bg-white/10">
            Open
          </span>
          <span className="flex items-center justify-center">
            <Bar w={48} />
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center pb-6">
          <Empty
            action="Share your store"
            art={
              <DeliveryTruck
                {...ART_ONLY}
                active={active}
                artClassName="w-32"
                title="A delivery truck waiting for its first order"
                tone={tone}
              />
            }
            line="New orders land here as they come in."
            title="No orders yet"
            tone={tone}
          />
        </div>
      </Window>
    ),
    tone: "#16a34a",
    width: "md:w-[24rem]",
  },
  {
    field: "Developer tools",
    id: "developer",
    line: "Keys on demand.",
    screen: (active, tone) => (
      <Window className={cn(RIGHT, "flex")}>
        <div className="border-border bg-surface/70 hidden w-44 shrink-0 flex-col gap-0.5 border-r p-3 md:flex dark:bg-white/[0.02]">
          <div className="px-2 pt-1 pb-3">
            <Bar className="bg-foreground/[0.07]" w={44} />
          </div>
          <NavRow icon={Settings01Icon} w={52} />
          <NavRow icon={UserGroupIcon} w={60} />
          <NavRow icon={CreditCardIcon} w={44} />
          <NavRow icon={CodeIcon} label="Developers" tone={tone} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-5 pt-4">
          <p className="text-foreground text-base font-semibold tracking-tight">
            API keys
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <Bar w="70%" />
            <Bar w="42%" />
          </div>
          <div className="border-border mt-4 mb-10 flex flex-1 items-center justify-center rounded-lg border">
            <Empty
              action="Create key"
              art={
                <Key
                  {...ART_ONLY}
                  active={active}
                  artClassName="w-28"
                  title="A key: no API keys created yet"
                  tone={tone}
                />
              }
              line="Create a key to call the API from your server."
              title="No API keys yet"
              tone={tone}
            />
          </div>
        </div>
      </Window>
    ),
    tone: "#0891b2",
    width: "md:w-[38rem]",
  },
  {
    field: "Scheduling",
    id: "scheduling",
    line: "A clear week.",
    screen: (active, tone) => (
      <Window className={cn(RIGHT, "flex flex-col")}>
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground" icon={Calendar03Icon} />
            <span className="text-foreground text-sm font-semibold">
              November
            </span>
          </div>
          <span className="border-border flex h-7 w-16 items-center justify-center rounded-md border">
            <Bar w={28} />
          </span>
        </div>
        <div className="border-border mt-4 grid grid-cols-5 border-y">
          {[
            ["M", 16],
            ["T", 17],
            ["W", 18],
            ["T", 19],
            ["F", 20],
          ].map(([day, date]) => (
            <div
              className="border-border flex flex-col items-center gap-1 border-l py-2 first:border-l-0"
              key={date}
            >
              <span className="text-muted-foreground text-[0.625rem] font-medium">
                {day}
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                  date === 18 ? "font-semibold text-white" : "text-foreground"
                )}
                style={date === 18 ? { backgroundColor: tone } : undefined}
              >
                {date}
              </span>
            </div>
          ))}
        </div>
        <div className="relative flex flex-1 items-center justify-center pb-6">
          <div
            aria-hidden="true"
            className="absolute inset-0 grid grid-cols-5 [mask-image:linear-gradient(to_bottom,black,transparent_35%)]"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                className="border-border border-l first:border-l-0"
                key={i}
              />
            ))}
          </div>
          <Empty
            action="New event"
            art={
              <Calendar
                {...ART_ONLY}
                active={active}
                artClassName="w-24"
                title="A calendar with nothing scheduled"
                tone={tone}
              />
            }
            className="relative"
            line="Your week is clear. Add an event to get started."
            title="Nothing scheduled"
            tone={tone}
          />
        </div>
      </Window>
    ),
    tone: "#d97706",
    width: "md:w-[30rem]",
  },
  {
    field: "Search",
    id: "search",
    line: "When nothing matches.",
    screen: (active, tone) => (
      <Window className="-bottom-6 top-0 right-6 left-6 flex flex-col">
        <div className="border-border flex items-center gap-2.5 border-b px-4 py-3.5">
          <Icon className="text-muted-foreground" icon={Search01Icon} />
          <span className="text-foreground text-sm">
            refund march
            <span
              aria-hidden="true"
              className="ml-px inline-block h-4 w-px translate-y-0.5"
              style={{ backgroundColor: tone }}
            />
          </span>
          <span className="border-border text-muted-foreground ml-auto rounded border px-1.5 py-0.5 font-mono text-[0.625rem]">
            Esc
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center pb-6">
          <Empty
            action="Search everything"
            art={
              <MagnifyingGlass
                {...ART_ONLY}
                active={active}
                artClassName="w-24"
                title="A magnifying glass that found nothing"
                tone={tone}
              />
            }
            line="Check the spelling, or search every workspace."
            outline
            title="No results for “refund march”"
          />
        </div>
      </Window>
    ),
    tone: "#e11d48",
    width: "md:w-[28rem]",
  },
  {
    field: "Files",
    id: "files",
    line: "Drop it here.",
    screen: (active, tone) => (
      <Window className={cn(RIGHT, "flex flex-col")}>
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Files</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-foreground font-semibold">Brand assets</span>
          </div>
          <Icon className="text-muted-foreground" icon={GridViewIcon} />
        </div>
        <div
          className="mx-5 mt-4 mb-10 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed"
          style={{
            backgroundColor: `color-mix(in oklab, ${tone} 4%, transparent)`,
            borderColor: `color-mix(in oklab, ${tone} 40%, transparent)`,
          }}
        >
          <Empty
            action="Browse files"
            art={
              <CloudUpload
                {...ART_ONLY}
                active={active}
                artClassName="w-28"
                title="A cloud waiting for files to be dropped"
                tone={tone}
              />
            }
            line="PNG, PDF or SVG, up to 50 MB."
            title="Drop files to upload"
            tone={tone}
          />
        </div>
      </Window>
    ),
    tone: "#4f46e5",
    width: "md:w-[34rem]",
  },
];

/* ─────────────────────────────── Card ──────────────────────────────── */

const Card = ({ shot }: { shot: Shot }) => {
  // Undefined until the first hover, so each object plays as it comes into
  // view; then true while the pointer is over the card.
  const [active, setActive] = useState<boolean | undefined>();
  return (
    <article
      className={cn(
        "relative flex h-[30rem] w-[86vw] max-w-[24rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl md:h-[32rem] md:max-w-none",
        shot.width,
        // A light wash of the card's colour; stronger on a dark page.
        !shot.dark &&
          "bg-[color-mix(in_oklab,var(--tone)_9%,var(--background))] dark:bg-[color-mix(in_oklab,var(--tone)_16%,var(--background))]",
        shot.dark &&
          "dark bg-background text-foreground ring-1 ring-white/10 ring-inset"
      )}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      style={{ "--tone": shot.tone } as React.CSSProperties}
    >
      <p className={cn(TYPE.cardHeader, "p-6 pb-5 text-pretty")}>
        <span className="text-foreground font-medium">{shot.field}.</span>{" "}
        <span className="text-muted-foreground">{shot.line}</span>
      </p>
      <div className="relative flex-1" inert>
        {shot.screen(active, shot.tone)}
      </div>
    </article>
  );
};

/* ─────────────────────────────── Strip ─────────────────────────────── */

/**
 * The section's heading row (left) with the strip's arrows (right), then the
 * strip itself: it starts on the page's left gutter and runs off the right
 * edge of the window.
 */
export const ProductStrip = ({
  head,
  action,
}: {
  head: React.ReactNode;
  /** A link beside the arrows (shown on phones too, without the arrows). */
  action?: React.ReactNode;
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState<number>();
  const [ends, setEnds] = useState({ end: false, start: true });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) {
      return;
    }
    setEnds({
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      start: el.scrollLeft <= 2,
    });
  }, []);

  // Line the first card up with the page's left gutter at every width.
  useEffect(() => {
    const el = anchor.current;
    if (!el) {
      return;
    }
    const update = () => {
      setInset(el.getBoundingClientRect().left);
      measure();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) {
      el.scrollBy({ behavior: "smooth", left: dir * el.clientWidth * 0.7 });
    }
  };

  return (
    <>
      <div className="container">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-12">
          {head}
          <div className="flex items-end gap-2 md:col-span-5 md:justify-end">
            {action}
            <Button
              aria-label="Previous products"
              className="hidden md:inline-flex"
              disabled={ends.start}
              onClick={() => step(-1)}
              size="icon"
              variant="outline"
            >
              <Icon icon={ArrowLeft01Icon} />
            </Button>
            <Button
              aria-label="Next products"
              className="hidden md:inline-flex"
              disabled={ends.end}
              onClick={() => step(1)}
              size="icon"
              variant="outline"
            >
              <Icon icon={ArrowRight01Icon} />
            </Button>
          </div>
        </div>
        <div aria-hidden="true" ref={anchor} />
      </div>
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:gap-5"
        onScroll={measure}
        ref={scroller}
        style={
          {
            paddingInline: inset === undefined ? "1rem" : `${inset}px`,
            scrollPaddingInline: inset === undefined ? "1rem" : `${inset}px`,
          } as React.CSSProperties
        }
      >
        {SHOTS.map((shot) => (
          <Card key={shot.id} shot={shot} />
        ))}
      </div>
    </>
  );
};
