"use client";

import { Braces, Check, X } from "lucide-react";
import type { MotionValue } from "motion/react";
import {
  AnimatePresence,
  animate,
  cubicBezier,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import * as React from "react";

import type { StripComponent } from "@/components/hero-UI-components/components-data";
import {
  STRIP_MOTION,
  STRIP_OPEN,
  STRIP_SIZES,
  featuresFor,
  usedInBlocks,
} from "@/components/hero-UI-components/components-data";
import { TokensOverlay } from "@/components/hero-UI-components/tokens-overlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { CssTokenSource } from "@/lib/css-vars";
import { cn } from "@/lib/utils";

const { collapsed, expandedWidth, pieceWidth } = STRIP_SIZES;
// Open tiles never run past the screen edges on phones (1.5rem each side,
// the strip's phone inset).
const OPEN_WIDTH = `min(${expandedWidth}rem, calc(100vw - 3rem))`;
// Width of the details panel beside the component (sm and up).
const PANEL_WIDTH = `${expandedWidth - collapsed.width}rem`;
// Curves for mapping open progress onto each part (see STRIP_OPEN).
const easeOutSine = cubicBezier(0.61, 1, 0.88, 1);
const easeInOutSine = cubicBezier(0.37, 0, 0.63, 1);
const easeOutCubic = cubicBezier(0.33, 1, 0.68, 1);
const PANEL_RANGE = [...STRIP_OPEN.panel];
// Layout animations scale the tile; Motion only corrects the corners for a
// px radius set inline (12px = rounded-xl).
const RADIUS = 12;

// Stops a press on the live component from starting a drag of the whole row.
// Motion listens with a native listener on the row, so React's
// stopPropagation would arrive too late.
const useStopDragFrom = (active: boolean) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;

    if (!(active && node)) {
      return;
    }

    const stop = (event: PointerEvent) => event.stopPropagation();
    node.addEventListener("pointerdown", stop);

    return () => node.removeEventListener("pointerdown", stop);
  }, [active]);

  return ref;
};

// One panel row, fading and rising in over its own slice of the open
// progress, so rows arrive one after another and leave in reverse.
const PanelRow = ({
  children,
  className,
  index,
  progress,
}: {
  children: React.ReactNode;
  className?: string;
  index: number;
  progress: MotionValue<number>;
}) => {
  const { rowShift, rows } = STRIP_OPEN;
  const range = [Math.min(rows.start + index * rows.step, 0.95), 1];
  const opacity = useTransform(progress, range, [0, 1], { ease: easeOutSine });
  const y = useTransform(progress, range, [rowShift, 0], {
    ease: easeOutSine,
  });

  return (
    <m.div style={{ opacity, y }} className={className}>
      {children}
    </m.div>
  );
};

const eyebrowClass = cn(TYPE.cardEyebrow, "text-muted-foreground uppercase");

