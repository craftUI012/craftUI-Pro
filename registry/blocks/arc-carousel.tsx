"use client";

/* oxlint-disable nextjs/no-img-element -- a registry block can't assume next/image is set up for the user's image host */

import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
} from "motion/react";
import type { MotionValue } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD (one beat, repeating)
 *
 *      0ms   dwell: the dial holds; a hairline under the active label fills
 *            over the dwell (it freezes while paused)
 *   2000ms   the next image is decoded, then the step: the dial springs one
 *            item on and the image changes with it, entering from the side
 *            the dial is turning toward, both in 500ms
 *   2500ms   settled: the next beat's dwell starts
 *
 * By hand:
 *   drag     the dial follows the pointer 1:1; each label that crosses the
 *            centre ticks into place (a 4% pulse, and a 1ms vibration on
 *            phones); release springs to the nearest label with the flick's
 *            speed, at most 3 items on
 *   tap      a label springs the dial to it, the travel time growing with
 *            the distance
 *   keys     ↑ / ↓ (or → / ←) step, Home / End jump to the ends, Enter
 *            opens the active item's link
 *   open     the image links to the active item; tapping the centre
 *            label opens it too
 *   ends     with `loop={false}` a drag past either end gives way less and
 *            less (rubber banding), the end label squashes, and release
 *            springs it back
 *   speed    a fast spin leans the labels and softens them; at rest they're
 *            crisp again
 *
 * The dial is one number, `phi` (items turned). Every label's angle, scale,
 * colour, fade, blur and lean is derived from it with useTransform, so the
 * dial never re-renders React while it moves.
 * ───────────────────────────────────────────────────────────────────────── */

const TIMING = {
  /** Seconds a detent pulse takes. */
  detent: 0.16,
  /** Longest a far jump may take, as a multiple of `step`. */
  maxTravel: 2,
  /** Seconds a one-item step (spring and image change) takes. */
  step: 0.5,
};

const DRAG = {
  /** Seconds of a flick's speed carried into where the dial lands. */
  carry: 0.12,
  /** Most items one flick can carry the dial past where it was let go. */
  maxSkip: 3,
  /** Rubber-band constant (Apple's): lower gives way less past an end. */
  rubber: 0.55,
  /** Pixels the pointer must travel before a press becomes a drag. */
  threshold: 4,
};

const SPEED = {
  /** The full extra blur, in px. */
  blur: 1.2,
  /** Items a second where labels start to lean; a normal step stays below. */
  from: 5,
  /** The full lean, in degrees. */
  lean: 6,
  /** Items a second over `from` at which the lean is full. */
  span: 20,
};

/** Overshoot of each step, as Motion's spring `bounce`. */
const SPRINGS: Record<"soft" | "snappy" | "bouncy", number> = {
  bouncy: 0.45,
  snappy: 0.28,
  soft: 0.12,
};

/** Entering element: ease-out-quint. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const DIAL = {
  /** The active label's size over the rest. */
  activeScale: 1.32,
  /** Blur, in px, at the far edge of the arc. It starts past `blurFrom`. */
  blur: 2,
  /** Share of the fade angle a label stays sharp for. */
  blurFrom: 0.55,
  /** How much a detent swells the active label. */
  detent: 0.04,
  /** Shape of the fade toward the edge; above 1 falls away sooner. */
  fadeCurve: 0.7,
  /** Largest label size, px. */
  fontMax: 60,
  /** Smallest label size, px. */
  fontMin: 22,
  /** Label size as a share of the dial's height, between the two. */
  fontScale: 0.047,
  /** Gap between labels along the arc, in label heights. */
  lineGap: 2.7,
  /** Radius of the arc as a share of the dial's height: larger is flatter. */
  radius: 0.62,
  /** How far an end label squashes when pulled one item past the end. */
  squash: 0.08,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const wrap = (value: number, count: number) =>
  ((value % count) + count) % count;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Opacity by angle from centre: 1 at the centre, exactly 0 at `edge`. */
const fadeAt = (angle: number, edge: number) =>
  angle >= edge
    ? 0
    : (0.5 + 0.5 * Math.cos(Math.PI * (angle / edge))) ** DIAL.fadeCurve;

/** How active a label is: 1 dead centre, 0 outside the band. */
const activeAt = (angle: number, band: number) =>
  angle >= band ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (angle / band));

