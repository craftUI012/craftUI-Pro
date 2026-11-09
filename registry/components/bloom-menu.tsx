"use client";

/* oxlint-disable nextjs/no-img-element -- a registry item can't assume next/image is set up for the user's image host */

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { Transition } from "motion/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  ComponentProps,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
} from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Bloom menu. An account menu that grows out of the avatar in your header:
 * the avatar's ring blooms into a card with your name, email and grouped
 * links, and the avatar itself slides into the card's corner. It folds
 * back into the avatar when you're done.
 *
 * ANIMATION STORYBOARD
 *
 *  closed    an avatar in a 40px ring
 *     0ms    open: the ring grows into the card (one spring, 500ms, a touch
 *            of bounce) while the avatar slides into its corner, 36 → 42px
 *   180ms    the name, email and items fade in out of a 4px blur (200ms)
 *   400ms    the items take clicks, so a fast double click can't hit one
 *            while the card is still growing
 *  closing   Escape, a click outside, the avatar or an item: the content
 *            blurs out at once (120ms) and the card shrinks back into the
 *            ring
 *
 * With reduced motion it opens and closes at once.
 * ───────────────────────────────────────────────────────────────────────── */

/** The card and the avatar: one spring for growing and shrinking. */
const SPRING: Transition = { bounce: 0.25, duration: 0.5, type: "spring" };
/** The card's content: waits for the card to be mostly grown, then fades in. */
const CONTENT: Transition = { delay: 0.18, duration: 0.2, ease: "easeOut" };
/** ...and leaves at once on close, so a shrunken copy of the menu never
 * rides along as the card folds back into the avatar. */
const CONTENT_OUT: Transition = { duration: 0.12, ease: "easeOut" };
/** When the items start taking clicks (ms): the content's delay + fade. */
const READY_MS = 400;
/** The ring's and the card's corner radius (px). */
const RADIUS = 20;

export interface BloomMenuItem {
  /** The item's name. Must be unique in its group. */
  label: string;
  /** An 18px icon before the label, e.g. an inline SVG. */
  icon?: ReactNode;
  /** Something small at the end of the row, e.g. a "Pro" pill or a count. */
  badge?: ReactNode;
  /** Makes the item a link. */
  href?: string;
  /** Called when the item is picked (after a link's own navigation starts). The menu closes either way. */
  onSelect?: () => void;
  /** Marks the page you're on, with a soft fill. */
  active?: boolean;
}

export interface BloomMenuProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** The person's name, at the top of the card. Its initials stand in when there's no avatar. Defaults to "Sophie Bennett". */
  name?: string;
  /** A line under the name, usually the email. Defaults to "sophie@acme.co". */
  email?: string;
  /** The avatar photo's URL; leave empty for initials. Defaults to a demo portrait. */
  avatar?: string;
  /** The items, in groups split by a thin line. Defaults to `bloomMenuGroups`, a SaaS workspace's menu. */
  groups?: BloomMenuItem[][];
  /** Which corner the card grows from: "end" for an avatar on the right of a header, "start" for one on the left. Defaults to "end". */
  align?: "end" | "start";
  /** Whether it's open, if you control it. */
  open?: boolean;
  /** Whether it starts open, if you don't. Defaults to false. */
  defaultOpen?: boolean;
  /** Called when it opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** What the avatar button says to screen readers. Defaults to "Account menu". */
  label?: string;
}

/** A 24px-grid line icon, drawn at 18px. */
const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    aria-hidden="true"
    className="size-[18px]"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.6}
    viewBox="0 0 24 24"
  >
    {children}
  </svg>
);

const ProBadge = () => (
  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary-foreground">
    PRO
  </span>
);

const InviteBadge = () => (
  <span className="flex size-5 items-center justify-center rounded-full border text-muted-foreground">
    <svg
      aria-hidden="true"
      className="size-2.5"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      viewBox="0 0 10 10"
    >
      <path d="M5 1.5v7M1.5 5h7" />
    </svg>
    <span className="sr-only">Invite</span>
  </span>
);

const DEMO_AVATAR =
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&h=160&q=80&auto=format&fit=crop&crop=faces";

/** The demo items: a SaaS workspace's account menu. Exported, so you can
 * start from them. */
