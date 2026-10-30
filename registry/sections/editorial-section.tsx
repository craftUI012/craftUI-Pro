"use client";

import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { Transition } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  CSSProperties,
  ComponentProps,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  Ref,
  RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * Scroll (direct, no timeline)
 *   the section pins; the page's scroll slides the press cards left, 1px
 *   for 1px. Each card stops at the left edge a slice past the one before
 *   (`peek`) and the next slides over it, so the features pile up like
 *   cuttings and the last ends in full view
 *
 * Open: one card leaves the deck (ms after the click)
 *      0ms   the cards lying on top of it slide off to the right (deck
 *            parts) while a veil fades over the rest of the deck and the
 *            page, 0 → 0.7, sitting just under the chosen card's slot
 *      0ms   the same card, never a copy, grows out of its slot to the
 *            middle of the screen on one spring, its text riding along at
 *            the same size (nothing re-wraps or stretches)
 *    180ms   more of the article and the link fade up, 14px → 0
 *
 * Close: it goes back in (Esc, the close button or a click outside)
 *      0ms   the extra text fades out (150ms)
 *      0ms   the card shrinks back into its slot as the cards that lay on
 *            top of it slide back over it, and the veil lifts
 *
 * One card element and its slot's depth never change, so nothing swaps,
 * crossfades or pops: the deck simply opens round it and closes over it.
 * The deck is one motion value (`part`, 0 closed → 1 parted) written to
 * each slot's transform and the veil's opacity; the card is a motion layout
 * animation. Cards are never faded themselves: they overlap, so a faded
 * card would show the one under it.
 * Transform and opacity only.
 * ───────────────────────────────────────────────────────────────────────── */

const TIMING = {
  /** Extra text starts fading up this long after the card starts out. */
  details: 180,
};

/** The scroll stack. */
const STACK = {
  /** Most a stacked card shows of itself, as a share of the rail's width. */
  peek: 0.1,
};

/** The card that comes out: one spring for its size, place and text. */
const CARD = {
  /** Gap round the open card, px: phone, then from sm, then from lg. */
  gutter: [8, 24, 40],
  /** Widest the open card gets, px. */
  maxWidth: 832,
  spring: {
    bounce: 0.08,
    type: "spring",
    visualDuration: 0.5,
  } satisfies Transition,
};

/** The rest of the deck while a card is out. */
const DECK = {
  /** How far past the rail's right edge the covering cards slide, px. */
  clear: 48,
  /** Same spring as the card, so the deck parts and closes with it. */
  spring: CARD.spring,
  /** Opacity of the veil over the rest of the deck and the page. */
  veil: 0.7,
};

/** The parts only an open feature has. */
const DETAILS = {
  in: {
    delay: TIMING.details / 1000,
    duration: 0.35,
    ease: [0.23, 1, 0.32, 1],
  } satisfies Transition,
  out: { duration: 0.15, ease: "easeOut" } satisfies Transition,
  /** px the text rises as it fades in. */
  rise: 14,
};

/** Card fills, darkest first, cycling: the foreground mixed into the page. */
const TONES = [13, 8, 5];

const tone = (index: number) =>
  `color-mix(in oklab, var(--foreground) ${TONES[index % TONES.length]}%, var(--background))`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export interface EditorialSectionFeature {
  /** Unique id: the deck keys on it, and it names the open card's labels. */
  id: string;
  /** The newspaper or magazine that ran it ("The Material Review"). */
  publication: string;
  /** What kind of piece it is ("Interview"): beside the date, or the publication on phones. */
  kind?: string;
  /** The article's headline. Keep it to about three lines on the card. */
  headline: string;
  /** One or two sentences under the headline: what the piece says about you. The card shows up to five lines. */
  excerpt: string;
  /** Publication date, as an ISO date ("2026-09-18"). */
  date: string;
  /** The open card's paragraphs: more of what the article says. */
  body: string[];
  /** The article on the publication's site. When set, the open card ends with a button to it. */
  href?: string;
}

