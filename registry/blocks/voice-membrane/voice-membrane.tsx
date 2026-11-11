"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { TextMorph } from "torph/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  createMembrane,
  createMembraneRenderer,
  drawMembraneStill,
} from "./voice-membrane-gl";
import type { MembraneRenderer, VoiceState } from "./voice-membrane-gl";

/* ─────────────────────────────────────────────────────────────────────────
 * Voice membrane. A voice assistant's presence as a ball of points held on
 * springs, like the skin of a drum or a drop of water, coloured like a
 * soap film. What the assistant is doing moves the surface:
 *
 *   idle        a still, quiet skin                       "Ask me anything"
 *   listening   small ripples where your syllables land   "Listening…"
 *   thinking    an even ring rolls down from the top,     "Thinking…"
 *               on a steady beat, while the ball breathes
 *   speaking    a ripple from the front on every syllable "Speaking"
 *   playing     standing waves under the music            "Now playing" + title
 *
 * The physics and the look table are in voice-membrane-gl.ts. Between
 * states every number eases over ~0.7s, so nothing cuts.
 *
 * Without a `state` prop the block runs a demo when you press the button:
 * listening 3s → thinking 1.8s → speaking 5.2s → playing 6s → idle.
 * ───────────────────────────────────────────────────────────────────────── */

export type { VoiceState };

const EASE = {
  /** Voice level, rising: fast, so a syllable lands on time. */
  attack: 22,
  /** Voice level, falling: slower, so speech reads as phrases. */
  release: 7,
};

/** The text each state shows when no `label` is given. */
const LABELS: Record<VoiceState, string> = {
  idle: "Ask me anything",
  listening: "Listening…",
  playing: "Now playing",
  speaking: "Speaking",
  thinking: "Thinking…",
};

const TEXT_MORPH = { duration: 320, ease: "cubic-bezier(0.23, 1, 0.32, 1)" };

/** A level: a number, or a function the orb reads every frame. */
export type VoiceLevel = number | (() => number);

const readLevel = (level: VoiceLevel | undefined) => {
  const value = typeof level === "function" ? level() : (level ?? 0);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
};

const approach = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-rate * dt));

// ── Colour ───────────────────────────────────────────────────────────────
// The points take the element's CSS `color`, which can be any format
// (Tailwind v4 colours are oklch), so a 1px canvas turns it into RGB.
let swatch: CanvasRenderingContext2D | null = null;

const toRgb = (css: string): [number, number, number] => {
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

/** The element's text colour as RGB, re-read when the theme changes. */
const useCssColor = (ref: React.RefObject<HTMLElement | null>) => {
  const color = useRef<[number, number, number]>([1, 1, 1]);
  useEffect(() => {
    const read = () => {
      if (ref.current) {
        color.current = toRgb(getComputedStyle(ref.current).color);
      }
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributeFilter: ["class", "style", "data-theme"],
      attributes: true,
    });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", read);
    };
  }, [ref]);
  return color;
};

// ── The orb ──────────────────────────────────────────────────────────────

export interface MembraneOrbProps extends ComponentProps<"div"> {
  /** What the assistant is doing; the surface eases to it. */
  state?: VoiceState;
  /** Voice level 0–1, or a function read every frame (e.g. an analyser). */
  level?: VoiceLevel;
}

/**
 * The membrane alone, filling its box (keep the box square). Its points
 * take the box's text colour: set `text-*` or `color` on it.
 */
