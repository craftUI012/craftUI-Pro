"use client";

import { LayoutGroup, LazyMotion, MotionConfig, m } from "motion/react";
import type * as React from "react";

import { HERO_EASE, HERO_TIMING } from "@/components/hero-section/hero-data";
import {
  HeroSceneProvider,
  useHeroScene,
} from "@/components/hero-section/hero-scene";
import { cn } from "@/lib/utils";

// Layout animations need the full `domMax` feature set; load it after the
// first paint so it never blocks the heading.
const loadFeatures = async () => {
  const { domMax } = await import("motion/react");

  return domMax;
};

interface HeroStageProps {
  copy: React.ReactNode;
  fog: React.ReactNode;
  wall: React.ReactNode;
}

const HeroLayout = ({ copy, fog, wall }: HeroStageProps) => {
  const scene = useHeroScene();

  return (
    <div data-scene={scene} className="relative size-full">
      {wall}
      <div
        className={cn(
          // Only the copy block takes the pointer, so the wall behind stays hoverable.
          "pointer-events-none relative z-10 flex size-full p-4 lg:p-6",
          scene === 1
            ? "items-center justify-center"
            : "items-start justify-start"
        )}
      >
        <LayoutGroup id="hero">
          {/* No box: the copy sits on the same surface as the image wall, and
              the fog feathers the wall out beneath it. The block keeps one
              size in both scenes, so the morph is a pure slide — no scaling,
              no distortion. */}
          <m.div
            layout
            layoutId="hero-panel"
            className="pointer-events-auto relative w-full max-w-2xl p-6 lg:p-10"
          >
            {fog}
            {copy}
          </m.div>
        </LayoutGroup>
      </div>
    </div>
  );
};

export const HeroStage = (props: HeroStageProps) => (
  <HeroSceneProvider>
    <LazyMotion features={loadFeatures}>
      <MotionConfig
        reducedMotion="user"
        // ease-in-out: the copy is already on screen, so it should speed up and
        // settle rather than launch at full speed like a spring does.
        transition={{ duration: HERO_TIMING.morph, ease: HERO_EASE.move }}
      >
        <HeroLayout {...props} />
      </MotionConfig>
    </LazyMotion>
  </HeroSceneProvider>
);