export const bloomMenuGroups: BloomMenuItem[][] = [
  [
    {
      active: true,
      href: "#",
      icon: (
        <Icon>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
        </Icon>
      ),
      label: "Profile",
    },
    {
      badge: <InviteBadge />,
      href: "#",
      icon: (
        <Icon>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 19.5c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5" />
          <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.4c1.6.6 2.8 2 3.5 4.1" />
        </Icon>
      ),
      label: "Team",
    },
    {
      badge: <ProBadge />,
      href: "#",
      icon: (
        <Icon>
          <rect height="14" rx="2.5" width="19" x="2.5" y="5" />
          <path d="M2.5 10h19M6.5 15h4" />
        </Icon>
      ),
      label: "Billing",
    },
    {
      href: "#",
      icon: (
        <Icon>
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </Icon>
      ),
      label: "Settings",
    },
  ],
  [
    {
      href: "#",
      icon: (
        <Icon>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.4M12 17h.01" />
        </Icon>
      ),
      label: "Help",
    },
    {
      icon: (
        <Icon>
          <path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
          <path d="M15 16l4-4-4-4M19 12H9" />
        </Icon>
      ),
      label: "Sign out",
    },
  ],
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

/** The avatar: the photo, or the name's initials on a soft fill. */
const Face = ({ name, src }: { name: string; src?: string }) =>
  src ? (
    <img alt="" className="size-full object-cover" decoding="async" src={src} />
  ) : (
    <span className="flex size-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground">
      {initialsOf(name)}
    </span>
  );

const ROW =
  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium outline-none select-none transition-colors hover:bg-accent/70 focus-visible:bg-accent";

/** One item: a link if it has an `href`, otherwise a button. */
const Row = ({ item, onDone }: { item: BloomMenuItem; onDone: () => void }) => {
  const pick = () => {
    item.onSelect?.();
    onDone();
  };
  const content = (
    <>
      <span className="shrink-0 text-muted-foreground">{item.icon}</span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge}
    </>
  );
  const className = cn(ROW, item.active && "bg-accent text-accent-foreground");
  return item.href ? (
    <motion.a
      aria-current={item.active ? "page" : undefined}
      className={className}
      href={item.href}
      onClick={pick}
      role="menuitem"
      tabIndex={-1}
      whileTap={{ scale: 0.98 }}
    >
      {content}
    </motion.a>
  ) : (
    <motion.button
      className={className}
      onClick={pick}
      role="menuitem"
      tabIndex={-1}
      type="button"
      whileTap={{ scale: 0.98 }}
    >
      {content}
    </motion.button>
  );
};

/** Arrow keys, Home and End move between the items, wrapping round. */
const moveFocus = (menu: HTMLElement | null, key: string) => {
  const items = [
    ...(menu?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []),
  ];
  if (items.length === 0) {
    return false;
  }
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next: Record<string, number> = {
    ArrowDown: at === -1 ? 0 : (at + 1) % items.length,
    ArrowUp:
      at === -1 ? items.length - 1 : (at - 1 + items.length) % items.length,
    End: items.length - 1,
    Home: 0,
  };
  const index = next[key];
  if (index === undefined) {
    return false;
  }
  items[index]?.focus();
  return true;
};

/** Whether it's open, controlled or not. */
const useOpenState = (
  open: boolean | undefined,
  defaultOpen: boolean,
  onOpenChange?: (open: boolean) => void
) => {
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) {
        setOwn(next);
      }
      onOpenChange?.(next);
    },
    [open, onOpenChange]
  );
  return [isOpen, setOpen] as const;
};

/** Closes on a click outside, or on Escape from anywhere. */
const useDismiss = (
  open: boolean,
  root: RefObject<HTMLDivElement | null>,
  close: (refocus: boolean) => void
) => {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        close(false);
      }
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, root, close]);
};

/** True once the card has had time to grow, so the items can take clicks. */
const useReady = (open: boolean) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!open) {
      return;
    }
    const id = window.setTimeout(() => setReady(true), READY_MS);
    return () => window.clearTimeout(id);
  }, [open]);
  return ready;
};