export const MembraneOrb = ({
  className,
  level,
  state = "idle",
  ...props
}: MembraneOrbProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = useCssColor(boxRef);
  const reduced = useReducedMotion() ?? false;
  const [fallback, setFallback] = useState(false);

  // Props the frame loop reads without restarting.
  const live = useRef({ level, reduced, state });
  live.current = { level, reduced, state };

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!(canvas && box)) {
      return;
    }
    const membrane = createMembrane(live.current.state);
    const data = new Float32Array(membrane.count * 8);
    let renderer: MembraneRenderer | null = createMembraneRenderer(
      canvas,
      membrane.count
    );
    if (!renderer) {
      setFallback(true);
      return;
    }
    let smoothed = 0;
    let frame = 0;
    let last = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { height, width } = box.getBoundingClientRect();
      renderer?.resize(
        Math.max(1, Math.round(width * dpr)),
        Math.max(1, Math.round(height * dpr)),
        Math.min(width, height)
      );
    };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const { level: input, reduced: still, state: goal } = live.current;
      const target = still ? 0 : readLevel(input);
      smoothed = approach(
        smoothed,
        target,
        target > smoothed ? EASE.attack : EASE.release,
        dt
      );
      membrane.step({
        dt,
        ink: color.current,
        level: smoothed,
        state: goal,
        still,
      });
      membrane.write(data);
      renderer?.draw(membrane, data);
      frame = requestAnimationFrame(tick);
    };

    const run = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (visible && !document.hidden && renderer) {
        frame = requestAnimationFrame(tick);
      }
    };

    const sizes = new ResizeObserver(resize);
    sizes.observe(box);
    const view = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      run();
    });
    view.observe(box);
    const lost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      renderer = null;
    };
    const restored = () => {
      renderer = createMembraneRenderer(canvas, membrane.count);
      resize();
      run();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    document.addEventListener("visibilitychange", run);
    resize();
    run();

    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      view.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("visibilitychange", run);
      renderer?.dispose();
    };
  }, [color]);

  // No WebGL2: one still drawing, redrawn when the state or size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(fallback && canvas)) {
      return;
    }
    const membrane = createMembrane(state);
    const data = new Float32Array(membrane.count * 8);
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      membrane.step({
        dt: 0,
        ink: color.current,
        level: 0,
        state,
        still: true,
      });
      membrane.write(data);
      drawMembraneStill(canvas, membrane, data);
    };
    draw();
    const sizes = new ResizeObserver(draw);
    sizes.observe(canvas);
    return () => sizes.disconnect();
  }, [color, fallback, state]);

  return (
    <div
      aria-hidden
      className={cn("relative", className)}
      data-slot="membrane-orb"
      ref={boxRef}
      {...props}
    >
      <canvas className="absolute inset-0 size-full" ref={canvasRef} />
    </div>
  );
};

// ── Voice level sources ──────────────────────────────────────────────────

/** A made-up speech level: syllables in phrases, with pauses between. */
export const speechLevel = (t: number) => {
  const phrase = 0.5 + 0.5 * Math.sin(t * 1.25) + 0.3 * Math.sin(t * 0.41);
  const gate = Math.min(Math.max((phrase - 0.2) / 0.35, 0), 1);
  const syllable =
    Math.abs(Math.sin(t * Math.PI * 3.3 + 1.6 * Math.sin(t * 1.1))) ** 1.4;
  const grain = 0.75 + 0.25 * Math.sin(t * 17.3) * Math.sin(t * 7.1);
  return gate * syllable * grain;
};

/** A made-up music level: a slow swell with a soft beat on top. */
export const musicLevel = (t: number) =>
  Math.min(
    1,
    0.45 +
      0.25 * Math.sin(t * 2.2) * Math.sin(t * 0.9) +
      0.3 * Math.max(0, Math.sin(t * Math.PI * 2.2)) ** 6
  );

type MicStatus = "off" | "starting" | "on" | "blocked";

/**
 * The microphone's level, 0–1, as a function to pass to `level`. Asks for
 * the mic while `enabled`; `status` says whether it's on or was blocked.
 */
