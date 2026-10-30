"use client";

/* oxlint-disable nextjs/no-img-element -- a registry section can't assume next/image is set up for the user's image host */
/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- clicking the section's backdrop closes an open tile; Esc (a window listener) is the keyboard path, and every tile is a real button */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ComponentProps,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 *   idle     the rail drifts left at `speed` px a second, looping; the
 *            cursor is a small dot
 *   hover    the rail eases to a stop; the tile under the pointer grows from
 *            its bottom edge (×1.32) and its neighbours less, by a sine bell
 *            over distance: 0.5 + 0.5·cos(π·d / R). The row re-flows so the
 *            growth pushes outward round the pointer, like the macOS dock;
 *            the dot swells into a "View" disc
 *   click    the tile scales up (to ~2.8×, capped to the screen) on a
 *            critically damped spring; the rail sinks and slides so the
 *            open tile moves a third of the way to the centre; the disc
 *            turns dark and reads "Close"
 *   close    click again, click anywhere, or press Esc
 *
 * Every frame is computed in one requestAnimationFrame loop from a few
 * numbers (pointer, hover, open, drift) and written straight to each tile's
 * transform: React never re-renders while the rail moves, and only
 * transform and opacity change.
 * ───────────────────────────────────────────────────────────────────────── */

const RAIL = {
  /** Tile height over width (the photos are 4:5-ish). */
  aspect: 1.23,
  /** Gap between tiles, as a share of a tile's width. */
  gap: 0.09,
  /** Tile width as a share of the section's width, within a floor and a cap. */
  width: 0.118,
  widthMax: 260,
  widthMin: 132,
};

const DOCK = {
  /** How far the open tile slides toward the centre (0 none, 1 all the way). */
  centre: 0.32,
  /** How much the tile under the pointer grows. */
  hover: 1.32,
  /** Most the open tile grows, before the screen caps it. */
  open: 2.8,
  /** Share of the viewport's height the open tile may fill at most. */
  openMaxHeight: 0.78,
  /** Share of the section's width the open tile may fill at most. */
  openMaxWidth: 0.86,
  /** Reach of the sine bell, in tiles: neighbours within it grow too. A
   * whole number makes the raised cosine a partition of unity: its copies
   * one tile apart always sum to the same total, so the row's extra width
   * is constant wherever the bump is, and far tiles never wobble as it
   * glides. */
  reach: 2,
  /** How far the rail sinks when a tile opens, in tile heights. */
  sink: 0.45,
};

/** Smoothing rates, per second: higher settles faster. */
/** The cursor's size and fill follow springs (natural frequencies, rad/s):
 * critically damped and starting from rest, so a fade never pops. */
const CURSOR_SPRING = { fill: 14, size: 16 };

/** One step of a critically damped spring following `target`; returns the
 * new velocity and moves `value` by reference through the returned pair. */
const follow = (
  value: number,
  velocity: number,
  target: number,
  omega: number,
  dt: number
) => {
  const nextVelocity =
    velocity + (omega * omega * (target - value) - 2 * omega * velocity) * dt;
  return { value: value + nextVelocity * dt, velocity: nextVelocity };
};

const RATE = {
  cursor: 20,
  drift: 6,
  focus: 12,
  hover: 9,
  label: 16,
};

/** The open spring's natural frequency (rad/s). Critically damped, so it
 * lands without a bounce; soft, as a large element should move slower
 * (within 1% of rest in ~0.63s). It starts from rest, so the motion eases in
 * and out on its own. */
const OPEN_OMEGA = Math.sqrt(110);

/** The exact critically damped spring: where it is and how fast it moves
 * `t` seconds after leaving `from` at `velocity`, heading for `to`. Closed
 * form, so it's smooth from the first frame at any frame rate. */
