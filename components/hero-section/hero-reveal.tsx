"use client";

import { m, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import type * as React from "react";

import {
  HERO_EASE,
  HERO_REVEAL_CLASS,
  HERO_TIMING,
} from "@/components/hero-section/hero-data";
import { useHeroScene } from "@/components/hero-section/hero-scene";

interface RevealMotion {
  order: number;
  reduce: boolean;
}

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: ({ order, reduce }: RevealMotion) => ({
    opacity: 1,
    transition: reduce
      ? { duration: 0 }
      : {
          delay: HERO_TIMING.revealStart + order * HERO_TIMING.revealStagger,
          duration: HERO_TIMING.tileDuration,
          ease: HERO_EASE.enter,
        },
    y: 0,
  }),
};

// Scene 1 is the promise (brand + headline only); the supporting copy and the
// actions rise in with scene 2. They stay in the layout while hidden, so the
// block never changes size and the headline sits at the optical centre —
// slightly above the geometric one — in scene 1.
export const HeroReveal = ({
  children,
  order,
}: {
  children: React.ReactNode;
  order: number;
}) => {
  const scene = useHeroScene();
  const reduce = useReducedMotion() ?? false;

  return (
    <m.div
      initial={false}
      animate={scene === 2 ? "shown" : "hidden"}
      custom={{ order, reduce } satisfies RevealMotion}
      variants={revealVariants}
      className={HERO_REVEAL_CLASS}
    >
      {children}
    </m.div>
  );
};