export const useMicLevel = (enabled: boolean) => {
  const analyser = useRef<AnalyserNode | null>(null);
  const buffer = useRef<Float32Array<ArrayBuffer> | null>(null);
  const [status, setStatus] = useState<MicStatus>("off");

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let audio: AudioContext | null = null;
    setStatus("starting");
    const open = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          return;
        }
        audio = new AudioContext();
        const node = audio.createAnalyser();
        node.fftSize = 1024;
        audio.createMediaStreamSource(stream).connect(node);
        analyser.current = node;
        buffer.current = new Float32Array(node.fftSize);
        setStatus("on");
      } catch {
        if (!cancelled) {
          setStatus("blocked");
        }
      }
    };
    open();
    return () => {
      cancelled = true;
      analyser.current = null;
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }
      audio?.close();
      setStatus("off");
    };
  }, [enabled]);

  const level = useCallback(() => {
    const node = analyser.current;
    const data = buffer.current;
    if (!(node && data)) {
      return 0;
    }
    node.getFloatTimeDomainData(data);
    let sum = 0;
    for (const sample of data) {
      sum += sample * sample;
    }
    // −55 dB (room) → 0, −15 dB (close, loud speech) → 1.
    const db = 10 * Math.log10(sum / data.length + 1e-10);
    return Math.min(Math.max((db + 55) / 40, 0), 1);
  }, []);

  return { level, status };
};

// ── Demo ─────────────────────────────────────────────────────────────────

/** The demo's script: each step's state, how long it holds, and its text. */
const SCRIPT: {
  eyebrow?: string;
  label?: string;
  ms: number;
  state: VoiceState;
}[] = [
  { ms: 3000, state: "listening" },
  { ms: 1800, state: "thinking" },
  { ms: 5200, state: "speaking" },
  {
    eyebrow: "Now playing",
    label: "Rain on Glass",
    ms: 6000,
    state: "playing",
  },
];

/**
 * The built-in demo: press to run one conversation, press again to stop.
 * Its `level` makes up a voice; pass `mic` to hear yours while listening.
 */
export const useVoiceDemo = (mic?: () => number) => {
  const [step, setStep] = useState(-1);
  const stepRef = useRef(step);
  stepRef.current = step;
  const micRef = useRef(mic);
  micRef.current = mic;

  useEffect(() => {
    const current = SCRIPT[step];
    if (!current) {
      return;
    }
    const timer = setTimeout(() => {
      setStep((s) => (s + 1 < SCRIPT.length ? s + 1 : -1));
    }, current.ms);
    return () => clearTimeout(timer);
  }, [step]);

  const level = useCallback(() => {
    const t = performance.now() / 1000;
    const state = SCRIPT[stepRef.current]?.state;
    if (state === "listening") {
      return micRef.current ? micRef.current() : speechLevel(t * 0.9) * 0.7;
    }
    if (state === "speaking") {
      return speechLevel(t);
    }
    return state === "playing" ? musicLevel(t) : 0;
  }, []);

  const current = SCRIPT[step];
  return {
    eyebrow: current?.eyebrow,
    label: current?.label,
    level,
    running: step >= 0,
    state: current?.state ?? ("idle" as VoiceState),
    toggle: () => setStep((s) => (s >= 0 ? -1 : 0)),
  };
};

// ── The block ────────────────────────────────────────────────────────────

/** The bars at rest: short, tall, short, so they read as a voice wave. */
const BARS_REST = [0.4, 0.75, 0.4];

/** Three bars that move with the level while the assistant is active. */
const LevelBars = ({
  active,
  level,
}: {
  active: boolean;
  level: VoiceLevel;
}) => {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const reduced = useReducedMotion() ?? false;
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    if (!active || reduced) {
      for (const [i, bar] of bars.current.entries()) {
        bar?.style.setProperty("transform", `scaleY(${BARS_REST[i]})`);
      }
      return;
    }
    let frame = 0;
    let smooth = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const target = readLevel(levelRef.current);
      smooth = approach(
        smooth,
        target,
        target > smooth ? EASE.attack : EASE.release,
        dt
      );
      const t = now / 1000;
      for (const [i, bar] of bars.current.entries()) {
        const wiggle = 0.5 + 0.5 * Math.sin(t * (5 + i * 2.3) + i);
        const reach = i === 1 ? 1 : 0.55 + 0.45 * wiggle;
        const scale = Math.min(1, BARS_REST[i] + 0.6 * smooth * reach);
        bar?.style.setProperty("transform", `scaleY(${scale})`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reduced]);

  return (
    <span className="flex h-4 items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          className={cn(
            "h-full w-[3px] rounded-full bg-current",
            // The frame loop drives them while active; back to rest eases.
            !active && "transition-transform duration-300 ease-out"
          )}
          key={i}
          ref={(node) => {
            bars.current[i] = node;
          }}
          style={{ transform: `scaleY(${BARS_REST[i]})` }}
        />
      ))}
    </span>
  );
};

