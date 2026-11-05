"use client";

/* oxlint-disable nextjs/no-img-element -- a registry section can't assume next/image is set up for the user's image host */
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Artwork fan hero. A centred headline, a fanned row of artworks with two
 * small hand-drawn hint, a line of copy and two pill actions. A client
 * component only for which card is open; every motion is CSS.
 *
 * The fan, per device (plain sm / md / lg breakpoints):
 *   phone    4 cards, each 42% of the row, overlapping about half
 *   tablet   5 cards at 30%
 *   desktop  7 cards at 23% (overlap ≈ 44%, as in the design)
 * Each card's slot gives its left edge, its drop along a gentle arc (the
 * middle rides highest, the ends sit lower), its tilt (the ends lean out
 * about 7°, with a little hand-placed jitter) and its size (the ends a
 * little larger, so the row reads as curving toward the viewer). Later
 * cards sit on top of earlier ones.
 *
 * ANIMATION STORYBOARD (ms after the page paints)
 *
 *      0   the headline rises
 *    150   the deck rises in as one stack (the whole row fades as a unit,
 *          so overlapping cards never ghost through each other); its
 *          cards sit squared up, a little fanned, the last card on top
 *    500   the fan opens: every card travels from the deck to its slot,
 *          the middle ones fastest (500ms), the outer ones furthest and
 *          last (750ms); position settles without overshoot, the tilt
 *          follows 60ms behind with a small swing past its rest
 *   1250   the hint pops in over the fan's right end ("hover to know the
 *          artist"; "tap…" on touch screens) and its little arrow draws
 *          itself down into the fan (600ms); once any card is opened the
 *          visitor has learned the trick, and the hint fades away
 *   1100   the copy rises, then the actions (80ms later)
 *  ~1630   all still
 *
 * A card coming out (hover with a mouse or pen, focus, or a click / tap):
 *      0   it lifts out of the row, straightens and grows (lively curve);
 *          every card to its right slides over as one to open a gap, the
 *          cards to its left ease a little left
 *    180   its layer rises above the row: by now the cards that covered
 *          its right edge have slid clear, so the change can't be seen
 *    260   if the pointer is still on it (or it was clicked), it turns
 *          over in 3D to its back: the artist and the work (700ms)
 *  leave   it turns back and settles into the row; its layer drops at
 *          once, while its neighbours are still parted, so again nothing
 *          visibly jumps
 * A click (or tap, or Enter) pins a card open until it is clicked again,
 * Escape is pressed or the page is clicked elsewhere.
 *
 * Reduced motion: no animation; cards still open and turn, instantly.
 * ───────────────────────────────────────────────────────────────────────── */

/** Every beat's start (ms) and the durations, in storyboard order. */
const TIMING = {
  /** The copy rises (the actions follow by `stagger`). */
  copy: 1100,
  /** The middle card's trip from the deck to its slot. */
  dealBase: 500,
  /** Added to the trip for the outer cards (scaled by distance from the middle). */
  dealSpread: 250,
  /** The deck rises in. */
  deck: 150,
  /** How long the deck takes to rise in. */
  deckRise: 400,
  /** The fan opens. */
  fan: 500,
  /** How long a card takes to turn over. */
  flip: 700,
  /** The hint pops in, once the last card has landed. */
  hint: 1250,
  /** How long the hint's arrow takes to draw. */
  hintDraw: 600,
  /** The hint's pop. */
  hintPop: 450,
  /** How long the pointer rests on a card before it turns over. */
  intent: 260,
  /** After a card comes out, when its layer rises (its neighbours have parted). */
  raise: 180,
  /** How long a text block takes to rise. */
  rise: 450,
  /** Between the copy and the actions. */
  stagger: 80,
  /** How far the tilt trails the travel. */
  turnLag: 60,
} as const;

