import type { RefObject } from "react";
import { useEffect, useState } from "react";

// The biggest frame of this shape that fits the area it sits in.
export const useFit = (
  ref: RefObject<HTMLDivElement | null>,
  frame: { height: number; width: number }
) => {
  const [fit, setFit] = useState<{ h: number; w: number } | null>(null);
  const { height: frameHeight, width: frameWidth } = frame;
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { height, width } = entry.contentRect;
      const w = Math.floor(
        Math.min(width, (height * frameWidth) / frameHeight)
      );
      setFit(
        w > 0 ? { h: Math.round((w * frameHeight) / frameWidth), w } : null
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, frameHeight, frameWidth]);
  return fit;
};
