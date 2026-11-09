"use client";

import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "motion/react";
import type { Transition } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Swap grid. A row of tall photo cards, each one a product, a project or
 * a person. Pick one and it travels and grows into a large pane with its
 * story, while the others shrink into a small rail beside it; pick another
 * and the two swap, passing each other mid-flight. Nothing fades out and
 * back in: every card is the same element the whole time, only bigger,
 * smaller or somewhere else.
 *
 * ANIMATION STORYBOARD
 *
 *  browsing   the cards stand side by side (stacked as bands on phones),
 *             each with its name and line at the bottom
 *     0ms     pick one: it grows into the pane while the rest shrink into
 *             a two-by-two rail (a row on phones), one spring, 550ms
 *   220ms     the photo has nearly landed: the back button and the pane's
 *             text rise in, line by line, 40ms apart
 *  switching  pick a thumbnail: the open card shrinks back into the rail as
 *             the new one grows into the pane, the same spring
 *  back       the back button or Escape: the card returns to its place and
 *             the others grow back around it
 *
 * The photo inside each card keeps its own shape while the card changes
 * its, so it's never stretched mid-flight; it's only cropped differently.
 * With reduced motion every change is instant.
 * ───────────────────────────────────────────────────────────────────────── */

/** The cards' movement: one spring for every grow, shrink and swap. */
const MOVE: Transition = { bounce: 0.12, duration: 0.55, type: "spring" };
/** Text leaving: quick, so it never rides along with a moving card. */
const LEAVE: Transition = { duration: 0.15, ease: "easeOut" };
/** The pane's text: when the first line starts, and the gap between lines (s). */
const TEXT = { lead: 0.22, stagger: 0.04 } as const;
/** Every card's corner radius (px): the photo's clip and the focus ring
 * share this one curve. */
const RADIUS = 8;

export interface SwapGridItem {
  /** The photo's URL. Portrait photos (about 3:4) fit best; it's cropped to fill each card. */
  image: string;
  /** What the photo shows, for screen readers. */
  alt: string;
  /** Which part of the photo to keep in view when it's cropped, like CSS `object-position`, e.g. "50% 25%" for a face near the top. Defaults to "50% 50%", the centre. */
  focus?: string;
  /** The name: a product, a project or a person. Must be unique in the list. */
  title: string;
  /** A short line under the name, e.g. a price, a role or "Residential · Lisbon". */
  subtitle?: string;
  /** A sentence or two shown in the pane. */
  description?: string;
  /** A link at the bottom of the pane, e.g. a product or case study page. */
  href?: string;
  /** The link's text. Defaults to "Learn more". */
  linkLabel?: string;
}

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

/** The demo items: a small ceramics shop's collection, in warm low light.
 * Exported, so you can start from them. */
export const swapGridItems: SwapGridItem[] = [
  {
    alt: "Three stoneware vases by a window in late red light",
    description:
      "Three hand-thrown stoneware vases, glazed to catch the last light of the day. Each one comes out of the kiln a little different.",
    focus: "50% 75%",
    href: "#",
    image: photo("1791474582148-bb1101815ad0"),
    linkLabel: "Add to bag",
    subtitle: "Set of three · $180",
    title: "Dusk vases",
  },
  {
    alt: "Two tall terracotta vases against a warm wall",
    description:
      "Raw terracotta, burnished by hand. Tall enough for branches, steady enough for a windowsill.",
    focus: "50% 60%",
    href: "#",
    image: photo("1760402327535-85a771fb034c"),
    linkLabel: "Add to bag",
    subtitle: "Terracotta pair · $140",
    title: "Tall pair",
  },
  {
    alt: "Glazed jars of different heights in low light",
    description:
      "Five jars from one firing, each glaze a test we liked too much to throw away. Sold one at a time.",
    focus: "50% 60%",
    href: "#",
    image: photo("1669060699449-3d6ff88006a8"),
    linkLabel: "Add to bag",
    subtitle: "Glaze study · from $96",
    title: "Kiln jars",
  },
  {
    alt: "A small round grey vase on a grey table",
    description:
      "A palm-sized vase for a single stem. Matte outside, glossy inside, made to hold water for good.",
    focus: "50% 60%",
    href: "#",
    image: photo("1787715746360-fec6df99f29c"),
    linkLabel: "Add to bag",
    subtitle: "Stoneware · $64",
    title: "Pebble vase",
  },
  {
    alt: "A cream two-handled jug holding paper flowers",
    description:
      "Two handles, one wobble on purpose. The first piece we ever sold, still made the same way.",
    focus: "50% 65%",
    href: "#",
    image: photo("1765283271840-8d2c94e6e7cb"),
    linkLabel: "Add to bag",
    subtitle: "Stoneware · $72",
    title: "Bloom jug",
  },
];

