"use client";

import * as React from "react";

import { HERO_TIMING } from "@/components/hero-section/hero-data";

export type HeroScene = 1 | 2;

const HeroSceneContext = React.createContext<HeroScene>(1);
// The lazily loaded wall calls this once it has mounted. Outside a provider
// there's no scene to gate, so the default does nothing.
const WallReadyContext = React.createContext<(() => void) | null>(null);

export const useHeroScene = () => React.useContext(HeroSceneContext);
export const useMarkWallReady = () => React.useContext(WallReadyContext);

// Server HTML always renders scene 1 (the heading is in the first paint).
// Scene 2 starts `sceneStartAt` after navigation — measured from page start,
// not hydration, so it lands at the same moment on every device — and not
// before the lazily loaded wall of live components has mounted. Reduced-motion users still get scene 2;
// MotionConfig makes the change instant for them.
export const HeroSceneProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [scene, setScene] = React.useState<HeroScene>(1);
  // Resolved by the wall on mount; read by the effect below.
  const wallReady = React.useRef<(() => void) | null>(null);
  const wallMounted = React.useRef(false);
  const markWallReady = React.useCallback(() => {
    wallMounted.current = true;
    wallReady.current?.();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Two gates: the fixed start time and "wall mounted" (capped by
    // wallTimeout, so a slow network never stalls the hero).
    const start = () => {
      let open = 2;
      const pass = () => {
        open -= 1;

        if (open === 0 && !cancelled) {
          setScene(2);
        }
      };

      timers.push(
        setTimeout(
          pass,
          Math.max(0, HERO_TIMING.sceneStartAt * 1000 - performance.now())
        )
      );

      let wallPassed = false;
      const wallPass = () => {
        if (!wallPassed) {
          wallPassed = true;
          pass();
        }
      };
      timers.push(setTimeout(wallPass, HERO_TIMING.wallTimeout * 1000));

      // The wall chunk loads during scene 1; switch once it has mounted so
      // the cards are already painted when their fade begins.
      if (wallMounted.current) {
        wallPass();
      } else {
        wallReady.current = wallPass;
      }
    };

    const stop = () => {
      cancelled = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };

    // Don't burn the transition in a background tab.
    if (document.visibilityState === "visible") {
      start();

      return stop;
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisible);
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, []);

  return (
    <HeroSceneContext.Provider value={scene}>
      <WallReadyContext.Provider value={markWallReady}>
        {children}
      </WallReadyContext.Provider>
    </HeroSceneContext.Provider>
  );
};
