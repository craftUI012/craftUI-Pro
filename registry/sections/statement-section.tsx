"use client";

import { Instrument_Serif, Roboto_Flex } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

import { StatementFlow } from "./statement-section-flow";

/* ─────────────────────────────────────────────────────────────────────────
 * Parted statement. A large statement with a round image in the middle of
 * it, every line split at its middle. Scrolling grows the image like a
 * stone pushing through water: the halves of each line it reaches slide
 * apart along its curve and off the sides. When it fills the screen, a
 * second statement rises out of it, from depth, and holds.
 *
 * SCROLL STORYBOARD (the stage is pinned; % of the scroll through it)
 *
 *    0%   the circle, a little over two lines tall, frames the photo's
 *         subject (`image.focus`); as it grows the photo drifts inside it
 *  0–50%  it grows to about two thirds of the stage; the lines it reaches
 *         part round it, and the framing eases back to the whole photo
 * 50–66%  it speeds up past the text, which blurs with its speed and fades
 *         as it slides off the sides, until the photo fills the stage
 * 68–84%  the second statement comes toward you out of the photo: scale
 *         0.6 → 1, blur 8px → 0, its letters drawing together, over a
 *         darkening behind it so it reads
 * 84–100% it holds while the camera keeps pushing in slowly (6%)
 *
 * Words never change lines and everything is a function of one smoothed
 * scroll position (statement-section-flow.ts places the words), so it
 * plays as smoothly backward as forward. Before the script runs the
 * statement is plain centred text, so the server's HTML reads fine.
 * Screen readers get both statements once; the moving copies are hidden
 * from them. With reduced motion nothing blurs, drifts or scales: the
 * second statement fades in place.
 * ───────────────────────────────────────────────────────────────────────── */

const sans = Roboto_Flex({ display: "swap", subsets: ["latin"] });

/** The accent voice: the emphasised phrase, and the second statement. */
const serif = Instrument_Serif({
  display: "swap",
  style: "italic",
  subsets: ["latin"],
  weight: "400",
});

const SCROLL = {
  /** Share of the scroll by which the photo fills the stage. */
  cover: 0.66,
  /** Share of the scroll spent opening the circle inside the text. */
  open: 0.5,
  /** Radius at the end of opening, as a share of the stage's shorter side. */
  openRadius: 0.34,
  /** Radius at the start, in line heights. */
  restRadius: 1.15,
} as const;

/** The photo inside the circle. */
const CAMERA = {
  /** How far the photo drifts inside the small circle, as a share of the stage's height. */
  drift: 0.08,
  /** Extra zoom while the second statement holds. */
  pushIn: 0.06,
  /** Zoom at the start; it settles to 1 as the circle opens. */
  zoom: 1.14,
} as const;

/** The second statement, coming toward you out of the photo. */
const REVEAL = {
  /** Blur at the start, in px. */
  blur: 8,
  /** Share of the scroll where it lands, and holds after. */
  end: 0.84,
  /** Size at the start, as a share of its own. */
  scale: 0.6,
  /** Darkening behind it at full strength (0–1). */
  scrim: 0.5,
  /** Share of the scroll where it starts. */
  start: 0.68,
  /** Letter spacing at the start, in ems. */
  trackingFrom: 0.08,
  /** Letter spacing at rest, in ems. */
  trackingTo: -0.015,
} as const;

/** Blur on a departing word: px per px/s of its speed, and its most. */
const MOTION_BLUR = { max: 3, perSpeed: 0.004 } as const;

/**
 * Scroll is followed through a critically damped spring, so a mouse
 * wheel's steps glide instead of jumping, without trailing far behind a
 * trackpad.
 */
const SCROLL_SPRING = { stiffness: 140 } as const;

export interface StatementImage {
  /** Image URL. A large landscape photo: it ends up filling the screen. */
  src: string;
  /** Describes the photo for screen readers. */
  alt: string;
  /**
   * The photo's subject, as a CSS position ("21% 40%"): the small circle
   * frames it at the start, then eases out to the whole photo.
   */
  focus?: string;
}

export interface StatementSectionProps extends Omit<
  ComponentProps<"section">,
  "children"
