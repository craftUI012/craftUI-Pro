"use client";

/* oxlint-disable nextjs/no-img-element -- a registry block can't assume next/image is set up for the user's image host */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, RefObject } from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Mosaic card. A photo with a short line over it, for a brand's values or
 * a manifesto: click or tap and the photo breaks into a mosaic of tiles
 * that vanish in scattered clusters to reveal the next one, while the line
 * rises in word by word. A small counter shows where you are. It can also
 * move on by itself.
 *
 * ANIMATION STORYBOARD (one change)
 *
 *      0ms   the old photo is cut into a `grid` × `grid` mosaic over the
 *            new one; tiles are dealt into `grid` random clusters, and one
 *            cluster vanishes every 45ms (each tile in 140ms), so the new
 *            photo shows through in scattered pixels, not row by row
 *      0ms   the old line drifts up and fades (180ms); the counter moves on
 *    180ms   the new line rises into place word by word, 20ms apart
 *            (200ms each, ease-out), so it reads left to right
 *   ~1.1s    the mosaic is gone
 *
 * With reduced motion every change is instant.
 * ───────────────────────────────────────────────────────────────────────── */

/** Every beat's timing (ms). */
const TIMING = {
  /** Between one cluster of tiles vanishing and the next. */
  cluster: 45,
  /** The counter's dash lighting up. */
  dash: 300,
  /** The old line drifting away. */
  textOut: 180,
  /** One tile's fade. */
  tile: 140,
  /** One word rising in. */
  word: 200,
  /** Between one word and the next. */
  wordStagger: 20,
} as const;

/** The curves, named; the CSS only refers to these. */
const EASE = {
  /** The old line leaving: ease-out-quad. */
  out: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  /** A word rising in: ease-out-quart. */
  word: "cubic-bezier(0.165, 0.84, 0.44, 1)",
} as const;

const CSS = `
@keyframes mc-vanish { to { opacity: 0; } }
@keyframes mc-word { from { translate: 0 105%; } }
@keyframes mc-out { to { opacity: 0; translate: 0 -0.3em; } }
.mc-tile { animation: mc-vanish ${TIMING.tile}ms linear var(--delay) both; }
.mc-word { display: inline-block; animation: mc-word ${TIMING.word}ms ${EASE.word} calc(var(--lead) + var(--i) * ${TIMING.wordStagger}ms) both; }
.mc-out { animation: mc-out ${TIMING.textOut}ms ${EASE.out} both; }
.mc-dash { transition: background-color ${TIMING.dash}ms ${EASE.out}; }
@media (prefers-reduced-motion: reduce) {
  .mc-tile, .mc-word, .mc-out { animation: none; }
  .mc-dash { transition: none; }
}
`;

export interface MosaicCardItem {
  /** The photo's URL. It's cropped to fill the card (`aspect`). Darker photos, or ones with a quiet top-left corner, carry the line best. */
  image: string;
  /** What the photo shows, for screen readers, e.g. "An open hand against black". */
  alt: string;
  /** The line over the photo: a value, a principle or a line of your manifesto. A few words read best. */
  text: string;
}

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

/** The demo items: a studio's principles on warm light in dark rooms.
 * Exported, so you can start from them. */
export const mosaicCardItems: MosaicCardItem[] = [
  {
    alt: "An open hand, softly lit against black",
    image: photo("1605552983816-3b7a9d32b2c6"),
    text: "Made by hand, on purpose.",
  },
  {
    alt: "Concrete arches with a patch of sunlight on the floor",
    image: photo("1741524915875-b382e15c55de"),
    text: "Leave room to breathe.",
  },
  {
    alt: "Warm light through a window, falling on a dark wall",
    image: photo("1706486540611-3b4221f1c3ad"),
    text: "Quiet, until it matters.",
  },
  {
    alt: "A streak of sunlight across a concrete staircase",
    image: photo("1741524915320-8fee76e41424"),
    text: "One careful step at a time.",
  },
];

/** The card's shape. */
const ASPECTS = {
  landscape: "aspect-[4/3]",
  portrait: "aspect-[4/5]",
  square: "aspect-square",
} as const;

export interface MosaicCardProps extends Omit<
  ComponentProps<"figure">,
  "children"
