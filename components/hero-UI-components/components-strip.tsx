"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  LazyMotion,
  MotionConfig,
  animate,
  m,
  useMotionValue,
  useTransform,
} from "motion/react";
import * as React from "react";

import {
  STRIP_COMPONENTS,
  STRIP_MOTION,
} from "@/components/hero-UI-components/components-data";
import type * as ComponentsRegistry from "@/components/hero-UI-components/components-registry";
import { StripTile } from "@/components/hero-UI-components/strip-tile";
import { Button } from "@/components/ui/button";
import { TYPE } from "@/constants/typography";
import type { CssTokenSource } from "@/lib/css-vars";
import { cn } from "@/lib/utils";

// Drag, momentum and layout animations need Motion's full feature set; load it
// after first paint.
const loadFeatures = async () => {
  const { domMax } = await import("motion/react");

  return domMax;
};

// Start loading the live components a little before the strip is visible.
const PRELOAD_MARGIN = "300px";
// Breathing room kept around a tile slid into view (px).
const REVEAL_MARGIN = 24;
// Progress (0–1) within which an edge counts as reached.
const EDGE = 0.01;
const TRACK_ID = "components-strip-track";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// One horizontal row of components, moved with physics rather than native
// scrolling:
// - drag: inertia after release, elastic resistance past either end, then a
//   spring back (Motion drag + dragTransition);
// - trackpad / horizontal wheel: follows the OS's own momentum, with the same
//   resistance past the ends, settling back once the wheel goes quiet;
// - vertical wheel and vertical swipes still scroll the page;
// - previous / next buttons page through for a mouse without a trackpad.
// Edge fades and a scroll bar under the row show there's more to see.
// Selecting a tile opens it in place; closing (button, Escape) returns it to
// the same spot. One tile is open at a time, and an opened tile slides fully
// into view.
export const ComponentsStrip = ({
  alignToId,
  tokenSource,
}: {
  alignToId: string;
  tokenSource: CssTokenSource;
}) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLUListElement>(null);
  const x = useMotionValue(0);
  // True once a drag moved the strip, so the click that ends it doesn't also
  // toggle a tile.
  const dragged = React.useRef(false);
  const [cards, setCards] = React.useState<
    (typeof ComponentsRegistry)["STRIP_CARDS"] | null
  >(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  // Line the first tile up with the page container: measure where the
  // section heading starts and use that as the strip's side padding.
  const [inset, setInset] = React.useState<number | null>(null);
  // How far through the row we are (0 = start, 1 = end), and how much of the
  // row fits on screen (for the scroll bar's thumb).
  const progress = useMotionValue(0);
  const [visibleShare, setVisibleShare] = React.useState(1);
  const [edges, setEdges] = React.useState({ end: false, start: true });
  // Drag limit, kept as a number: with a ref, Motion watches the row's size
  // and, when a tile opens and the row widens, stops any running slide (so
  // the opened tile never slid into view).
  const [minX, setMinX] = React.useState(0);
  const startFade = useTransform(progress, [0, 0.04], [0, 1]);
  const endFade = useTransform(progress, [0.96, 1], [1, 0]);
  const thumbLeft = useTransform(
    progress,
    (value) => `${value * (1 - visibleShare) * 100}%`
  );

  const bounds = React.useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;

    if (!(viewport && track)) {
      return { max: 0, min: 0 };
    }

    return {
      max: 0,
      min: Math.min(0, viewport.clientWidth - track.offsetWidth),
    };
  }, []);

  const moveTo = React.useCallback(
    (target: number) => {
      animate(x, target, STRIP_MOTION.spring);
    },
    [x]
  );

  // Pull the strip back inside its bounds (after overscroll or a resize).
  const settle = React.useCallback(() => {
    const { max, min } = bounds();
    const current = x.get();
    const target = clamp(current, min, max);

    if (target !== current) {
      moveTo(target);
    }
  }, [bounds, moveTo, x]);

  // Keep progress, edge state and the thumb size in step with the row.
  const track = React.useCallback(() => {
    const viewport = viewportRef.current;
    const row = trackRef.current;

    if (!(viewport && row)) {
      return;
    }

    const { min } = bounds();
    setMinX(min);
    const value = min === 0 ? 0 : clamp(x.get() / min, 0, 1);
    progress.set(value);
    setVisibleShare(Math.min(1, viewport.clientWidth / row.offsetWidth));
    const next = { end: value >= 1 - EDGE, start: value <= EDGE };
    setEdges((current) =>
      current.end === next.end && current.start === next.start ? current : next
    );
  }, [bounds, progress, x]);

  React.useEffect(() => x.on("change", track), [track, x]);

  React.useEffect(() => {
    const row = trackRef.current;

    if (!row) {
      return;
    }

    const observer = new ResizeObserver(track);
    observer.observe(row);

    return () => observer.disconnect();
  }, [track]);

  // Page one screen at a time, landing on tile edges: next brings the first
  // cut-off tile on the right to the start; previous brings the last cut-off
  // tile on the left to the end.
  const page = React.useCallback(
    (direction: 1 | -1) => {
      const viewport = viewportRef.current;
      const tiles = [
        ...(trackRef.current?.querySelectorAll<HTMLElement>(
          "[data-strip-id]"
        ) ?? []),
      ];

      if (!viewport || tiles.length === 0) {
        return;
      }

      const pad = inset ?? 0;
      const offset = x.get();
      const width = viewport.clientWidth;
      let target = offset;

      if (direction === 1) {
        const tile = tiles.find(
          (t) => t.offsetLeft + offset + t.offsetWidth > width - pad + 1
        );
        target = tile ? pad - tile.offsetLeft : offset;
      } else {
        const tile = tiles.findLast((t) => t.offsetLeft + offset < pad - 1);
        target = tile ? width - pad - tile.offsetLeft - tile.offsetWidth : 0;
      }

      const { max, min } = bounds();
      moveTo(clamp(target, min, max));
    },
    [bounds, inset, moveTo, x]
  );

  // Slide a tile fully into view. offsetLeft/offsetWidth are layout values,
  // so they're already final while the layout animation is still running.
  const reveal = React.useCallback(
    (id: string) => {
      const viewport = viewportRef.current;
      const tile = trackRef.current?.querySelector<HTMLElement>(
        `[data-strip-id="${id}"]`
      );

      if (!(viewport && tile)) {
        return;
      }

      const left = tile.offsetLeft + x.get();
      const right = left + tile.offsetWidth;
      let target = x.get();

      if (right > viewport.clientWidth - REVEAL_MARGIN) {
        target -= right - viewport.clientWidth + REVEAL_MARGIN;
      }

      if (left < REVEAL_MARGIN) {
        target -= left - REVEAL_MARGIN;
      }

      const { max, min } = bounds();
      moveTo(clamp(target, min, max));
    },
    [bounds, moveTo, x]
  );

  React.useEffect(() => {
    const anchor = document.querySelector(`#${alignToId}`);
    const viewport = viewportRef.current;

    if (!(anchor && viewport)) {
      return;
    }

    const measure = () => {
      setInset(
        anchor.getBoundingClientRect().left -
          viewport.getBoundingClientRect().left
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [alignToId]);

  // Load the live components once the strip nears the viewport.
  React.useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    let cancelled = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        observer.disconnect();
        const { STRIP_CARDS } =
          await import("@/components/hero-UI-components/components-registry");

        if (!cancelled) {
          setCards(STRIP_CARDS);
        }
      },
      { rootMargin: PRELOAD_MARGIN }
    );
    observer.observe(viewport);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  // Trackpad / horizontal wheel. Native listener: React's onWheel is passive
  // and can't stop the browser's own horizontal scroll or back-swipe.
  React.useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const onWheel = (event: WheelEvent) => {
      // Horizontal intent: a sideways trackpad swipe, or Shift + wheel.
      // Plain vertical wheel scrolls the page as usual.
      let delta = 0;

      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        delta = event.deltaX;
      } else if (event.shiftKey) {
        delta = event.deltaY;
      }

      if (!delta) {
        return;
      }

      event.preventDefault();
      x.stop();

      const { max, min } = bounds();
      const current = x.get();
      const step = -delta;
      const pushingPastEnd =
        (current >= max && step > 0) || (current <= min && step < 0);
      x.set(
        current + (pushingPastEnd ? step * STRIP_MOTION.wheelResistance : step)
      );

      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, STRIP_MOTION.wheelSettleMs);
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", settle);

    return () => {
      clearTimeout(settleTimer);
      viewport.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", settle);
    };
  }, [bounds, settle, x]);

  // After a tile opens, slide it into view; after one closes, the strip got
  // shorter, so make sure it's still inside its bounds.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (expandedId) {
        reveal(expandedId);
      } else {
        settle();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [expandedId, reveal, settle]);

  const toggle = React.useCallback((id: string) => {
    if (dragged.current) {
      return;
    }

    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const close = React.useCallback(() => setExpandedId(null), []);

  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user" transition={STRIP_MOTION.spring}>
        <div className="flex flex-col gap-minor">
          <div ref={viewportRef} className="relative overflow-hidden">
            <m.ul
              id={TRACK_ID}
              ref={trackRef}
              aria-label="UI components"
              drag="x"
              style={{
                paddingInline: inset === null ? undefined : `${inset}px`,
                x,
              }}
              dragConstraints={{ left: minX, right: 0 }}
              dragElastic={STRIP_MOTION.dragElastic}
              dragMomentum
              dragTransition={STRIP_MOTION.dragTransition}
              onPointerDown={() => {
                dragged.current = false;
              }}
              onDragStart={() => {
                dragged.current = true;
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && expandedId) {
                  close();
                }
              }}
              // px-6 is the pre-measure fallback; the measured inset replaces it.
              className="relative flex w-max cursor-grab items-start gap-minor px-6 py-2 select-none active:cursor-grabbing"
            >
              {STRIP_COMPONENTS.map((item) => (
                <StripTile
                  key={item.id}
                  item={item}
                  Piece={cards?.[item.id] ?? null}
                  expanded={expandedId === item.id}
                  onToggle={toggle}
                  onFocusTile={reveal}
                  tokenSource={tokenSource}
                />
              ))}
            </m.ul>
            {/* Edge fades: show there's more row past either edge, and fade
                out once that edge is reached. */}
            <m.div
              aria-hidden
              style={{ opacity: startFade }}
              className="from-background pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r to-transparent"
            />
            <m.div
              aria-hidden
              style={{ opacity: endFade }}
              className="from-background pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l to-transparent"
            />
          </div>

          <div className="container-wrapper">
            <div className="container flex items-center gap-minor">
              <span
                className={cn(
                  TYPE.cardCaption,
                  "text-muted-foreground shrink-0 tabular-nums"
                )}
              >
                {STRIP_COMPONENTS.length} components
              </span>
              <div
                aria-hidden
                className="bg-muted relative h-0.5 flex-1 overflow-hidden rounded-full"
              >
                <m.div
                  className="bg-foreground/40 absolute inset-y-0 rounded-full"
                  style={{ left: thumbLeft, width: `${visibleShare * 100}%` }}
                />
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Show previous components"
                  aria-controls={TRACK_ID}
                  disabled={edges.start}
                  onClick={() => page(-1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Show next components"
                  aria-controls={TRACK_ID}
                  disabled={edges.end}
                  onClick={() => page(1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
};
