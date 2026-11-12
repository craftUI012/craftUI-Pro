"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Generative UI kit. The shared pieces behind the Generative UI blocks
 * (Agent run and the rest of the series). Each block ships this file
 * beside itself.
 *
 *   DotOrb     a step's state drawn in a dot matrix: faint while it
 *              waits, a ripple while it works, a tick when it's done and
 *              a cross when it fails
 *   JsonCode   JSON in mono with each part coloured: keys, strings,
 *              numbers, true/false/null and punctuation
 *   ScanLoader a strip of dots with a light sweeping across: working
 *   AutoHeight a panel that opens to its content's height and follows it
 *              as the content changes, so nothing ever jumps
 *   partialOf  a value as a model streams it, for demos: keys arrive in
 *              order, strings a character at a time
 *
 * Render GEN_CSS once in the block (a <style>) for the orb and the scan.
 *
 * The colours are CSS variables with light and dark defaults, so a page
 * can retune them: --gen-key, --gen-string, --gen-number, --gen-literal
 * and --gen-done (set them on the block or any parent).
 * ───────────────────────────────────────────────────────────────────────── */

/** The colour defaults, light then dark, set on a block's root. */
export const GEN_COLORS = cn(
  "[--gen-key:oklch(0.46_0.15_264)] [--gen-string:oklch(0.48_0.12_152)] [--gen-number:oklch(0.52_0.15_48)] [--gen-literal:oklch(0.5_0.18_330)] [--gen-done:oklch(0.52_0.13_152)]",
  "dark:[--gen-key:oklch(0.8_0.09_264)] dark:[--gen-string:oklch(0.82_0.12_152)] dark:[--gen-number:oklch(0.82_0.11_62)] dark:[--gen-literal:oklch(0.8_0.12_330)] dark:[--gen-done:oklch(0.78_0.15_152)]"
);

/* ------------------------------------------------------------- dot orb */

/** What a step is doing, as the orb draws it. */
export type DotOrbState = "idle" | "run" | "done" | "fail";

/**
 * The dot grid: 9×9 on a 2-unit pitch, cut to a disc (rows of 3, 5, 7, 9,
 * 9, 9, 7, 5, 3: 57 dots). Nine across, not seven, so the tick can sit
 * exactly on the centre: its corners land on (-6,0), (-2,4) and (6,-4).
 */
const DOTS = (() => {
  const out: { d: number; x: number; y: number }[] = [];
  for (let row = -4; row <= 4; row += 1) {
    for (let col = -4; col <= 4; col += 1) {
      const x = col * 2;
      const y = row * 2;
      if (x * x + y * y <= 68) {
        out.push({ d: Math.hypot(x, y) / 2, x, y });
      }
    }
  }
  return out;
})();

const key = (x: number, y: number) => `${x},${y}`;

/**
 * The dots each finished state lights; the rest stay faint. Both are
 * centred on the grid: the tick spans x -6…6 and y -4…4, the cross ±4.
 */
const SHAPES: Record<"done" | "fail", Set<string>> = {
  done: new Set([
    key(-6, 0),
    key(-4, 2),
    key(-2, 4),
    key(0, 2),
    key(2, 0),
    key(4, -2),
    key(6, -4),
  ]),
  fail: new Set([
    key(-4, -4),
    key(-2, -2),
    key(0, 0),
    key(2, 2),
    key(4, 4),
    key(4, -4),
    key(2, -2),
    key(-2, 2),
    key(-4, 4),
  ]),
};

/** The scan's sweep, in ms. */
const SCAN = {
  /** How far behind its left neighbour each column lights. */
  columnStep: 38,
  /** How far behind the row above each row lights, for a slant. */
  rowStep: 70,
  /** One sweep across and back to rest. */
  sweep: 1300,
} as const;

/** Every beat of the orb, in ms. */
const ORB = {
  /** One ripple, centre to edge and back to rest. */
  ripple: 1100,
  /** How far behind its inner neighbour each ring of dots runs. */
  rippleStep: 110,
  /** A finished shape draws in, from the centre outward. */
  settle: 240,
  /** The delay per ring as it settles. */
  settleStep: 30,
} as const;