const MicIcon = () => (
  <svg
    aria-hidden
    className="size-3.5"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.75}
    viewBox="0 0 24 24"
  >
    <rect height="12" rx="3" width="6" x="9" y="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export interface VoiceMembraneProps extends Omit<
  ComponentProps<"div">,
  "onToggle"
> {
  /**
   * What the assistant is doing. Leave it out for the built-in demo, which
   * runs one conversation when the button is pressed.
   */
  state?: VoiceState;
  /** Voice level 0–1, or a function read every frame (see `useMicLevel`). */
  level?: VoiceLevel;
  /** The text in the middle. Defaults to the state's own word. */
  label?: string;
  /** A small line above the label, e.g. "Now playing". */
  eyebrow?: string;
  /** Called when the talk button is pressed (controlled use). */
  onToggle?: () => void;
  /** The talk button's accessible name. Defaults by state. */
  buttonLabel?: string;
  /**
   * Show the talk button (and, in the demo, the mic toggle). Turn it off
   * when your own UI drives `state`. Defaults to true.
   */
  showControls?: boolean;
}

export const VoiceMembrane = ({
  buttonLabel,
  className,
  eyebrow,
  label,
  level,
  onToggle,
  showControls = true,
  state,
  ...props
}: VoiceMembraneProps) => {
  const [micOn, setMicOn] = useState(false);
  const mic = useMicLevel(micOn);
  const demo = useVoiceDemo(mic.status === "on" ? mic.level : undefined);
  const isDemo = state === undefined;

  const shown = isDemo ? demo.state : state;
  const text = (isDemo ? demo.label : label) ?? LABELS[shown];
  const above = isDemo ? demo.eyebrow : eyebrow;
  const voice = isDemo ? demo.level : (level ?? 0);
  const active = shown !== "idle";

  return (
    <div
      className={cn("flex w-full max-w-sm flex-col items-center", className)}
      data-slot="voice-membrane"
      {...props}
    >
      <div className="relative aspect-square w-full">
        <MembraneOrb className="absolute inset-0" level={voice} state={shown} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[20%] text-center">
          <div className="relative">
            <AnimatePresence initial={false}>
              {above ? (
                <motion.p
                  animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                  className="text-muted-foreground absolute inset-x-0 bottom-full mb-1.5 text-[0.625rem] font-medium tracking-[0.2em] whitespace-nowrap uppercase"
                  exit={{ filter: "blur(2px)", opacity: 0, y: -4 }}
                  initial={{ filter: "blur(2px)", opacity: 0, y: 4 }}
                  key={above}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  {above}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <TextMorph
              as="p"
              className="text-foreground text-lg tracking-tight whitespace-nowrap"
              duration={TEXT_MORPH.duration}
              ease={TEXT_MORPH.ease}
              respectReducedMotion
            >
              {text}
            </TextMorph>
          </div>
        </div>
      </div>

      {showControls ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            aria-label={buttonLabel ?? (active ? "Stop" : "Start talking")}
            aria-pressed={active}
            className="size-14 rounded-full"
            onClick={isDemo ? demo.toggle : onToggle}
            size="icon"
            variant="outline"
          >
            <LevelBars active={active} level={voice} />
          </Button>
          {isDemo ? (
            <Button
              aria-pressed={micOn}
              className="text-muted-foreground h-7 gap-1.5 rounded-full px-2.5 text-xs"
              onClick={() => setMicOn((on) => !on)}
              size="sm"
              variant="ghost"
            >
              <MicIcon />
              {mic.status === "blocked" ? "Mic blocked" : "Use my mic"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {above ? `${above}: ${text}` : text}
      </p>
    </div>
  );
};

export default VoiceMembrane;
