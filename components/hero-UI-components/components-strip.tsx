"use client";

import {
  LazyMotion,
  MotionConfig,
  animate,
  m,
  useMotionValue,
} from "motion/react";
import * as React from "react";

import {
  STRIP_COMPONENTS,
  STRIP_MOTION,
  STRIP_SIZES,
} from "@/components/hero-UI-components/components-data";
import type * as ComponentsRegistry from "@/components/hero-UI-components/components-registry";
import { StripTile } from "@/components/hero-UI-components/strip-tile";

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// One horizontal row of components, moved with physics rather than native
// scrolling:
// - drag: inertia after release, elastic resistance past either end, then a
//   spring back (Motion drag + dragTransition);
// - trackpad / horizontal wheel: follows the OS's own momentum, with the same
//   resistance past the ends, settling back once the wheel goes quiet;
// - vertical wheel and vertical swipes still scroll the page.
// Clicking a tile expands it in place; clicking again returns it to the same
// spot. One tile is open at a time, and an opened tile slides fully into view.
export const ComponentsStrip = ({ alignToId }: { alignToId: string }) => {
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

  // Line the first tile up with the page container: measure where the
  // section heading starts and use that as the strip's side padding.
  const [inset, setInset] = React.useState<number | null>(null);

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

  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user" transition={STRIP_MOTION.spring}>
        <div ref={viewportRef} className="overflow-hidden">
          <m.ul
            ref={trackRef}
            aria-label="UI components"
            drag="x"
            style={{
              minHeight: `${STRIP_SIZES.rowHeight}rem`,
              paddingInline: inset === null ? undefined : `${inset}px`,
              x,
            }}
            dragConstraints={viewportRef}
            dragElastic={STRIP_MOTION.dragElastic}
            dragMomentum
            dragTransition={STRIP_MOTION.dragTransition}
            onPointerDown={() => {
              dragged.current = false;
            }}
            onDragStart={() => {
              dragged.current = true;
            }}
            // px-6 is the pre-measure fallback; the measured inset replaces it.
            className="relative flex w-max cursor-grab items-end gap-minor px-6 select-none active:cursor-grabbing"
          >
            {STRIP_COMPONENTS.map(({ id, name }) => (
              <StripTile
                key={id}
                id={id}
                name={name}
                Card={cards?.[id] ?? null}
                expanded={expandedId === id}
                onToggle={toggle}
                onFocusTile={reveal}
              />
            ))}
          </m.ul>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
};
