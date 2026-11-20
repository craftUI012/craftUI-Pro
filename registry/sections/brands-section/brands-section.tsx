"use client";

import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Brands section. A short list of brand names set very large, one of them
 * lit at a time. The lit row opens a small thumbnail in front of its name,
 * and on wide screens three of the brand's products settle in beside the
 * list. Every few seconds the next row lights up and, as it does, its name
 * rolls over to a brand the list hasn't shown yet, so the seven rows are a
 * window onto a longer roster.
 *
 * DIRECTION. Everything moves the way the light travels. Going down the
 * list (the cycle always does), the old name rolls up and away and the new
 * one comes up from below; the products rise into place from below while
 * the old ones drift up and blur out. Going up (pointing at a row above
 * the lit one), all of it runs the other way.
 *
 * THE ROLL. Both names sit in one grid cell (no absolute positioning, so
 * the row is always as wide as the wider name) under a perspective. The old
 * name tips back on X to 90° and rises half a row; the new one comes up
 * from 90° below. Both blur to 10px and fade on the way, which hides the
 * moment they cross. One spring drives all of it, with a slight overshoot,
 * so the new name tips a few degrees past flat and rocks back.
 *
 * ANIMATION STORYBOARD (each step, every `interval` ms)
 *
 *    0ms   the next row lights up: grey → foreground (200ms)
 *    0ms   its name rolls over to the next brand in the roster (spring,
 *          no bounce, lands in ~400ms)
 *    0ms   its thumbnail opens from zero width, pushing the name right;
 *          the previous row's closes (300ms ease-in-out)
 *    0ms   the new products fade in on top from the other side and
 *          sharpen; the old ones stay opaque underneath, drifting the
 *          way of travel and softening (both 600ms, one ease-out curve)
 *
 * Pointing at a row (resting on it 90ms) lights it and rolls its name over itself, up
 * or down by direction. Tabbing to a row lights it too, but with no roll
 * and no slide: keyboard moves stay instant. Either holds the cycle until
 * the pointer or focus leaves. The cycle only runs while the list is on
 * screen. With reduced motion nothing cycles by itself and every change is
 * instant.
 *
 * Since the cycle may never run (reduced motion, focus resting in the
 * list), a "Show more brands" button after the rows swaps the waiting
 * brands in at once. It's hidden until focused, and always shown with
 * reduced motion. Each brand's link carries its category, count and the
 * products' alt text as its description, since the photos themselves are
 * hidden from screen readers (they swap on every step).
 * ───────────────────────────────────────────────────────────────────────── */

// Everything below animates only `transform`, `opacity` and `filter`, each
// as a whole value (a `transform` string, not `y` / `rotateX`), so Motion
// hands it to the browser as a Web Animation that runs on the compositor
// instead of writing styles from JavaScript every frame.
const MOTION = {
  /** Small text under the products: arrives, and leaves quicker. */
  captionIn: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  captionOut: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  /**
   * How long the pointer rests on a row before it lights. Sweeping across
   * the list passes over rows in well under this, so only the row you stop
   * on rolls and swaps the products, instead of every row on the way.
   */
  hoverIntent: 90,
  /** The roll: no bounce, so the name glides into place and stops. */
  roll: { bounce: 0, type: "spring", visualDuration: 0.4 },
  /** Blur on a product as it comes and goes. Kept well under 20px. */
  shotBlur: 6,
  /**
   * Products, both ways, on one curve and one duration. The new shot fades
   * in on top while the old one stays fully opaque underneath (it only
   * drifts and softens), so the cell never shows through mid-swap: no dip
   * in brightness, no flicker.
   */
  shotMove: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  /** How far a product travels, as a share of its own height. */
  shotTravel: 6,
} as const;

/**
 * Shot sizes, cropped by Unsplash to each cell's shape (on a desktop the tall
 * shot is 4 columns by the list's height, the pair 2 columns by half of it,
 * both about 3 : 4): about twice the largest size a cell is drawn at, so
 * nothing larger is fetched, decoded or blurred.
 */
