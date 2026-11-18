"use client";

import {
  Book02Icon,
  File02Icon,
  FileScriptIcon,
} from "@hugeicons/core-free-icons";
import { motion, useInView, useReducedMotion } from "motion/react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import type { IconSvg } from "@/components/icon";
import { cn } from "@/lib/utils";

import { Arrow, Note } from "./primitives";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * The hero's skill folder, in the page's neutrals: the files the agent
 * reads, filed in a folder. Each file shows a one-line tab (its icon, its
 * path, its length) above the one in front; the front one, SKILL.md,
 * stands open. Landscape, about 4:3.
 *
 *    0ms   in view: the files sit down inside the pocket, out of sight
 *  120ms   they rise out of it back to front, 70ms apart (spring)
 *  ~700ms  still: five tabs, SKILL.md open
 *
 * Hover, focus or tap a file: it rises LIFT out of the stack (spring, a
 * little bounce), its shadow deepening, and shows its title and line;
 * leave and it settles back. Hover is read from the resting tabs, so a
 * raised file never blocks the files behind it.
 *
 * Reduced motion: the files are already up; a lift is a jump.
 * ───────────────────────────────────────────────────────── */

const FILES: {
  dir: string;
  icon: IconSvg;
  line: string;
  lines: number;
  name: string;
  title: string;
}[] = [
  {
    dir: "scripts/",
    icon: FileScriptIcon,
    line: "Renders each object dark at 4× and fails doubled lines, a wrong size or a beat that won't settle.",
    lines: 489,
    name: "check.mjs",
    title: "The checker",
  },
  {
    dir: "references/",
    icon: File02Icon,
    line: "One beat per object, storyboarded in ms and played by active. It always comes back to rest.",
    lines: 229,
    name: "motion.md",
    title: "Motion",
  },
  {
    dir: "references/",
    icon: File02Icon,
    line: "One fine outline, paper faces, one brand mark. Flat things face you; boxy things turn.",
    lines: 311,
    name: "line-style.md",
    title: "Line style",
  },
  {
    dir: "references/",
    icon: File02Icon,
    line: "Two vague words become three concepts: the object, its one beat, and why it fits.",
    lines: 124,
    name: "brief-to-concept.md",
    title: "Brief to concept",
  },
  {
    dir: "",
    icon: Book02Icon,
    line: "Describe a state; get one object that tells it in one beat, in your theme, checked before you see it.",
    lines: 315,
    name: "SKILL.md",
    title: "The one idea",
  },
];

const FRONT = FILES.length - 1;

// Geometry, rem. A tab shows STEP of its file; a raised file rises LIFT, so
// STEP + LIFT of it shows: tab, title and line. The front file shows that
// much at rest. Narrow columns get more lift (the line wraps to three).
const STEP = 2.5;
const POCKET_H = 7;
const geometry = (compact: boolean) => {
  const lift = compact ? 5.75 : 4.5;
  const top = lift + 0.75;
  // The pocket starts under the front file's line, clear of its own tab.
  const pocket = top + FRONT * STEP + STEP + lift + 1.25;
  return {
    // Tall enough that every file runs down into the pocket.
    card: pocket - (top + FRONT * STEP) + 1.5,
    height: pocket + POCKET_H,
    lift,
    pocket,
    top,
  };
};

const TIMING = {
  // The files rise out of the pocket one after another, this far apart (s).
  stagger: 0.07,
  // The wait after coming into view before the first one moves (s).
  start: 0.12,
};

// The lift: quick, with a touch of overshoot, like paper pulled up.
const LIFT_SPRING = {
  bounce: 0.18,
  type: "spring",
  visualDuration: 0.32,
} as const;
// The rise out of the pocket: softer, barely past its place.
const RISE_SPRING = {
  bounce: 0.08,
  type: "spring",
  visualDuration: 0.5,
} as const;

