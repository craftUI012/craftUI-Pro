"use client";

import { m, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import * as React from "react";

import {
  HERO_DEPTH_SPAN,
  HERO_EASE,
  HERO_TIMING,
  heroTileDiagonal,
} from "@/components/hero-section/hero-data";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

interface TileMotion {
  index: number;
  reduce: boolean;
}

// Only opacity + scale animate (compositor-only).
// off → ghost (scene 1 preview, faint) → visible (scene 2, full).
const tileVariants: Variants = {
  ghost: ({ reduce }: TileMotion) => ({
    opacity: HERO_TIMING.ghostOpacity,
    scale: 0.96,
    transition: reduce
      ? { duration: 0 }
      : { duration: HERO_TIMING.ghostDuration, ease: HERO_EASE.enter },
  }),
  off: { opacity: 0, scale: 0.96 },
  // Diagonal wave from the top-left (where the copy lands): tiles on the same
  // diagonal reveal together, so the cards spread out from behind the text.
  visible: ({ index, reduce }: TileMotion) => ({
    opacity: 1,
    scale: 1,
    transition: reduce
      ? { duration: 0 }
      : {
          delay:
            HERO_TIMING.tilesStart +
            heroTileDiagonal(index) * HERO_TIMING.tilesStagger,
          duration: HERO_TIMING.tileDuration,
          ease: HERO_EASE.enter,
        },
  }),
};

// The card itself never changes after mount. Memoised so the scene switch
// only updates the tile's animation state instead of re-rendering 18 live
// cards (charts included) in the first frame of the reveal.
const TileCard = React.memo(({ Card }: { Card: React.ComponentType }) => (
  // Hovering the tile drops the depth fade so the card shows in full colour.
  <div
    inert
    aria-hidden
    className="hero-media-tone pointer-events-none transition-[filter] duration-200 ease-out select-none group-hover:[filter:none] motion-reduce:transition-none"
  >
    <Card />
  </div>
));
TileCard.displayName = "TileCard";

// One tile on the 3D wall: a live kit card at its natural width, cropped to
// 4:3 and eased out at the bottom. It's a moving preview — the card is inert
// (no focus, no clicks) and hidden from assistive tech; Browse Components is
// the accessible way in. With a mouse, hovering lifts the tile, restores full
// colour and shows what the card is built from. Tailwind's `hover:` only applies where
// hover exists, so touch devices skip it.
export const HeroTile = ({
  Card,
  index,
  label,
  visible,
}: {
  Card: React.ComponentType;
  index: number;
  label: string;
  visible: boolean;
}) => {
  const reduce = useReducedMotion() ?? false;
  // 0 next to the copy → 1 from HERO_DEPTH_SPAN diagonals out. Feeds the
  // depth fade in `hero-media-tone`; set once, so the drift costs nothing.
  const depth = Math.min(heroTileDiagonal(index) / HERO_DEPTH_SPAN, 1);

  return (
    // Lift lives on this wrapper — Motion owns the tile's own transform.
    <div className="group pointer-events-auto transition-transform duration-200 ease-out hover:-translate-y-1.5 motion-reduce:transition-none">
      <m.div
        initial="off"
        animate={visible ? "visible" : "ghost"}
        custom={{ index, reduce } satisfies TileMotion}
        variants={tileVariants}
        style={{ "--hero-depth": depth } as React.CSSProperties}
        className="mask-ease-bottom relative aspect-[4/3] w-[22rem] overflow-hidden rounded-xl"
      >
        <TileCard Card={Card} />
        <span
          aria-hidden
          className={cn(
            TYPE.cardEyebrow,
            "bg-background text-foreground pointer-events-none absolute top-3 right-3 rounded-md px-2 py-1 opacity-0 shadow-border transition-opacity duration-200 ease-out group-hover:opacity-100 motion-reduce:transition-none"
          )}
        >
          {label}
        </span>
      </m.div>
    </div>
  );
};
