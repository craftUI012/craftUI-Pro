"use client";

import * as React from "react";

import type { ShowcaseBlockId } from "@/components/hero-blocks/blocks-data";
import type * as BlocksRegistry from "@/components/hero-blocks/blocks-registry";
import { Skeleton } from "@/components/ui/skeleton";

// Start loading a little before the card scrolls into view.
const PRELOAD_MARGIN = "300px";

// One import shared by every preview: the kit loads once, on first need.
let registry: Promise<typeof BlocksRegistry> | null = null;
const loadRegistry = () => {
  registry ??= import("@/components/hero-blocks/blocks-registry");

  return registry;
};

// The live block inside a showcase card. Rendered only once the card is near
// the viewport; until then a skeleton holds the exact same space, so nothing
// shifts. The preview is inert (no focus, no clicks) and hidden from
// assistive tech: the card's text describes it.
export const BlockPreview = ({ id }: { id: ShowcaseBlockId }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [Card, setCard] = React.useState<React.ComponentType | null>(null);

  React.useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    let cancelled = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        observer.disconnect();
        const { findKitCard } = await loadRegistry();

        if (!cancelled) {
          // Functional form: state holds a component, not an updater.
          setCard(() => findKitCard(id));
        }
      },
      { rootMargin: PRELOAD_MARGIN }
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [id]);

  return (
    <div
      ref={ref}
      className="bg-muted/50 mask-ease-bottom @container relative h-72 overflow-hidden rounded-lg"
    >
      <div className="flex justify-center pt-6">
        {/* Kit cards keep their real 22rem width; narrow wells scale them
            down instead of letting them reflow. */}
        <div className="w-[22rem] shrink-0 origin-top scale-[0.82] @[25rem]:scale-100">
          {Card ? (
            <div inert aria-hidden className="pointer-events-none select-none">
              <Card />
            </div>
          ) : (
            <Skeleton className="h-64 w-full rounded-xl" />
          )}
        </div>
      </div>
    </div>
  );
};