/** The demo coverage: a furniture studio in the press. Exported, so you can
 * start from them: `[yourFeature, ...pressFeatures]`. */
export const pressFeatures: EditorialSectionFeature[] = [
  {
    body: [
      "The brief fit on a sticky note: a chair you can sit in for an evening, carry up a narrow stair and repair at the kitchen table. The studio says every early prototype failed at least one of the three.",
      "The answer is in the joints. There is no glue anywhere in the frame; each corner locks with a single tapered oak pin, so a loose leg is a two-minute fix with the one tool that comes in the box.",
      "After a month of daily use, the cushion has held its shape and the frame hasn't creaked once. It isn't the cheapest lounge chair we've tested this year, but it may be the last one you need to buy.",
    ],
    date: "2026-09-18",
    excerpt:
      "Forty prototypes, one tapered pin per joint and no glue. Our critic spent a month with Ostra's lounge chair and found a seat designed to be repaired, not replaced.",
    headline:
      "Ostra's new lounge chair is built to come apart, and that's the point",
    href: "#",
    id: "material-review",
    kind: "Review",
    publication: "The Material Review",
  },
  {
    body: [
      "Most furniture brands make money when you buy again. Ostra makes it when you don't: a growing share of its revenue now comes from spare parts, reupholstery and a paid repair service.",
      "Every frame carries a lifetime warranty, and parts ship by post with a printed guide. The workshop answers the phone, and the founders say about half of all calls end without anything being sold.",
      "Investors were sceptical at first. Three years in, repeat customers spend more on average than new ones, and the studio's returns rate is the lowest in its category.",
    ],
    date: "2026-08-02",
    excerpt:
      "Spare parts by post, a lifetime frame warranty and a workshop that answers the phone. Inside the economics of a studio that would rather you bought less.",
    headline: "How a small furniture maker made repair its business model",
    href: "#",
    id: "evening-ledger",
    kind: "Report",
    publication: "The Evening Ledger",
  },
  {
    body: [
      "Ostra's two founders met as apprentices in a joinery that made church pews. They still draw every piece by hand before anyone opens a laptop.",
      "Trends come up often in the conversation, mostly as things to avoid. Their rule: if a colour or shape would look dated in ten years, it doesn't make the collection, however well it might sell this season.",
      "Flat-pack, they insist, was never about price. It's about stairs, small lifts and second homes, and the chance to move a sofa without hiring two people.",
    ],
    date: "2026-06-21",
    excerpt:
      "The founders of Ostra on drawing by hand, designing for narrow stairs and why they turn down most of the trends their customers ask for.",
    headline:
      "Ostra's founders on slow design, flat-pack and saying no to trends",
    href: "#",
    id: "habitat-weekly",
    kind: "Interview",
    publication: "Habitat Weekly",
  },
  {
    body: [
      "When Ostra took the top floor, the windows were boarded and the timber was soaked. The studio kept every original column and let the patched brickwork show where the old line shafts once ran.",
      "The workshop came last on purpose. The team spent a month working at borrowed tables before ordering anything, so benches, racks and the spray booth sit where people actually walk.",
      "Today twelve makers work under one roof, with the timber store on the ground floor and the showroom by the tall windows where the looms used to stand.",
    ],
    date: "2026-05-07",
    excerpt:
      "Brick walls, steel windows and a floor that once carried looms. How a furniture studio turned a disused textile mill into a workshop for twelve makers.",
    headline: "A 1920s textile mill gets a second life as a furniture workshop",
    href: "#",
    id: "northline-journal",
    kind: "Feature",
    publication: "Northline Journal",
  },
  {
    body: [
      "You have probably sat in a copy of the Pin chair without knowing it. Its low arms and visible oak joints have turned up in hotel lobbies, cafés and at least three high-street ranges this year.",
      "The studio behind it employs fewer people than most design agencies and has never run an advertisement. It sells mostly through word of mouth and a waiting list that reopens twice a year.",
      "Asked about the copies, the founders shrug. The originals can be repaired for decades, they point out, and the imitations can't.",
    ],
    date: "2026-03-15",
    excerpt:
      "Twelve makers, no advertising and a waiting list that opens twice a year. Meet the studio whose chair has been imitated more than any other this year.",
    headline: "The quiet studio behind this year's most copied chair",
    href: "#",
    id: "field-and-form",
    kind: "Profile",
    publication: "Field & Form",
  },
  {
    body: [
      "Flat-pack still carries the memory of wobbly shelves and missing screws. A new wave of makers is changing that, and Ostra is the clearest example.",
      "Its pieces arrive in a single box, assemble with one tool and come apart just as easily, which matters more than it sounds: furniture that can be moved is furniture that gets kept.",
      "If the decade's best design is the kind that lasts, it may well be the kind that ships in a box.",
    ],
    date: "2026-01-22",
    excerpt:
      "Furniture that arrives in one box, builds with one tool and survives five moves. An essay on why flat-pack has become the most sustainable choice.",
    headline: "Why the best furniture of the decade might ship in a box",
    href: "#",
    id: "common-room",
    kind: "Essay",
    publication: "Common Room",
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.75}
    viewBox="0 0 16 16"
  >
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </svg>
);

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.75}
    viewBox="0 0 16 16"
  >
    <path d="M5 11 11 5M6 5h5v5" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={className}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth={1.75}
    viewBox="0 0 16 16"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