> {
  /** The statement. Plain text; it's set word by word. */
  text?: string;
  /** A phrase in `text` set in the italic accent face. */
  emphasis?: string;
  /** The second statement, which rises out of the photo at the end. */
  reveal?: string;
  /** The photo in the circle that grows to fill the screen. */
  image?: StatementImage;
  /** Small text in the top corner. */
  eyebrow?: ReactNode;
  /** How long the stage stays pinned, in screen heights. */
  length?: number;
  /**
   * The element that scrolls, when it isn't the page (a custom scroll
   * container, a smooth-scroll wrapper). The stage is then as tall as it.
   */
  scroller?: RefObject<HTMLElement | null>;
  /** 1 when this is the page's main heading; 2 when the page has its own h1. */
  headingLevel?: 1 | 2;
}

const DEFAULT_TEXT =
  "We make things for the quiet hours, the first light and the long road home, the patient work of getting it right.";

const DEFAULT_IMAGE: StatementImage = {
  alt: "Wind turbines against the rising sun",
  focus: "22% 38%",
  src: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=2000&q=75",
};

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** A cubic between (0, a) and (1, b) leaving at slope ma and arriving at mb. */
const hermite = (t: number, a: number, b: number, ma: number, mb: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * a +
    (t3 - 2 * t2 + t) * ma +
    (-2 * t3 + 3 * t2) * b +
    (t3 - t2) * mb
  );
};

/**
 * The circle's radius at scroll progress p, on a stage w×h: one smooth,
 * always-growing curve from its rest size, through the opening at
 * SCROLL.open, to past the corners at SCROLL.cover, then held. It keeps
 * its speed through the opening, so the scroll never seems to stall.
 */
const radiusAt = (p: number, w: number, h: number, lineHeight: number) => {
  const rest = lineHeight * SCROLL.restRadius;
  const open = Math.max(Math.min(w, h) * SCROLL.openRadius, rest);
  const cover = Math.hypot(w / 2, h / 2) * 1.04;
  if (p >= SCROLL.cover) {
    return cover;
  }
  const first = (open - rest) / SCROLL.open;
  const second = (cover - open) / (SCROLL.cover - SCROLL.open);
  const through = Math.min(3 * first, second);
  if (p <= SCROLL.open) {
    return hermite(p / SCROLL.open, rest, open, 0, through * SCROLL.open);
  }
  const span = SCROLL.cover - SCROLL.open;
  return hermite((p - SCROLL.open) / span, open, cover, through * span, 0);
};

/** "21% 40%" as fractions of the photo; its centre if not given. */
const parseFocus = (focus?: string): [number, number] => {
  const parts = (focus ?? "")
    .split(/\s+/)
    .map((part) => Number.parseFloat(part) / 100);
  const x = Number.isFinite(parts[0]) ? clamp01(parts[0]) : 0.5;
  const y = Number.isFinite(parts[1]) ? clamp01(parts[1]) : 0.5;
  return [x, y];
};