/** The orb's and the scan's keyframes; render once in the block. */
export const GEN_CSS = `
@keyframes gen-dot-ripple { 0%, 100% { opacity: .16; transform: scale(.7) } 40% { opacity: 1; transform: scale(1) } }
@keyframes gen-dot-in { from { opacity: 0; transform: scale(.6) } }
.gen-dot { transform-box: fill-box; transform-origin: center; }
.gen-orb[data-state="run"] .gen-dot { animation: gen-dot-ripple ${ORB.ripple}ms cubic-bezier(.45,0,.55,1) infinite; animation-delay: calc(var(--d) * ${ORB.rippleStep}ms - ${ORB.ripple}ms); }
.gen-orb .gen-dot[data-lit] { animation: gen-dot-in ${ORB.settle}ms cubic-bezier(.23,1,.32,1) backwards; animation-delay: calc(var(--d) * ${ORB.settleStep}ms); }
@keyframes gen-scan { 0%, 100% { opacity: .12 } 45% { opacity: .95 } }
.gen-scan circle { animation: gen-scan ${SCAN.sweep}ms cubic-bezier(.45,0,.55,1) infinite; animation-delay: calc(var(--c) * ${SCAN.columnStep}ms + var(--r) * ${SCAN.rowStep}ms - ${SCAN.sweep}ms); }
@media (prefers-reduced-motion: reduce) {
  .gen-orb .gen-dot { animation: none !important; }
  .gen-orb[data-state="run"] .gen-dot { opacity: .55; }
  .gen-scan circle { animation: none; opacity: .35; }
}
`;

/**
 * A step's state in a dot matrix. `idle` is a faint disc; `run` ripples
 * from the centre out; `done` draws a tick and `fail` a cross, each
 * settling in from the centre. Size it with `size-*`; it takes the text
 * colour, except done (--gen-done) and fail (the destructive colour).
 */
