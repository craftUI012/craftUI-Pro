"use client";

import * as React from "react";

import {
  useHeroScene,
  useMarkWallReady,
} from "@/components/hero-section/hero-scene";
import { HeroTile } from "@/components/hero-section/hero-tile";
import { HERO_CARDS } from "@/components/hero-section/hero-wall-cards";

// The wall: live kit cards laid flat in 3D (perspective + rotateX/rotateZ),
// drifting slowly along their own plane. Hidden in scene 1; the cards stagger
// in while the copy moves to scene 2. Loaded lazily (see hero-wall-lazy.tsx).
//
// Cards keep their real width (22rem) and the whole plane is scaled per
// breakpoint, so a card never reflows into a squashed layout on phones.
// After the cards commit, charts measure themselves and render once more;
// give that a moment before the scene starts moving.
const SETTLE_MS = 200;

export const HeroWall = () => {
  const scene = useHeroScene();
  const markWallReady = useMarkWallReady();
  const [cardsMounted, setCardsMounted] = React.useState(false);

  // Render the 18 cards in a transition: React can yield between them, so the
  // mount never blocks a frame while scene 1 is on screen.
  React.useEffect(() => {
    React.startTransition(() => setCardsMounted(true));
  }, []);

  React.useEffect(() => {
    if (!cardsMounted) {
      return;
    }

    const timer = setTimeout(() => markWallReady?.(), SETTLE_MS);

    return () => clearTimeout(timer);
  }, [cardsMounted, markWallReady]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [perspective:100rem] mask-ease-frame"
    >
      <div className="absolute top-[72%] left-1/2 -translate-x-1/2 -translate-y-1/2 lg:top-1/2">
        {/* Tilt + per-breakpoint scale — kept on its own element so the drift
            below can animate `transform` without fighting the rotation. */}
        <div className="[transform:rotateX(28deg)_rotateZ(-10deg)_scale(0.5)] [transform-style:preserve-3d] md:[transform:rotateX(28deg)_rotateZ(-10deg)_scale(0.72)] lg:[transform:rotateX(28deg)_rotateZ(-10deg)_scale(0.9)]">
          {/* will-change: promote the moving plane before the cards appear,
              so its first frames aren't rasterised mid-reveal. */}
          <div className="will-change-transform motion-safe:animate-[hero-drift_48s_ease-in-out_infinite_alternate]">
            <div className="grid grid-cols-[repeat(6,22rem)] gap-5">
              {cardsMounted &&
                HERO_CARDS.map(({ Component, id, uses }, index) => (
                  <HeroTile
                    key={id}
                    Card={Component}
                    index={index}
                    label={uses}
                    visible={scene === 2}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