// ── The card ──────────────────────────────────────────────────────────────

// shadcn's Card parts, as motion components: the card animates its own
// layout, and each part rides along at its size (layout="position").
const MotionCard = motion.create(Card);
const MotionCardTitle = motion.create(CardTitle);
const MotionCardDescription = motion.create(CardDescription);
const MotionCardFooter = motion.create(CardFooter);

// Headline and excerpt are the same size open and closed, and as wide as
// the card's text column in the rail (--feature-text, measured), so they
// keep their line breaks as the card grows and only move. Weights stay at
// 400 and 500.
const TITLE =
  "mt-3 max-w-[var(--feature-text,34rem)] text-[1.625rem] leading-[1.1] font-medium tracking-[-0.025em] text-balance sm:mt-4 sm:text-3xl lg:text-[2.25rem] lg:leading-[1.08] xl:text-[2.5rem]";
const EXCERPT =
  "mt-4 max-w-[var(--feature-text,34rem)] text-[0.9375rem] leading-relaxed text-pretty text-foreground/75 sm:mt-5 sm:text-base";

// The open card's controls: a 2px foreground outline, which clears 3:1
// against the card's tint in light and dark (the theme's ring is too faint
// on a tinted card).
const FOCUS =
  "focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground focus-visible:outline-solid";

/** A link to another site: it opens in a new tab. */
const isExternal = (href: string) => /^https?:\/\//.test(href);

/** Where the open card sits, in its slot's coordinates (the slot moves with
 * the scroll, so the card stays inside it and is laid out from there). */
interface OpenFrame {
  top: number;
  bottom: number;
  left: number;
  width: number;
  maxHeight: number;
}

/** What an open feature adds: more of the article and a link to it. */
const FeatureDetails = ({
  feature,
  linkLabel,
  ref,
}: {
  feature: EditorialSectionFeature;
  linkLabel: string;
  /** AnimatePresence's popLayout measures the leaving text through it. */
  ref?: Ref<HTMLDivElement>;
}) => (
  <motion.div
    ref={ref}
    animate={{ opacity: 1, transition: DETAILS.in, y: 0 }}
    className="mt-8 flex flex-col gap-8 border-t border-foreground/10 pt-8 sm:mt-10 sm:gap-10 sm:pt-10"
    exit={{ opacity: 0, transition: DETAILS.out }}
    initial={{ opacity: 0, y: DETAILS.rise }}
    layout="position"
  >
    <div className="flex max-w-[38rem] flex-col gap-5 text-base leading-relaxed text-pretty text-foreground/85">
      {feature.body.map((paragraph) => (
        <p key={paragraph.slice(0, 24)}>{paragraph}</p>
      ))}
    </div>
    {feature.href ? (
      <Button
        asChild
        className={cn(
          "group/link h-11 gap-4 self-start rounded-none py-0 pr-0 pl-5",
          FOCUS
        )}
        size="lg"
        variant="default"
      >
        <a
          href={feature.href}
          {...(isExternal(feature.href)
            ? { rel: "noreferrer", target: "_blank" }
            : {})}
        >
          {linkLabel}
          {/* The arrow on its own square tile, flush with the button's end. */}
          <span
            aria-hidden
            className="grid size-11 place-items-center bg-black/20"
          >
            <ArrowIcon className="size-3.5 transition-transform duration-200 ease-out group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
          </span>
          <span className="sr-only">
            {isExternal(feature.href)
              ? `(${feature.publication}, opens in a new tab)`
              : `(${feature.publication})`}
          </span>
        </a>
      </Button>
    ) : null}
  </motion.div>
);

