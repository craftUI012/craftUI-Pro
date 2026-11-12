"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { VoiceLevel } from "@/registry/blocks/voice-orb/voice-orb";

import { createPointRenderer } from "./point-gl";
import { FLOATS, approach } from "./shared";
import type { RGB, Sim, VoiceState } from "./shared";

/** Voice level: fast up so a syllable lands on time, slower down. */
const LEVEL = { attack: 22, release: 7 };

let swatch: CanvasRenderingContext2D | null = null;

/** Any CSS colour (Tailwind v4 colours are oklch) as 0–1 RGB. */
const toRgb = (css: string): RGB => {
  swatch ??= document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!swatch) {
    return [1, 1, 1];
  }
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillStyle = css;
  swatch.fillRect(0, 0, 1, 1);
  const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
};

const readLevel = (level: VoiceLevel) => {
  const value = typeof level === "function" ? level() : level;
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
};

/** Runs one concept Sim on a canvas that fills its (square) box. */
export const ConceptOrb = ({
  className,
  create,
  level,
  state,
}: {
  className?: string;
  create: () => Sim;
  level: VoiceLevel;
  state: VoiceState;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ level, state });
  live.current = { level, state };

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!(box && canvas)) {
      return;
    }
    const sim = create();
    const renderer = createPointRenderer(canvas, sim.count);
    if (!renderer) {
      return;
    }
    const data = new Float32Array(sim.count * FLOATS);
    let ink = toRgb(getComputedStyle(box).color);
    let smoothed = 0;
    let time = 0;
    let last = 0;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { height, width } = box.getBoundingClientRect();
      renderer.resize(
        Math.max(1, Math.round(width * dpr)),
        Math.max(1, Math.round(height * dpr)),
        Math.min(width, height)
      );
    };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      time += dt;
      const target = readLevel(live.current.level);
      smoothed = approach(
        smoothed,
        target,
        target > smoothed ? LEVEL.attack : LEVEL.release,
        dt
      );
      sim.step({ dt, ink, level: smoothed, state: live.current.state, time });
      sim.write(data);
      renderer.draw(sim, data);
      frame = requestAnimationFrame(tick);
    };

    const run = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (visible && !document.hidden) {
        frame = requestAnimationFrame(tick);
      }
    };

    const theme = new MutationObserver(() => {
      ink = toRgb(getComputedStyle(box).color);
    });
    theme.observe(document.documentElement, {
      attributeFilter: ["class", "style", "data-theme"],
      attributes: true,
    });
    const sizes = new ResizeObserver(resize);
    sizes.observe(box);
    const view = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      run();
    });
    view.observe(box);
    document.addEventListener("visibilitychange", run);
    resize();
    run();

    return () => {
      cancelAnimationFrame(frame);
      theme.disconnect();
      sizes.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", run);
      renderer.dispose();
    };
  }, [create]);

  return (
    <div aria-hidden className={cn("relative", className)} ref={boxRef}>
      <canvas className="absolute inset-0 size-full" ref={canvasRef} />
    </div>
  );
};