// Paper on paper: depth from shadow, no outline. A resting file casts up
// onto the one behind it; a raised one casts further. The inset top edge
// is what separates them in dark mode, where shadows barely read.
const SHADOW = {
  rest: "0 -1px 2px rgb(0 0 0 / 0.04), 0 -6px 14px -6px rgb(0 0 0 / 0.1), inset 0 1px 0 rgb(255 255 255 / 0.06)",
  up: "0 -2px 4px rgb(0 0 0 / 0.05), 0 -14px 32px -10px rgb(0 0 0 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.08)",
};

// The folder's two greys, from the page's own ink. Light: the back a step
// deeper than the pocket, both under the white files. Dark: the back below
// the files, the pocket a step above them, so the front still reads.
const BACK =
  "bg-[color-mix(in_oklab,var(--foreground)_9%,var(--background))] text-[color-mix(in_oklab,var(--foreground)_9%,var(--background))] dark:bg-[color-mix(in_oklab,var(--foreground)_4%,var(--background))] dark:text-[color-mix(in_oklab,var(--foreground)_4%,var(--background))]";
const POCKET =
  "bg-[color-mix(in_oklab,var(--foreground)_4.5%,var(--background))] text-[color-mix(in_oklab,var(--foreground)_4.5%,var(--background))] dark:bg-[color-mix(in_oklab,var(--foreground)_11%,var(--background))] dark:text-[color-mix(in_oklab,var(--foreground)_11%,var(--background))]";

/** A hump with soft shoulders: the folder's tab, in the current colour. */
const Tab = ({ className, lip }: { className?: string; lip?: boolean }) => (
  <svg
    aria-hidden="true"
    className={cn("absolute left-1/2 h-7 w-60 -translate-x-1/2", className)}
    preserveAspectRatio="none"
    viewBox="0 0 240 28"
  >
    <path
      className="fill-current"
      d="M0 28 C 26 28, 34 0, 64 0 H 176 C 206 0, 214 28, 240 28 Z"
    />
    {lip ? (
      <path
        d="M0 28 C 26 28, 34 0.5, 64 0.5 H 176 C 206 0.5, 214 28, 240 28"
        fill="none"
        className="stroke-white/50 dark:stroke-white/[0.07]"
        vectorEffect="non-scaling-stroke"
      />
    ) : null}
  </svg>
);

const transitionFor = (reduced: boolean, rising: boolean, i: number) => {
  if (reduced) {
    return { duration: 0 };
  }
  if (rising) {
    return { ...RISE_SPRING, delay: TIMING.start + i * TIMING.stagger };
  }
  return LIFT_SPRING;
};