interface FeatureCardProps extends ComponentProps<typeof MotionCard> {
  feature: EditorialSectionFeature;
  index: number;
  /** Out of the deck, in the middle of the screen. */
  open: boolean;
  /** Where it sits while open. */
  frame: OpenFrame | null;
  /** Prefix for the ids that label the open card. */
  idBase: string;
  formatDate: (date: string) => string;
  readLabel: string;
  closeLabel: string;
  linkLabel: string;
  /** The heading level of the card's headline. */
  titleLevel: 2 | 3 | 4;
  buttonRef: (node: HTMLButtonElement | null) => void;
  closeRef: (node: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onClose: () => void;
  onButtonFocus: (event: FocusEvent<HTMLButtonElement>) => void;
}

/** Keeps Tab inside the open card. */
const trapTab = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== "Tab") {
    return;
  }
  const focusable = [
    ...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button"),
  ];
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) {
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

/**
 * One press card. It is the card in the deck and, opened, the same element
 * grown to the middle of the screen: there is never a second copy.
 */
const FeatureCard = ({
  feature,
  index,
  open,
  frame,
  idBase,
  formatDate,
  readLabel,
  closeLabel,
  linkLabel,
  titleLevel,
  buttonRef,
  closeRef,
  onOpen,
  onClose,
  onButtonFocus,
  className,
  style,
  ...props
}: FeatureCardProps) => {
  const Heading = `h${titleLevel}` as const;
  const placed: CSSProperties =
    open && frame
      ? {
          bottom: frame.bottom,
          left: frame.left,
          maxHeight: frame.maxHeight,
          top: frame.top,
          width: frame.width,
        }
      : {};

  return (
    <MotionCard
      aria-describedby={open ? `${idBase}-excerpt` : undefined}
      aria-labelledby={open ? `${idBase}-title` : undefined}
      aria-modal={open ? true : undefined}
      className={cn(
        "absolute gap-0 overflow-hidden rounded-none py-0 text-foreground shadow-none",
        open
          ? "my-auto h-fit"
          : "inset-0 has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-foreground has-[button:focus-visible]:ring-inset",
        className
      )}
      layout
      onKeyDown={open ? trapTab : undefined}
      role={open ? "dialog" : undefined}
      style={{ ...style, ...placed, backgroundColor: tone(index) }}
      transition={CARD.spring}
      {...props}
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            key="close"
            animate={{ opacity: 1, transition: DETAILS.in }}
            className="absolute top-3 right-3 z-10 sm:top-5 sm:right-5"
            exit={{ opacity: 0, transition: DETAILS.out }}
            initial={{ opacity: 0 }}
            layout="position"
          >
            <Button
              ref={closeRef}
              className={cn(
                "size-10 rounded-full bg-background/80 text-foreground shadow-none backdrop-blur-sm hover:bg-background",
                FOCUS
              )}
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <CloseIcon className="size-4" />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        className={cn(
          "flex flex-col p-6 sm:p-8 lg:p-10",
          open
            ? "min-h-0 overflow-y-auto overscroll-contain pb-10 sm:pb-12"
            : "h-full"
        )}
        layoutScroll
      >
        <CardHeader className="block px-0">
          <motion.p className="text-sm font-medium" layout="position">
            {feature.publication}
            {/* Phones show the kind here: the date row has no room for it. */}
            {feature.kind ? (
              <span className="font-normal text-foreground/65 sm:hidden">
                <span aria-hidden> · </span>
                {feature.kind}
              </span>
            ) : null}
          </motion.p>
          <MotionCardTitle
            className={TITLE}
            id={`${idBase}-title`}
            layout="position"
          >
            <Heading>
              {open ? (
                feature.headline
              ) : (
                // Stretched over the whole card: the card is the button.
                // The card's ring (on :has) is its focus indicator.
                <button
                  ref={buttonRef}
                  aria-haspopup="dialog"
                  className="cursor-pointer text-left outline-none after:absolute after:inset-0"
                  onClick={onOpen}
                  onFocus={onButtonFocus}
                  type="button"
                >
                  {feature.headline}
                </button>
              )}
            </Heading>
          </MotionCardTitle>
          <MotionCardDescription
            className={cn(EXCERPT, !open && "line-clamp-5")}
            id={`${idBase}-excerpt`}
            layout="position"
          >
            {feature.excerpt}
          </MotionCardDescription>
        </CardHeader>

        <MotionCardFooter
          className={cn(
            // As wide as the text column in both states, so "Read more"
            // keeps its place in the row and moves only with it.
            "w-full max-w-[var(--feature-text,34rem)] flex-wrap gap-x-8 gap-y-1 px-0 text-sm",
            open ? "mt-6 sm:mt-8" : "mt-auto pt-6"
          )}
          layout="position"
        >
          <time className="font-medium" dateTime={feature.date}>
            {formatDate(feature.date)}
          </time>
          {feature.kind ? (
            <span aria-hidden className="hidden text-foreground/65 sm:inline">
              {feature.kind}
            </span>
          ) : null}
          {/* Part of the row, so it rides with the date; it steps aside
              while the card is open, where the article link takes over. */}
          <motion.span
            animate={
              open
                ? { opacity: 0, transition: DETAILS.out }
                : { opacity: 1, transition: DETAILS.in }
            }
            aria-hidden
            className="ml-auto inline-flex items-center gap-1.5"
            initial={false}
          >
            {readLabel}
            <ChevronIcon className="size-3.5" />
          </motion.span>
        </MotionCardFooter>

        {/* popLayout: leaving text stops taking up room at once, so the
            date row glides to the card's foot with the rest instead of
            dropping there when the fade ends. */}
        <AnimatePresence mode="popLayout">
          {open ? (
            <FeatureDetails
              key="details"
              feature={feature}
              linkLabel={linkLabel}
            />
          ) : null}
        </AnimatePresence>
      </motion.div>
    </MotionCard>
  );
};

// ── The section ───────────────────────────────────────────────────────────

export interface EditorialSectionProps extends Omit<
  ComponentProps<"section">,
  "children"
> {
  /** The headline above the cards. */
  heading?: ReactNode;
  /** The press features, newest first. Each is a card; clicking one opens it. Defaults to `pressFeatures`, the exported demo set. */
  features?: EditorialSectionFeature[];
  /** Locale for the dates ("en-GB" gives "18 September 2026"). */
  locale?: string;
  /** Shown on every card, at the end of the row with its date. */
  readLabel?: string;
  /** Screen-reader name of the open feature's close button. */
  closeLabel?: string;
  /** The open feature's button to its `href`, when it has one. */
  linkLabel?: string;
  /**
   * The element that scrolls, when it isn't the page (a custom scroll
   * container, a smooth-scroll wrapper). The stage is then as tall as it.
   */
  scroller?: RefObject<HTMLElement | null>;
  /** 1 when this is the page's main heading; 2 when the page has its own h1. */
  headingLevel?: 1 | 2 | 3;
}

interface Geometry {
  /** A card's width, px. */
  width: number;
  /** How much of itself a stacked card shows, px. */
  peek: number;
  /** The pinned scroll's length: from side by side to all stacked, px. */
  travel: number;
}

/**
 * Makes the rest of the page inert while a card is open, as a modal's
 * background must be (keyboard and screen readers stay in the card; a click
 * there still closes it). Returns the undo.
 */
const inertOutside = (keep: HTMLElement) => {
  const changed: HTMLElement[] = [];
  let node: HTMLElement = keep;
  while (node.parentElement && node !== document.body) {
    for (const sibling of node.parentElement.children) {
      if (
        sibling !== node &&
        sibling instanceof HTMLElement &&
        !sibling.inert &&
        !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)
      ) {
        sibling.inert = true;
        changed.push(sibling);
      }
    }
    node = node.parentElement;
  }
  return () => {
    for (const element of changed) {
      element.inert = false;
    }
  };
};

