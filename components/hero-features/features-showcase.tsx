"use client";

import { Check } from "lucide-react";
import { AnimatePresence, LazyMotion, MotionConfig, m } from "motion/react";
import { Accordion } from "radix-ui";
import * as React from "react";

import { FEATURE_VISUALS } from "@/components/hero-features/feature-visuals";
import type { FeatureId } from "@/components/hero-features/features-data";
import {
  FEATURE_MOTION,
  FEATURES,
} from "@/components/hero-features/features-data";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

// Layout animations (the screens ring's shared layoutId) need Motion's full
// feature set; load it after first paint.
const loadFeatures = async () => {
  const { domMax } = await import("motion/react");

  return domMax;
};

// The visual for a feature, in its panel. Swaps follow the storyboard in
// features-data.ts: the old one fades out slightly downward, the new one
// fades in from 0.98 scale and a 4px blur. No animation on first render.
const VisualPanel = ({
  className,
  id,
}: {
  className?: string;
  id: FeatureId;
}) => {
  const Visual = FEATURE_VISUALS[id];

  return (
    <div
      className={cn(
        "bg-card relative aspect-square overflow-hidden rounded-3xl shadow-card sm:aspect-[4/3]",
        className
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          key={id}
          initial={{ filter: "blur(4px)", opacity: 0, scale: 0.98 }}
          animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: FEATURE_MOTION.exit, y: 4 }}
          transition={FEATURE_MOTION.enter}
          className="absolute inset-0"
        >
          <Visual />
        </m.div>
      </AnimatePresence>
    </div>
  );
};

// Left: the features as an accordion (one always open), so each expands in
// place with its details; the two columns split evenly; Radix gives it arrow-key navigation between items,
// which also shows the keyboard claim at work. Right (lg and up): the open
// feature's visual. Below lg the visual sits inside the open item instead,
// right under what was tapped.
export const FeaturesShowcase = () => {
  const [open, setOpen] = React.useState<FeatureId>(FEATURES[0].id);
  // Render one visual, where it fits: beside the list from lg, inside the
  // open item below it. (A hidden copy would still run its animations.)
  const wide = useMediaQuery("(min-width: 64rem)");

  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">
        <div className="grid grid-cols-1 items-center gap-major-sm lg:grid-cols-2 lg:gap-major-lg">
          <Accordion.Root
            type="single"
            value={open}
            // Keep one open: ignore the "collapse the open item" change.
            onValueChange={(value) => value && setOpen(value as FeatureId)}
            className="flex flex-col"
          >
            {FEATURES.map((feature) => {
              const active = feature.id === open;

              return (
                <Accordion.Item
                  key={feature.id}
                  value={feature.id}
                  className="relative"
                >
                  {/* Rail: brand on the open item. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 rounded-full transition-colors duration-300 ease-out motion-reduce:transition-none",
                      active ? "bg-brand" : "bg-muted"
                    )}
                  />
                  <Accordion.Header>
                    <Accordion.Trigger
                      className={cn(
                        "focus-visible:ring-ring/50 flex w-full flex-col gap-1 rounded-lg py-4 pl-6 text-left outline-none transition-opacity duration-300 ease-out focus-visible:ring-[3px] motion-reduce:transition-none",
                        active ? "opacity-100" : "opacity-55 hover:opacity-80"
                      )}
                    >
                      <span
                        className={cn(
                          TYPE.cardEyebrow,
                          "text-muted-foreground uppercase"
                        )}
                      >
                        {feature.label}
                      </span>
                      <span className={cn(TYPE.headingPanel, "text-balance")}>
                        {feature.title}
                      </span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden motion-reduce:animate-none">
                    <div
                      className={cn("flex flex-col pb-5 pl-6", RHYTHM.minor)}
                    >
                      <p
                        className={cn(
                          TYPE.cardBody,
                          "text-muted-foreground text-pretty"
                        )}
                      >
                        {feature.description}
                      </p>
                      <ul className="flex flex-col gap-2">
                        {feature.points.map((point) => (
                          <li
                            key={point}
                            className={cn(
                              TYPE.cardBody,
                              "flex items-start gap-2"
                            )}
                          >
                            <Check
                              aria-hidden
                              className="text-brand-text mt-0.5 size-4 shrink-0"
                            />
                            {point}
                          </li>
                        ))}
                      </ul>
                      {!wide && (
                        <VisualPanel id={feature.id} className="mt-2" />
                      )}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion.Root>

          {wide && <VisualPanel id={open} />}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
};
