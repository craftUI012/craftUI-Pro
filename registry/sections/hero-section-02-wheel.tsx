"use client";

import { ArrowUpRight } from "lucide-react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type {
  AnimationPlaybackControls,
  MotionValue,
  Transition,
} from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { cn } from "@/lib/utils";

import { NARROW, SPAN, WIDE } from "./hero-section-02-shared";
import type {
  ShowreelCategory,
  ShowreelReel,
  Wheel,
} from "./hero-section-02-shared";

/* The wheel itself: frames, rims and their captions. Both wheels (WIDE
 * beside the copy, NARROW mirrored above it) are rendered, and a container
 * query shows one, so the server's HTML is already right at any width. Each
 * is drawn in design units inside an anchor the section scales (--reel-s).
 *
 * One motion value, `position`, drives every frame: a float index that can
 * run past the ends. Each frame's offset is its index minus `position`,
 * wrapped into the ring, so the strip is an endless loop. A frame only
 * jumps ends where it's fully faded out, never across the visible arc. */

const SPRING: Transition = {
  bounce: 0.12,
  type: "spring",
  visualDuration: 0.7,
};

/** Fewer reels than this are repeated round the ring so it never has gaps. */
const MIN_FRAMES = 12;

/** Spokes per side of the crest, and their length. */
const FAN = 7;
const FAN_LEN = 1600;

/** Pixels a press can wander before it becomes a drag. */
const TAP_SLOP = 6;

/** Seconds of release velocity projected forward when a drag is flung. */
const FLING = 0.16;

const KEY_STEPS: Record<string, number> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
};

const mod = (value: number, n: number) => ((value % n) + n) % n;

/** `value` wrapped into [-n/2, n/2): a signed distance round the ring. */
const wrap = (value: number, n: number) => mod(value + n / 2, n) - n / 2;

/**
 * Frames recede with distance from the crest, and are fully gone by the
 * point where they wrap to the other end.
 */
const frameOpacity = (offset: number, count: number) => {
  const away = Math.abs(offset);
  const depth = 1 - Math.min(away / 8, 1) * 0.7;
  const edge = Math.min(Math.max((count / 2 - away) / 1.25, 0), 1);
  return depth * edge;
};

/* The bezel is the next ring out: foreground mixed into the page colour, so
 * it reads as a darker band on light and a lighter one on dark. The first
 * stop is the crease where bezel meets picture. */
const bezelFill = (lift: number) =>
  `linear-gradient(90deg, color-mix(in oklab, var(--foreground) 28%, transparent) 0 3px, color-mix(in oklab, var(--foreground) ${lift}%, var(--background)) 3px, color-mix(in oklab, var(--foreground) ${lift * 0.62}%, var(--background)) 62%, color-mix(in oklab, var(--foreground) ${lift * 0.4}%, var(--background)) 100%)`;
const BEZEL_FILL = bezelFill(7);
const BEZEL_FILL_CREST = bezelFill(11);

interface FrameProps {
  count: number;
  flip: boolean;
  index: number;
  isCrest: boolean;
  onSelect: (index: number) => void;
  position: MotionValue<number>;
  reel: ShowreelReel;
  setRef: (element: HTMLButtonElement | null) => void;
  wheel: Wheel;
}

