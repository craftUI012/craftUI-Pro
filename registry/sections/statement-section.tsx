"use client";

import { Roboto_Flex } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

import { SQUEEZE, StatementFlow } from "./statement-section-flow";

/* ─────────────────────────────────────────────────────────────────────────
 * Parted statement. A large statement with a round image in the middle of
 * it, the lines parting round its curve. Scrolling grows the image like a
 * stone pushing through water: the lines it presses condense first, then
 * words drop to the next line, and at the end the text is pushed off the
 * edges and the image fills the screen.
 *
 * SCROLL STORYBOARD (the stage is pinned; % of the scroll through it)
 *
 *    0%   the image is a circle a little over two lines tall
 *  0–78%  it grows to about two thirds of the stage; the lines round it
 *         condense, then words break to the next line, the push rippling
 *         outward from the circle
 * 78–100% it grows past the text, which is pushed off the top and bottom;
 *         the image fills the stage, settling from a slight zoom
 *
 * statement-section-flow.ts does the wrapping and the words' springs; this
 * file measures, scrolls and draws. Before the script runs the statement is
 * plain centred text, so the server's HTML reads fine. Screen readers get
 * the statement once, as a heading; the moving words are hidden from them.
 * With reduced motion the words snap to place instead of travelling.
 * ───────────────────────────────────────────────────────────────────────── */

/** A variable font with a width axis, for the squeeze. */
const flex = Roboto_Flex({
  axes: ["wdth"],
  display: "swap",
  subsets: ["latin"],
});

const SCROLL = {
  /** Share of the scroll spent opening the circle inside the text. */
  open: 0.78,
  /** Radius at the end of opening, as a share of the stage's shorter side. */
  openRadius: 0.34,
  /** Radius at the start, in line heights. */
  restRadius: 1.15,
  /** The image's zoom at the start; it settles to 1 as the circle opens. */
  zoom: 1.14,
} as const;

/**
 * The circle follows the scroll through a spring, so wheel steps glide. It
 * is softer than the words', so the words always make way ahead of it.
 */
const RADIUS_SPRING = { stiffness: 60 } as const;

export interface StatementImage {
  src: string;
  alt: string;
}

export interface StatementSectionProps extends Omit<
  ComponentProps<"section">,
  "children"
> {
  /** The statement. Plain text; it's set word by word. */
  text?: string;
  image?: StatementImage;
  /** Small text in the top corner. */
  eyebrow?: ReactNode;
  /** Small text in the bottom corner, e.g. where the picture was taken. */
  caption?: ReactNode;
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
  src: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=2000&q=75",
};

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const easeIn = (t: number) => t * t * t;

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

/** The circle's radius at scroll progress p, on a stage w×h. */
const radiusAt = (p: number, w: number, h: number, lineHeight: number) => {
  const rest = lineHeight * SCROLL.restRadius;
  const open = Math.max(Math.min(w, h) * SCROLL.openRadius, rest);
  if (p <= SCROLL.open) {
    return rest + (open - rest) * easeInOut(p / SCROLL.open);
  }
  const cover = Math.hypot(w / 2, h / 2) + 2;
  return open + (cover - open) * easeIn((p - SCROLL.open) / (1 - SCROLL.open));
};

const sum = (list: number[]) => list.reduce((total, w) => total + w, 0);

/** The words' widths at normal width and fully condensed, read from the page. */
const measure = (
  block: HTMLElement,
  words: HTMLElement[],
  space: HTMLElement
) => {
  const read = () => ({
    space: space.getBoundingClientRect().width,
    widths: words.map((word) => word.getBoundingClientRect().width),
  });
  // Measured as plain inline text, with no per-word width set.
  const { ready } = block.dataset;
  block.dataset.ready = "false";
  for (const word of words) {
    word.style.fontVariationSettings = "";
    word.style.transform = "";
  }
  block.style.fontVariationSettings = "";
  const normal = read();
  block.style.fontVariationSettings = `"wdth" ${SQUEEZE.min * 100}`;
  const narrow = read();
  block.style.fontVariationSettings = "";
  block.dataset.ready = ready;

  const style = getComputedStyle(block);
  const fontSize = Number.parseFloat(style.fontSize);
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.1;
  // A font with no width axis doesn't get narrower: fake a gentler squeeze.
  const axis = sum(narrow.widths) < sum(normal.widths) * 0.98;
  const min = axis ? SQUEEZE.min : SQUEEZE.synthetic;
  return {
    axis,
    metrics: {
      condensed: axis
        ? narrow.widths
        : normal.widths.map((w) => w * SQUEEZE.synthetic),
      fontSize,
      lineHeight,
      natural: normal.widths,
      space: normal.space,
      spaceCondensed: axis ? narrow.space : normal.space * SQUEEZE.synthetic,
    },
    min,
  };
};

const Heading = ({ children, level }: { children: ReactNode; level: 1 | 2 }) =>
  level === 1 ? (
    <h1 className="sr-only">{children}</h1>
  ) : (
    <h2 className="sr-only">{children}</h2>
  );