/** The curves, named; the CSS only refers to these. */
const EASE = {
  /** A card turning over: a touch of overshoot at the end. */
  flip: "cubic-bezier(0.3, 1.15, 0.4, 1)",
  /** Travel: fast out, long soft landing, no overshoot. */
  land: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Hover in and the tilt's swing: a small overshoot. */
  lively: "cubic-bezier(0.2, 1.3, 0.4, 1)",
  /** A tag's pop. */
  pop: "cubic-bezier(0.2, 1.5, 0.4, 1)",
  /** Hover out and neighbours: plain settle. */
  settle: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

// The section's static motion. Per-card values (slots, deck offsets, trip
// lengths, tag delays) come from cardCss() below, scoped to this instance.
const CSS = `
@keyframes hs3-deck { from { opacity: 0; translate: 0 1.5rem; scale: 0.96; } }
@keyframes hs3-move { from { translate: var(--hs3-dx) var(--hs3-dy); scale: var(--hs3-ds); } }
@keyframes hs3-turn { from { rotate: var(--hs3-dr); } }
@keyframes hs3-pop { from { opacity: 0; scale: 0.6; translate: 0 0.5rem; } }
@keyframes hs3-rise { from { opacity: 0; translate: 0 0.75rem; } }
.hs3-deck { animation: hs3-deck ${TIMING.deckRise}ms ${EASE.settle} ${TIMING.deck}ms both; }
.hs3-move { animation: hs3-move var(--hs3-dur) ${EASE.land} ${TIMING.fan}ms both; }
.hs3-turn { animation: hs3-turn var(--hs3-dur) ${EASE.lively} ${TIMING.fan + TIMING.turnLag}ms both; }
@keyframes hs3-draw { from { stroke-dashoffset: 1; } }
.hs3-hint { transition: opacity 400ms ${EASE.settle}, translate 400ms ${EASE.settle}; }
.hs3-hint[data-seen] { opacity: 0; translate: 0 -0.375rem; }
.hs3-hint-in { animation: hs3-pop ${TIMING.hintPop}ms ${EASE.pop} ${TIMING.hint}ms both; }
.hs3-draw { stroke-dasharray: 1; animation: hs3-draw ${TIMING.hintDraw}ms ${EASE.settle} ${TIMING.hint + 120}ms both; }
.hs3-draw-head { animation-delay: ${TIMING.hint + 120 + TIMING.hintDraw - 120}ms; animation-duration: 220ms; }
.hs3-rise { animation: hs3-rise ${TIMING.rise}ms ${EASE.settle} var(--hs3-at, 0ms) both; }
.hs3-card { transition: z-index 0s; }
.hs3-card[data-active] { z-index: 30; transition-delay: ${TIMING.raise}ms; }
.hs3-lift { perspective: 60rem; transition: translate 450ms ${EASE.settle}, rotate 450ms ${EASE.settle}, scale 450ms ${EASE.settle}; }
.hs3-card[data-active] .hs3-lift { translate: 0 -12%; rotate: calc(var(--hs3-r) * -1); scale: 1.12; transition-duration: 550ms; transition-timing-function: ${EASE.lively}; }
.hs3-card[data-active] ~ .hs3-card .hs3-lift { translate: var(--hs3-part) 0; }
.hs3-card:has(~ .hs3-card[data-active]) .hs3-lift { translate: -12% 0; }
.hs3-flip { transform-style: preserve-3d; transition: rotate ${TIMING.flip}ms ${EASE.flip}; }
.hs3-card[data-flipped] .hs3-flip { rotate: y 180deg; }
.hs3-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.hs3-back { rotate: y 180deg; }
@media (prefers-reduced-motion: reduce) {
  .hs3-deck, .hs3-move, .hs3-turn, .hs3-rise, .hs3-hint-in, .hs3-draw { animation: none; }
  .hs3-card, .hs3-lift, .hs3-flip, .hs3-hint { transition: none; }
}
`;

/* ── The fan's geometry ────────────────────────────────────────────────── */

/** Cards shown and each card's width (% of the row) per breakpoint. */
const FAN = {
  base: { count: 4, width: 42 },
  lg: { count: 7, width: 23 },
  md: { count: 5, width: 30 },
} as const;
// How far the end cards drop below the middle, as % of a card's height.
const ARC = 12;
// The end cards' lean, in degrees.
const TILT = 7;
// How much bigger the end cards are than the middle one: the row reads as
// curving toward the viewer, as in the design.
const BULGE = 0.12;
// Hand-placed variation, so the cards read as separate pieces laid down
// rather than one strip: extra lean (degrees) and drop (% of card height).
const JITTER = [0, -3, 2, -1.5, 2.5, -2, 1];
const LIFT = [0, -4, 2, -3, 1, -2, 0];

type Breakpoint = keyof typeof FAN;

/** A card's slot in a row of `count`: left edge (%), drop (%) and lean (°). */
const slotOf = (index: number, count: number, width: number) => {
  const t = count === 1 ? 0.5 : index / (count - 1);
  const s = 2 * t - 1;
  return {
    drop: ARC * s * s + (LIFT[index] ?? 0),
    lean: TILT * s + (JITTER[index] ?? 0),
    left: t * (100 - width),
    size: 1 - BULGE / 2 + BULGE * s * s,
  };
};

// The deck before the fan opens: each card squared up over the row's
// centre, fanned a touch (degrees per step from the middle) and stepped
// down a little (% of card height) so the stack's edges show.
const DECK = { lean: 1.6, step: 1.4 };
// Card height over width (the card is 100:95).
const ASPECT = 0.95;
// Tailwind's md and lg breakpoints, for the per-card stylesheet.
const MEDIA: Record<Breakpoint, string | null> = {
  base: null,
  lg: "(min-width: 64rem)",
  md: "(min-width: 48rem)",
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A card's slot and its trip from the deck, as CSS variables, for a row of
 * `count`. The trip starts where the card sits in the deck, expressed in
 * the card's own frame: the slot's rotation and scale are applied outside
 * the moving layer, so the offset D (in card widths) is turned back by the
 * lean and divided by the size, T = R(−lean) · D / size, before it becomes
 * translate percentages (x of the card's width, y of its height).
 */
const cardVars = (index: number, count: number, width: number) => {
  const slot = slotOf(index, count, width);
  const t = count === 1 ? 0.5 : index / (count - 1);
  const s = Math.abs(2 * t - 1);
  const fromMiddle = index - (count - 1) / 2;
  // The deck position relative to the slot, in card widths.
  const dx = (50 - width / 2 - slot.left) / width;
  const dy = ((-slot.drop + (index - (count - 1)) * -DECK.step) / 100) * ASPECT;
  const a = (-slot.lean * Math.PI) / 180;
  const tx = (dx * Math.cos(a) - dy * Math.sin(a)) / slot.size;
  const ty = (dx * Math.sin(a) + dy * Math.cos(a)) / slot.size;
  return {
    "--hs3-dr": `${round(-slot.lean + fromMiddle * DECK.lean)}deg`,
    "--hs3-ds": String(round(1 / slot.size)),
    "--hs3-dur": `${Math.round(TIMING.dealBase + TIMING.dealSpread * s)}ms`,
    "--hs3-dx": `${round(tx * 100)}%`,
    "--hs3-dy": `${round((ty / ASPECT) * 100)}%`,
    "--hs3-l": `${round(slot.left)}%`,
    "--hs3-r": `${round(slot.lean)}deg`,
    "--hs3-s": String(round(slot.size)),
    "--hs3-y": `${round(slot.drop)}%`,
  };
};

/** Every card's variables per breakpoint, scoped to one section instance. */
const cardCss = (
  scope: string,
  cards: number,
  counts: Record<Breakpoint, number>
) => {
  const rules: string[] = [];
  for (const bp of ["base", "md", "lg"] as const) {
    const body: string[] = [];
    for (let index = 0; index < Math.min(cards, counts[bp]); index += 1) {
      const vars = cardVars(index, counts[bp], FAN[bp].width);
      const decls = Object.entries(vars)
        .map(([k, v]) => `${k}:${v}`)
        .join(";");
      body.push(`[data-hs3="${scope}"] .hs3-c${index}{${decls}}`);
    }
    rules.push(
      MEDIA[bp] ? `@media ${MEDIA[bp]}{${body.join("")}}` : body.join("")
    );
  }
  return rules.join("\n");
};

/** Shown at a breakpoint or not: literal classes, so Tailwind sees them. */
const showClasses = (base: boolean, md: boolean, lg: boolean) =>
  cn(
    base ? "block" : "hidden",
    md ? "md:block" : "md:hidden",
    lg ? "lg:block" : "lg:hidden"
  );

/* ── Pieces ────────────────────────────────────────────────────────────── */

/**
 * A little hand-drawn arrow: it leaves the hint's first word, ties a small
 * loop and runs down and left into the fan, with a tiny sparkle beside it.
 * The shaft draws itself (stroke-dashoffset over pathLength 1), then the
 * head.
 */
const HintArrow = () => (
  <svg
    aria-hidden="true"
    className="h-[3.25em] w-auto shrink-0 translate-y-[0.5em]"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 72 52"
  >
    <path
      className="hs3-draw"
      d="M68 9C56 6 44 9 41 17c-3 8 6 12 10 6 4-6-5-12-14-8-11 5-19 16-26 29"
      pathLength={1}
    />
    <path
      className="hs3-draw hs3-draw-head"
      d="M11 44l-.6-8.6M11 44l8-2.6"
      pathLength={1}
    />
    <path
      className="hs3-draw hs3-draw-head"
      d="M60 28.5c.5 2.7 1.4 3.6 4.1 4.1-2.7.5-3.6 1.4-4.1 4.1-.5-2.7-1.4-3.6-4.1-4.1 2.7-.5 3.6-1.4 4.1-4.1Z"
      pathLength={1}
      strokeWidth={1.5}
    />
  </svg>
);

/**
 * The hint over the fan's right end: the arrow, then the words, leaning a
 * touch like a note pencilled on the page. "hover…" for mice and pens,
 * "tap…" for touch screens (pointer-coarse). Hidden from screen readers:
 * each card's button already says it shows details.
 */
const Hint = ({
  hint,
  touchHint,
  seen,
}: {
  hint: string;
  touchHint: string;
  seen: boolean;
}) => (
  <div
    aria-hidden="true"
    className="hs3-hint pointer-events-none absolute right-[2%] -top-[3rem] z-40 text-[0.8125rem] text-foreground/60 md:-top-[3.5rem] md:text-[0.875rem] lg:right-[4%] lg:-top-[3.75rem] lg:text-[0.9375rem]"
    data-seen={seen ? "" : undefined}
  >
    <div className="hs3-hint-in flex items-start gap-[0.35em]">
      <HintArrow />
      <span className="-rotate-[4deg] font-medium tracking-[-0.01em] whitespace-nowrap">
        <span className="pointer-coarse:hidden">{hint}</span>
        <span className="hidden pointer-coarse:inline">{touchHint}</span>
      </span>
    </div>
  </div>
);

/* Plain links styled with the theme's tokens rather than <Button asChild>:
 * the section is server-rendered and its actions need no client code to be
 * links. Pills at least 48px tall, full width on phones, 12px apart; the
 * same 1.75rem inline padding on both (a pill's round ends eat into its
 * inline space, so it needs more than a square button); a 0.96 press.
 * Transitions name their properties. */
const PILL =
  "relative isolate inline-flex min-h-12 w-full items-center justify-center rounded-full px-7 py-3 text-[0.9375rem] leading-none font-medium whitespace-nowrap outline-none transition-[background-color,color,scale,box-shadow] duration-200 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96] motion-reduce:active:scale-100 sm:w-auto";

/* The label's box trimmed to the cap height and the baseline (text-box:
 * trim-both cap alphabetic): without it the line box carries the font's
 * ascent above the capitals and its descent below the baseline, and the
 * flex centring then centres that box, so capitals sit visibly high. Trimmed,
 * the centring is optical: the capitals sit in the true middle. Browsers
 * without text-box trim fall back to the 1em box (leading-none), which is
 * still close. The pill keeps min-h-12 and its padding, so a longer or
 * translated label grows it instead of clipping. */
const LABEL = "[text-box:trim-both_cap_alphabetic]";

/* Both pills: a fine ring of their own text colour set 3px in from the
 * edge, crisp, like an inlaid rim, under the label (−z inside the pill's own
 * stacking context), and a medium text shadow on the label. The ring
 * follows the theme because it is the text colour. Hover brightens it and
 * draws it a pixel closer to the edge; press dims it. No inset shadows. */
const RING =
  "text-shadow-md before:pointer-events-none before:absolute before:inset-[0.1875rem] before:-z-10 before:rounded-full before:border before:transition-[border-color,inset] before:duration-200 before:ease-out hover:before:inset-[0.125rem] motion-reduce:before:transition-none";

/* The primary pill carries the theme's primary, with a small contact
 * shadow under it. */
const PRIMARY = cn(
  RING,
  "bg-primary text-primary-foreground hover:bg-primary/92",
  "shadow-[0_1px_2px_0_rgb(0_0_0/0.18),0_0.375rem_1rem_-0.5rem_rgb(0_0_0/0.3)]",
  "before:border-primary-foreground/30 hover:before:border-primary-foreground/45 active:before:border-primary-foreground/20"
);

/* The quiet pill: the theme's secondary, flat. */
const SECONDARY = cn(
  RING,
  "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  "before:border-secondary-foreground/15 hover:before:border-secondary-foreground/25 active:before:border-secondary-foreground/10"
);

/* ── The card's two faces ──────────────────────────────────────────────── */

// Both faces share the card's shape and lift: rounded per breakpoint, a
// soft shadow down and to the left over the card beneath.
const FACE =
  "hs3-face absolute inset-0 overflow-hidden rounded-xl md:rounded-[1.125rem] lg:rounded-[1.375rem] shadow-[-0.75rem_0.25rem_1.5rem_-0.5rem_rgb(0_0_0/0.28),0_1.25rem_2.5rem_-0.75rem_rgb(0_0_0/0.4),0_0_0_1px_rgb(0_0_0/0.06)] dark:shadow-[-0.75rem_0.25rem_1.5rem_-0.5rem_rgb(0_0_0/0.6),0_1.25rem_2.5rem_-0.75rem_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.06)]";

// The card's edge, drawn inside it like the edge of a print, on an overlay
// above the image (an image paints over its own box's inset shadow): a
// hairline ring that keeps two similar artworks apart where one overlaps
// the other (dark on light pages, light on dark ones), a faint highlight
// along the top edge where light catches it, and a soft shade inside the
// bottom edge for a hint of thickness. Subtle on purpose: it should only
// be missed if it were gone.
const EDGE =
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12),inset_0_1px_0_0_rgb(255_255_255/0.3),inset_0_-0.75rem_1.25rem_-0.875rem_rgb(0_0_0/0.22)] dark:after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),inset_0_1px_0_0_rgb(255_255_255/0.16),inset_0_-0.75rem_1.25rem_-0.875rem_rgb(0_0_0/0.35)]";