/** The open card's gap to the screen's edge at this width. */
const gutterFor = (width: number) => {
  if (width >= 1024) {
    return CARD.gutter[2];
  }
  return width >= 640 ? CARD.gutter[1] : CARD.gutter[0];
};

export const EditorialSection = ({
  heading = "As featured in",
  features = pressFeatures,
  locale = "en-US",
  readLabel = "Read more",
  closeLabel = "Close",
  linkLabel = "Read the article",
  scroller,
  headingLevel = 2,
  className,
  style,
  ...props
}: EditorialSectionProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const geometry = useRef<Geometry>({ peek: 0, travel: 0, width: 0 });
  const openRef = useRef<number | null>(null);
  const refocusing = useRef(false);
  const redraw = useRef<(() => void) | null>(null);
  // 0 closed → 1 parted: the deck round the open card.
  const part = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  // The open card, and the one going back in (the page stays locked and
  // the deck inert until it's home).
  const [open, setOpen] = useState<number | null>(null);
  const [landing, setLanding] = useState<number | null>(null);
  const [frame, setFrame] = useState<OpenFrame | null>(null);

  const idBase = useId();
  const HeadingTag = `h${headingLevel}` as const;
  const titleLevel = (headingLevel + 1) as 2 | 3 | 4;
  const count = features.length;
  const out = open ?? landing;
  const outRef = useRef(out);
  outRef.current = out;

  const formatDate = useCallback(
    (date: string) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(date)),
    [locale]
  );

  // ── Scroll: slide and stack; the deck: part and veil ────────────────────
  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const rail = railRef.current;
    if (!section || !stage || !rail) {
      return;
    }
    const scrollTarget: HTMLElement | Window = scroller?.current ?? window;

    const viewTop = () =>
      scrollTarget === window
        ? 0
        : (scrollTarget as HTMLElement).getBoundingClientRect().top;

    const draw = () => {
      const { peek, travel, width } = geometry.current;
      const scrolled = clamp(
        viewTop() - section.getBoundingClientRect().top,
        0,
        travel
      );
      const parted = part.get();
      const chosen = outRef.current;
      const railWidth = rail.clientWidth;
      if (veilRef.current) {
        veilRef.current.style.opacity = String(parted * DECK.veil);
      }
      for (const [i, slot] of slotRefs.current.entries()) {
        if (!slot) {
          continue;
        }
        // Side by side, until it reaches its place in the stack.
        const x = Math.max(i * peek, i * width - scrolled);
        // Cards lying on the open one slide off to the right.
        const aside =
          chosen !== null && i > chosen
            ? parted * (railWidth + DECK.clear - x)
            : 0;
        slot.style.transform = `translate3d(${x + aside}px, 0, 0)`;
      }
    };
    redraw.current = draw;

    const fit = () => {
      if (scrollTarget !== window) {
        const { height } = (
          scrollTarget as HTMLElement
        ).getBoundingClientRect();
        section.style.setProperty("--stage-h", `${height}px`);
      }
      const width = slotRefs.current[0]?.offsetWidth ?? 0;
      const room = rail.clientWidth - width;
      const peek =
        count > 1
          ? Math.max(
              0,
              Math.min(rail.clientWidth * STACK.peek, room / (count - 1))
            )
          : 0;
      const travel = Math.max(0, (count - 1) * (width - peek));
      geometry.current = { peek, travel, width };
      section.style.setProperty("--travel", `${travel}px`);
      // The text column: the open card keeps the rail card's line breaks.
      const header = rail.querySelector<HTMLElement>("[data-slot=card-header]");
      if (header && outRef.current === null) {
        stage.style.setProperty("--feature-text", `${header.clientWidth}px`);
      }
      draw();
    };

    fit();
    const resize = new ResizeObserver(() => {
      if (outRef.current === null) {
        fit();
      }
    });
    resize.observe(rail);
    if (scrollTarget !== window) {
      resize.observe(scrollTarget as HTMLElement);
    }
    const stopPart = part.on("change", draw);
    scrollTarget.addEventListener("scroll", draw, { passive: true });
    return () => {
      resize.disconnect();
      stopPart();
      scrollTarget.removeEventListener("scroll", draw);
    };
  }, [count, part, scroller]);

  // ── Open and close ──────────────────────────────────────────────────────
  /** Parts (1) or closes (0) the deck; at once under reduced motion. */
  const moveDeck = useCallback(
    (to: number) => {
      if (reduceMotion) {
        part.set(to);
      } else {
        void animate(part, to, DECK.spring);
      }
    },
    [part, reduceMotion]
  );

  const openCard = (index: number) => {
    const slot = slotRefs.current[index];
    if (!slot) {
      return;
    }
    // The visible area: the page's window, or the scroll box.
    const container = scroller?.current;
    const view = container
      ? container.getBoundingClientRect()
      : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const box = slot.getBoundingClientRect();
    const gutter = gutterFor(view.width);
    const width = Math.min(CARD.maxWidth, view.width - gutter * 2);
    setFrame({
      bottom: box.bottom - (view.bottom - gutter),
      left: view.left + (view.width - width) / 2 - box.left,
      maxHeight: view.height - gutter * 2,
      top: view.top + gutter - box.top,
      width,
    });
    openRef.current = index;
    setLanding(null);
    setOpen(index);
    moveDeck(1);
  };

  const close = useCallback(() => {
    const index = openRef.current;
    if (index === null) {
      return;
    }
    openRef.current = null;
    setLanding(index);
    setOpen(null);
    moveDeck(0);
  }, [moveDeck]);

  const home = (index: number) => {
    if (landing === index) {
      setLanding(null);
      setFrame(null);
    }
  };

  // Which card is out changes which slots slide aside: redraw.
  useEffect(() => {
    redraw.current?.();
  }, [out]);

  // While a card is out: the page holds still; Esc and a click outside
  // close it; focus goes to its close button, then back to the card.
  useEffect(() => {
    if (out === null) {
      return;
    }
    const container = scroller?.current;
    const root = document.documentElement;
    const target = container ?? root;
    const gap = container ? 0 : window.innerWidth - root.clientWidth;
    const previous = {
      overflow: target.style.overflow,
      paddingRight: target.style.paddingRight,
    };
    target.style.overflow = "hidden";
    if (gap > 0) {
      target.style.paddingRight = `${gap}px`;
    }
    const restore = sectionRef.current
      ? inertOutside(sectionRef.current)
      : null;
    return () => {
      target.style.overflow = previous.overflow;
      target.style.paddingRight = previous.paddingRight;
      restore?.();
    };
  }, [out, scroller]);

  useEffect(() => {
    if (open === null) {
      return;
    }
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const slot = slotRefs.current[open];
      if (slot && !slot.contains(event.target as Node)) {
        // Keeps the click from moving focus, which goes back to the card.
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  // Back in the deck: focus returns to the card that was open, without
  // the reveal scroll (it's landing where it was).
  useEffect(() => {
    if (landing === null) {
      return;
    }
    refocusing.current = true;
    buttonRefs.current
      .get(features[landing]?.id ?? "")
      ?.focus({ preventScroll: true });
    refocusing.current = false;
    // Reduced motion has no layout animation to finish.
    const timer = window.setTimeout(() => {
      setLanding(null);
      setFrame(null);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [landing, features]);

  /** Keyboard focus on a card not in view yet scrolls the page to it. */
  const reveal = (index: number, event: FocusEvent<HTMLButtonElement>) => {
    const section = sectionRef.current;
    const rail = railRef.current;
    const slot = slotRefs.current[index];
    if (
      !section ||
      !rail ||
      !slot ||
      refocusing.current ||
      !event.currentTarget.matches(":focus-visible")
    ) {
      return;
    }
    // Already in full view: inside the rail and not under the next card.
    const shown = slot.getBoundingClientRect();
    const next = slotRefs.current[index + 1]?.getBoundingClientRect();
    if (
      shown.right <= rail.getBoundingClientRect().right + 1 &&
      (!next || next.left >= shown.right - 1)
    ) {
      return;
    }
    const { peek, travel, width } = geometry.current;
    const along = clamp(index * (width - peek), 0, travel);
    const container = scroller?.current;
    // Next frame: the browser's own scroll-to-focus runs after this event
    // and would undo it. Instant, even on a smooth-scrolling page: focus
    // shouldn't wait for an animation.
    requestAnimationFrame(() => {
      if (container) {
        const top =
          section.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;
        container.scrollTo({ behavior: "instant", top: top + along });
      } else {
        const top = section.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ behavior: "instant", top: top + along });
      }
    });
  };

  const shared = {
    closeLabel,
    formatDate,
    linkLabel,
    readLabel,
    titleLevel,
  };

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        className={cn("relative bg-background text-foreground", className)}
        style={{
          height: "calc(var(--stage-h, 100svh) + var(--travel, 0px))",
          ...style,
        }}
        {...props}
      >
        <div
          ref={stageRef}
          className={cn(
            "sticky top-0 flex h-[var(--stage-h,100svh)] flex-col justify-center gap-8 overflow-x-clip py-8 sm:gap-12",
            out !== null && "z-50"
          )}
        >
          <HeadingTag
            className="px-5 text-[2.75rem] leading-none font-normal tracking-[-0.045em] sm:px-8 sm:text-6xl lg:px-10 lg:text-7xl xl:text-[5.5rem]"
            inert={out !== null}
          >
            {heading}
          </HeadingTag>

          <div className="px-5 sm:px-8 lg:px-10">
            <div
              ref={railRef}
              className="relative h-[clamp(22rem,calc(var(--stage-h,100svh)-14rem),34rem)]"
            >
              {/* Over the page and the cards under the open one, never
                  over the open card itself. */}
              <div
                ref={veilRef}
                aria-hidden
                className="pointer-events-none fixed inset-0 bg-background opacity-0"
                style={{ zIndex: (out ?? -1) * 2 + 1 }}
              />
              {features.map((feature, index) => (
                <div
                  key={feature.id}
                  ref={(node) => {
                    slotRefs.current[index] = node;
                  }}
                  className="absolute inset-y-0 left-0 w-[84%] will-change-transform sm:w-[64%] lg:w-[clamp(34rem,50%,52rem)]"
                  inert={out !== null && out !== index}
                  style={{
                    // Side by side until the scroll code takes over.
                    transform: `translateX(${index * 100}%)`,
                    // Fixed for good: the open card never jumps the deck.
                    // Even numbers, so the veil fits between two cards.
                    zIndex: (index + 1) * 2,
                  }}
                >
                  <FeatureCard
                    {...shared}
                    buttonRef={(node) => {
                      if (node) {
                        buttonRefs.current.set(feature.id, node);
                      } else {
                        buttonRefs.current.delete(feature.id);
                      }
                    }}
                    closeRef={(node) => {
                      if (open === index) {
                        closeRef.current = node;
                      }
                    }}
                    feature={feature}
                    frame={out === index ? frame : null}
                    idBase={`${idBase}-${feature.id}`}
                    index={index}
                    onButtonFocus={(event) => reveal(index, event)}
                    onClose={close}
                    onLayoutAnimationComplete={() => home(index)}
                    onOpen={() => openCard(index)}
                    open={open === index}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
};

export default EditorialSection;