const Frame = ({
  count,
  flip,
  index,
  isCrest,
  onSelect,
  position,
  reel,
  setRef,
  wheel,
}: FrameProps) => {
  const { at, bezel, bezelAt, pic, step } = wheel;
  const offset = useTransform(position, (p) => wrap(index - p, count));
  const angle = useTransform(offset, (o) => o * step);
  const x = useTransform(angle, (a) => at(a, pic.rc).x);
  const y = useTransform(angle, (a) => at(a, pic.rc).y);
  const opacity = useTransform(offset, (o) => frameOpacity(o, count));
  const shade = useTransform(offset, (o) => Math.min(Math.abs(o) * 0.08, 0.45));
  const zIndex = useTransform(offset, (o) => 40 - Math.round(Math.abs(o)));

  return (
    <motion.button
      ref={setRef}
      aria-current={isCrest || undefined}
      aria-label={reel.description}
      className={cn(
        "group/frame absolute top-0 left-0 cursor-grab outline-none select-none active:cursor-grabbing",
        // Narrow: the band runs sideways, so vertical swipes still scroll.
        flip ? "touch-pan-y" : "touch-none"
      )}
      data-crest={isCrest || undefined}
      onClick={() => onSelect(index)}
      style={{
        height: pic.h,
        marginLeft: -pic.w / 2,
        marginTop: -pic.h / 2,
        opacity,
        rotate: angle,
        width: pic.w,
        x,
        y,
        zIndex,
      }}
      tabIndex={isCrest ? 0 : -1}
      type="button"
    >
      {/* The picture, cut to its sector. */}
      <span
        className="bg-muted absolute inset-0"
        style={{ clipPath: pic.clip }}
      >
        {/* Upright, 16:9 on screen. On the mirrored wheel the box is laid
            the other way round, and the same diagonal flip, applied twice,
            cancels out. */}
        <span
          className="absolute top-1/2 left-1/2 block"
          style={{
            height: flip ? pic.w : pic.h,
            transform: flip
              ? "translate(-50%, -50%) matrix(0, 1, 1, 0, 0, 0)"
              : "translate(-50%, -50%)",
            width: flip ? pic.h : pic.w,
          }}
        >
          {/* oxlint-disable-next-line nextjs/no-img-element -- Any URL the host passes, with no next.config image domains to set up. */}
          <img
            alt={reel.alt}
            className="size-full object-cover"
            decoding="async"
            draggable={false}
            loading="lazy"
            src={reel.src}
          />
        </span>
        {/* Everything off the crest sits back, toward the page colour. */}
        <motion.span
          aria-hidden
          className="bg-background pointer-events-none absolute inset-0"
          style={{ opacity: shade }}
        />
      </span>

      {/* The bezel: the next ring out, over the same two angles. Its box is
          taller than the picture's (the same angle subtends more arc further
          out), so it's placed by bezelAt rather than butted on. */}
      <span
        aria-hidden
        className="pointer-events-none absolute transition-[background] duration-300"
        style={{
          background: isCrest ? BEZEL_FILL_CREST : BEZEL_FILL,
          clipPath: bezel.clip,
          height: bezel.h,
          left: bezelAt.left,
          top: bezelAt.top,
          width: bezel.w,
        }}
      />

      {/* A 1px outline on the picture, traced on the sector like the focus
          ring below: pure black at 10% on light pages, pure white on dark,
          so its edge holds against any frame or background. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible"
        height={pic.h}
        width={pic.w}
      >
        <path
          className="stroke-black/10 dark:stroke-white/10"
          d={pic.d}
          fill="none"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Focus ring traced on the sector itself, not its square box. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible opacity-0 group-focus-visible/frame:opacity-100"
        height={pic.h}
        width={pic.w}
      >
        <path
          d={pic.d}
          fill="none"
          stroke="var(--ring)"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </motion.button>
  );
};

interface ArcCaptionProps {
  category?: string;
  count: number;
  flip: boolean;
  index: number;
  isCrest: boolean;
  position: MotionValue<number>;
  reel: ShowreelReel;
  wheel: Wheel;
}

/* Undo the anchor's scale (text stays its real size at every width), then
 * hang the caption off its point on the arc: beside it on the wide wheel,
 * centred under it on the mirrored one. */
const CAPTION_WIDE =
  "w-[calc(var(--reel-caption-w)*var(--reel-s))] items-start text-left [transform:scale(calc(1/var(--reel-s)))_translate(0,-50%)]";
const CAPTION_NARROW =
  "w-[calc(var(--reel-narrow-step)*var(--reel-s)-1rem)] items-center text-center [transform:matrix(0,1,1,0,0,0)_scale(calc(1/var(--reel-s)))_translate(-50%,0)]";

/**
 * A reel's details, riding the arc just past the rim at the same angle as
 * its frame, so they turn with it. Every caption stays on the arc, dimming
 * with distance as the frames do; the section's focus blur does the rest.
 * Only the crest's can be clicked or tabbed to. On the mirrored wheel each
 * is one frame wide, so neighbours sit side by side.
 */
const ArcCaption = ({
  category,
  count,
  flip,
  index,
  isCrest,
  position,
  reel,
  wheel,
}: ArcCaptionProps) => {
  const { at, config, rimR, step } = wheel;
  const r = rimR + config.captionGap;
  const offset = useTransform(position, (p) => wrap(index - p, count));
  const angle = useTransform(offset, (o) => o * step);
  const x = useTransform(angle, (a) => at(a, r).x);
  const y = useTransform(angle, (a) => at(a, r).y);
  const opacity = useTransform(offset, (o) =>
    Math.max(0.3, 1 - Math.abs(o) * 0.28)
  );

  return (
    <motion.div
      aria-hidden={!isCrest}
      className="pointer-events-none absolute top-0 left-0"
      inert={!isCrest}
      style={{ opacity, rotate: angle, x, y }}
    >
      <div
        className={cn(
          "absolute top-0 left-0 flex origin-top-left flex-col",
          isCrest && "pointer-events-auto",
          flip ? CAPTION_NARROW : CAPTION_WIDE
        )}
      >
        {category ? (
          <p
            className={cn(
              "text-foreground leading-tight font-semibold tracking-tight",
              flip ? "text-[15px]" : "text-lg"
            )}
          >
            {category}
          </p>
        ) : null}
        <p
          className={cn(
            "text-muted-foreground mt-1.5 w-full leading-snug text-pretty",
            // A frame-wide caption gets a third line before it truncates.
            flip ? "line-clamp-3 text-xs" : "line-clamp-2 text-sm"
          )}
        >
          {reel.href ? (
            <a
              className="focus-visible:ring-ring/50 hover:text-foreground rounded-sm outline-none transition-colors duration-150 hover:underline hover:underline-offset-4 focus-visible:ring-[3px]"
              href={reel.href}
            >
              {reel.description}
              <ArrowUpRight
                aria-hidden
                className="ml-0.5 inline size-3.5 align-[-0.125em]"
              />
            </a>
          ) : (
            reel.description
          )}
        </p>
        {reel.views && reel.views.length > 0 ? (
          <dl
            className={cn(
              "text-foreground flex flex-wrap items-center font-medium tabular-nums",
              flip
                ? "mt-2 justify-center gap-x-2 gap-y-1 text-[11px]"
                : "mt-3 gap-x-4 gap-y-1.5 text-xs"
            )}
          >
            {reel.views.map((view) => (
              <div key={view.platform} className="flex items-center gap-1.5">
                <dt className="sr-only">{view.platform} views</dt>
                <span className="[&_svg]:size-3.5 [&_svg]:shrink-0">
                  {view.icon}
                </span>
                <dd className="whitespace-nowrap">{view.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </motion.div>
  );
};

/** Rims, lip, spokes and the content side's surface: one static SVG. */
const Drum = ({ wheel }: { wheel: Wheel }) => {
  const uid = useId().replaceAll(/[^\w-]/gu, "");
  const { arc, at, config, lipR, picInner, picOuter, rimR, step } = wheel;
  const crest = at(0, rimR);
  const top = at(-SPAN, rimR);
  const bottom = at(SPAN, rimR);
  const spokes = Array.from({ length: FAN * 2 + 2 }, (_, i) => i - FAN - 1);

  return (
    <svg
      aria-hidden
      className="text-foreground pointer-events-none absolute top-0 left-0 overflow-visible"
      height={1}
      width={1}
    >
      <defs>
        {/* The content side is its own surface: a touch off the page colour
            at the curve, falling back to it. */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${uid}-panel`}
          x1={crest.x}
          x2={crest.x + 900}
          y1={0}
          y2={0}
        >
          <stop offset="0" stopColor="currentColor" stopOpacity={0.045} />
          <stop offset="0.45" stopColor="currentColor" stopOpacity={0.015} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
        {/* Spokes fade along their length and are gone before the copy. */}
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${uid}-spoke`}
          x1={crest.x}
          x2={crest.x + config.spokeFade}
          y1={0}
          y2={0}
        >
          <stop offset="0" stopColor="currentColor" stopOpacity={0.16} />
          <stop offset="0.55" stopColor="currentColor" stopOpacity={0.07} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* The content side, its leading edge the rim arc itself, so the page
          surface and the band share one curve. */}
      <path
        d={`${arc(rimR, -SPAN, SPAN)} L 4000 ${bottom.y} L 4000 ${top.y} Z`}
        fill={`url(#${uid}-panel)`}
      />
      {/* Back lip: the back of the drum. */}
      <path
        d={arc(lipR, -SPAN, SPAN)}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.035}
        strokeWidth={config.lipWidth}
      />
      {/* A clean gap between the lip and the strip. */}
      <path
        d={arc(picInner - 6, -SPAN, SPAN)}
        fill="none"
        stroke="var(--background)"
        strokeWidth={22}
      />
      {/* Backing for the picture band and the bezel, so the band still
          reads as one ring past where the frames fade out. */}
      <path
        d={arc((picInner + picOuter) / 2, -SPAN, SPAN)}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.025}
        strokeWidth={config.radial}
      />
      <path
        d={arc(picOuter + config.stripW / 2, -SPAN, SPAN)}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.05}
        strokeWidth={config.stripW}
      />
      {/* Spokes leave the rim at the seams between frames, so each slab on
          the content side continues exactly one frame. The crest's own two
          edges are brightest: they bracket the caption. */}
      {spokes.map((k) => {
        const a = (k + 0.5) * step;
        const p = at(a, rimR + 2);
        const q = at(a, rimR + FAN_LEN);
        const isCrestEdge = Math.abs(k + 0.5) < 1;
        return (
          <line
            key={k}
            opacity={isCrestEdge ? 1 : Math.max(0.2, 1 - Math.abs(k) * 0.11)}
            stroke={`url(#${uid}-spoke)`}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            x1={p.x}
            x2={q.x}
            y1={p.y}
            y2={q.y}
          />
        );
      })}
      {/* Front rim: the accent hairline where the band meets the page. */}
      <path
        d={arc(rimR, -SPAN, SPAN)}
        fill="none"
        stroke="var(--primary)"
        strokeOpacity={0.8}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {/* Crest tick: the strip's reading line. */}
      <path
        d={arc(rimR, -step / 2, step / 2)}
        fill="none"
        stroke="var(--primary)"
        strokeLinecap="round"
        strokeWidth={4}
      />
    </svg>
  );
};

interface WheelViewProps {
  categories: Map<string, string>;
  className: string;
  crestIndex: number;
  flip: boolean;
  handlers: {
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  };
  hold: Record<
    "onBlur" | "onFocus" | "onPointerEnter" | "onPointerLeave",
    () => void
  >;
  label: string;
  onSelect: (index: number) => void;
  position: MotionValue<number>;
  reels: ShowreelReel[];
  ringCount: number;
  setRef: (index: number, element: HTMLButtonElement | null) => void;
  wheel: Wheel;
}

/** One wheel: a zero-size anchor at its reference point, scaled by --reel-s. */
const WheelView = ({
  categories,
  className,
  crestIndex,
  flip,
  handlers,
  hold,
  label,
  onSelect,
  position,
  reels,
  ringCount,
  setRef,
  wheel,
}: WheelViewProps) => (
  <div
    aria-label={label}
    aria-roledescription="carousel"
    className={cn("absolute z-20 origin-top-left", className)}
    role="region"
    {...hold}
  >
    <div
      className="showreel-drum"
      style={{ transformOrigin: `${wheel.cx}px 0px` }}
    >
      <Drum wheel={wheel} />
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- The frames inside are the focusable controls; this only routes their keys and drags. */}
      <div
        className="absolute top-0 left-0"
        data-axis={flip ? "x" : "y"}
        data-step={wheel.config.tangential}
        {...handlers}
      >
        {Array.from({ length: ringCount }, (_, i) => (
          <Frame
            key={i}
            count={ringCount}
            flip={flip}
            index={i}
            isCrest={crestIndex === i}
            onSelect={onSelect}
            position={position}
            reel={reels[i % reels.length]}
            setRef={(element) => setRef(i, element)}
            wheel={wheel}
          />
        ))}
      </div>
      {Array.from({ length: ringCount }, (_, i) => {
        const reel = reels[i % reels.length];
        return (
          <ArcCaption
            key={i}
            category={reel.category ? categories.get(reel.category) : undefined}
            count={ringCount}
            flip={flip}
            index={i}
            isCrest={crestIndex === i}
            position={position}
            reel={reel}
            wheel={wheel}
          />
        );
      })}
    </div>
  </div>
);

// How big the wheel is drawn comes from the CSS the section set, so a drag
// always matches what's on screen.
const readScale = (element: Element) =>
  Number.parseFloat(getComputedStyle(element).getPropertyValue("--reel-s")) ||
  1;

export interface ShowreelWheelProps {
  autoplay: boolean;
  autoplayInterval: number;
  categories?: ShowreelCategory[];
  initialIndex: number;
  label: string;
  reels: ShowreelReel[];
}

export const ShowreelWheel = ({
  autoplay,
  autoplayInterval,
  categories,
  initialIndex,
  label,
  reels,
}: ShowreelWheelProps) => {
  const count = reels.length;
  const ringCount = count * Math.max(1, Math.ceil(MIN_FRAMES / count));
  const reduced = useReducedMotion();

  const position = useMotionValue(initialIndex);
  const target = useRef(initialIndex);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  // Both wheels' frames, keyed "w3" / "n3"; only one wheel is ever shown.
  const frames = useRef(new Map<string, HTMLButtonElement | null>());
  const focusCrest = useRef(false);

  // The frame nearest the crest, as the wheel turns (not just where it'll
  // land): it takes focus, the playback bar and the readable caption.
  const [crestRing, setCrestRing] = useState(initialIndex);
  useMotionValueEvent(position, "change", (p) => setCrestRing(Math.round(p)));
  const reel = reels[mod(crestRing, count)];
  const categoryLabels = new Map(
    categories?.map((category) => [category.id, category.label])
  );

  const [interacted, setInteracted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Covers the stage, so autoplay can tell when the wheel is on screen.
  const probeRef = useRef<HTMLDivElement>(null);
  const inView = useInView(probeRef, { margin: "-10% 0px" });

  const settle = useCallback(
    (next: number, velocity = 0) => {
      controls.current?.stop();
      target.current = next;
      if (reduced) {
        position.set(next);
        return;
      }
      controls.current = animate(position, next, { ...SPRING, velocity });
    },
    [position, reduced]
  );

  const go = useCallback(
    (direction: number) => settle(target.current + direction),
    [settle]
  );

  const selectFrame = (index: number) => {
    setInteracted(true);
    settle(target.current + wrap(index - target.current, ringCount));
  };

  /* ---- drag: 1:1 under the finger, flung to the nearest frame ---- */

  const drag = useRef<{
    axis: "x" | "y";
    from: number;
    id: number;
    last: number;
    moved: boolean;
    origin: number;
    perFrame: number;
    time: number;
    velocity: number;
  } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const { axis, step } = event.currentTarget.dataset;
    drag.current = {
      axis: axis === "x" ? "x" : "y",
      from: position.get(),
      id: event.pointerId,
      last: position.get(),
      moved: false,
      origin: axis === "x" ? event.clientX : event.clientY,
      // Screen pixels of drag that move the wheel by one frame.
      perFrame: readScale(event.currentTarget) * Number(step),
      time: event.timeStamp,
      velocity: 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) {
      return;
    }
    const delta =
      (state.axis === "x" ? event.clientX : event.clientY) - state.origin;
    if (!state.moved) {
      if (Math.abs(delta) < TAP_SLOP) {
        return;
      }
      // Now it's a drag: capture, so the release can't land as a click.
      state.moved = true;
      controls.current?.stop();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      setInteracted(true);
    }
    const next = state.from - delta / state.perFrame;
    const seconds = (event.timeStamp - state.time) / 1000;
    if (seconds > 0) {
      state.velocity =
        0.8 * ((next - state.last) / seconds) + 0.2 * state.velocity;
    }
    state.last = next;
    state.time = event.timeStamp;
    position.set(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) {
      return;
    }
    setDragging(false);
    // A pause before letting go means no fling.
    const velocity = event.timeStamp - state.time < 80 ? state.velocity : 0;
    settle(Math.round(position.get() + velocity * FLING), velocity);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    setInteracted(true);
    focusCrest.current = true;
    go(step);
  };

  // Keyboard moves keep focus on whichever frame is at the crest.
  useEffect(() => {
    if (focusCrest.current) {
      focusCrest.current = false;
      const index = mod(crestRing, ringCount);
      const shown = [
        frames.current.get(`w${index}`),
        frames.current.get(`n${index}`),
      ].find((element) => element?.offsetParent);
      shown?.focus({ preventScroll: true });
    }
  }, [crestRing, ringCount]);

  /* ---- autoplay: advances while nobody's using the wheel and it's on
     screen. Any move restarts the count, so it never steps right after
     one. ---- */

  useEffect(() => {
    if (!autoplay || reduced || paused || dragging || !inView) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        go(1);
      }
    }, autoplayInterval);
    return () => window.clearInterval(timer);
  }, [
    autoplay,
    autoplayInterval,
    crestRing,
    dragging,
    go,
    inView,
    paused,
    reduced,
  ]);

  const hold = {
    onBlur: () => setPaused(false),
    onFocus: () => setPaused(true),
    onPointerEnter: () => setPaused(true),
    onPointerLeave: () => setPaused(false),
  };

  if (count === 0) {
    return null;
  }

  const handlers = {
    onKeyDown,
    onPointerCancel: onPointerUp,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };

  return (
    <>
      <WheelView
        className="top-1/2 left-0 hidden [transform:scale(var(--reel-s))] @5xl:block"
        crestIndex={mod(crestRing, ringCount)}
        flip={false}
        handlers={handlers}
        hold={hold}
        categories={categoryLabels}
        label={label}
        onSelect={selectFrame}
        position={position}
        reels={reels}
        ringCount={ringCount}
        setRef={(index, element) => frames.current.set(`w${index}`, element)}
        wheel={WIDE}
      />
      {/* Mirrored across the diagonal: the same wheel, lying across the top
          and opening downward. */}
      <WheelView
        className="top-0 left-1/2 [transform:scale(var(--reel-s))_matrix(0,1,1,0,0,0)] @5xl:hidden"
        crestIndex={mod(crestRing, ringCount)}
        flip
        handlers={handlers}
        hold={hold}
        categories={categoryLabels}
        label={label}
        onSelect={selectFrame}
        position={position}
        reels={reels}
        ringCount={ringCount}
        setRef={(index, element) => frames.current.set(`n${index}`, element)}
        wheel={NARROW}
      />

      <div
        ref={probeRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      />
      {/* The captions are drawn on the arc; this is what's read out. */}
      <p aria-live={interacted ? "polite" : "off"} className="sr-only">
        {reel.description}
      </p>
    </>
  );
};