export const DotOrb = ({
  className,
  state,
}: {
  /** Size and colour classes. */
  className?: string;
  /** What the step is doing. */
  state: DotOrbState;
}) => {
  const shape = state === "done" || state === "fail" ? SHAPES[state] : null;
  return (
    <svg
      aria-hidden
      // Remount on a state change so a finished shape draws in afresh.
      key={state}
      className={cn(
        "gen-orb size-4 shrink-0",
        state === "done" && "text-(--gen-done)",
        state === "fail" && "text-destructive",
        className
      )}
      data-state={state}
      viewBox="-9 -9 18 18"
    >
      {DOTS.map((dot) => {
        const lit = shape?.has(key(dot.x, dot.y));
        let opacity = 0.18;
        if (state === "run") {
          opacity = 0.16;
        } else if (shape) {
          opacity = lit ? 1 : 0.14;
        }
        return (
          <circle
            key={key(dot.x, dot.y)}
            className="gen-dot"
            data-lit={lit || undefined}
            cx={dot.x}
            cy={dot.y}
            fill="currentColor"
            opacity={opacity}
            r={lit ? 1 : 0.8}
            style={{ "--d": dot.d.toFixed(2) } as CSSProperties}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------ json code */

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],]/gu;

type TokenKind = "key" | "string" | "number" | "literal" | "punct" | "space";

/** `value` as indented JSON, cut into coloured parts. */
const tokensOf = (value: unknown): { kind: TokenKind; text: string }[] => {
  const json = JSON.stringify(value, null, 2) ?? "";
  const out: { kind: TokenKind; text: string }[] = [];
  let last = 0;
  for (const match of json.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) {
      out.push({ kind: "space", text: json.slice(last, at) });
    }
    const [text, quoted, colon, literal] = match;
    if (quoted && colon) {
      out.push({ kind: "key", text: quoted });
      out.push({ kind: "punct", text: colon });
    } else if (quoted) {
      out.push({ kind: "string", text });
    } else if (literal) {
      out.push({ kind: "literal", text });
    } else if (/^[{}[\],]$/u.test(text)) {
      out.push({ kind: "punct", text });
    } else {
      out.push({ kind: "number", text });
    }
    last = at + text.length;
  }
  if (last < json.length) {
    out.push({ kind: "space", text: json.slice(last) });
  }
  return out;
};

const TOKEN_CLASS: Record<TokenKind, string> = {
  key: "text-(--gen-key)",
  literal: "text-(--gen-literal)",
  number: "text-(--gen-number)",
  punct: "text-muted-foreground",
  space: "",
  string: "text-(--gen-string)",
};

/**
 * A value as indented JSON in mono, each part in its colour. With
 * `streaming`, a solid caret sits at the end, for input still arriving
 * (a caret holds still while text is typing in).
 */
export const JsonCode = ({
  className,
  streaming = false,
  value,
}: {
  /** Classes for the `<pre>`. */
  className?: string;
  /** Shows a caret after the last character. */
  streaming?: boolean;
  /** Any JSON-serialisable value. */
  value: unknown;
}) => (
  <pre
    className={cn(
      "font-mono text-xs leading-relaxed whitespace-pre-wrap break-words",
      className
    )}
  >
    {tokensOf(value).map((token, i) => (
      <span
        // A token's place in the fixed text.
        // biome-ignore lint/suspicious/noArrayIndexKey: derived, stable
        key={i}
        className={TOKEN_CLASS[token.kind]}
      >
        {token.text}
      </span>
    ))}
    {streaming && (
      <span
        aria-hidden
        className="bg-foreground ml-px inline-block h-[1.1em] w-[0.45em] align-[-0.2em]"
      />
    )}
  </pre>
);

/* ------------------------------------------------------------- partials */

/** How many characters a value takes to stream in. */
export const streamLength = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.reduce<number>((n, item) => n + streamLength(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce<number>(
      (n, item) => n + streamLength(item),
      0
    );
  }
  return String(value).length;
};

/**
 * `value` with only its first `count` characters arrived, the way a model
 * streams a tool's input: keys appear in order as their value starts,
 * strings grow a character at a time, numbers and true/false/null land
 * whole. Returns undefined before anything has arrived.
 */
export const partialOf = (value: unknown, count: number): unknown => {
  let left = Math.max(0, Math.floor(count));
  const walk = (node: unknown): unknown => {
    if (left <= 0) {
      return undefined;
    }
    if (Array.isArray(node)) {
      const out: unknown[] = [];
      for (const item of node) {
        const part = walk(item);
        if (part === undefined) {
          break;
        }
        out.push(part);
      }
      return out;
    }
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [name, item] of Object.entries(node)) {
        const part = walk(item);
        if (part === undefined) {
          break;
        }
        out[name] = part;
      }
      return out;
    }
    const size = String(node).length;
    if (typeof node === "string") {
      const taken = node.slice(0, left);
      left -= size;
      return taken;
    }
    if (left < size) {
      left = 0;
      return undefined;
    }
    left -= size;
    return node;
  };
  return walk(value);
};

/* ------------------------------------------------------------ scan */

/**
 * A strip of dots, three rows deep, with a light sweeping across: the
 * step is working. Size it with `w-*`; it takes the text colour.
 */
export const ScanLoader = ({
  className,
  columns = 12,
}: {
  /** Size and colour classes. */
  className?: string;
  /** How many dots across. */
  columns?: number;
}) => (
  <svg
    aria-hidden
    className={cn("gen-scan h-3 shrink-0", className)}
    style={{ width: `${columns * 0.375}rem` }}
    viewBox={`0 0 ${columns * 6} 12`}
  >
    {Array.from({ length: 3 * columns }, (_, i) => {
      const c = i % columns;
      const r = Math.floor(i / columns);
      return (
        <circle
          key={`${c}-${r}`}
          cx={3 + c * 6}
          cy={2 + r * 4}
          fill="currentColor"
          r={1.1}
          style={{ "--c": c, "--r": r } as CSSProperties}
        />
      );
    })}
  </svg>
);

/* ------------------------------------------------------------ panel */

/**
 * The panel's motion. Height runs on a spring with no bounce, so a panel
 * toggled mid-way turns round from where it is instead of restarting;
 * closing is a little quicker than opening. The content fades in just
 * behind the height and out a little faster. Anything that moves with a
 * panel (a chevron) uses PANEL_SPRING too, so they read as one.
 */
const PANEL = {
  /** The content fades in, just behind the height. */
  fadeIn: 0.18,
  /** And out, quicker. */
  fadeOut: 0.12,
} as const;

/** The panels' spring, open and closed. Share it with a panel's chevron. */
export const PANEL_SPRING = {
  close: { bounce: 0, type: "spring", visualDuration: 0.2 },
  open: { bounce: 0, type: "spring", visualDuration: 0.28 },
} as const;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Opens to its content's height, then follows it as the content changes
 * (an output replacing a loader, a step opening inside), so nothing ever
 * jumps. Closed, its content is inert: out of the Tab order and hidden
 * from screen readers.
 *
 * It animates to Motion's `height: "auto"`, not to a measured number:
 * Motion measures once as it starts, runs the spring, then leaves the
 * panel at `auto`. So an open panel isn't animating at all; it is just
 * as tall as its content. That matters when panels nest (a step opening
 * inside the open steps list): the inner panel's spring alone drives the
 * card, frame for frame, instead of the outer one chasing a target that
 * moves every frame and clipping the inner one as it lags behind.
 */
export const AutoHeight = ({
  children,
  id,
  open,
}: {
  /** The content. */
  children: ReactNode;
  /** For the button that opens it (`aria-controls`). */
  id?: string;
  /** Open or closed. */
  open: boolean;
}) => (
  <motion.div
    animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
    className="overflow-hidden"
    id={id}
    inert={!open}
    initial={false}
    transition={{
      height: open ? PANEL_SPRING.open : PANEL_SPRING.close,
      opacity: {
        delay: open ? 0.05 : 0,
        duration: open ? PANEL.fadeIn : PANEL.fadeOut,
        ease: EASE_OUT,
      },
    }}
  >
    {children}
  </motion.div>
);