/**
 * The back of a card: who made it and what it is, set small and quiet so
 * it reads as a museum label. Thumbnail, name and handle at the top; the
 * title under an "Artwork" eyebrow, then medium and year; a hairline, then
 * the price and its status. Sizes are em of the face's own size, which
 * steps up per breakpoint, so the label scales with the card.
 */
const CardBack = ({
  art,
  id,
  open,
  onClose,
}: {
  art: Artwork;
  id: string;
  open: boolean;
  onClose: () => void;
}) => (
  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the card's own button (focused) closes it from the keyboard; this is the pointer shortcut
  <div
    aria-hidden={!open}
    className={cn(
      FACE,
      EDGE,
      "hs3-back flex flex-col bg-card p-[8%] text-left text-[0.5625rem] text-card-foreground sm:text-[0.6875rem] md:text-[0.75rem] lg:text-[0.8125rem]"
    )}
    id={id}
    onClick={onClose}
  >
    <div className="flex items-center gap-[0.6em]">
      <img
        alt=""
        className="size-[2.4em] shrink-0 rounded-[0.55em] object-cover"
        draggable={false}
        src={art.src}
      />
      <div className="min-w-0 leading-[1.2]">
        <p className="truncate font-medium">{art.artist}</p>
        {art.handle ? (
          <p className="truncate text-muted-foreground">{art.handle}</p>
        ) : null}
      </div>
    </div>
    <div className="mt-auto">
      <p className="text-[0.8em] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Artwork
      </p>
      <p className="mt-[0.2em] text-[1.45em] leading-[1.08] font-medium tracking-[-0.025em] text-balance">
        {art.title ?? art.alt}
      </p>
      {art.medium || art.year ? (
        <p className="mt-[0.3em] text-muted-foreground">
          {[art.medium, art.year].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
    {art.price ? (
      <div className="mt-[0.8em] flex items-center justify-between border-t border-foreground/10 pt-[0.7em]">
        <span className="font-medium tabular-nums">{art.price}</span>
        <span className="inline-flex items-center gap-[0.4em] text-muted-foreground">
          <span className="size-[0.45em] rounded-full bg-emerald-500" />
          {art.status ?? "Available"}
        </span>
      </div>
    ) : null}
  </div>
);

/* ── Content ───────────────────────────────────────────────────────────── */

export interface Artwork {
  /** Image URL. Square-ish works best (the card is 100:95); it is cropped to fill. */
  src: string;
  /** What the artwork shows, for screen readers, e.g. "Collage of torn red posters". */
  alt: string;
  /** The work's title, on the card's back, up to about 24 characters ("Late Bloom"). */
  title?: string;
  /** The artist's name, on the back. Without it the card comes out but doesn't turn over. */
  artist?: string;
  /** The artist's handle, under their name ("@hanasato"). */
  handle?: string;
  /** Medium, up to about 16 characters ("Gouache on paper"). */
  medium?: string;
  /** Year made ("2025"). */
  year?: string;
  /** Price as shown ("$520"). */
  price?: string;
  /** Status beside the price ("Available", "Sold"). Default "Available". */
  status?: string;
}

export interface ArtworkAction {
  /** Where the button goes: a page, an anchor ("#pricing") or a mailto: link. */
  href: string;
  /** The button's text, e.g. "Sign up". */
  label: string;
}

// Placeholder artworks (free Unsplash photos) until your own are wired in.
const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&h=608&q=75`;

const DEFAULT_ARTWORKS: Artwork[] = [
  {
    alt: "Torn layers of red and black posters around a black and white hand",
    artist: "Mara Okafor",
    handle: "@maraokafor",
    medium: "Torn paper collage",
    price: "$480",
    src: unsplash("photo-1618327907215-4e514efabd41"),
    title: "Torn Signals",
    year: "2025",
  },
  {
    alt: "Collage of cut-out eyes on a checkered background",
    artist: "Coplin Reyes",
    handle: "@coplin",
    medium: "Mixed media",
    price: "$360",
    src: unsplash("photo-1772160967360-0f0b98c518d1"),
    title: "Watchers",
    year: "2024",
  },
  {
    alt: "Torn yellow poster with French lettering",
    artist: "Inès Laurent",
    handle: "@ineslaurent",
    medium: "Found poster",
    price: "$290",
    src: unsplash("photo-1758506972113-f67919771702"),
    title: "L'Affiche Jaune",
    year: "2023",
  },
  {
    alt: "Pink and white flower painting",
    artist: "Hana Sato",
    handle: "@hanasato",
    medium: "Gouache on paper",
    price: "$520",
    src: unsplash("photo-1579167728798-a1cf3d595960"),
    title: "Late Bloom",
    year: "2025",
  },
  {
    alt: "Collage of layered paper scraps",
    artist: "Theo Brandt",
    handle: "@theobrandt",
    medium: "Paper collage",
    price: "$310",
    src: unsplash("photo-1704634616614-281ace4a8bfc"),
    title: "Paper Weather",
    year: "2024",
  },
  {
    alt: "Collage of colourful vintage posters",
    artist: "Lin Wei",
    handle: "@linwei",
    medium: "Poster archive",
    price: "$440",
    src: unsplash("photo-1766471901200-44196760e2c8"),
    title: "Night Market",
    year: "2023",
  },
  {
    alt: "Green and white abstract painting",
    artist: "Andrea Costa",
    handle: "@andrea",
    medium: "Acrylic on canvas",
    price: "$680",
    src: unsplash("photo-1578059457717-721408f0758e"),
    title: "Green Hours",
    year: "2025",
  },
];

/* ── Section ───────────────────────────────────────────────────────────── */

export interface HeroSection03Props {
  /** The headline. Default "A place to display your masterpiece.", breaking after "your" from tablets up. */
  heading?: ReactNode;
  /** The line under the fan, up to about 140 characters. */
  description?: ReactNode;
  /** Up to 7 artworks, left to right: phones show the first 4, tablets 5, desktops all 7. Defaults are placeholder photos. */
  artworks?: Artwork[];
  /** The hand-drawn hint over the fan for mice and pens, up to about 26 characters. Empty to hide it. */
  hint?: string;
  /** The same hint for touch screens, where there is no hover. */
  touchHint?: string;
  /** The filled pill action. */
  primaryAction?: ArtworkAction;
  /** The quiet pill action beside it. */
  secondaryAction?: ArtworkAction;
  /** The headline's level: 1 when this hero opens the page (default), 2 inside a longer page. */
  headingLevel?: 1 | 2;
  /** Classes for the section. */
  className?: string;
}

/**
 * Artwork fan hero: a big centred headline over a fanned row of artworks
 * with a small hand-drawn hint, a line of copy and two pill actions. On load
 * a deck rises in and opens into the fan, each tag popping as its card
 * lands; on hover a card lifts and straightens while its neighbours ease
 * apart. 4 cards on phones, 5 on tablets, 7 on desktops.
 * Follows the shadcn theme (light and dark).
 */
export const HeroSection03 = ({
  heading = (
    <>
      A place to display your <br className="hidden md:inline" />
      masterpiece.
    </>
  ),
  description = "Artists can display their masterpieces, and buyers can discover and purchase works that resonate with them.",
  artworks = DEFAULT_ARTWORKS,
  hint = "hover to know the artist",
  touchHint = "tap to know the artist",
  primaryAction = { href: "#sign-up", label: "Sign up" },
  secondaryAction = { href: "#about", label: "Read more" },
  headingLevel = 1,
  className,
}: HeroSection03Props) => {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  // Scopes this instance's per-card stylesheet.
  const scope = useId().replaceAll(/[^a-zA-Z0-9_-]/g, "");
  const fan = useRef<HTMLUListElement>(null);
  const intent = useRef(0);
  // Which card the pointer rests on, which has keyboard focus, which was
  // clicked open, and which the resting pointer has turned over.
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [peeked, setPeeked] = useState<number | null>(null);
  // Once any card has come out, the visitor knows the trick: drop the hint.
  const [seen, setSeen] = useState(false);
  // One card is out at a time: the pointer's, then focus, then the pinned.
  const active = hovered ?? focused ?? pinned;
  const flipped = (index: number) =>
    active === index && (pinned === index || peeked === index);

  // A pinned card closes on Escape or a click anywhere else.
  useEffect(() => {
    if (pinned === null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(null);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!fan.current?.contains(e.target as Node)) {
        setPinned(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [pinned]);

  useEffect(() => () => window.clearTimeout(intent.current), []);

  // A mouse or pen resting on a card brings it out at once and turns it
  // over after a short rest, so sweeping across the row doesn't flip every
  // card. Touch has no hover: a tap pins the card instead.
  const enter = (index: number, pointer: string) => {
    if (pointer === "touch") {
      return;
    }
    window.clearTimeout(intent.current);
    setHovered(index);
    setSeen(true);
    if (pinned !== null && pinned !== index) {
      setPinned(null);
    }
    intent.current = window.setTimeout(() => setPeeked(index), TIMING.intent);
  };
  const leave = () => {
    window.clearTimeout(intent.current);
    setHovered(null);
    setPeeked(null);
  };
  const cards = artworks.slice(0, FAN.lg.count);
  const counts: Record<Breakpoint, number> = {
    base: Math.min(FAN.base.count, cards.length),
    lg: Math.min(FAN.lg.count, cards.length),
    md: Math.min(FAN.md.count, cards.length),
  };
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-background px-4 pt-16 pb-16 text-foreground sm:px-6 md:pt-24 md:pb-20 lg:pt-28 lg:pb-24",
        className
      )}
      data-hs3={scope}
      data-slot="hero-section-03"
    >
      <style>{CSS}</style>
      <style>{cardCss(scope, cards.length, counts)}</style>
      <div className="mx-auto flex max-w-[76rem] flex-col items-center text-center">
        <Heading className="hs3-rise max-w-[14ch] text-[2.5rem] leading-[1.04] font-medium tracking-[-0.045em] text-balance sm:text-[3rem] md:max-w-none md:text-[3.75rem] lg:text-[5rem] lg:leading-[1.02]">
          {heading}
        </Heading>

        {/* The fan: an aspect-locked row the cards are placed in. Its
            height holds a card plus the arc's drop and the end cards' lean. */}
        <div className="relative mt-14 w-full sm:max-w-[30rem] md:mt-20 md:max-w-none lg:mt-16 lg:max-w-[70rem]">
          {hint ? <Hint hint={hint} seen={seen} touchHint={touchHint} /> : null}
          <ul
            aria-label="Featured artworks"
            className="hs3-deck relative aspect-[100/50] w-full [--hs3-part:45%] [--hs3-w:42%] md:aspect-[100/37] md:[--hs3-w:30%] lg:aspect-[100/29] lg:[--hs3-part:60%] lg:[--hs3-w:23%]"
            ref={fan}
          >
            {cards.map((art, index) => {
              const turns = Boolean(art.artist);
              const open = turns && flipped(index);
              const backId = `${scope}-back-${index}`;
              return (
                <li
                  className={cn(
                    "hs3-card absolute top-[6%] aspect-[100/95] w-(--hs3-w) z-(--hs3-z)",
                    `hs3-c${index}`,
                    "left-(--hs3-l) translate-y-(--hs3-y) rotate-(--hs3-r) scale-(--hs3-s)",
                    showClasses(
                      index < counts.base,
                      index < counts.md,
                      index < counts.lg
                    )
                  )}
                  data-active={active === index ? "" : undefined}
                  data-flipped={open ? "" : undefined}
                  key={art.src}
                  onPointerEnter={(e) => enter(index, e.pointerType)}
                  onPointerLeave={leave}
                  style={{ "--hs3-z": index + 1 } as CSSProperties}
                >
                  {/* Layers, so each motion has its own curve: the trip from
                    the deck, the tilt's swing, the lift out of the row (which
                    carries the tag, so it rides with its card) and the turn
                    over to the back. */}
                  <div className="hs3-move size-full">
                    <div className="hs3-turn size-full">
                      <div className="hs3-lift relative size-full">
                        <div className="hs3-flip relative size-full">
                          <button
                            aria-controls={turns ? backId : undefined}
                            aria-expanded={turns ? open : undefined}
                            className={cn(
                              FACE,
                              EDGE,
                              "block cursor-pointer bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                            )}
                            onBlur={() => setFocused(null)}
                            onClick={() => {
                              setPinned((p) => (p === index ? null : index));
                              setSeen(true);
                            }}
                            onFocus={() => {
                              setFocused(index);
                              setSeen(true);
                            }}
                            type="button"
                          >
                            <img
                              alt={art.alt}
                              className="size-full object-cover select-none"
                              decoding="async"
                              draggable={false}
                              sizes="(min-width: 64rem) 17rem, (min-width: 48rem) 15rem, 42vw"
                              src={art.src}
                            />
                            {turns ? (
                              <span className="sr-only">
                                {` by ${art.artist}. Show details.`}
                              </span>
                            ) : null}
                          </button>
                          {turns ? (
                            <CardBack
                              art={art}
                              id={backId}
                              onClose={() => setPinned(null)}
                              open={open}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p
          className="hs3-rise mt-8 max-w-[34rem] text-[0.9375rem] leading-relaxed text-pretty text-foreground/75 md:mt-10 md:text-base lg:text-[1.0625rem]"
          style={{ "--hs3-at": `${TIMING.copy}ms` } as CSSProperties}
        >
          {description}
        </p>

        <div
          className="hs3-rise mt-7 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row md:mt-8"
          style={
            { "--hs3-at": `${TIMING.copy + TIMING.stagger}ms` } as CSSProperties
          }
        >
          <a className={cn(PILL, PRIMARY)} href={primaryAction.href}>
            <span className={LABEL}>{primaryAction.label}</span>
          </a>
          <a className={cn(PILL, SECONDARY)} href={secondaryAction.href}>
            <span className={LABEL}>{secondaryAction.label}</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection03;