const BloomMenu = ({
  name = "Sophie Bennett",
  email = "sophie@acme.co",
  avatar = DEMO_AVATAR,
  groups = bloomMenuGroups,
  align = "end",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  label = "Account menu",
  className,
  ...props
}: BloomMenuProps) => {
  const uid = useId();
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Where focus goes when it opens: the first item from the keyboard, the
  // menu itself from a click, nowhere when the page opened it.
  const focusOnOpen = useRef<"first" | "menu" | null>(null);
  const ready = useReady(open);

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    },
    [setOpen]
  );
  useDismiss(open, rootRef, close);

  useEffect(() => {
    const how = focusOnOpen.current;
    focusOnOpen.current = null;
    if (!open || !how) {
      return;
    }
    const first =
      menuRef.current?.querySelector<HTMLElement>("[role=menuitem]");
    (how === "first" ? first : menuRef.current)?.focus({ preventScroll: true });
  }, [open]);

  const openFrom = (how: "first" | "menu") => {
    focusOnOpen.current = how;
    setOpen(true);
  };

  const onTriggerClick = (event: MouseEvent<HTMLButtonElement>) =>
    // A click from Enter or Space has no pointer, so `detail` is 0.
    openFrom(event.detail === 0 ? "first" : "menu");

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openFrom("first");
    }
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      close(false);
    } else if (moveFocus(menuRef.current, event.key)) {
      event.preventDefault();
    }
  };

  const end = align === "end";

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("relative inline-flex size-10 shrink-0", className)}
        data-slot="bloom-menu"
        ref={rootRef}
        {...props}
      >
        <motion.button
          aria-controls={open ? `${uid}-menu` : undefined}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={label}
          className="group relative block size-10 cursor-pointer outline-none"
          layoutId={`${uid}-card`}
          onClick={onTriggerClick}
          onKeyDown={onTriggerKey}
          ref={triggerRef}
          style={{
            borderRadius: RADIUS,
            pointerEvents: open ? "none" : "auto",
          }}
          transition={SPRING}
          type="button"
        >
          {/* The focus ring sits on the avatar, not the button: the button
              is the card's twin, so while the card folds back Motion scales
              it up to the card's size, and a ring on it would scale too. */}
          <motion.span
            className="absolute inset-[2px] overflow-hidden rounded-full group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50"
            layoutId={`${uid}-avatar`}
            transition={SPRING}
          >
            <Face name={name} src={avatar} />
          </motion.span>
        </motion.button>

        <AnimatePresence>
          {open ? (
            <motion.div
              className={cn(
                "absolute top-0 z-50 w-[19rem] max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground shadow-[0_8px_40px_rgb(0_0_0/0.14)] ring-1 ring-border/60",
                end ? "right-0" : "left-0"
              )}
              key="card"
              layoutId={`${uid}-card`}
              style={{ borderRadius: RADIUS }}
              transition={SPRING}
            >
              {/* The avatar again, now in the card's corner: it closes the menu. */}
              <button
                aria-label="Close account menu"
                className={cn(
                  "absolute top-4 size-12 cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  end ? "right-4" : "left-4"
                )}
                onClick={() => close(true)}
                type="button"
              >
                <motion.span
                  className="absolute inset-[3px] overflow-hidden rounded-full"
                  layoutId={`${uid}-avatar`}
                  transition={SPRING}
                >
                  <Face name={name} src={avatar} />
                </motion.span>
              </button>

              <motion.div
                animate={{ filter: "blur(0px)", opacity: 1 }}
                exit={{
                  filter: "blur(4px)",
                  opacity: 0,
                  transition: CONTENT_OUT,
                }}
                initial={{ filter: "blur(4px)", opacity: 0 }}
                transition={CONTENT}
              >
                <div className={cn("px-4 pt-4 pb-3", end ? "pr-16" : "pl-16")}>
                  <p className="truncate text-base font-semibold tracking-tight">
                    {name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {email}
                  </p>
                </div>

                <div className="mx-1 h-px bg-border" />

                <div
                  aria-label={label}
                  className={cn(
                    "outline-none",
                    !ready && "pointer-events-none"
                  )}
                  id={`${uid}-menu`}
                  onKeyDown={onMenuKey}
                  ref={menuRef}
                  role="menu"
                  tabIndex={-1}
                >
                  {groups.map((group, index) => (
                    <Fragment key={group.map((item) => item.label).join("|")}>
                      {index > 0 ? (
                        <div className="mx-1 h-px bg-border" role="separator" />
                      ) : null}
                      <div className="flex flex-col p-2" role="group">
                        {group.map((item) => (
                          <Row
                            item={item}
                            key={item.label}
                            onDone={() => close(true)}
                          />
                        ))}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};

export default BloomMenu;