const Details = ({
  closeRef,
  item,
  onClose,
  onShowTokens,
  open,
  progress,
  stacked,
  tokensRef,
}: {
  closeRef: React.RefObject<HTMLButtonElement | null>;
  item: StripComponent;
  onClose: () => void;
  onShowTokens: () => void;
  open: boolean;
  progress: MotionValue<number>;
  stacked: boolean;
  tokensRef: React.RefObject<HTMLButtonElement | null>;
}) => {
  const features = featuresFor(item.id);
  const usedIn = usedInBlocks(item.name);
  const opacity = useTransform(progress, PANEL_RANGE, [0, 1], {
    ease: easeOutSine,
  });
  const x = useTransform(progress, PANEL_RANGE, [STRIP_OPEN.panelShift, 0], {
    ease: easeOutCubic,
  });

  return (
    <m.div
      layout="position"
      // Still mounted while closing so it can fade out; inert once closing
      // starts, so focus can't land on it.
      inert={!open}
      style={{ opacity, width: stacked ? "100%" : PANEL_WIDTH, x }}
      className={cn(
        "bg-muted/40 flex shrink-0 flex-col overflow-y-auto p-4",
        RHYTHM.minor
      )}
    >
      <PanelRow
        index={0}
        progress={progress}
        className="flex items-start justify-between gap-2"
      >
        <span className={eyebrowClass}>Key features</span>
        <div className="-mt-1.5 -mr-1.5 flex items-center gap-1">
          <Button
            ref={tokensRef}
            variant="outline"
            size="sm"
            onClick={onShowTokens}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Braces />
            Tokens
          </Button>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon-sm"
            aria-label={`Close ${item.name}`}
            onClick={onClose}
            className="size-7"
          >
            <X />
          </Button>
        </div>
      </PanelRow>
      <PanelRow index={1} progress={progress}>
        <ul className="flex flex-col gap-1.5">
          {features.map((feature) => (
            <li
              key={feature}
              className={cn(TYPE.cardCaption, "flex items-start gap-2")}
            >
              <Check
                aria-hidden
                className="text-brand-text mt-0.5 size-3.5 shrink-0"
              />
              {feature}
            </li>
          ))}
        </ul>
      </PanelRow>
      {usedIn.length > 0 && (
        // pt-minor: "Used in" is a separate group from the features, so it
        // gets two minor steps above it instead of one.
        <PanelRow
          index={2}
          progress={progress}
          className="flex flex-col gap-1 pt-minor"
        >
          <span className={eyebrowClass}>Used in</span>
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            {usedIn.join(", ")}
          </span>
        </PanelRow>
      )}
    </m.div>
  );
};