/** Apple's rubber band: how far content moves when pulled `pull` past an
 * edge, in a box `size` long. Gives way less the further it's pulled. */
const rubberBand = (pull: number, size: number) =>
  (1 - 1 / ((pull * DRAG.rubber) / size + 1)) * size;

/* Images are decoded before the dial steps to them, so autoplay never
 * reveals a half-loaded one; a failed load still steps. */
const decoded = new Map<string, Promise<void>>();
const decode = async (src: string) => {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    // Broken or blocked: show what the browser has.
  }
};
const ready = (src: string) => {
  let pending = decoded.get(src);
  if (!pending) {
    pending = decode(src);
    decoded.set(src, pending);
  }
  return pending;
};

/* ── Geometry ──────────────────────────────────────────────────────────── */

interface DialGeometry {
  /** Half-width of the active band, in degrees. */
  band: number;
  /** Angle at which a label has faded out, in degrees. */
  fadeAngle: number;
  fontSize: number;
  height: number;
  originX: number;
  originY: number;
  radius: number;
  /** Degrees between neighbouring labels. */
  step: number;
}

/* Everything follows the dial's measured height, so the arc keeps its
 * shape on every screen. The fade ends where the arc meets the dial's top
 * and bottom edges, so labels dissolve rather than being cut off. */
const geometryFor = (width: number, height: number): DialGeometry => {
  const fontSize = clamp(height * DIAL.fontScale, DIAL.fontMin, DIAL.fontMax);
  const radius = height * DIAL.radius;
  const step = toDegrees((fontSize * DIAL.lineGap) / radius);
  const fadeAngle = Math.max(
    step,
    toDegrees(Math.asin(Math.min(1, height / 2 / radius))) * 0.97
  );
  const curl = radius * (1 - Math.cos((fadeAngle * Math.PI) / 180));
  const indent = Math.min(width * 0.36, curl + fontSize * 0.9);
  return {
    band: step * 0.75,
    fadeAngle,
    fontSize,
    height,
    originX: indent - radius,
    originY: height / 2,
    radius,
    step,
  };
};

/* Which laps of the items to draw: a looping dial draws enough whole laps
 * either side to fill the arc, so it wraps with nothing swapping. */
const lapsFor = (
  loop: boolean,
  geometry: DialGeometry | null,
  count: number
) => {
  const laps =
    loop && geometry
      ? Math.ceil(
          (geometry.fadeAngle + geometry.step) / (count * geometry.step)
        )
      : 0;
  return Array.from({ length: laps * 2 + 1 }, (_, index) => index - laps);
};

const useSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ height: number; width: number } | null>(
    null
  );
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({
          height: entry.contentRect.height,
          width: entry.contentRect.width,
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
};

/* ── One label on the arc ──────────────────────────────────────────────── */

interface DialMotion {
  /** The dwell's progress, 0 to 1: fills the active label's hairline. */
  progress: MotionValue<number>;
  /** The detent pulse, 0 to 1 and back. */
  pulse: MotionValue<number>;
  /** Where the dial is, in item units (wrapped when it loops). */
  phase: MotionValue<number>;
  /** Signed speed effect, -1 to 1: drives the lean and the extra blur. */
  speed: MotionValue<number>;
  /** Items pulled past an end: negative before the first, positive after
   * the last. Always 0 when the dial loops. */
  stretch: MotionValue<number>;
}

/* A zero-size node pinned at the arc's centre: one rotation puts the label
 * on the arc and leaves it tangent, so position and tilt never disagree.
 * `offset` is where this copy sits in item units; a looping dial draws each
 * item in a few copies a whole lap apart, so it wraps with nothing
 * swapping. */
const ArcLabel = memo(function ArcLabel({
  edge,
  geometry,
  item,
  motionValues,
  number,
  offset,
  showProgress,
}: {
  edge?: "first" | "last";
  geometry: DialGeometry;
  item: ArcCarouselItem;
  motionValues: DialMotion;
  number: string;
  offset: number;
  showProgress: boolean;
}) {
  const { band, fadeAngle, radius, step } = geometry;
  const { phase, progress, pulse, speed, stretch } = motionValues;
  const angle = useTransform(phase, (value) => (offset - value) * step);
  const active = useTransform(angle, (value) =>
    activeAt(Math.abs(value), band)
  );
  const transform = useTransform(
    [angle, active, pulse, speed, stretch],
    ([value, level, beat, fast, pulled]: number[]) => {
      const size =
        (1 + (DIAL.activeScale - 1) * level) * (1 + DIAL.detent * beat * level);
      let pull = 0;
      if (edge === "first") {
        pull = clamp01(-pulled);
      } else if (edge === "last") {
        pull = clamp01(pulled);
      }
      return `rotate(${value}deg) translateX(${radius}px) scale(${size * (1 + DIAL.squash * 0.5 * pull)}, ${size * (1 - DIAL.squash * pull)}) skewX(${fast * SPEED.lean}deg)`;
    }
  );
  const opacity = useTransform(angle, (value) =>
    fadeAt(Math.abs(value), fadeAngle)
  );
  const filter = useTransform([angle, speed], ([value, fast]: number[]) => {
    const blur =
      DIAL.blur *
        clamp01(
          (Math.abs(value) / fadeAngle - DIAL.blurFrom) / (1 - DIAL.blurFrom)
        ) +
      SPEED.blur * Math.abs(fast);
    return blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
  });
  const color = useTransform(
    active,
    (level) =>
      `color-mix(in oklab, var(--ac-ink) ${Math.round(level * 100)}%, var(--ac-muted))`
  );

  return (
    <motion.div
      className="absolute size-0 origin-top-left will-change-transform"
      style={{ left: geometry.originX, top: geometry.originY, transform }}
    >
      <motion.span
        className="absolute top-0 left-0 flex -translate-y-1/2 cursor-pointer items-baseline leading-none font-medium tracking-[-0.035em] whitespace-nowrap [@media(hover:hover)]:hover:[--ac-muted:var(--ac-muted-hover)]"
        data-offset={offset}
        style={{ color, filter, fontSize: geometry.fontSize, opacity }}
      >
        <span className="absolute right-full mr-[0.55em] font-mono text-[0.24em] tracking-normal tabular-nums opacity-60">
          {number}
        </span>
        {item.label}
        {item.meta && (
          <span className="ml-[0.4em] font-mono text-[0.24em] tracking-normal tabular-nums opacity-60">
            {item.meta}
          </span>
        )}
        {/* the dwell: a hairline that fills while this label is active */}
        {showProgress && (
          <motion.span
            className="absolute top-full left-0 mt-[0.24em] h-[0.035em] min-h-px w-full overflow-hidden rounded-full bg-current/15"
            style={{ opacity: active }}
          >
            <motion.span
              className="block size-full origin-left rounded-full bg-current"
              style={{ scaleX: progress }}
            />
          </motion.span>
        )}
      </motion.span>
    </motion.div>
  );
});

/* ── The image's frame ─────────────────────────────────────────────────── */

const ArrowUpRight = () => (
  <svg
    aria-hidden="true"
    className="size-[0.9em]"
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    viewBox="0 0 16 16"
    width="16"
  >
    <path d="M5 11 L11 5 M6 5 H11 V10" />
  </svg>
);

/* The image's 3:2 frame. With an href it's a link: a "View project" pill
 * rises in on hover and focus, and the photo leans in a touch. */
const ImageFrame = ({
  children,
  href,
  label,
  linkRef,
  linkText,
}: {
  children: ReactNode;
  href?: string;
  label: string;
  linkRef: RefObject<HTMLAnchorElement | null>;
  linkText: string;
}) => {
  const frame =
    "group/frame relative block aspect-[3/2] w-full overflow-hidden bg-muted";
  if (!href) {
    return <div className={frame}>{children}</div>;
  }
  return (
    <a
      aria-label={label}
      className={cn(
        frame,
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      )}
      href={href}
      ref={linkRef}
    >
      <span className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)]:group-hover/frame:scale-[1.02]">
        {children}
      </span>
      <span className="absolute bottom-4 left-4 inline-flex translate-y-1 items-center gap-1.5 rounded-full bg-background/90 px-3.5 py-2 text-sm font-medium text-foreground opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_2px_4px_rgb(0_0_0/0.06)] backdrop-blur-sm transition-[opacity,translate] duration-200 ease-out group-focus-visible/frame:translate-y-0 group-focus-visible/frame:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:group-hover/frame:translate-y-0 [@media(hover:hover)]:group-hover/frame:opacity-100">
        {linkText}
        <ArrowUpRight />
      </span>
    </a>
  );
};