> {
  /** The photo-and-line pairs it moves through, in order; they loop. Three to six read best. Defaults to `mosaicCardItems`, a studio's principles. */
  items?: MosaicCardItem[];
  /** The card's shape: "landscape" (4:3), "square" or "portrait" (4:5). Defaults to "landscape". */
  aspect?: keyof typeof ASPECTS;
  /** Tiles along each side of the dissolve: more is finer. Defaults to 12. */
  grid?: number;
  /** Seconds before it moves on by itself; 0 to change only on click or tap. It holds while the pointer rests on it, while it has focus and off screen, and never moves by itself with reduced motion. Defaults to 0. */
  interval?: number;
  /** Whether to show the small "01 / 04" counter at the bottom. Defaults to true. */
  counter?: boolean;
  /** What the card's button says to screen readers, e.g. "Next principle". Defaults to "Show next". */
  nextLabel?: string;
}

interface Tile {
  /** Column, from 0. */
  x: number;
  /** Row, from 0. */
  y: number;
  /** When it starts to vanish (ms). */
  delay: number;
}

const shuffle = <T,>(list: T[]) => {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
};

/** Deals every tile into one of `grid` clusters (`grid` tiles each, at
 * random places) and gives each cluster its own start, so the photo
 * dissolves in scattered pixels rather than row by row. */
const buildTiles = (grid: number): Tile[] => {
  const clusters = shuffle(
    Array.from({ length: grid * grid }, (_, i) => i % grid)
  );
  const order = shuffle(Array.from({ length: grid }, (_, k) => k));
  const startOf = new Map(order.map((c, rank) => [c, rank * TIMING.cluster]));
  return clusters.map((cluster, i) => ({
    delay: startOf.get(cluster) ?? 0,
    x: i % grid,
    y: Math.floor(i / grid),
  }));
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "1" → "01". */
const pad = (n: number) => String(n).padStart(2, "0");

/** Whether it's on screen, in a tab the visitor is looking at. */
const useOnScreen = (ref: RefObject<HTMLElement | null>) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let onScreen = false;
    const update = () => setVisible(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return visible;
};

/** The old photo, cut into tiles that vanish cluster by cluster. */
const Mosaic = ({
  image,
  tiles,
  grid,
}: {
  image: string;
  tiles: Tile[];
  grid: number;
}) => (
  <div
    aria-hidden="true"
    className="absolute inset-0 z-10 grid"
    style={{
      gridTemplateColumns: `repeat(${grid}, 1fr)`,
      gridTemplateRows: `repeat(${grid}, 1fr)`,
    }}
  >
    {tiles.map((tile) => (
      <div
        className="mc-tile bg-no-repeat"
        key={`${tile.x}-${tile.y}`}
        style={
          {
            "--delay": `${tile.delay}ms`,
            backgroundImage: `url("${image}")`,
            backgroundPosition: `${(tile.x / (grid - 1)) * 100}% ${(tile.y / (grid - 1)) * 100}%`,
            backgroundSize: `${grid * 100}% ${grid * 100}%`,
          } as CSSProperties
        }
      />
    ))}
  </div>
);

/** The line, rising in word by word. */
const Words = ({
  text,
  lead,
  className,
  silent,
}: {
  text: string;
  lead: number;
  className?: string;
  /** Hidden from screen readers: the line leaving, which is gone in a moment. */
  silent?: boolean;
}) => (
  <p
    aria-hidden={silent ? true : undefined}
    className={cn(
      "max-w-[18ch] text-xl leading-[1.1] font-medium tracking-[-0.02em] text-balance sm:text-2xl",
      className
    )}
    style={{ "--lead": `${lead}ms` } as CSSProperties}
  >
    {text.split(" ").map((word, i) => (
      // oxlint-disable-next-line react/no-array-index-key -- a word can repeat in a line; its place is its identity
      <span key={i}>
        <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
          <span className="mc-word" style={{ "--i": i } as CSSProperties}>
            {word}
          </span>
        </span>{" "}
      </span>
    ))}
  </p>
);

/** "01 / 04" and a dash for every item, the current one lit. */
const Counter = ({
  items,
  index,
}: {
  items: MosaicCardItem[];
  index: number;
}) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute bottom-3 left-1/2 z-[12] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/35 px-3 py-1.5 text-xs text-white backdrop-blur-md sm:bottom-4"
  >
    <span className="tabular-nums">
      {pad(index + 1)}
      <span className="text-white/60"> / {pad(items.length)}</span>
    </span>
    <span className="flex gap-1">
      {items.map((item, i) => (
        <span
          className={cn(
            "mc-dash h-0.5 w-3 rounded-full",
            i === index ? "bg-white" : "bg-white/35"
          )}
          key={item.text}
        />
      ))}
    </span>
  </div>
);