// One tile in the strip. Closed, it shows the component at real size behind a
// button that opens it. Open, the component becomes usable and a details panel
// lists its key features and the blocks above that use it; its Tokens button
// lays the component's globals.css values over the tile for developers. From sm up the
// tile grows sideways (never taller, so the row keeps its height); on phones
// there's no room beside the component, so the panel stacks under it and the
// tile grows downward instead. The close button, Escape, or opening another
// tile puts it back.
//
// Motion follows the storyboard in components-data.ts (STRIP_OPEN): one
// spring-driven progress value per tile, mapped onto the panel, its rows and
// the component, so every part stays in step and reverses mid-way cleanly.
export const StripTile = ({
  Piece,
  expanded,
  item,
  onFocusTile,
  onToggle,
  tokenSource,
}: {
  Piece: React.ComponentType | null;
  expanded: boolean;
  item: StripComponent;
  onFocusTile: (id: string) => void;
  onToggle: (id: string) => void;
  tokenSource: CssTokenSource;
}) => {
  const tileRef = React.useRef<HTMLDivElement>(null);
  const openRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const liveRef = useStopDragFrom(expanded);
  const wasExpanded = React.useRef(expanded);
  // Set by the open button: a click with detail 0 came from Enter/Space.
  const openedByKeyboard = React.useRef(false);
  const stacked = !useMediaQuery("(min-width: 40rem)") && expanded;
  const reduceMotion = useReducedMotion();
  const tokensRef = React.useRef<HTMLButtonElement>(null);
  const [tokensOpen, setTokensOpen] = React.useState(false);
  // A closed tile never keeps its overlay.
  const showTokens = tokensOpen && expanded;
  const hadTokens = React.useRef(false);

  React.useEffect(() => {
    if (!expanded) {
      setTokensOpen(false);
    }
  }, [expanded]);

  // Back to the Tokens button once the overlay closes. After the commit,
  // because the panel is inert while the overlay is up.
  React.useEffect(() => {
    if (hadTokens.current && !showTokens && expanded) {
      tokensRef.current?.focus({ preventScroll: true });
    }

    hadTokens.current = showTokens;
  }, [expanded, showTokens]);

  const progress = useMotionValue(expanded ? 1 : 0);
  // The panel mounts with the open (so the close button exists when focus
  // moves to it) and stays mounted until the close has played out.
  const [closing, setClosing] = React.useState(false);
  const panelMounted = expanded || closing;
  const pieceScale = useTransform(
    progress,
    [0, 1],
    [STRIP_OPEN.pieceScale, 1],
    {
      ease: easeInOutSine,
    }
  );

  React.useEffect(() => {
    const target = expanded ? 1 : 0;

    if (progress.get() === target) {
      return;
    }

    if (reduceMotion) {
      progress.set(target);

      return;
    }

    setClosing(!expanded);
    const controls = animate(progress, target, {
      ...STRIP_MOTION.spring,
      onComplete: () => setClosing(false),
    });

    return () => controls.stop();
  }, [expanded, progress, reduceMotion]);

  // Keep keyboard focus with the tile as its controls swap. Into the panel
  // only when opened from the keyboard (a mouse open shouldn't draw a focus
  // ring on the close button); back to the tile on close. preventScroll: the
  // strip slides the tile into view itself.
  React.useEffect(() => {
    if (expanded === wasExpanded.current) {
      return;
    }

    wasExpanded.current = expanded;

    if (expanded) {
      if (openedByKeyboard.current) {
        closeRef.current?.focus({ preventScroll: true });
      }
    } else if (
      document.activeElement === document.body ||
      // Focus on a control inside the component, which just went inert.
      tileRef.current?.contains(document.activeElement)
    ) {
      openRef.current?.focus({ preventScroll: true });
    }
  }, [expanded]);

  return (
    <m.li layout data-strip-id={item.id} className="flex shrink-0 flex-col">
      <div className={cn("flex flex-col", RHYTHM.minor)}>
        <m.div
          ref={tileRef}
          layout
          style={{
            borderRadius: RADIUS,
            height: stacked ? "auto" : `${collapsed.height}rem`,
            width: expanded ? OPEN_WIDTH : `${collapsed.width}rem`,
          }}
          // Card elevation at rest, lifted on hover; an open tile stays lifted.
          className={cn(
            "bg-card relative flex overflow-hidden transition-[box-shadow] duration-200 ease-out hover:shadow-card-hover motion-reduce:transition-none",
            expanded ? "shadow-card-hover" : "shadow-card",
            stacked && "flex-col"
          )}
        >
          {/* layout="position" keeps the component at its real size while
              the tile's width animates. */}
          <m.div
            layout="position"
            className={cn(
              "flex shrink-0 items-center justify-center",
              stacked ? "py-6" : "h-full"
            )}
            style={{ width: stacked ? "100%" : `${collapsed.width}rem` }}
          >
            <m.div
              ref={liveRef}
              inert={!expanded}
              className={cn(!expanded && "select-none")}
              style={{ scale: pieceScale, width: `${pieceWidth}rem` }}
            >
              {Piece ? <Piece /> : <Skeleton className="h-24 w-full" />}
            </m.div>
          </m.div>
          {panelMounted && (
            <Details
              closeRef={closeRef}
              item={item}
              onClose={() => {
                setTokensOpen(false);
                onToggle(item.id);
              }}
              onShowTokens={() => setTokensOpen(true)}
              open={expanded && !showTokens}
              progress={progress}
              stacked={stacked}
              tokensRef={tokensRef}
            />
          )}
          <AnimatePresence>
            {showTokens && (
              <TokensOverlay
                item={item}
                source={tokenSource}
                onClose={() => setTokensOpen(false)}
              />
            )}
          </AnimatePresence>
          {!expanded && (
            <button
              ref={openRef}
              type="button"
              aria-expanded={false}
              aria-label={`Open ${item.name}`}
              onClick={(event) => {
                openedByKeyboard.current = event.detail === 0;
                onToggle(item.id);
              }}
              onFocus={() => onFocusTile(item.id)}
              className="focus-visible:ring-ring/50 absolute inset-0 cursor-[inherit] rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
            />
          )}
        </m.div>
        <m.div
          layout="position"
          className="flex flex-col gap-0.5"
          style={{ width: `${collapsed.width}rem` }}
        >
          <span className={cn(TYPE.cardCaption, "font-medium")}>
            {item.name}
          </span>
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            {item.description}
          </span>
        </m.div>
      </div>
    </m.li>
  );
};