const SHOT_SIZES = [
  [640, 860],
  [400, 540],
  [400, 540],
] as const;

export interface BrandImage {
  /** Describes the product in the shot, for anyone who can't see it. */
  alt: string;
  /** Image URL. Crop it near the cell's shape (see `SHOT_SIZES`). */
  src: string;
}

export interface Brand {
  /** What the brand makes, shown under its products: "Ceramics". */
  category: string;
  /** Where the brand's row links to: its store or collection page. */
  href?: string;
  /** Three product shots: the tall one on the left, then top and bottom right. */
  images: [BrandImage, BrandImage, BrandImage];
  /** The brand's name, set large in the list. */
  name: string;
  /** How many of its products the store carries, shown under its products. */
  products?: number;
  /** Small square shown in front of the lit name. Defaults to the first image. */
  thumbnail?: string;
}

export interface BrandsSectionProps extends Omit<
  ComponentProps<"section">,
  "children"
> {
  /** The roster. Rows beyond `visible` wait their turn and roll in. */
  brands?: Brand[];
  /** The link under the subheader. Pass `null` to leave it out. */
  cta?: { href: string; label: string } | null;
  /** The subheader: one or two sentences beside the heading. */
  description?: string;
  /**
   * Draw the column grid over the section, the way a layout grid shows in a
   * design tool. Off by default: it's for checking alignment.
   */
  guides?: boolean;
  /** The section heading, top left. */
  heading?: string;
  /** Milliseconds each row stays lit while the cycle runs. */
  interval?: number;
  /** How many rows the list shows at once. */
  visible?: number;
}