export interface SwapGridProps extends Omit<
  ComponentProps<"div">,
  "children" | "onChange"
> {
  /** The cards, in order. Four to six fit best. Defaults to `swapGridItems`, a ceramics shop's collection. */
  items?: SwapGridItem[];
  /** The card that's open at first, by its place in `items` (from 0). Defaults to none: all the cards side by side. */
  defaultOpen?: number;
  /** Called with the open card's place in `items`, or null when all are side by side again. */
  onOpenChange?: (index: number | null) => void;
  /** What the back button says to screen readers. Defaults to "Back to all". */
  backLabel?: string;
}

/** Where the photo sits inside a card: a box with the photo's own shape,
 * at least as big as the card each way, placed at the item's focus point.
 * Its shape never changes, so the card can change shape around it without
 * stretching it. */
const PHOTO_BOX =
  "pointer-events-none absolute aspect-[3/4] min-h-full min-w-full max-w-none bg-muted bg-cover bg-center";

/** "50% 75%" → the box's place, like `object-position` does for an image. */
const placeOf = (focus = "50% 50%"): CSSProperties => {
  const [x = 50, y = x] = focus
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .filter((n) => Number.isFinite(n));
  return { left: `${x}%`, top: `${y}%`, translate: `-${x}% -${y}%` };
};

/** A card's photo: the part that travels between the grid and the pane. */
/** The shades that keep white text readable on any photo. They live
 * inside the photo's clip, so their edge is the photo's edge: a separate
 * rounded layer on top never quite matches the curve and lets the photo
 * show at the corners. */
const SHADES = {
  /** Under a card's name and line, in the grid. */
  caption: "h-28 max-h-full bg-linear-to-t from-black/60 to-transparent",
  /** Under the pane's story. */
  pane: "h-3/4 bg-linear-to-t from-black/80 via-black/45 to-transparent",
} as const;

const Photo = ({
  item,
  layoutId,
  shade,
}: {
  item: SwapGridItem;
  layoutId: string;
  /** Which shade to show at the bottom, if any. */
  shade?: keyof typeof SHADES;
}) => (
  <motion.span
    className="absolute inset-0 block"
    layoutId={layoutId}
    // Rounded with one clip over its own layer, so the photo and its shade
    // are drawn together first and rounded once. With `overflow: hidden` and
    // a radius (or a clip without its own layer) the browser rounds each one
    // separately, and along the curve the half-drawn photo shows through the
    // half-drawn shade as a thin light line.
    style={{
      clipPath: `inset(0 round ${RADIUS}px)`,
      willChange: "transform",
    }}
  >
    {/* Shared too, not just `layout`: it flies from its old box to its new
        one on the same spring as the card, so at every frame it's still 3:4
        and still covers the card. With plain `layout` a freshly mounted
        photo jumps to its final size and leaves a gap while the card is
        still shrinking. */}
    <motion.span
      className={PHOTO_BOX}
      layoutId={`${layoutId}-photo`}
      style={{
        ...placeOf(item.focus),
        backgroundImage: `url("${item.image}")`,
      }}
    />
    <AnimatePresence initial={false}>
      {shade ? (
        <motion.span
          animate={{ opacity: 1 }}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 block",
            SHADES[shade]
          )}
          exit={{ opacity: 0, transition: LEAVE }}
          initial={{ opacity: 0 }}
          key={shade}
          transition={{ ...MOVE, delay: shade === "pane" ? TEXT.lead : 0.1 }}
        />
      ) : null}
    </AnimatePresence>
  </motion.span>
);