/* ── Content ───────────────────────────────────────────────────────────── */

export interface ArcCarouselItem {
  /** Unique id: the dial and the image key on it. */
  id: string;
  /** The item's name on the dial, one to three words: "Timber House". */
  label: string;
  /** A short note after the label, such as a year: "2025". Optional. */
  meta?: string;
  /** URL of the item's image, shown at 3:2 beside the dial. 1200px wide is plenty. */
  image: string;
  /** What the image shows, for screen readers. */
  alt: string;
  /** Where the item leads: the image becomes a link to it, and tapping the active label (or pressing Enter on the dial) opens it. Leave it out for no link. */
  href?: string;
}

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&auto=format&fit=crop&q=80`;

/** The demo items: an architecture studio's selected projects. Exported, so
 * you can start from them: `[...arcCarouselItems, yourItem]`. */
export const arcCarouselItems: ArcCarouselItem[] = [
  {
    alt: "A two-storey timber-clad house with lit glass walls under a large gum tree at dusk",
    href: "#timber-house",
    id: "timber-house",
    image: photo("1600585154340-be6161a56a0c"),
    label: "Timber House",
    meta: "2026",
  },
  {
    alt: "A woven metal façade curving against a clear blue sky",
    href: "#woven-pavilion",
    id: "woven-pavilion",
    image: photo("1493397212122-2b85dda8106b"),
    label: "Woven Pavilion",
    meta: "2026",
  },
  {
    alt: "Two white towers with ribbon balconies curving toward each other, seen from below",
    href: "#ribbon-towers",
    id: "ribbon-towers",
    image: photo("1518005020951-eccb494ad742"),
    label: "Ribbon Towers",
    meta: "2025",
  },
  {
    alt: "A house of warm timber and dark steel behind a garden of desert plants",
    href: "#canyon-residence",
    id: "canyon-residence",
    image: photo("1600566753190-17f0baa2a6c3"),
    label: "Canyon Residence",
    meta: "2025",
  },
  {
    alt: "A calm living room in warm neutrals, with leather stools and a high band of windows",
    href: "#quiet-room",
    id: "quiet-room",
    image: photo("1618221195710-dd6b41faaea6"),
    label: "Quiet Room",
    meta: "2024",
  },
  {
    alt: "An angular museum of glass and white panels rising over the street",
    href: "#glass-museum",
    id: "glass-museum",
    image: photo("1487958449943-2429e8be8625"),
    label: "Glass Museum",
    meta: "2023",
  },
];

/* The image enters from the side the dial turns toward: from below when
 * turning on, from above when turning back. */
const IMAGE_VARIANTS = {
  center: { filter: "blur(0px)", opacity: 1, scale: 1, y: "0%" },
  enter: (direction: number) => ({
    filter: "blur(8px)",
    opacity: 0,
    scale: 1.04,
    y: direction < 0 ? "-6%" : "6%",
  }),
  exit: (direction: number) => ({
    filter: "blur(4px)",
    opacity: 0,
    transition: { duration: TIMING.step * 0.8, ease: EASE_OUT },
    y: direction < 0 ? "4%" : "-4%",
  }),
};

const REDUCED_VARIANTS = {
  center: { opacity: 1 },
  enter: { opacity: 0 },
  exit: { opacity: 0, transition: { duration: 0 } },
};

export interface ArcCarouselProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** The items, in order: each a label on the dial and the image shown while it's active. Five to eight read best. Defaults to `arcCarouselItems`, an architecture studio's selected projects. */
  items?: ArcCarouselItem[];
  /** Seconds the dial holds on each item before stepping on. Defaults to 2. */
  dwell?: number;
  /** How the dial steps: "soft" barely overshoots, "snappy" a little, "bouncy" visibly. Defaults to "snappy". */
  spring?: "soft" | "snappy" | "bouncy";
  /** Whether the dial wraps round from the last item to the first. With `false` it has ends: a drag past one gives way less and less and springs back, and autoplay rewinds to the start. Defaults to `true`. */
  loop?: boolean;
  /** What the dial is called for screen readers, e.g. "Collections". Defaults to "Selected projects". */
  dialLabel?: string;
  /** The words on an item's link, shown over its image on hover and focus and read with the item's name: "View project: Timber House". Defaults to "View project". */
  linkText?: string;
}

const ArcCarousel = ({
  className,
  items = arcCarouselItems,
  dwell = 2,
  spring = "snappy",
  loop = true,
  dialLabel = "Selected projects",
  linkText = "View project",
  style,
  ...props
}: ArcCarouselProps) => {
  const count = items.length;
  const last = Math.max(0, count - 1);
  const rootRef = useRef<HTMLDivElement>(null);
  const [dialRef, size] = useSize();
  const inView = useInView(rootRef, { amount: 0.3 });
  const reduceMotion = useReducedMotion() ?? false;

  /* ── the dial's motion values ── */
  const phi = useMotionValue(0);
  const progress = useMotionValue(0);
  const pulse = useMotionValue(0);
  const velocity = useVelocity(phi);
  const phase = useTransform(phi, (value) =>
    loop ? wrap(value, Math.max(1, count)) : value
  );
  const speed = useTransform(velocity, (value) =>
    reduceMotion
      ? 0
      : Math.sign(value) * clamp01((Math.abs(value) - SPEED.from) / SPEED.span)
  );
  const stretch = useTransform(phi, (value) => {
    if (loop) {
      return 0;
    }
    if (value < 0) {
      return value;
    }
    return value > last ? value - last : 0;
  });
  /* Stable, so the memoised labels skip every React render the image
   * change causes. */
  const motionValues = useMemo<DialMotion>(
    () => ({ phase, progress, pulse, speed, stretch }),
    [phase, progress, pulse, speed, stretch]
  );

  /* ── what's showing ── */
  const [view, setView] = useState({ direction: 1, index: 0 });
  const [announcement, setAnnouncement] = useState("");
  /* The unwrapped item the image is on, to tell which way a change goes. */
  const shownRef = useRef(0);

  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  /* The active item's link, so the dial can open it. */
  const linkRef = useRef<HTMLAnchorElement>(null);
  /* The running step, so a press can catch the dial mid-flight. */
  const stepRef = useRef<ReturnType<typeof animate> | null>(null);
  const dragRef = useRef<{
    id: number;
    moved: boolean;
    phi: number;
    samples: { t: number; y: number }[];
    tap: number | null;
    touch: boolean;
    y: number;
  } | null>(null);

  const indexOf = (value: number) =>
    loop ? wrap(Math.round(value), count) : clamp(Math.round(value), 0, last);
  const describe = (index: number) => {
    const item = items[index];
    if (!item) {
      return "";
    }
    const name = item.meta ? `${item.label}, ${item.meta}` : item.label;
    return `${name}, ${index + 1} of ${count}`;
  };

  /* Points the image at an (unwrapped) item; returns whether it changed. */
  const show = (target: number) => {
    const settled = loop
      ? Math.round(target)
      : clamp(Math.round(target), 0, last);
    if (settled === shownRef.current) {
      return false;
    }
    const direction = Math.sign(settled - shownRef.current);
    shownRef.current = settled;
    setView({ direction, index: indexOf(settled) });
    return true;
  };

  /* Every move of the dial goes through here: autoplay, a release, a tap
   * or a key. The farther it goes, the longer it takes, up to a cap. */
  const stepTo = (
    target: number,
    {
      onDone,
      velocity: initial = 0,
    }: { onDone?: () => void; velocity?: number } = {}
  ) => {
    const settled = loop ? target : clamp(target, 0, last);
    show(settled);
    progress.set(0);
    stepRef.current?.stop();
    if (reduceMotion) {
      phi.set(settled);
      onDone?.();
      return;
    }
    const distance = Math.abs(settled - phi.get());
    stepRef.current = animate(phi, settled, {
      bounce: SPRINGS[spring],
      onComplete: onDone,
      type: "spring",
      velocity: initial,
      visualDuration:
        TIMING.step * clamp(0.8 + 0.2 * distance, 1, TIMING.maxTravel),
    });
  };

  /* The beat: the hairline fills over the dwell, the next image is decoded,
   * then the dial steps. Paused on hover or focus, while dragging, while
   * off-screen or with the Pause button: the hairline freezes where it is
   * and carries on from there. */
  useEffect(() => {
    if (!(playing && !hovered && !dragging && inView) || count < 2) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof animate> | undefined;
    /* run and advance call each other: run fills the hairline, advance
     * steps, then hands back to run. */
    const beat: { run?: () => void } = {};
    const advance = async () => {
      const here = Math.round(phi.get());
      const target = !loop && here >= last ? 0 : here + 1;
      await ready(items[indexOf(target)]?.image ?? "");
      if (!cancelled) {
        stepTo(target, { onDone: () => !cancelled && beat.run?.() });
      }
    };
    beat.run = () => {
      timer = animate(progress, 1, {
        duration: Math.max(0, (1 - progress.get()) * dwell),
        ease: "linear",
        onComplete: advance,
      });
    };
    beat.run();
    return () => {
      cancelled = true;
      timer?.stop();
    };
  });

  /* Decode the neighbours ahead, whichever way the dial goes next. */
  useEffect(() => {
    for (const offset of [1, -1]) {
      const neighbour = items[wrap(view.index + offset, Math.max(1, count))];
      if (neighbour) {
        ready(neighbour.image);
      }
    }
  }, [count, items, view.index]);

  const geometry = useMemo(
    () => (size ? geometryFor(size.width, size.height) : null),
    [size]
  );
  /* Pixels of drag per item: the label spacing along the arc. */
  const pixelsPerItem = geometry ? geometry.fontSize * DIAL.lineGap : 1;

  /* ── the hand: drag, flick, tap ── */
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (count < 2 || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    stepRef.current?.stop();
    const tapped = (event.target as Element).closest<HTMLElement>(
      "[data-offset]"
    );
    dragRef.current = {
      id: event.pointerId,
      moved: false,
      phi: phi.get(),
      samples: [{ t: event.timeStamp, y: event.clientY }],
      tap: tapped ? Number(tapped.dataset.offset) : null,
      touch: event.pointerType === "touch",
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < DRAG.threshold) {
      return;
    }
    drag.moved = true;
    drag.samples = [
      ...drag.samples.filter((sample) => event.timeStamp - sample.t < 100),
      { t: event.timeStamp, y: event.clientY },
    ];
    let value = drag.phi - dy / pixelsPerItem;
    /* Past an end the dial gives way less and less (in pixels, against
     * the dial's height, as iOS does). */
    if (!loop && geometry) {
      const { height } = geometry;
      if (value < 0) {
        value = -rubberBand(-value * pixelsPerItem, height) / pixelsPerItem;
      } else if (value > last) {
        value =
          last +
          rubberBand((value - last) * pixelsPerItem, height) / pixelsPerItem;
      }
    }
    phi.set(value);
    /* A detent: each label that reaches the centre ticks into place. */
    if (show(value) && !reduceMotion) {
      animate(pulse, [0, 1, 0], { duration: TIMING.detent, ease: "easeOut" });
      if (drag.touch) {
        navigator.vibrate?.(1);
      }
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    const done = () => setDragging(false);

    /* A tap: spring to the label pressed, or settle where the dial is. */
    if (!drag.moved) {
      let target = Math.round(phi.get());
      if (drag.tap !== null) {
        target = loop
          ? Math.round(phi.get() + (drag.tap - phase.get()))
          : drag.tap;
        /* The label already in the centre: open it, as its link would. */
        if (target === Math.round(phi.get()) && linkRef.current) {
          linkRef.current.click();
          stepTo(target, { onDone: done });
          return;
        }
        setAnnouncement(describe(indexOf(target)));
      }
      stepTo(target, { onDone: done });
      return;
    }

    const [first] = drag.samples;
    const latest = drag.samples.at(-1);
    const seconds = first && latest ? (latest.t - first.t) / 1000 : 0;
    /* items per second, positive when turning on */
    let flick =
      first && latest && seconds > 0
        ? -(latest.y - first.y) / pixelsPerItem / seconds
        : 0;
    const here = phi.get();
    /* Pulled past an end: spring straight back, no carry. */
    if (!loop && (here < 0 || here > last)) {
      flick = 0;
    }
    const carried = clamp(flick * DRAG.carry, -DRAG.maxSkip, DRAG.maxSkip);
    const target = Math.round(here + carried);
    setAnnouncement(
      describe(loop ? wrap(target, count) : clamp(target, 0, last))
    );
    stepTo(target, { onDone: done, velocity: flick });
  };

  /* ── the keys ── */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) {
      return;
    }
    const here = Math.round(phi.get());
    /* The nearest copy of item `index`, when the dial loops. */
    const toItem = (index: number) => {
      if (!loop) {
        return index;
      }
      let delta = index - wrap(here, count);
      if (delta > count / 2) {
        delta -= count;
      } else if (delta < -count / 2) {
        delta += count;
      }
      return here + delta;
    };
    const targets: Record<string, number> = {
      ArrowDown: here - 1,
      ArrowLeft: here - 1,
      ArrowRight: here + 1,
      ArrowUp: here + 1,
      End: toItem(last),
      Home: toItem(0),
    };
    if (event.key === "Enter" && linkRef.current) {
      event.preventDefault();
      linkRef.current.click();
      return;
    }
    const target = targets[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    stepTo(target);
  };

  const copies = lapsFor(loop, geometry, count);
  const current = items[view.index] ?? items[0];
  const variants = reduceMotion ? REDUCED_VARIANTS : IMAGE_VARIANTS;

  return (
    <div
      ref={rootRef}
      data-slot="arc-carousel"
      aria-label={dialLabel}
      aria-roledescription="carousel"
      role="region"
      className={cn(
        "relative grid w-full items-center gap-8 bg-background px-5 py-12 text-foreground sm:px-8 md:grid-cols-2 md:gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:px-12 xl:px-16",
        className
      )}
      onBlur={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={
        {
          "--ac-ink": "var(--foreground, oklch(0.145 0 0))",
          "--ac-muted":
            "color-mix(in oklab, var(--foreground, oklch(0.145 0 0)) 38%, var(--background, oklch(1 0 0)))",
          "--ac-muted-hover":
            "color-mix(in oklab, var(--foreground, oklch(0.145 0 0)) 62%, var(--background, oklch(1 0 0)))",
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {/* Changes made by hand, said once they land; autoplay stays quiet. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Hover and focus pause the dial; this pauses it for good, and shows
          only when it has keyboard focus. First in the tab order, before the
          moving dial, as the WAI carousel pattern asks. */}
      {count > 1 && (
        <button
          className="sr-only rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => setPlaying((value) => !value)}
          type="button"
        >
          {playing ? "Pause" : "Play"}
        </button>
      )}

      {/* the dial: a vertical slider for keys and screen readers */}
      <div
        ref={dialRef}
        aria-label={dialLabel}
        aria-orientation="vertical"
        aria-valuemax={count}
        aria-valuemin={1}
        aria-valuenow={view.index + 1}
        aria-valuetext={describe(view.index)}
        className={cn(
          "relative h-[22rem] touch-none overflow-hidden rounded-2xl outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-[28rem] md:h-[30rem] lg:h-[42rem] xl:h-[46rem]",
          dragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onKeyDown={onKeyDown}
        onLostPointerCapture={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        tabIndex={0}
      >
        <div aria-hidden="true" className="absolute inset-0">
          {geometry &&
            copies.flatMap((lap) =>
              items.map((item, index) => {
                let edge: "first" | "last" | undefined;
                if (!loop && index === 0) {
                  edge = "first";
                } else if (!loop && index === last) {
                  edge = "last";
                }
                return (
                  <ArcLabel
                    edge={edge}
                    geometry={geometry}
                    item={item}
                    key={`${item.id}-${lap}`}
                    motionValues={motionValues}
                    number={String(index + 1).padStart(2, "0")}
                    offset={index + lap * count}
                    showProgress={count > 1}
                  />
                );
              })
            )}
        </div>
      </div>

      {/* the image: changes with each step, entering from the side the
          dial turns toward */}
      <ImageFrame
        href={current?.href}
        label={current ? `${linkText}: ${current.label}` : linkText}
        linkRef={linkRef}
        linkText={linkText}
      >
        <AnimatePresence custom={view.direction} initial={false}>
          {current && (
            <motion.img
              alt={current.alt}
              animate="center"
              className="absolute inset-0 size-full object-cover"
              custom={view.direction}
              exit="exit"
              initial="enter"
              key={current.id}
              src={current.image}
              transition={{
                duration: reduceMotion ? 0 : TIMING.step,
                ease: EASE_OUT,
              }}
              variants={variants}
            />
          )}
        </AnimatePresence>
      </ImageFrame>
    </div>
  );
};

export default ArcCarousel;