export const StatementSection = ({
  text = DEFAULT_TEXT,
  image = DEFAULT_IMAGE,
  eyebrow = "(02) — Field notes",
  caption = "First light, 05:48",
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
  const imageRef = useRef<HTMLImageElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [ready, setReady] = useState(false);

  const words = text.split(/\s+/).filter(Boolean);
  const wordsKey = words.join(" ");

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const block = blockRef.current;
    const space = spaceRef.current;
    const picture = imageRef.current;
    if (!section || !stage || !block || !space || !picture) {
      return;
    }
    const spans = wordRefs.current.slice(0, words.length);
    if (spans.some((span) => !span)) {
      return;
    }
    const nodes = spans as HTMLSpanElement[];
    const flow = new StatementFlow(nodes.length);
    flow.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let disposed = false;
    let raf = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    let axis = true;
    let radius = 0;
    let radiusV = 0;
    let measured = false;
    const shown = new Float32Array(nodes.length).fill(-1);
    const scrollTarget: HTMLElement | Window = scroller?.current ?? window;

    // ── Scroll ───────────────────────────────────────────────────────────
    const viewport = () =>
      scrollTarget === window
        ? { height: window.innerHeight, top: 0 }
        : (() => {
            const rect = (scrollTarget as HTMLElement).getBoundingClientRect();
            return { height: rect.height, top: rect.top };
          })();

    /** How far through the pinned scroll we are, 0 to 1. */
    const progress = () => {
      const rect = section.getBoundingClientRect();
      const view = viewport();
      const travel = rect.height - view.height;
      return travel > 0 ? clamp01((view.top - rect.top) / travel) : 0;
    };

    // ── Draw ─────────────────────────────────────────────────────────────
    const draw = () => {
      const cx = width / 2;
      const cy = height / 2;
      picture.style.clipPath = `circle(${radius}px at ${cx}px ${cy}px)`;
      const p = progress();
      picture.style.transform = `scale(${SCROLL.zoom - (SCROLL.zoom - 1) * p})`;
      for (const [i, node] of nodes.entries()) {
        const s = flow.stretch[i];
        node.style.transform = axis
          ? `translate3d(${flow.x[i]}px, ${flow.y[i]}px, 0)`
          : `translate3d(${flow.x[i]}px, ${flow.y[i]}px, 0) scaleX(${s})`;
        // Width-axis changes restyle the word: only when it really changes.
        const wdth = Math.round(s * 200) / 2;
        if (axis && shown[i] !== wdth) {
          shown[i] = wdth;
          node.style.fontVariationSettings =
            wdth === 100 ? "" : `"wdth" ${wdth}`;
        }
      }
    };

    const step = (dt: number, snap: boolean) => {
      const target = radiusAt(progress(), width, height, flow.lineHeight);
      if (snap || flow.reducedMotion) {
        radius = target;
        radiusV = 0;
      } else {
        const k = RADIUS_SPRING.stiffness;
        radiusV += (-k * (radius - target) - 2 * Math.sqrt(k) * radiusV) * dt;
        radius += radiusV * dt;
      }
      flow.layout(width, width / 2, height / 2, radius);
      if (snap) {
        flow.snap();
      }
      const moving = flow.step(dt);
      draw();
      return (
        moving || Math.abs(radius - target) > 0.3 || Math.abs(radiusV) > 0.5
      );
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
      const result = measure(block, nodes, space);
      ({ axis } = result);
      flow.setMetrics(result.metrics, result.min);
      shown.fill(-1);
      measured = true;
      step(0, true);
      setReady(true);
    };

    const resize = new ResizeObserver(() => {
      if (!disposed) {
        fit();
      }
    });
    // Measure only once the font is in, or the widths are the fallback's.
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

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Rebuilt when the words change, keyed on their text.
  }, [wordsKey, scroller]);

  const Level = headingLevel;

  return (
    <section
      ref={sectionRef}
      className={cn(
        "bg-background text-foreground relative",
        flex.className,
        className
      )}
      style={{ height: `calc(var(--stage-h, 100svh) * ${length})`, ...style }}
      {...props}
    >
      <Heading level={Level}>{text}</Heading>
      <div
        ref={stageRef}
        className="sticky top-0 h-[var(--stage-h,100svh)] overflow-hidden"
      >
        {/* oxlint-disable-next-line nextjs/no-img-element -- Any URL the host passes, with no next.config image domains to set up. */}
        <img
          ref={imageRef}
          alt={image.alt}
          // In front of the words: a word crossing the gap while the text
          // reflows passes behind the picture, as behind a stone.
          className="absolute inset-0 z-10 size-full object-cover"
          decoding="async"
          src={image.src}
          style={{ clipPath: "circle(0px at 50% 50%)" }}
        />

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
                  className="whitespace-nowrap group-data-[ready=true]/flow:absolute group-data-[ready=true]/flow:top-0 group-data-[ready=true]/flow:left-0 group-data-[ready=true]/flow:origin-left group-data-[ready=true]/flow:will-change-transform"
                >
                  {word}
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

        {eyebrow ? (
          <p className="absolute top-5 left-5 z-20 font-mono text-[0.6875rem] tracking-[0.08em] text-white uppercase mix-blend-difference sm:top-8 sm:left-8">
            {eyebrow}
          </p>
        ) : null}
        {caption ? (
          <p className="absolute right-5 bottom-5 z-20 max-w-[60%] text-right font-mono text-[0.6875rem] tracking-[0.08em] text-white uppercase mix-blend-difference sm:right-8 sm:bottom-8">
            {caption}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default StatementSection;