const MosaicCard = ({
  items = mosaicCardItems,
  aspect = "landscape",
  grid = 12,
  interval = 0,
  counter = true,
  nextLabel = "Show next",
  className,
  onPointerEnter,
  onPointerLeave,
  ...props
}: MosaicCardProps) => {
  const count = items.length;
  const tiles = Math.max(2, Math.round(grid));
  const rootRef = useRef<HTMLElement>(null);
  const timer = useRef(0);
  const [index, setIndex] = useState(0);
  const [changes, setChanges] = useState(0);
  const [resting, setResting] = useState(false);
  const [leaving, setLeaving] = useState<{
    item: MosaicCardItem;
    tiles: Tile[];
  } | null>(null);
  const visible = useOnScreen(rootRef);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Load the next photo early, so it's ready under the mosaic.
  useEffect(() => {
    const upcoming = items[(index + 1) % Math.max(1, count)];
    if (upcoming) {
      const img = new Image();
      img.src = upcoming.image;
    }
  }, [index, items, count]);

  const next = useCallback(() => {
    const from = items[index];
    if (leaving || count < 2 || !from) {
      return;
    }
    setIndex((i) => (i + 1) % count);
    setChanges((c) => c + 1);
    if (prefersReducedMotion()) {
      return;
    }
    setLeaving({ item: from, tiles: buildTiles(tiles) });
    timer.current = window.setTimeout(
      () => setLeaving(null),
      tiles * TIMING.cluster + TIMING.tile + 400
    );
  }, [count, index, items, leaving, tiles]);

  // Moves on by itself every `interval` seconds while nothing holds it.
  useEffect(() => {
    if (!interval || resting || !visible || leaving || prefersReducedMotion()) {
      return;
    }
    const id = window.setTimeout(next, interval * 1000);
    return () => window.clearTimeout(id);
  }, [interval, resting, visible, leaving, next]);

  const current = items[index];
  if (!current) {
    return null;
  }

  return (
    <figure
      className={cn(
        "relative isolate m-0 w-full overflow-hidden rounded-sm bg-muted text-white",
        ASPECTS[aspect],
        className
      )}
      data-slot="mosaic-card"
      onPointerEnter={(event) => {
        setResting(event.pointerType === "mouse");
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        setResting(false);
        onPointerLeave?.(event);
      }}
      ref={rootRef}
      {...props}
    >
      <style>{CSS}</style>
      <img
        alt={current.alt}
        className="absolute inset-0 size-full object-cover"
        decoding="async"
        src={current.image}
      />
      {leaving ? (
        <Mosaic grid={tiles} image={leaving.item.image} tiles={leaving.tiles} />
      ) : null}

      {/* A soft shade under the line, so it reads on any photo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[11] h-2/3 bg-linear-to-b from-black/45 to-transparent"
      />

      <figcaption className="pointer-events-none absolute inset-x-0 top-0 z-[12] grid p-5 sm:p-6">
        {leaving ? (
          <Words
            className="mc-out col-start-1 row-start-1"
            key={`out-${changes}`}
            lead={0}
            silent
            text={leaving.item.text}
          />
        ) : null}
        <Words
          className="col-start-1 row-start-1"
          key={`in-${changes}`}
          lead={changes ? TIMING.textOut : 0}
          text={current.text}
        />
      </figcaption>

      {counter && count > 1 ? <Counter index={index} items={items} /> : null}

      {/* The whole card is the button to move on. */}
      <button
        aria-label={nextLabel}
        className="absolute inset-0 z-20 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
        onBlur={() => setResting(false)}
        onClick={next}
        onFocus={() => setResting(true)}
        type="button"
      />
    </figure>
  );
};

export default MosaicCard;