/** Which words (by index) make up `phrase` in `words`, if it's there. */
const phraseIndices = (words: string[], phrase?: string) => {
  const target = (phrase ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (target.length === 0) {
    return new Set<number>();
  }
  for (let i = 0; i + target.length <= words.length; i += 1) {
    if (target.every((t, k) => words[i + k].toLowerCase() === t)) {
      return new Set(target.map((_, k) => i + k));
    }
  }
  return new Set<number>();
};

/** The words' widths, read from the page as plain inline text. */
const measure = (
  block: HTMLElement,
  words: HTMLElement[],
  space: HTMLElement
) => {
  for (const word of words) {
    word.style.transform = "";
  }
  const natural = words.map((word) => word.getBoundingClientRect().width);
  const spaceWidth = space.getBoundingClientRect().width;
  const style = getComputedStyle(block);
  const fontSize = Number.parseFloat(style.fontSize);
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.1;
  return { fontSize, lineHeight, natural, space: spaceWidth };
};

/**
 * Each word's baseline within its own box, once placed: the accent face
 * sits differently in its box, so it's shifted to share the line's
 * baseline. Read from a zero-size marker after each word's text.
 */
const baselines = (words: HTMLElement[]) =>
  words.map((word) => {
    const marker = word.querySelector("[data-baseline]");
    return marker
      ? marker.getBoundingClientRect().top - word.getBoundingClientRect().top
      : 0;
  });

const Heading = ({ children, level }: { children: ReactNode; level: 1 | 2 }) =>
  level === 1 ? (
    <h1 className="sr-only">{children}</h1>
  ) : (
    <h2 className="sr-only">{children}</h2>
  );

export const StatementSection = ({
  text = DEFAULT_TEXT,
  emphasis = "the quiet hours,",
  reveal = "Made slowly, built to last.",
  image = DEFAULT_IMAGE,
  eyebrow = "(02) — Field notes",
  length = 3,
  scroller,
  headingLevel = 2,
  className,
  style,
  ...props
}: StatementSectionProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLParagraphElement>(null);
  const spaceRef = useRef<HTMLSpanElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLParagraphElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [ready, setReady] = useState(false);

  const words = text.split(/\s+/).filter(Boolean);
  const wordsKey = words.join(" ");
  const accent = phraseIndices(words, emphasis);
  const { focus } = image;

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const block = blockRef.current;
    const space = spaceRef.current;
    const lens = windowRef.current;
    const picture = imageRef.current;
    const scrim = scrimRef.current;
    const second = revealRef.current;
    if (!section || !stage || !block || !space || !lens || !picture) {
      return;
    }
    const spans = wordRefs.current.slice(0, words.length);
    if (spans.some((span) => !span)) {
      return;
    }
    const nodes = spans as HTMLSpanElement[];
    const flow = new StatementFlow(nodes.length);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const [fx, fy] = parseFocus(focus);

    let disposed = false;
    let raf = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    let progress = 0;
    let velocity = 0;
    let measured = false;
    let shift = new Float32Array(nodes.length);
    const prevX = new Float32Array(nodes.length);
    const shownBlur = new Float32Array(nodes.length).fill(-1);
    const shownOpacity = new Float32Array(nodes.length).fill(-1);
    const scrollTarget: HTMLElement | Window = scroller?.current ?? window;

    // ── Scroll ───────────────────────────────────────────────────────────
    const viewport = () => {
      if (scrollTarget === window) {
        return { height: window.innerHeight, top: 0 };
      }
      const rect = (scrollTarget as HTMLElement).getBoundingClientRect();
      return { height: rect.height, top: rect.top };
    };

    /** How far through the pinned scroll we are, 0 to 1. */
    const target = () => {
      const rect = section.getBoundingClientRect();
      const view = viewport();
      const travel = rect.height - view.height;
      return travel > 0 ? clamp01((view.top - rect.top) / travel) : 0;
    };

    // ── The photo: framing, drift, zoom ──────────────────────────────────
    const drawPhoto = (p: number, r: number) => {
      const cx = width / 2;
      const cy = height / 2;
      lens.style.clipPath = `circle(${r}px at ${cx}px ${cy}px)`;

      const opening = easeInOut(Math.min(p / SCROLL.cover, 1));
      const hold = smooth(clamp01((p - REVEAL.end) / (1 - REVEAL.end)));
      const zoom =
        p < SCROLL.cover || reduced
          ? CAMERA.zoom - (CAMERA.zoom - 1) * opening
          : 1 + CAMERA.pushIn * hold;

      // The photo covers the stage, cropped toward its subject (the img's
      // object-position is the focus), which so lands at (fx·W, fy·H).
      // It's brought to the circle's centre at the start, and eased back
      // as the circle opens.
      const rw = width * zoom;
      const rh = height * zoom;
      const away = 1 - opening;
      let tx = -(fx - 0.5) * rw * away;
      let ty = -(fy - 0.5) * rh * away;
      if (!reduced) {
        // A slow drift while the circle grows: none at rest (so the subject
        // is framed exactly) or once it's full, most on the way.
        ty -= CAMERA.drift * height * Math.sin(Math.PI * away);
      }
      // Never so far that the photo's edge shows inside the circle.
      const roomX = Math.max(rw / 2 - Math.min(r, cx), 0);
      const roomY = Math.max(rh / 2 - Math.min(r, cy), 0);
      tx = Math.min(Math.max(tx, -roomX), roomX);
      ty = Math.min(Math.max(ty, -roomY), roomY);
      picture.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${zoom})`;
    };

    // ── The second statement ─────────────────────────────────────────────
    const drawReveal = (p: number) => {
      const t = clamp01((p - REVEAL.start) / (REVEAL.end - REVEAL.start));
      const e = easeOut(t);
      if (scrim) {
        scrim.style.opacity = String(smooth(t));
      }
      if (!second) {
        return;
      }
      second.style.opacity = String(smooth(t));
      if (reduced) {
        return;
      }
      const scale = REVEAL.scale + (1 - REVEAL.scale) * e;
      const blur = REVEAL.blur * (1 - e);
      const tracking =
        REVEAL.trackingFrom + (REVEAL.trackingTo - REVEAL.trackingFrom) * e;
      second.style.transform = `scale(${scale})`;
      second.style.filter = blur > 0.05 ? `blur(${blur}px)` : "";
      second.style.letterSpacing = `${tracking.toFixed(4)}em`;
    };

    // ── The words: place, fade at the edge, blur with speed ──────────────
    const drawWords = (dt: number) => {
      for (const [i, node] of nodes.entries()) {
        const x = flow.x[i];
        node.style.transform = `translate3d(${x}px, ${flow.y[i] + shift[i]}px, 0)`;
        const opacity = Math.round(flow.opacity[i] * 100) / 100;
        if (shownOpacity[i] !== opacity) {
          shownOpacity[i] = opacity;
          node.style.opacity = opacity === 1 ? "" : String(opacity);
        }
        const speed = dt > 0 ? Math.abs(x - prevX[i]) / dt : 0;
        prevX[i] = x;
        const blur = reduced
          ? 0
          : Math.round(
              Math.min(speed * MOTION_BLUR.perSpeed, MOTION_BLUR.max) * 2
            ) / 2;
        if (shownBlur[i] !== blur) {
          shownBlur[i] = blur;
          node.style.filter = blur > 0 ? `blur(${blur}px)` : "";
        }
      }
    };

    const step = (dt: number, snap: boolean) => {
      const goal = target();
      if (snap || reduced) {
        progress = goal;
        velocity = 0;
      } else {
        const k = SCROLL_SPRING.stiffness;
        velocity += (-k * (progress - goal) - 2 * Math.sqrt(k) * velocity) * dt;
        progress += velocity * dt;
      }
      const r = radiusAt(progress, width, height, flow.lineHeight);
      const rest = flow.lineHeight * SCROLL.restRadius;
      flow.layout(width, height, width / 2, height / 2, r, rest);
      drawPhoto(progress, r);
      drawReveal(progress);
      drawWords(snap ? 0 : dt);
      const moving =
        Math.abs(progress - goal) > 1e-4 || Math.abs(velocity) > 1e-3;
      if (!moving && !snap) {
        // Settled: one still frame so motion blur clears.
        drawWords(0);
      }
      return moving;
    };

    const frame = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      raf = !disposed && step(dt, false) ? requestAnimationFrame(frame) : 0;
    };

    const wake = () => {
      if (raf === 0 && measured && !disposed) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    // ── Size and measure ─────────────────────────────────────────────────
    const fit = () => {
      // The stage is as tall as whatever scrolls: the window or `scroller`.
      const { height: stageHeight } = viewport();
      section.style.setProperty("--stage-h", `${stageHeight}px`);
      ({ height, width } = stage.getBoundingClientRect());
      // Widths as plain inline text; baselines once placed.
      block.dataset.ready = "false";
      flow.setMetrics(measure(block, nodes, space));
      block.dataset.ready = "true";
      const lines = baselines(nodes);
      const plain = nodes.findIndex((_, i) => !accent.has(i));
      const reference = lines[plain === -1 ? 0 : plain];
      shift = Float32Array.from(lines, (b) => reference - b);
      shownBlur.fill(-1);
      shownOpacity.fill(-1);
      measured = true;
      step(0, true);
      prevX.set(flow.x);
      setReady(true);
    };

    const resize = new ResizeObserver(() => {
      if (!disposed) {
        fit();
      }
    });
    // Measure only once the fonts are in, or the widths are the fallback's.
    const start = async () => {
      await document.fonts.ready;
      if (!disposed) {
        fit();
        resize.observe(stage);
        if (scrollTarget !== window) {
          resize.observe(scrollTarget as HTMLElement);
        }
      }
    };
    void start();

    const onScroll = () => wake();
    // The window's height sets the stage's; the stage itself is fixed px.
    const onResize = () => {
      if (measured && !disposed) {
        fit();
      }
    };
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // A font that finishes loading late changes every width: measure again.
    document.fonts.addEventListener("loadingdone", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.fonts.removeEventListener("loadingdone", onResize);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Rebuilt when the words, accent or framing change, keyed on their text.
  }, [wordsKey, emphasis, focus, scroller]);

  return (
    <section
      ref={sectionRef}
      className={cn(
        "bg-background text-foreground relative",
        sans.className,
        className
      )}
      style={{ height: `calc(var(--stage-h, 100svh) * ${length})`, ...style }}
      {...props}
    >
      <Heading level={headingLevel}>{text}</Heading>
      {reveal ? <p className="sr-only">{reveal}</p> : null}
      <div
        ref={stageRef}
        className="sticky top-0 h-[var(--stage-h,100svh)] overflow-hidden"
      >
        {/* The circle: a window onto the photo, which moves inside it. */}
        <div
          ref={windowRef}
          aria-hidden
          className="absolute inset-0 z-10 overflow-hidden"
          style={{ clipPath: "circle(0px at 50% 50%)" }}
        >
          {/* oxlint-disable-next-line nextjs/no-img-element -- Any URL the host passes, with no next.config image domains to set up. */}
          <img
            ref={imageRef}
            alt=""
            className="absolute inset-0 size-full object-cover will-change-transform"
            decoding="async"
            src={image.src}
            style={{ objectPosition: focus }}
          />
          <div
            ref={scrimRef}
            className="absolute inset-0 opacity-0"
            style={{
              background: `radial-gradient(ellipse 70% 60% at 50% 50%, rgb(0 0 0 / ${REVEAL.scrim}), rgb(0 0 0 / ${REVEAL.scrim * 0.45}) 70%, rgb(0 0 0 / ${REVEAL.scrim * 0.3}))`,
            }}
          />
        </div>

        <p
          ref={blockRef}
          aria-hidden
          className="group/flow absolute inset-0 flex items-center justify-center px-[0.5em] text-center text-[2.75rem] leading-[0.95] font-medium tracking-[-0.03em] sm:text-6xl lg:text-7xl xl:text-[5.5rem] data-[ready=true]:block data-[ready=true]:p-0"
          data-ready={ready ? "true" : "false"}
        >
          <span className="block max-w-[16em] group-data-[ready=true]/flow:contents">
            {words.map((word, i) => (
              <span key={`${i}-${word}`}>
                <span
                  ref={(node) => {
                    wordRefs.current[i] = node;
                  }}
                  className={cn(
                    "whitespace-nowrap group-data-[ready=true]/flow:absolute group-data-[ready=true]/flow:top-0 group-data-[ready=true]/flow:left-0 group-data-[ready=true]/flow:will-change-transform",
                    accent.has(i) &&
                      cn(serif.className, "text-[1.12em] tracking-[-0.01em]")
                  )}
                >
                  {word}
                  <span
                    aria-hidden
                    className="inline-block size-0"
                    data-baseline
                  />
                </span>{" "}
              </span>
            ))}
          </span>
          {/* One space, measured for the gaps between words. */}
          <span
            ref={spaceRef}
            className="pointer-events-none invisible absolute whitespace-pre"
          >
            {" "}
          </span>
        </p>

        {reveal ? (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-6">
            <p
              ref={revealRef}
              aria-hidden
              className={cn(
                serif.className,
                "max-w-[12em] text-center text-5xl leading-[0.95] text-balance text-white opacity-0 [text-shadow:0_1px_24px_rgb(0_0_0/0.25)] sm:text-7xl lg:text-8xl xl:text-[8.5rem]"
              )}
            >
              {reveal}
            </p>
          </div>
        ) : null}

        {eyebrow ? (
          <p className="absolute top-5 left-5 z-30 font-mono text-[0.6875rem] tracking-[0.08em] text-white uppercase mix-blend-difference sm:top-8 sm:left-8">
            {eyebrow}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default StatementSection;