const unsplash = (id: string, width: number, height = width) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&h=${height}&q=70`;

const brand = (
  name: string,
  category: string,
  products: number,
  shots: [id: string, alt: string][]
): Brand => ({
  category,
  href: "#",
  images: shots.map(([id, alt], shot) => ({
    alt,
    src: unsplash(id, SHOT_SIZES[shot][0], SHOT_SIZES[shot][1]),
  })) as [BrandImage, BrandImage, BrandImage],
  name,
  products,
  thumbnail: unsplash(shots[0][0], 160),
});

const DEFAULT_BRANDS: Brand[] = [
  brand("Kilnworks", "Ceramics", 48, [
    ["1687191883721-257d8cad5b54", "White ceramic vase on a white table"],
    ["1631125915973-e0d155a14e4e", "Three white ceramic jars"],
    ["1597696929736-6d13bed8e6a8", "Ceramic vases in neutral tones"],
  ]),
  brand("Ember Lane", "Candles", 26, [
    ["1602607203475-c5e99918dfc5", "Candle in a dark jar beside its lid"],
    ["1602607203588-d6d0eda790e3", "Black candle jars on stone blocks"],
    ["1572726729207-a78d6feb18d7", "Two amber glass candles"],
  ]),
  brand("Hollis & Rowe", "Leather goods", 34, [
    ["1691480150204-66dd1eb77391", "Brown leather handbag"],
    ["1548175604-bc2d52e2271f", "Round leather case, open"],
    ["1645276255969-680d5b62789d", "Black leather bag"],
  ]),
  brand("Lumo Studio", "Lighting", 19, [
    ["1769255119650-f658d3dbc397", "Table lamp with a wooden base, lit"],
    ["1710934600592-17d9e5674f1c", "White dome lamp shade"],
    ["1685302874389-ed7790984a2e", "Floor lamp beside a plant"],
  ]),
  brand("Clearwater", "Glassware", 41, [
    ["1774283425516-4958ed906dce", "Stemmed glasses on white"],
    ["1575624848988-154eddea5184", "Smoked wine glasses"],
    ["1609637130666-df885bc55b83", "Coloured glass vessels"],
  ]),
  brand("Saltwood", "Furniture", 22, [
    ["1505843490538-5133c6c7d0e1", "White shell chair on wooden legs"],
    ["1691380302791-7a0be56f28fd", "Blue metal chair with a wooden seat"],
    ["1659729927017-b2d4fd4b3698", "Green wooden chair"],
  ]),
  brand("Pell", "Skincare", 30, [
    ["1626897844971-aef92643f056", "Amber dropper bottle"],
    ["1611080541716-4de04385fbae", "Blue balm jar"],
    ["1611080541626-4ecc5ead618d", "Pink balm jar"],
  ]),
  brand("Morrow", "Tableware", 27, [
    ["1687158179173-b9f3eac1fde9", "Two cream mugs"],
    ["1650959858546-d09833d5317b", "White mug on white"],
    ["1616241673111-508b4662c707", "White mug by a window"],
  ]),
  brand("Solen", "Eyewear", 16, [
    ["1584036553516-bf83210aa16c", "Black sunglasses on white"],
    ["1649119161997-00ffc8c24e11", "Round sunglasses with thin frames"],
    ["1653038282189-803202722a05", "Small dark sunglasses"],
  ]),
  brand("Quietform", "Audio", 12, [
    ["1641048930621-ab5d225ae5b0", "Black over-ear headphones"],
    ["1546435770-a3e426bf472b", "Grey headphones on white"],
    ["1583394838336-acd977736f90", "Wired headphones on white"],
  ]),
  brand("Vale Parfums", "Fragrance", 18, [
    ["1612871178341-33f941a841e3", "Clear perfume bottle with a gold cap"],
    ["1718833858193-b89cd20ec6c0", "Slim dark perfume bottle"],
    ["1694179023466-cb438ce7ae0b", "Square glass perfume bottle"],
  ]),
];

/* ── Cycle state ─────────────────────────────────────────────────────────
 * `slots` holds the brand shown in each row; `queue` the brands waiting, in
 * the order they will roll in. Advancing lights the next row and swaps its
 * brand for the head of the queue; the brand it replaces joins the back. */

interface Cycle {
  active: number;
  /** 1 when the light last moved down the list, -1 when it moved up. */
  direction: 1 | -1;
  queue: number[];
  /** The last change came from the keyboard: show it without motion. */
  instant: boolean;
  /** Per row, how many times it has lit up: a new count re-rolls its name. */
  rolls: number[];
  slots: number[];
}

type CycleAction =
  | { type: "advance" }
  | { type: "more" }
  | { keyboard: boolean; row: number; type: "select" };

const startCycle = ({ total, visible }: { total: number; visible: number }) => {
  const rows = Math.min(visible, total);
  return {
    active: 0,
    direction: 1,
    instant: false,
    queue: Array.from({ length: total - rows }, (_, i) => rows + i),
    rolls: Array.from({ length: rows }, () => 0),
    slots: Array.from({ length: rows }, (_, i) => i),
  } satisfies Cycle;
};

const rollRow = (rolls: number[], row: number) =>
  rolls.map((count, i) => (i === row ? count + 1 : count));

const cycleReducer = (state: Cycle, action: CycleAction): Cycle => {
  if (action.type === "more") {
    // Every waiting brand (up to a row each) rolls in at once, below the lit
    // row as the cycle would bring them, and the light stays where it is.
    let next = state;
    const steps = Math.min(state.queue.length, state.slots.length);
    for (let i = 0; i < steps; i += 1) {
      next = cycleReducer(next, { type: "advance" });
    }
    return { ...next, active: state.active, instant: true };
  }
  if (action.type === "select") {
    if (state.active === action.row) {
      return state;
    }
    return {
      ...state,
      active: action.row,
      direction: action.row > state.active ? 1 : -1,
      instant: action.keyboard,
      // A keyboard move lights the row without rolling its name.
      rolls: action.keyboard ? state.rolls : rollRow(state.rolls, action.row),
    };
  }
  // The cycle always travels down, wrapping from the last row to the first.
  const next = (state.active + 1) % state.slots.length;
  const moved = {
    ...state,
    active: next,
    direction: 1 as const,
    instant: false,
    rolls: rollRow(state.rolls, next),
  };
  if (state.queue.length === 0) {
    return moved;
  }
  const [incoming, ...rest] = state.queue;
  const slots = [...state.slots];
  const outgoing = slots[next];
  slots[next] = incoming;
  return { ...moved, queue: [...rest, outgoing], slots };
};

/* ── Pieces ────────────────────────────────────────────────────────────── */

// `d` is the direction of travel: 1 down the list, -1 up it. Going down,
// the new name comes from below (tipped back -90°) and the old one leaves
// upward; going up, the reverse.
const ROLL_VARIANTS = {
  enter: (d: 1 | -1) => ({
    filter: "blur(10px)",
    opacity: 0,
    transform: `translateY(${50 * d}%) rotateX(${-90 * d}deg)`,
  }),
  exit: (d: 1 | -1) => ({
    filter: "blur(10px)",
    opacity: 0,
    transform: `translateY(${-50 * d}%) rotateX(${90 * d}deg)`,
  }),
  rest: {
    filter: "blur(0px)",
    opacity: 1,
    transform: "translateY(0%) rotateX(0deg)",
  },
};

const RollingName = ({
  direction,
  name,
  roll,
  still,
}: {
  direction: 1 | -1;
  name: string;
  roll: number;
  still: boolean;
}) => (
  <span className="pointer-events-none grid min-w-0 perspective-normal">
    <AnimatePresence custom={direction} initial={false}>
      <motion.span
        animate="rest"
        className="col-start-1 row-start-1 -my-2 min-w-0 truncate py-2"
        custom={direction}
        exit="exit"
        initial="enter"
        key={`${name}:${roll}`}
        transition={still ? { duration: 0 } : MOTION.roll}
        variants={ROLL_VARIANTS}
      >
        {name}
      </motion.span>
    </AnimatePresence>
  </span>
);

// Products travel with the light: arriving from the side it's heading
// away from, leaving toward the side it's heading to. `still` (reduced
// motion) makes the leave instant too, since the exit carries its own timing.
interface ShotMove {
  d: 1 | -1;
  still: boolean;
}

// The arriving shot is always on top (zIndex 1) and fades in; the leaving
// one drops underneath (zIndex 0) and keeps its opacity, only drifting the
// other way and softening, over the same duration. Opacity never dips below
// full cover, so nothing behind the cell shows through. No scale: resampling
// a detailed photo while it scales shimmers.
const SHOT_VARIANTS = {
  enter: ({ d }: ShotMove) => ({
    filter: `blur(${MOTION.shotBlur}px)`,
    opacity: 0,
    transform: `translateY(${MOTION.shotTravel * d}%)`,
    zIndex: 1,
  }),
  exit: ({ d, still }: ShotMove) => ({
    filter: `blur(${MOTION.shotBlur}px)`,
    transform: `translateY(${-MOTION.shotTravel * d}%)`,
    transition: still ? { duration: 0 } : MOTION.shotMove,
    zIndex: 0,
  }),
  rest: {
    filter: "blur(0px)",
    opacity: 1,
    transform: "translateY(0%)",
    zIndex: 1,
  },
};

/** Decode a preloaded image now; if that fails it simply decodes on mount. */
const decodeAhead = async (image: HTMLImageElement) => {
  try {
    await image.decode();
  } catch {
    // Nothing to do: the shot still loads normally when it mounts.
  }
};

/* ── The grid ─────────────────────────────────────────────────────────────
 * Every row of the section is this grid: 4 columns on a phone, 8 from md,
 * 12 from lg, with a 1rem gutter (1.5rem from lg). Each row is the same
 * width with the same template, so their column edges line up exactly, and
 * every piece is placed only by column start and span: no fractions, no
 * max-widths, no inner padding. The `guides` overlay is drawn from the same
 * constant, so what it shows is the grid the layout actually uses.
 *
 *              phone (4)     tablet (8)          desktop (12)
 *   heading    h2 1–4        h2 1–8              h2 1–6
 *              copy 1–4      copy 1–6            copy 7–11
 *              + link under the copy, same columns
 *   main       list 1–4      list 1–8            list 1–6
 *              tall 1–2      tall 1–5            tall 7–10
 *              pair 3–4      pair 6–8            pair 11–12
 *   caption    name 1–3      name 1–5            name 7–10
 *              count 4       count 6–8           count 11–12
 * ───────────────────────────────────────────────────────────────────────── */

const GRID =
  "grid grid-cols-4 gap-x-4 md:grid-cols-8 lg:grid-cols-12 lg:gap-x-6";

/**
 * Where each of a brand's three shots sits in the main row. Below lg they
 * sit under the list (rows 2–3), the pair as squares the tall shot matches;
 * from lg beside it, both rows sharing the list's height.
 */
const CELLS = [
  "col-span-2 col-start-1 row-span-2 row-start-2 md:col-span-5 lg:col-span-4 lg:col-start-7 lg:row-start-1",
  "col-span-2 col-start-3 row-start-2 aspect-square md:col-span-3 md:col-start-6 lg:col-span-2 lg:col-start-11 lg:row-start-1 lg:aspect-auto",
  "col-span-2 col-start-3 row-start-3 aspect-square md:col-span-3 md:col-start-6 lg:col-span-2 lg:col-start-11 lg:row-start-2 lg:aspect-auto",
];

// The caption under the products follows the same direction as the rest,
// over a shorter distance: it's small text, so it only needs a nudge.
const CAPTION_VARIANTS = {
  enter: ({ d }: ShotMove) => ({
    opacity: 0,
    transform: `translateY(${60 * d}%)`,
  }),
  exit: ({ d, still }: ShotMove) => ({
    opacity: 0,
    transform: `translateY(${-60 * d}%)`,
    transition: still ? { duration: 0 } : MOTION.captionOut,
  }),
  rest: { opacity: 1, transform: "translateY(0%)" },
};

const ArrowIcon = () => (
  <svg
    aria-hidden
    className="size-3.5"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.5}
    viewBox="0 0 16 16"
  >
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

/** The layout grid, drawn: one tinted band per live column. */
const GridGuides = () => (
  <div
    aria-hidden
    className={cn(
      GRID,
      "pointer-events-none absolute inset-x-0 -inset-y-16 z-10 md:-inset-y-24 lg:-inset-y-32"
    )}
  >
    {Array.from({ length: 12 }, (_, column) => (
      <div
        className={cn(
          "bg-primary/10",
          column >= 4 && column < 8 && "max-md:hidden",
          column >= 8 && "max-lg:hidden"
        )}
        key={column}
      />
    ))}
  </div>
);

/* ── Section ───────────────────────────────────────────────────────────── */

export const BrandsSection = ({
  brands = DEFAULT_BRANDS,
  className,
  cta = { href: "#", label: "Browse all brands" },
  description = "Independent makers we stock and stand behind, from small-batch ceramics to everyday carry. New names join every week.",
  guides = false,
  heading = "Shop from brands like",
  interval = 3000,
  visible = 7,
  ...props
}: BrandsSectionProps) => {
  const [cycle, dispatch] = useReducer(
    cycleReducer,
    { total: brands.length, visible },
    startCycle
  );
  const [held, setHeld] = useState({ focus: false, pointer: false });
  const list = useRef<HTMLUListElement>(null);
  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);
  const onScreen = useInView(list, { amount: 0.3 });
  const reduced = useReducedMotion() ?? false;
  const idBase = useId();
  // What "Show more brands" brought in, read out once by the status line.
  const [announcement, setAnnouncement] = useState("");

  const running = onScreen && !reduced && !held.focus && !held.pointer;

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = window.setInterval(
      () => dispatch({ type: "advance" }),
      interval
    );
    return () => window.clearInterval(id);
  }, [running, interval]);

  const activeBrand = cycle.slots[cycle.active];

  // Warm the cache for every brand a row shows plus the next one in line,
  // so a brand's products have loaded before they slide in.
  const warmed = useRef(new Set<number>());
  // Held so the decoded images aren't garbage-collected before they show.
  const decoded = useRef<HTMLImageElement[]>([]);
  const [nextUp] = cycle.queue;
  useEffect(() => {
    if (!onScreen) {
      return;
    }
    for (const index of [...cycle.slots, nextUp]) {
      if (index === undefined || warmed.current.has(index)) {
        continue;
      }
      warmed.current.add(index);
      for (const image of brands[index].images) {
        // Load and decode ahead of time: a shot that is still decoding when
        // it mounts paints a blank frame first, which reads as a flicker.
        const preload = new Image();
        preload.src = image.src;
        decodeAhead(preload);
        decoded.current.push(preload);
      }
    }
  }, [brands, cycle.slots, nextUp, onScreen]);

  const lit = brands[activeBrand];
  const still = reduced || cycle.instant;
  const move: ShotMove = { d: cycle.direction, still };

  const showMore = () => {
    const incoming = cycle.queue
      .slice(0, cycle.slots.length)
      .map((index) => brands[index].name);
    dispatch({ type: "more" });
    setAnnouncement(`Now showing ${incoming.join(", ")}.`);
  };

  return (
    <section
      data-slot="brands-section"
      className={cn(
        "relative overflow-clip bg-background px-4 py-16 text-foreground md:px-8 md:py-24 lg:py-32",
        className
      )}
      {...props}
    >
      <div className="relative mx-auto max-w-7xl">
        {guides ? <GridGuides /> : null}

        {/* Heading row: the heading, and beside it the subheader with the
            link under it; the link's line sits level with the heading's. */}
        <div className={cn(GRID, "items-end gap-y-4")}>
          <h2 className="col-span-4 text-4xl leading-none font-medium tracking-[-0.04em] text-balance md:col-span-8 md:text-5xl lg:col-span-6">
            {heading}
          </h2>
          <div className="col-span-4 flex flex-col items-start gap-4 md:col-span-6 lg:col-span-5 lg:col-start-7">
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground md:text-base">
              {description}
            </p>
            {cta ? (
              <Button
                className="h-auto gap-1.5 p-0 text-sm font-normal text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground has-[>svg]:px-0"
                variant="link"
                nativeButton={false}
                render={<a href={cta.href} />}
              >
                {cta.label}
                <ArrowIcon />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Main row: the roster, and the lit brand's products beside it. */}
        <div
          className={cn(
            GRID,
            "mt-12 gap-y-4 lg:mt-16 lg:grid-rows-2 lg:gap-y-6"
          )}
        >
          {/* Flex gaps, not space-y: the hidden "Show more brands" row is
              out of flow until shown, so it adds no space at rest. */}
          <ul
            className="col-span-4 row-start-1 -mb-2 flex min-w-0 flex-col gap-1 pb-2 mask-[linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] max-lg:mb-6 md:col-span-8 md:gap-2 lg:col-span-6 lg:row-span-2 lg:mask-none"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setHeld((h) => ({ ...h, focus: false }));
              }
            }}
            onFocus={() => setHeld((h) => ({ ...h, focus: true }))}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") {
                setHeld((h) => ({ ...h, pointer: true }));
              }
            }}
            onPointerLeave={() => setHeld((h) => ({ ...h, pointer: false }))}
            ref={list}
          >
            {cycle.slots.map((brandIndex, row) => {
              const item = brands[brandIndex];
              const isLit = row === cycle.active;
              const detailsId = `${idBase}-details-${row}`;
              return (
                <li key={row}>
                  {/* The products' alt text, as the link's description. */}
                  <span hidden id={detailsId}>
                    {[
                      item.category,
                      item.products ? `${item.products} products` : null,
                      ...item.images.map((image) => image.alt),
                    ]
                      .filter(Boolean)
                      .join(". ")}
                  </span>
                  <a
                    aria-describedby={detailsId}
                    aria-label={item.name}
                    className={cn(
                      "group/brand relative flex min-h-10 w-full items-center rounded-lg transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground motion-reduce:transition-none sm:min-h-12 lg:min-h-16 xl:min-h-18",
                      isLit ? "text-foreground" : "text-foreground/45"
                    )}
                    data-active={isLit || undefined}
                    draggable={false}
                    href={item.href ?? "#"}
                    onFocus={() =>
                      dispatch({ keyboard: true, row, type: "select" })
                    }
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "mouse") {
                        return;
                      }
                      window.clearTimeout(intent.current);
                      intent.current = window.setTimeout(
                        () =>
                          dispatch({ keyboard: false, row, type: "select" }),
                        MOTION.hoverIntent
                      );
                    }}
                    onPointerLeave={() => window.clearTimeout(intent.current)}
                  >
                    <span className="pointer-events-none block h-10 w-0 shrink-0 overflow-hidden rounded-md transition-[width,margin-right] duration-300 ease-[cubic-bezier(0.645,0.045,0.355,1)] group-data-active/brand:mr-3 group-data-active/brand:w-10 motion-reduce:transition-none sm:h-12 sm:group-data-active/brand:w-12 lg:h-16 lg:rounded-xl lg:group-data-active/brand:mr-4 lg:group-data-active/brand:w-16 xl:h-18 xl:group-data-active/brand:w-18">
                      {/* oxlint-disable-next-line nextjs/no-img-element -- Any URL the host passes, with no next.config image domains to set up. */}
                      <img
                        alt=""
                        className="size-10 max-w-none bg-muted object-cover sm:size-12 lg:size-16 xl:size-18"
                        decoding="async"
                        draggable={false}
                        loading="lazy"
                        src={item.thumbnail ?? item.images[0].src}
                      />
                    </span>
                    <span className="min-w-0 text-4xl leading-none font-medium tracking-[-0.04em] whitespace-nowrap sm:text-5xl lg:text-6xl xl:text-7xl">
                      <RollingName
                        direction={cycle.direction}
                        name={item.name}
                        roll={cycle.rolls[row]}
                        still={still}
                      />
                    </span>
                  </a>
                </li>
              );
            })}
            {cycle.queue.length > 0 ? (
              <li className="sr-only focus-within:not-sr-only motion-reduce:not-sr-only">
                <button
                  className="rounded-sm py-1 text-sm text-muted-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                  onClick={showMore}
                  type="button"
                >
                  Show more brands
                </button>
              </li>
            ) : null}
          </ul>
          <p className="sr-only" role="status">
            {announcement}
          </p>

          {CELLS.map((cell, shot) => (
            <div
              aria-hidden
              className={cn(
                "relative overflow-hidden rounded-md bg-muted",
                cell
              )}
              key={shot}
            >
              <AnimatePresence custom={move} initial={false}>
                <motion.img
                  alt=""
                  animate="rest"
                  className="absolute inset-0 size-full object-cover"
                  custom={move}
                  decoding="async"
                  draggable={false}
                  exit="exit"
                  initial="enter"
                  key={activeBrand}
                  src={lit.images[shot].src}
                  transition={still ? { duration: 0 } : MOTION.shotMove}
                  variants={SHOT_VARIANTS}
                />
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Caption row, under the products. */}
        <div
          className={cn(GRID, "mt-3 overflow-hidden text-xs leading-normal")}
        >
          <AnimatePresence custom={move} initial={false}>
            <motion.p
              animate="rest"
              className="col-span-4 row-start-1 grid grid-cols-subgrid md:col-span-8 lg:col-span-6 lg:col-start-7"
              custom={move}
              exit="exit"
              initial="enter"
              key={activeBrand}
              transition={still ? { duration: 0 } : MOTION.captionIn}
              variants={CAPTION_VARIANTS}
            >
              <span className="col-span-3 truncate md:col-span-5 lg:col-span-4">
                <span className="font-medium">{lit.name}</span>
                <span className="text-muted-foreground"> · {lit.category}</span>
              </span>
              {lit.products ? (
                <span className="col-span-1 text-right text-muted-foreground tabular-nums md:col-span-3 lg:col-span-2">
                  {lit.products} products
                </span>
              ) : null}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default BrandsSection;