const criticalSpring = (
  from: number,
  to: number,
  velocity: number,
  t: number
) => {
  const offset = from - to;
  const rise = velocity + OPEN_OMEGA * offset;
  const decay = Math.exp(-OPEN_OMEGA * t);
  return {
    value: to + (offset + rise * t) * decay,
    velocity: (velocity - OPEN_OMEGA * rise * t) * decay,
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Maps `value` from one range onto another, clamped to the second. */
const map = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
) => {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * t;
};

/** Frame-rate independent exponential approach toward `target`. */
const approach = (value: number, target: number, rate: number, dt: number) =>
  value + (target - value) * (1 - Math.exp(-rate * dt));

/** The dock's sine bell: 1 at the pointer, 0 at `reach` tiles away. */
const bell = (distance: number) =>
  distance >= DOCK.reach
    ? 0
    : 0.5 + 0.5 * Math.cos((Math.PI * distance) / DOCK.reach);

/* ── The rail's frame state, kept outside React ────────────────────────── */

interface RailState {
  /** Drift, in px, wrapped to one set of tiles. */
  offset: number;
  /** Where the drift is heading when a focused tile pulls it into view. */
  offsetTarget: number | null;
  /** The pointer over the rail, in rail px; null when outside. It only picks
   * the focused tile: the dock is centred on the tile, not the pointer. */
  pointerTarget: number | null;
  /** The tile the dock is centred on (index into the rendered copies). */
  focusTile: number | null;
  /** The dock's centre, in base-layout px, gliding toward the focused
   * tile's centre; null before anything has been hovered. */
  focus: number | null;
  /** 0 to 1: how far the dock is "on". */
  hover: number;
  /** 0 to 1: how far the open tile is open. */
  open: number;
  openVelocity: number;
  /** Where the open spring last set off from, toward which goal, how fast,
   * and the seconds since: retargeting mid-flight keeps its velocity. */
  openFrom: number;
  openGoal: number;
  openStartVelocity: number;
  openTime: number;
  /** The tile (index into the rendered copies) that is open or opening. */
  openTile: number | null;
  /** Whether a tile is meant to be open. */
  opened: boolean;
  /** The cursor, in section px, and its size (0 dot, 1 disc). */
  cursorX: number;
  cursorY: number;
  cursorTargetX: number;
  cursorTargetY: number;
  cursorSize: number;
  cursorSizeVelocity: number;
  /** 0 to 1: how far the disc has turned to Close. */
  cursorClose: number;
  cursorCloseVelocity: number;
  /** 0 to 1: the View word's own fade, so it never jumps with the fill. */
  cursorView: number;
  cursorInside: boolean;
  cursorOnTile: boolean;
}

/* ── One frame, in three pure steps ────────────────────────────────────── */

interface RailGeometry {
  gap: number;
  loopWidth: number;
  slot: number;
  speed: number;
  tileCount: number;
  tileHeight: number;
  tileWidth: number;
  width: number;
}

/** Step 1: advance the inputs (pointer, hover, the open spring, the drift). */
const advance = (
  s: RailState,
  g: RailGeometry,
  dt: number,
  reduceMotion: boolean
) => {
  const rate = (value: number) => (reduceMotion ? 1e3 : value);
  /* The pointer's presence only: opening fades the dock through the open
   * spring instead (see layout), so both share one curve. */
  const hoverTarget = s.pointerTarget === null ? 0 : 1;
  s.hover = approach(s.hover, hoverTarget, rate(RATE.hover), dt);

  /* The open spring, solved exactly. A new goal restarts it from where it
   * is, at the speed it's moving, so a click mid-flight just turns it. */
  const openTarget = s.opened ? 1 : 0;
  if (openTarget !== s.openGoal) {
    s.openFrom = s.open;
    s.openStartVelocity = s.openVelocity;
    s.openGoal = openTarget;
    s.openTime = 0;
  }
  if (reduceMotion) {
    s.open = openTarget;
    s.openVelocity = 0;
  } else {
    s.openTime += dt;
    const spring = criticalSpring(
      s.openFrom,
      s.openGoal,
      s.openStartVelocity,
      s.openTime
    );
    s.open = spring.value;
    s.openVelocity = spring.velocity;
    /* At rest once within 0.3% (under a pixel at any size). */
    if (Math.abs(openTarget - s.open) + Math.abs(s.openVelocity) < 0.003) {
      s.open = openTarget;
      s.openVelocity = 0;
    }
  }
  if (!s.opened && s.open === 0) {
    s.openTile = null;
  }

  /* The drift eases off while hovered or open; a focused tile can pull it. */
  if (s.offsetTarget !== null) {
    s.offset = approach(s.offset, s.offsetTarget, rate(RATE.drift), dt);
    if (Math.abs(s.offset - s.offsetTarget) < 0.5) {
      s.offset = s.offsetTarget;
      s.offsetTarget = null;
    }
  } else if (!reduceMotion) {
    const still = Math.max(s.hover, Math.min(1, s.open));
    s.offset += g.speed * dt * (1 - still);
  }
};

/* Picks the tile the dock centres on, from where the tiles are drawn: the
 * one under the pointer. Hysteresis keeps the current tile until the
 * pointer is clearly past it (half a gap and 6px beyond its edge), so
 * resting in a gap can't flip between two tiles. */
const pickFocus = (
  s: RailState,
  g: RailGeometry,
  lefts: number[],
  scales: number[]
) => {
  const pointer = s.pointerTarget;
  if (pointer === null) {
    return;
  }
  const hold = g.gap / 2 + 6;
  if (s.focusTile !== null) {
    const left = lefts[s.focusTile] ?? 0;
    const right = left + g.tileWidth * (scales[s.focusTile] ?? 1);
    if (pointer >= left - hold && pointer <= right + hold) {
      return;
    }
  }
  let nearest = 0;
  let best = Number.POSITIVE_INFINITY;
  for (const [index, left] of lefts.entries()) {
    const centre = left + (g.tileWidth * (scales[index] ?? 1)) / 2;
    const distance = Math.abs(centre - pointer);
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  }
  s.focusTile = nearest;
};

/* Tiles are laid out at their open size and scaled down at rest, so the
 * browser rasterises each photo at full size and only ever shrinks it: an
 * open tile is as sharp as the photo, never a stretched thumbnail. */

/** Step 2: lay the rail out. Each tile's scale comes from the dock's sine
 * bell round the pointer (measured on the base layout, so growth can't feed
 * back into itself), then the open tile lerps to its open size. The row is
 * laid out with those widths and shifted so one focal point stays put: the
 * pointer while hovering, the open tile's centre (sliding toward the middle)
 * while open. */
const layout = (
  s: RailState,
  g: RailGeometry,
  viewportHeight: number,
  dt: number,
  reduceMotion: boolean
) => {
  const drift = ((s.offset % g.loopWidth) + g.loopWidth) % g.loopWidth;
  const start = -g.loopWidth - drift;
  const openScale = Math.min(
    DOCK.open,
    (viewportHeight * DOCK.openMaxHeight) / g.tileHeight,
    (g.width * DOCK.openMaxWidth) / g.tileWidth
  );
  const opened = clamp(s.open, 0, 1);
  /* The dock fades out as a tile opens and back as it closes, on the same
   * spring as the scale, the sink and the slide: one curve for the lot. */
  const dock = s.hover * (1 - opened);

  /* The dock's centre glides to the focused tile's centre; while the dock
   * is off it jumps there, so coming back grows the bump in place. */
  if (s.focusTile !== null) {
    const target = start + s.focusTile * g.slot + g.tileWidth / 2;
    s.focus =
      s.focus === null || s.hover < 0.01 || reduceMotion
        ? target
        : approach(s.focus, target, RATE.focus, dt);
  }

  const scales = Array.from({ length: g.tileCount }, (_, index) => {
    const centre = start + index * g.slot + g.tileWidth / 2;
    const near =
      s.focus === null ? 0 : bell(Math.abs(centre - s.focus) / g.slot);
    const scale = 1 + (DOCK.hover - 1) * near * dock;
    return index === s.openTile ? scale + (openScale - scale) * s.open : scale;
  });

  const lefts: number[] = [];
  let x = start;
  for (const scale of scales) {
    lefts.push(x);
    x += g.tileWidth * scale + g.gap;
  }

  /* Where a base-layout point lands in the scaled layout. */
  const mapPoint = (base: number) => {
    const index = clamp(
      Math.floor((base - start) / g.slot),
      0,
      g.tileCount - 1
    );
    const within = base - (start + index * g.slot);
    const scaled = g.tileWidth * (scales[index] ?? 1);
    const left = lefts[index] ?? 0;
    return within < g.tileWidth
      ? left + (within / g.tileWidth) * scaled
      : left + scaled + (within - g.tileWidth);
  };

  /* The dock's anchor: half the row's extra width goes each way, so the
   * focused tile grows evenly about its own centre (the bell is symmetric)
   * and, with a whole-number reach, the far tiles never move at all while
   * the bump glides: the extra width is the same wherever it is. The open
   * tile's anchor takes over through the open spring itself, so the hand-
   * off is as smooth as the spring: no jump on click, none on close. */
  const extra = scales.reduce(
    (sum, scale) => sum + g.tileWidth * (scale - 1),
    0
  );
  const dockShift = -extra / 2;
  let shift = dockShift;
  if (s.openTile !== null) {
    const base = start + s.openTile * g.slot + g.tileWidth / 2;
    /* Slide a third of the way to the middle, but never past the
     * section's edges (16px in), so on a phone it lands fully on screen. */
    const half = (g.tileWidth * openScale) / 2;
    const margin = Math.min(16, Math.max(0, g.width / 2 - half));
    const settled = clamp(
      base + (g.width / 2 - base) * DOCK.centre,
      half + margin,
      g.width - half - margin
    );
    /* `opened` is applied once, here, so the row's position is close to
     * linear in the spring: a close mirrors an open exactly. */
    const openShift = settled - mapPoint(base);
    shift = dockShift + (openShift - dockShift) * opened;
  }

  const placed = lefts.map((left) => left + shift);
  /* Re-pick only once a close has all but finished: while the open tile is
   * still large and slid off its place, the pointer can sit over another
   * tile, and re-centring the dock mid-close would tug the row. */
  if (!s.opened && s.open < 0.02) {
    pickFocus(s, g, placed, scales);
  }
  return {
    lefts: placed,
    scales,
    sink: g.tileHeight * DOCK.sink * s.open,
  };
};

/** Step 3: ease the cursor toward the pointer and its size toward a dot
 * (0) or a disc (1). */
const moveCursor = (s: RailState, dt: number, reduceMotion: boolean) => {
  const rate = (value: number) => (reduceMotion ? 1e3 : value);
  s.cursorX = approach(s.cursorX, s.cursorTargetX, rate(RATE.cursor), dt);
  s.cursorY = approach(s.cursorY, s.cursorTargetY, rate(RATE.cursor), dt);
  const sizeTarget = s.opened || s.cursorOnTile ? 1 : 0;
  const fillTarget = s.opened ? 1 : 0;
  if (reduceMotion) {
    s.cursorSize = sizeTarget;
    s.cursorClose = fillTarget;
    s.cursorView = s.opened ? 0 : 1;
    return;
  }
  const size = follow(
    s.cursorSize,
    s.cursorSizeVelocity,
    sizeTarget,
    CURSOR_SPRING.size,
    dt
  );
  s.cursorSize = clamp(size.value, 0, 1);
  s.cursorSizeVelocity = size.velocity;
  const fill = follow(
    s.cursorClose,
    s.cursorCloseVelocity,
    fillTarget,
    CURSOR_SPRING.fill,
    dt
  );
  s.cursorClose = clamp(fill.value, 0, 1);
  s.cursorCloseVelocity = fill.velocity;
  /* The View word leaves the moment a tile opens and returns only once the
   * shrinking fill has all but gone (under 3%: a 5px speck), on its own
   * short fade either way, so the two never overlap. */
  const viewTarget = !s.opened && s.cursorClose < 0.03 ? 1 : 0;
  s.cursorView = approach(s.cursorView, viewTarget, RATE.label, dt);
};

interface CursorLayers {
  close: HTMLElement | null;
  closeLabel: HTMLElement | null;
  disc: HTMLElement | null;
  dot: HTMLElement | null;
  root: HTMLElement | null;
  viewLabel: HTMLElement | null;
}

/* Writes the cursor. Only transform and opacity change, and no colour ever
 * animates: each layer keeps its own colour and word, and they blend by
 * opacity and scale, so no frame shows a grey in-between.
 *
 *   dot     a fixed 12px dot that shrinks away as the disc grows behind it
 *   disc    the white "View" disc (with its shadow), 12px → 160px
 *   close   a solid dark fill growing from the centre inside the white disc
 *           (scale only, so never a grey in-between)
 *   labels  outside the fill, so text never scales; they fade in over the
 *           disc's last half, and View leaves before the fill reaches it,
 *           Close arrives once the fill has covered it
 * Size and fill follow critically damped springs from rest, so no fade
 * starts at full speed. */
const drawCursor = (s: RailState, layers: CursorLayers) => {
  const { close, closeLabel, disc, dot, root, viewLabel } = layers;
  if (!root) {
    return;
  }
  root.style.transform = `translate3d(${s.cursorX.toFixed(1)}px, ${s.cursorY.toFixed(1)}px, 0)`;
  root.style.opacity = s.cursorInside ? "1" : "0";
  const size = s.cursorSize;
  const fill = s.cursorClose;
  if (dot) {
    /* Gone by 35% of the disc's growth, before any text shows at 50%. */
    dot.style.transform = `translate(-50%, -50%) scale(${(1 - map(size, 0, 0.35, 0, 1)).toFixed(4)})`;
  }
  if (disc) {
    disc.style.transform = `translate(-50%, -50%) scale(${map(size, 0, 1, 0.075, 1).toFixed(4)})`;
    /* Faded in over its first half: at rest its shadow would ring the dot. */
    disc.style.opacity = map(size, 0, 0.5, 0, 1).toFixed(3);
  }
  if (close) {
    /* A solid dark fill growing from the centre: scale only, never opacity,
     * so no frame mixes white and dark into grey. 101.5% covers the white
     * disc's anti-aliased edge. */
    close.style.transform = `scale(${(fill * 1.015).toFixed(4)})`;
  }
  const words = map(size, 0.5, 1, 0, 1);
  if (viewLabel) {
    viewLabel.style.opacity = (words * s.cursorView).toFixed(3);
  }
  if (closeLabel) {
    /* In once the fill has covered the word. */
    closeLabel.style.opacity = (words * map(fill, 0.6, 1, 0, 1)).toFixed(3);
  }
};

const layerOf = (index: number, scale: number, openTile: number | null) => {
  if (index === openTile) {
    return "3";
  }
  return scale > 1.01 ? "2" : "1";
};

/* Swallows the click that follows a drag, so a drag never opens a tile. */
const swallowClick = (event: MouseEvent) => {
  event.stopPropagation();
  event.preventDefault();
};

/* ── Content ───────────────────────────────────────────────────────────── */

export interface GallerySectionItem {
  /** Unique id: the rail keys on it. */
  id: string;
  /** URL of the photo, shown at about 4:5. Use one about 1000px wide: an open tile scales it up nearly 3×. */
  image: string;
  /** What the photo shows, for screen readers. */
  alt: string;
}

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1000&h=1230&auto=format&fit=crop&q=80`;

/** The demo photos: people and chairs on flat colour. Exported, so you can
 * start from them: `[...galleryItems, yourPhoto]`. */
export const galleryItems: GallerySectionItem[] = [
  {
    alt: "A pale wooden bar stool against a soft blue wall",
    id: "stool",
    image: photo("1503602642458-232111445657"),
  },
  {
    alt: "A woman in a skeleton-hand T-shirt leaning on a pink brick wall",
    id: "pink-wall",
    image: photo("1503342217505-b0a15ec3261c"),
  },
  {
    alt: "A black chair on wooden legs against a teal wall",
    id: "black-chair",
    image: photo("1592078615290-033ee584e267"),
  },
  {
    alt: "A woman in a patterned collar against a deep red wall",
    id: "red-wall",
    image: photo("1531123897727-8f129e1688ce"),
  },
  {
    alt: "A bright orange chair in a white room",
    id: "orange-chair",
    image: photo("1561677978-583a8c7a4b43"),
  },
  {
    alt: "A woman in heart sunglasses and a red sweater against a teal sky",
    id: "teal-sky",
    image: photo("1529139574466-a303027c1d8b"),
  },
  {
    alt: "A yellow armchair beside a brass floor lamp",
    id: "yellow-armchair",
    image: photo("1586023492125-27b2c045efd7"),
  },
  {
    alt: "A young man in a grey hoodie against a blue wall",
    id: "blue-wall",
    image: photo("1628157588553-5eeea00af15c"),
  },
  {
    alt: "A white shell chair beside a potted palm",
    id: "shell-chair",
    image: photo("1519947486511-46149fa0a254"),
  },
];

export interface GallerySectionProps extends Omit<
  ComponentProps<"section">,
  "title"
> {
  /** The headline above the rail. Defaults to "Furniture for how people sit, lean and gather." */
  heading?: ReactNode;
  /** The photos on the rail, in order. It loops, so six or more read best. Defaults to `galleryItems`. */
  items?: GallerySectionItem[];
  /** Pixels a second the rail drifts while nothing is hovered or open. `0` holds it still. Defaults to 28. */
  speed?: number;
  /** The word in the cursor disc over a closed tile. Defaults to "View". */
  viewLabel?: string;
  /** The word in the cursor disc while a tile is open. Defaults to "Close". */
  closeLabel?: string;
  /** The headline's level: 1 when this is the page's main heading, 2 or 3 to fit under the page's own. Defaults to 2. */
  headingLevel?: 1 | 2 | 3;
}

const GallerySection = ({
  className,
  heading = "Furniture for how people sit, lean and gather.",
  items = galleryItems,
  speed = 28,
  viewLabel = "View",
  closeLabel = "Close",
  headingLevel = 2,
  ...props
}: GallerySectionProps) => {
  const HeadingTag = `h${headingLevel}` as const;
  const count = items.length;

  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cursor = useRef<CursorLayers>({
    close: null,
    closeLabel: null,
    disc: null,
    dot: null,
    root: null,
    viewLabel: null,
  });
  const [openId, setOpenId] = useState<number | null>(null);
  const [width, setSectionWidth] = useState(0);

  const state = useRef<RailState>({
    cursorClose: 0,
    cursorCloseVelocity: 0,
    cursorInside: false,
    cursorOnTile: false,
    cursorSize: 0,
    cursorSizeVelocity: 0,
    cursorTargetX: 0,
    cursorTargetY: 0,
    cursorView: 1,
    cursorX: 0,
    cursorY: 0,
    focus: null,
    focusTile: null,
    hover: 0,
    offset: 0,
    offsetTarget: null,
    open: 0,
    openFrom: 0,
    openGoal: 0,
    openStartVelocity: 0,
    openTile: null,
    openTime: 0,
    openVelocity: 0,
    opened: false,
    pointerTarget: null,
  });
  const dragRef = useRef<{ id: number; moved: boolean; x: number } | null>(
    null
  );

  /* Tile size follows the section's width, so the rail keeps its rhythm on
   * every screen. */
  const tileWidth = clamp(width * RAIL.width, RAIL.widthMin, RAIL.widthMax);
  const tileHeight = tileWidth * RAIL.aspect;
  const gap = tileWidth * RAIL.gap;
  const slot = tileWidth + gap;
  const loopWidth = count * slot;
  /* Enough whole sets to cover the section, plus one either side to wrap
   * into, plus room for the dock's growth. */
  const sets = count > 0 ? Math.ceil((width * 1.4) / loopWidth) + 2 : 0;
  const tileCount = sets * count;
  const tiles = Array.from({ length: tileCount }, (_, index) => index);
  /* The copy each item is reachable by keyboard: the second set. */
  const primary = (index: number) => index >= count && index < count * 2;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSectionWidth(entry.contentRect.width);
      }
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  /* ── The frame loop: advance, lay out, write ── */
  useEffect(() => {
    if (!width || count === 0) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const geometry: RailGeometry = {
      gap,
      loopWidth,
      slot,
      speed,
      tileCount,
      tileHeight,
      tileWidth,
      width,
    };
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = state.current;
      advance(s, geometry, dt, reduceMotion);
      const { lefts, scales, sink } = layout(
        s,
        geometry,
        window.innerHeight,
        dt,
        reduceMotion
      );
      for (const [index, scale] of scales.entries()) {
        const tile = tileRefs.current[index];
        if (tile) {
          tile.style.transform = `translate3d(${(lefts[index] ?? 0).toFixed(2)}px, ${sink.toFixed(2)}px, 0) scale(${(scale / DOCK.open).toFixed(4)})`;
          const layer = layerOf(index, scale, s.openTile);
          if (tile.style.zIndex !== layer) {
            tile.style.zIndex = layer;
          }
        }
      }
      moveCursor(s, dt, reduceMotion);
      drawCursor(s, cursor.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    count,
    gap,
    loopWidth,
    slot,
    speed,
    tileCount,
    tileHeight,
    tileWidth,
    width,
  ]);

  /* ── Opening and closing ── */
  const setOpen = useCallback((tile: number | null) => {
    const s = state.current;
    if (tile === null) {
      s.opened = false;
      setOpenId(null);
      return;
    }
    s.openTile = tile;
    s.opened = true;
    setOpenId(tile);
  }, []);

  useEffect(() => {
    if (openId === null) {
      return;
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, setOpen]);

  /* ── Pointer: the dock, the cursor, and dragging the rail by hand ── */
  const onSectionMove = (event: PointerEvent<HTMLElement>) => {
    const section = sectionRef.current;
    const rail = railRef.current;
    if (!(section && rail)) {
      return;
    }
    const s = state.current;
    const box = section.getBoundingClientRect();
    s.cursorTargetX = event.clientX - box.left;
    s.cursorTargetY = event.clientY - box.top;
    if (!s.cursorInside) {
      s.cursorX = s.cursorTargetX;
      s.cursorY = s.cursorTargetY;
      s.cursorInside = true;
    }
    const railBox = rail.getBoundingClientRect();
    /* Over a tile, or in a gap between tiles within the row's band: the gaps
     * count too, so the disc doesn't flash to a dot between every two tiles,
     * and a click there opens the tile the dock is centred on. */
    const overTile =
      (event.target as Element).closest("[data-gallery-tile]") !== null;
    const inBand =
      event.clientY >= railBox.bottom - tileHeight &&
      event.clientY <= railBox.bottom;
    const onTile = event.pointerType === "mouse" && (overTile || inBand);
    s.cursorOnTile = onTile;
    if (event.pointerType === "mouse") {
      const inRail =
        event.clientY >= railBox.top - tileHeight &&
        event.clientY <= railBox.bottom + 8;
      s.pointerTarget = inRail ? event.clientX - railBox.left : null;
    }

    const drag = dragRef.current;
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      if (drag.moved || Math.abs(dx) > 6) {
        drag.moved = true;
        drag.x = event.clientX;
        s.offset -= dx;
        s.offsetTarget = null;
      }
    }
  };

  const onSectionLeave = () => {
    const s = state.current;
    s.cursorInside = false;
    s.cursorOnTile = false;
    s.pointerTarget = null;
  };

  /* A click in a gap opens the tile the dock is centred on, as the disc
   * promises. */
  const onRailClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const s = state.current;
    if (
      !s.opened &&
      s.focusTile !== null &&
      s.cursorOnTile &&
      !(event.target as Element).closest("[data-gallery-tile]")
    ) {
      event.stopPropagation();
      setOpen(s.focusTile);
    }
  };

  const onRailDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    dragRef.current = { id: event.pointerId, moved: false, x: event.clientX };
  };

  const onRailUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) {
      /* Swallow the click that follows a drag. */
      window.addEventListener("click", swallowClick, {
        capture: true,
        once: true,
      });
      setTimeout(
        () => window.removeEventListener("click", swallowClick, true),
        0
      );
    }
  };

  /* A click on the section outside the open tile closes it. */
  const onSectionClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (
      state.current.opened &&
      !(event.target as Element).closest("[data-gallery-tile]")
    ) {
      setOpen(null);
    }
  };

  /* ── Keyboard: focus acts like the pointer; Enter/Space open ── */
  const onTileFocus = (index: number) => {
    const s = state.current;
    const centre = -loopWidth + index * slot + tileWidth / 2;
    const drift = ((s.offset % loopWidth) + loopWidth) % loopWidth;
    const onScreen = centre - drift;
    /* Pull the rail so a focused tile sits inside the middle 70%. */
    const low = width * 0.15;
    const high = width * 0.85;
    if (onScreen < low || onScreen > high) {
      s.offsetTarget = s.offset + (onScreen - width / 2);
    }
    s.pointerTarget = clamp(onScreen, low, high);
  };

  const onTileBlur = () => {
    state.current.pointerTarget = null;
  };

  const onTileKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const next = count + ((index - count + step + count) % count);
    tileRefs.current[next]?.focus();
  };

  return (
    <section
      ref={sectionRef}
      data-slot="gallery-section"
      className={cn(
        "relative w-full overflow-x-clip bg-background py-16 text-foreground sm:py-20 lg:py-24 [@media(hover:hover)_and_(pointer:fine)]:cursor-none",
        className
      )}
      onClick={onSectionClick}
      onPointerLeave={onSectionLeave}
      onPointerMove={onSectionMove}
      {...props}
    >
      <HeadingTag className="mx-auto max-w-[17em] px-5 text-center text-[2rem] leading-[1.08] font-medium tracking-[-0.035em] text-balance sm:px-8 sm:text-5xl lg:text-6xl xl:text-[4.5rem]">
        {heading}
      </HeadingTag>

      {/* the rail: tiles positioned by the frame loop, bottoms aligned */}
      <div
        ref={railRef}
        className="relative mt-12 touch-pan-y select-none sm:mt-16 lg:mt-24"
        onClick={onRailClick}
        onPointerCancel={onRailUp}
        onPointerDown={onRailDown}
        onPointerUp={onRailUp}
        style={{
          height: tileHeight,
          marginBottom: tileHeight * DOCK.sink,
        }}
      >
        {tiles.map((index) => {
          const item = items[index % count];
          if (!item) {
            return null;
          }
          const isPrimary = primary(index);
          const isOpen = openId === index;
          return (
            <button
              aria-expanded={isPrimary ? isOpen : undefined}
              aria-hidden={isPrimary ? undefined : true}
              aria-label={isPrimary ? item.alt : undefined}
              className="absolute bottom-0 left-0 block origin-bottom-left overflow-hidden bg-muted outline-none will-change-transform focus-visible:ring-[3px] focus-visible:ring-ring/50 [@media(hover:hover)_and_(pointer:fine)]:cursor-none"
              data-gallery-tile=""
              key={index}
              onBlur={onTileBlur}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(isOpen ? null : index);
              }}
              onFocus={() => onTileFocus(index)}
              onKeyDown={(event) => onTileKey(event, index)}
              ref={(element) => {
                tileRefs.current[index] = element;
              }}
              style={{
                height: tileHeight * DOCK.open,
                width: tileWidth * DOCK.open,
              }}
              tabIndex={isPrimary ? 0 : -1}
              type="button"
            >
              <img
                alt=""
                className="pointer-events-none size-full object-cover"
                decoding="async"
                draggable={false}
                loading={isPrimary ? "eager" : "lazy"}
                src={item.image}
              />
            </button>
          );
        })}
      </div>

      {/* the cursor: a dot that swells into a labelled disc (fine pointers
          only; touch keeps the system's behaviour). Every layer is placed
          and faded by the frame loop. */}
      <div
        ref={(element) => {
          cursor.current.root = element;
        }}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-10 hidden opacity-0 will-change-transform [@media(hover:hover)_and_(pointer:fine)]:block"
      >
        <div
          ref={(element) => {
            cursor.current.disc = element;
          }}
          className="absolute top-0 left-0 size-40 opacity-0 will-change-transform"
        >
          <div className="absolute inset-0 grid place-items-center rounded-full bg-background text-base font-medium text-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.08)]">
            <span
              ref={(element) => {
                cursor.current.viewLabel = element;
              }}
              className="opacity-0"
            >
              {viewLabel}
            </span>
          </div>
          <div
            ref={(element) => {
              cursor.current.close = element;
            }}
            className="absolute inset-0 rounded-full bg-foreground will-change-transform"
            /* inline, not `scale-0`: Tailwind v4's scale-* sets the separate
               `scale` property, which would multiply the loop's transform */
            style={{ transform: "scale(0)" }}
          />
          <span
            ref={(element) => {
              cursor.current.closeLabel = element;
            }}
            className="absolute inset-0 grid place-items-center text-base font-medium text-background opacity-0"
          >
            {closeLabel}
          </span>
        </div>
        <div
          ref={(element) => {
            cursor.current.dot = element;
          }}
          className="absolute top-0 left-0 size-3 rounded-full bg-foreground"
        />
      </div>
    </section>
  );
};

export default GallerySection;