const ArrowLeft = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

/** Drawn edge to edge in its box and sized in em, so it scales with the
 * text. It sits a touch below the baseline, because an up-right arrow's
 * weight is at its top right and on the baseline it reads as floating. */
const ArrowUpRight = () => (
  <svg
    aria-hidden="true"
    className="ml-[0.45em] inline-block size-[0.7em] align-[-0.1em]"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.5}
    viewBox="0 0 10 10"
  >
    <path d="M1.25 8.75 8.75 1.25M3 1.25h5.75V7" />
  </svg>
);

/** One line of the pane's text, rising in after the card has nearly landed. */
const Line = ({
  rank,
  className,
  children,
  as = "p",
}: {
  rank: number;
  className?: string;
  children: ReactNode;
  as?: "p" | "h3" | "div";
}) => {
  const Tag = motion[as];
  return (
    <Tag
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      transition={{ ...MOVE, delay: TEXT.lead + rank * TEXT.stagger }}
    >
      {children}
    </Tag>
  );
};

/** The open card: its photo, and its story laid over the bottom. */
const Pane = ({
  item,
  uid,
  backLabel,
  onBack,
  titleRef,
}: {
  item: SwapGridItem;
  uid: string;
  backLabel: string;
  onBack: () => void;
  titleRef: RefObject<HTMLSpanElement | null>;
}) => (
  <motion.section
    aria-labelledby={`${uid}-title`}
    className="relative min-h-0 min-w-0 flex-[1.4] md:flex-[1.35]"
    exit={{ opacity: 0, transition: LEAVE }}
    key="pane"
    layout
  >
    {/* Keyed by item, so a swap mounts a new photo that flies in from the
        rail, instead of re-pointing this one at another card. */}
    <Photo
      item={item}
      key={`photo-${item.title}`}
      layoutId={`${uid}-${item.title}`}
      shade="pane"
    />

    {/* Laid over a photo, not the page, so it stays white in both themes. */}
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6"
      exit={{ opacity: 0, transition: LEAVE }}
      initial={{ opacity: 0 }}
      key={`text-${item.title}`}
      transition={{ ...MOVE, delay: TEXT.lead }}
    >
      {item.subtitle ? (
        <Line className="text-xs text-white/70 sm:text-sm" rank={0}>
          {item.subtitle}
        </Line>
      ) : null}
      <Line
        as="h3"
        className="mt-1 text-2xl leading-tight font-medium tracking-[-0.02em] text-balance sm:text-3xl"
        rank={1}
      >
        <span
          className="outline-none"
          id={`${uid}-title`}
          ref={titleRef}
          tabIndex={-1}
        >
          {item.title}
        </span>
      </Line>
      {item.description ? (
        <Line
          className="mt-2 max-w-[46ch] text-sm leading-relaxed text-pretty text-white/80"
          rank={2}
        >
          {item.description}
        </Line>
      ) : null}
      {item.href ? (
        <Line as="div" className="mt-4" rank={3}>
          <a
            className="rounded-sm text-sm font-medium text-white underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/70"
            href={item.href}
          >
            {item.linkLabel ?? "Learn more"}
            <ArrowUpRight />
          </a>
        </Line>
      ) : null}
    </motion.div>

    {/* Belongs to the photo, not the pane: keyed by item, it leaves with
        the old photo on a swap and comes back with the text once the new
        one has nearly landed, so it never floats over an empty pane. */}
    <motion.button
      animate={{ opacity: 1, scale: 1 }}
      aria-label={backLabel}
      className="absolute top-3 left-3 flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/85 text-neutral-950 backdrop-blur-sm transition-colors outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white/70 sm:top-4 sm:left-4"
      exit={{ opacity: 0, transition: LEAVE }}
      initial={{ opacity: 0, scale: 0.9 }}
      key={`back-${item.title}`}
      onClick={onBack}
      transition={{ ...MOVE, delay: TEXT.lead }}
      type="button"
      whileTap={{ scale: 0.94 }}
    >
      <ArrowLeft />
    </motion.button>
  </motion.section>
);

