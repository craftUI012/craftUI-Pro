"use client";

import { m } from "motion/react";
import type * as React from "react";

import { STRIP_SIZES } from "@/components/hero-UI-components/components-data";
import { Skeleton } from "@/components/ui/skeleton";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Inset between the tile edge and the component inside it (rem).
const INSET = 0.75;

const sizeFor = (expanded: boolean) =>
  expanded ? STRIP_SIZES.expanded : STRIP_SIZES.collapsed;

// Scale that fits the component's real width into the tile, minus the inset.
// Expanded tiles are sized so this lands on 1: the component at full size.
const scaleFor = (expanded: boolean) =>
  (sizeFor(expanded).width - INSET * 2) / STRIP_SIZES.cardWidth;

// One tile in the strip. A real button covers it, so it's reachable by
// keyboard and toggles with Enter/Space as well as a click. Size changes use
// Motion's `layout` (transform-based), so neighbours slide instead of
// jumping; the component inside scales separately so it stays crisp when
// expanded.
export const StripTile = ({
  Card,
  expanded,
  id,
  name,
  onFocusTile,
  onToggle,
}: {
  Card: React.ComponentType | null;
  expanded: boolean;
  id: string;
  name: string;
  onFocusTile: (id: string) => void;
  onToggle: (id: string) => void;
}) => {
  const size = sizeFor(expanded);

  return (
    <m.li layout data-strip-id={id} className="flex shrink-0 flex-col">
      <div className={cn("flex flex-col", RHYTHM.minor)}>
        {/* The tile is a plain container; the button is laid over the
            preview as a sibling. The kit components inside contain their own
            buttons, and a <button> can't contain another <button>. */}
        <m.div
          layout
          style={{ height: `${size.height}rem`, width: `${size.width}rem` }}
          // Card elevation at rest, lifted on hover; an open tile stays lifted.
          className={cn(
            "bg-card relative overflow-hidden rounded-xl transition-[box-shadow] duration-200 ease-out hover:shadow-card-hover motion-reduce:transition-none",
            expanded ? "shadow-card-hover" : "shadow-card"
          )}
        >
          <div className="mask-ease-bottom absolute inset-0">
            {/* layout="position" undoes the tile's size-change scaling, so
                only the explicit scale below changes the component's size. */}
            <m.div
              layout="position"
              className="absolute"
              style={{ left: `${INSET}rem`, top: `${INSET}rem` }}
            >
              <m.div
                initial={false}
                animate={{ scale: scaleFor(expanded) }}
                style={{ width: `${STRIP_SIZES.cardWidth}rem` }}
                className="origin-top-left"
              >
                {Card ? (
                  <div
                    inert
                    aria-hidden
                    className="pointer-events-none select-none"
                  >
                    <Card />
                  </div>
                ) : (
                  <Skeleton className="h-64 w-full rounded-xl" />
                )}
              </m.div>
            </m.div>
          </div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}
            onClick={() => onToggle(id)}
            onFocus={() => onFocusTile(id)}
            className="focus-visible:ring-ring/50 absolute inset-0 cursor-[inherit] rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
          />
        </m.div>
        <m.span
          layout="position"
          className={cn(TYPE.cardCaption, "text-muted-foreground")}
        >
          {name}
        </m.span>
      </div>
    </m.li>
  );
};