export const SkillFolder = () => {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35, once: true });
  const [compact, setCompact] = useState(false);
  const [lifted, setLifted] = useState<number | null>(null);
  // The rise plays once; after it, lifts don't wait on the stagger.
  const [risen, setRisen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.width < 520)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || risen) {
      return;
    }
    const ms = (TIMING.start + FILES.length * TIMING.stagger + 0.6) * 1000;
    const id = window.setTimeout(() => setRisen(true), ms);
    return () => window.clearTimeout(id);
  }, [inView, risen]);

  const g = geometry(compact);
  const shown = reduced || inView;
  const rising = shown && !risen && !reduced;

  // Which file a mouse is on, read from the resting tabs rather than what
  // is drawn: a raised file covers the tabs behind it.
  const fileAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    const y =
      (event.clientY - event.currentTarget.getBoundingClientRect().top) / rem;
    if (y < g.top - 1 || y >= g.pocket) {
      return null;
    }
    return Math.min(FRONT, Math.max(0, Math.floor((y - g.top) / STEP)));
  };

  return (
    <div
      className="relative overflow-hidden [--base:0.75rem] [--step:0.375rem] sm:[--base:1.5rem] sm:[--step:0.5rem]"
      onPointerLeave={() => setLifted(null)}
      onPointerMove={(event) => {
        // Touch picks a file by tapping it (the button's click).
        if (event.pointerType !== "touch" && shown) {
          setLifted(fileAt(event));
        }
      }}
      ref={ref}
      style={{ height: `${g.height}rem` }}
    >
      {/* The back of the folder: full width, a step deeper, its tab up top. */}
      <div
        aria-hidden="true"
        className={cn("absolute inset-x-1 bottom-0 rounded-2xl", BACK)}
        style={{ top: `${g.top - 1.25}rem` }}
      >
        <Tab className="-top-7" />
      </div>

      <ul aria-label="The files in the skill">
        {FILES.map((file, i) => {
          const up = lifted === i;
          const lift = i === FRONT ? 0.375 : g.lift;
          const inset = `calc(var(--base) + ${FRONT - i} * var(--step))`;
          const tucked = `${g.pocket - (g.top + i * STEP)}rem`;
          let y = "0rem";
          if (!shown) {
            y = tucked;
          } else if (up) {
            y = `-${lift}rem`;
          }
          return (
            <motion.li
              animate={{ boxShadow: up ? SHADOW.up : SHADOW.rest, y }}
              className="bg-card absolute rounded-xl"
              initial={reduced ? false : { boxShadow: SHADOW.rest, y: tucked }}
              key={file.name}
              style={{
                height: `${g.card}rem`,
                left: inset,
                right: inset,
                top: `${g.top + i * STEP}rem`,
                zIndex: i + 1,
              }}
              transition={transitionFor(reduced, rising, i)}
            >
              <button
                aria-pressed={up}
                className="focus-visible:ring-ring/50 flex w-full flex-col rounded-xl px-4 text-left outline-none focus-visible:ring-2"
                onClick={() => setLifted(up ? null : i)}
                onFocus={() => setLifted(i)}
                type="button"
              >
                {/* The tab: what shows of the file at rest. */}
                <span
                  className="flex shrink-0 items-center gap-2.5"
                  style={{ height: `${STEP}rem` }}
                >
                  <Icon
                    className="text-muted-foreground shrink-0"
                    icon={file.icon}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    <span className="text-muted-foreground">{file.dir}</span>
                    <span className="text-foreground">{file.name}</span>
                  </span>
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.6875rem] tabular-nums">
                    {file.lines} lines
                  </span>
                </span>
                {/* The page: what a lift shows. */}
                <span className="flex flex-col gap-1 pt-1 pl-[1.625rem]">
                  <span className="text-foreground text-[0.9375rem] leading-5 font-semibold tracking-tight">
                    {file.title}
                  </span>
                  <span className="text-muted-foreground text-[0.8125rem] leading-relaxed text-pretty">
                    {file.line}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>

      {/* The front of the folder: the pocket the files stand in. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 rounded-2xl shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_-12px_28px_-16px_rgb(0_0_0/0.22)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_-12px_28px_-16px_rgb(0_0_0/0.6)]",
          POCKET
        )}
        style={{ top: `${g.pocket}rem` }}
      >
        <Tab
          className="-top-[1.22rem] h-5 w-44 sm:-top-[1.72rem] sm:h-7 sm:w-60"
          lip
        />
        <div className="flex h-full flex-col items-center justify-center gap-1 px-6 pb-1 text-center">
          <span className="text-muted-foreground font-mono text-xs">
            isometrics/
          </span>
          <span className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
            Everything your agent reads.
          </span>
          <span className="text-muted-foreground text-sm">
            Five files, shared by every agent.
          </span>
        </div>
        <div className="text-muted-foreground pointer-events-none absolute top-3 right-5 hidden items-start gap-1 sm:flex">
          <Arrow
            className="text-muted-foreground h-8 w-10"
            d="M36 26 C 26 22, 14 16, 8 6"
            delay={0.9}
            head="M6 16 L8 6 L17 9"
            viewBox="0 0 44 32"
          />
          <Note className="text-muted-foreground mt-3 text-lg md:text-xl">
            hover a file!
          </Note>
        </div>
      </div>
    </div>
  );
};