/** A card in the grid or the rail. */
const Card = ({
  item,
  uid,
  browsing,
  onPick,
  buttonRef,
}: {
  item: SwapGridItem;
  uid: string;
  browsing: boolean;
  onPick: () => void;
  buttonRef: (node: HTMLButtonElement | null) => void;
}) => (
  <motion.button
    aria-label={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
    className={cn(
      "group relative min-h-0 min-w-0 cursor-pointer rounded-[8px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      browsing ? "flex-1" : "aspect-square md:aspect-auto"
    )}
    layout
    onClick={onPick}
    ref={buttonRef}
    type="button"
    whileTap={{ scale: 0.97 }}
  >
    <Photo
      item={item}
      layoutId={`${uid}-${item.title}`}
      shade={browsing ? "caption" : undefined}
    />
    <AnimatePresence initial={false}>
      {browsing ? (
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-x-0 bottom-0 block p-3 text-left text-white sm:p-4"
          exit={{ opacity: 0, transition: LEAVE }}
          initial={{ opacity: 0, y: 6 }}
          key="caption"
          transition={{ ...MOVE, delay: 0.1 }}
        >
          <span className="block truncate text-sm font-medium">
            {item.title}
          </span>
          {item.subtitle ? (
            <span className="block truncate text-xs text-white/70">
              {item.subtitle}
            </span>
          ) : null}
        </motion.span>
      ) : null}
    </AnimatePresence>
  </motion.button>
);

const SwapGrid = ({
  items = swapGridItems,
  defaultOpen,
  onOpenChange,
  backLabel = "Back to all",
  className,
  onKeyDown,
  ...props
}: SwapGridProps) => {
  const uid = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(
    defaultOpen !== undefined && items[defaultOpen] ? defaultOpen : null
  );
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const titleRef = useRef<HTMLSpanElement>(null);
  // Where focus goes after the next change: the pane's title, or a card.
  const focusNext = useRef<string | null>(null);

  const open = openIndex === null ? null : (items[openIndex] ?? null);

  const choose = useCallback(
    (index: number | null) => {
      const leaving = open;
      focusNext.current = index === null ? (leaving?.title ?? null) : "title";
      setOpenIndex(index);
      onOpenChange?.(index);
    },
    [open, onOpenChange]
  );

  // Moves focus once the change has rendered, so keyboard and screen
  // reader users land on the new story, or back on the card they opened.
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "title") {
      titleRef.current?.focus({ preventScroll: true });
    } else if (target) {
      buttons.current.get(target)?.focus({ preventScroll: true });
    }
  }, [openIndex]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      choose(null);
    }
    onKeyDown?.(event);
  };

  return (
    <MotionConfig reducedMotion="user" transition={MOVE}>
      <LayoutGroup id={uid}>
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- only catches Escape bubbling up from the buttons inside */}
        <div
          className={cn(
            "flex h-[34rem] w-full flex-col gap-2 sm:h-[38rem] sm:gap-3 md:aspect-[2/1] md:h-auto md:flex-row",
            className
          )}
          data-slot="swap-grid"
          onKeyDown={handleKeyDown}
          {...props}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {open ? (
              <Pane
                backLabel={backLabel}
                item={open}
                key="pane"
                onBack={() => choose(null)}
                titleRef={titleRef}
                uid={uid}
              />
            ) : null}
          </AnimatePresence>

          <motion.div
            className={cn(
              "min-h-0 min-w-0 gap-2 sm:gap-3",
              open
                ? "grid shrink-0 grid-cols-[repeat(var(--rail),minmax(0,1fr))] md:flex-1 md:auto-rows-fr md:grid-cols-2"
                : "flex flex-1 flex-col md:flex-row"
            )}
            layout
            style={{ "--rail": Math.min(5, items.length - 1) } as CSSProperties}
          >
            {items.map((item, index) =>
              index === openIndex ? null : (
                <Card
                  browsing={!open}
                  buttonRef={(node) => {
                    if (node) {
                      buttons.current.set(item.title, node);
                    } else {
                      buttons.current.delete(item.title);
                    }
                  }}
                  item={item}
                  key={item.title}
                  onPick={() => choose(index)}
                  uid={uid}
                />
              )
            )}
          </motion.div>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
};

export default SwapGrid;
