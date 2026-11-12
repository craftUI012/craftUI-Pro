"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  AutoHeight,
  DotOrb,
  GEN_COLORS,
  GEN_CSS,
  JsonCode,
  PANEL_SPRING,
  ScanLoader,
  partialOf,
  streamLength,
} from "./generative-ui";
import type { DotOrbState } from "./generative-ui";

/* ─────────────────────────────────────────────────────────────────────────
 * Agent run. An AI agent's run in one line, the way it sits in a chat
 * thread: a dot-matrix orb, a verb that rolls to each new step ("Searching
 * the web", "Reading acme.com/about"), a dot per step filling in, and the
 * live call underneath as its arguments stream in. Finished, it folds to
 * a summary ("Researched Acme Inc.", 4 tools · 5.2s). The line itself is
 * the disclosure: it opens to every call on a timeline, and each call
 * opens (one at a time) to its exact input and output as coloured JSON.
 *
 * It's driven by state, not by a clock. Each step takes the states of the
 * Vercel AI SDK's tool parts (input-streaming → input-available →
 * output-available | output-error), plus `pending` for a step the agent
 * has planned but not started, so a real agent wires straight in:
 *
 *   const steps = message.parts.filter(isToolUIPart).map((part) => ({
 *     ...part,
 *     tool: getToolName(part),
 *     label: LABELS[getToolName(part)],
 *   }));
 *   <AgentRun title="Research Acme Inc." running={isLoading} steps={steps} />
 *
 * Pass `running` while the model thinks between calls, so the live call
 * stays open across the gaps instead of folding and reopening.
 *
 * Without `steps` it runs a built-in demo when Run is pressed, and rests on
 * the finished run, ready to run again.
 *
 * LAYOUT. One left rail, the width of the orb (1.5rem): the orb heads it,
 * the step dots run down it on a hairline, and everything else (the
 * label, the live call, each step, its JSON) starts on one text edge to
 * its right (3.25rem in).
 *
 * ANIMATION STORYBOARD
 *
 *    Run      the orb starts its ripple; the line rolls to the first verb
 *    stream   the live call opens under the line and its arguments
 *             stream in behind a caret
 *    running  a dot scan sweeps at the end of the call
 *    done     the step's dot pops green and the call shows its result;
 *             the line rolls to "Searched the web"
 *    next     the next call crossfades in, in the same open panel
 *    finish   the live call folds away, the orb gives way to a filled
 *             check (a 200ms pop from 0.6, then the check draws in over
 *             220ms) and the line rolls to the summary, its count and time
 *
 * Labels and calls swap in a 6px rise with a 3px blur (220ms in, 150ms
 * out, ease-out). Panels open on a no-bounce spring (0.28s; 0.2s to
 * close) to Motion's height "auto", so a step opening inside the open
 * list drives the whole card in one motion; the chevron turns on the
 * same spring. A finished step's dot
 * pops from 1.6× (200ms, ease-out). With reduced motion nothing moves or
 * blurs: labels and calls swap in a fade and the loaders hold still.
 * Screen readers get the run's status as a short sentence, politely.
 * ───────────────────────────────────────────────────────────────────────── */

/** Where a step is. The Vercel AI SDK's tool part states, plus `pending`. */
export type AgentStepState =
  | "pending"
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

/** One tool call in the run. */
export interface AgentStep {
  /** A stable id for the call; the AI SDK's `toolCallId` fits. */
  toolCallId: string;
  /** The tool's name, e.g. "search_web". */
  tool: string;
  /** Where the call is. */
  state: AgentStepState;
  /** What it's doing, shown while it runs: "Searching the web". */
  label?: string;
  /** What it did, shown once it's done: "Searched the web". */
  doneLabel?: string;
  /** Its result in a few words, for the steps list: "8 results". */
  result?: string;
  /** The arguments, whole or still streaming in. */
  input?: unknown;
  /** What the tool returned. */
  output?: unknown;
  /** Why the call failed, for `output-error`. */
  errorText?: string;
  /** How long the call took, in ms. Measured for you when left out. */
  durationMs?: number;
}

export interface AgentRunProps extends Omit<
  ComponentProps<"div">,
  "children" | "title"
> {
  /** What the agent is doing, e.g. "Research Acme Inc.". */
  title?: string;
  /** The same, done: "Researched Acme Inc.". Defaults to `title`. */
  doneTitle?: string;
  /** The run's steps. Leave out to show the built-in demo. */
  steps?: AgentStep[];
  /** Whether the agent is working. Read from the steps when left out. */
  running?: boolean;
  /** Starts the run. The Run button only shows when this is set. */
  onRun?: () => void;
  /** Opens the steps list at first. */
  defaultExpanded?: boolean;
}

/** One demo step: what the tool is sent and what it returns. */
interface DemoStep {
  tool: string;
  label: string;
  doneLabel: string;
  result: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  /** How long the tool takes once its input is in, in ms. */
  runMs: number;
}

const DEMO_TITLE = "Research Acme Inc.";
const DEMO_DONE_TITLE = "Researched Acme Inc.";

const DEMO: DemoStep[] = [
  {
    doneLabel: "Searched the web",
    input: { limit: 8, query: "Acme Inc. funding 2026" },
    label: "Searching the web",
    output: {
      results: 8,
      top: { source: "techcrunch.com", title: "Acme raises $40M Series B" },
    },
    result: "8 results",
    runMs: 700,
    tool: "search_web",
  },
  {
    doneLabel: "Read acme.com/about",
    input: { url: "https://acme.com/about" },
    label: "Reading acme.com/about",
    output: { status: 200, title: "About Acme", words: 1240 },
    result: "1,240 words",
    runMs: 1000,
    tool: "visit_page",
  },
  {
    doneLabel: "Extracted 3 fields",
    input: { fields: ["ceo", "headcount", "founded"] },
    label: "Extracting 3 fields",
    output: { ceo: "Dana Whitfield", founded: 2019, headcount: 180 },
    result: "3 of 3 found",
    runMs: 850,
    tool: "extract_data",
  },
  {
    doneLabel: "Wrote the summary",
    input: { maxWords: 80, save: true, tone: "brief" },
    label: "Writing the summary",
    output: { saved: true, words: 74 },
    result: "74 words, saved",
    runMs: 650,
    tool: "write_summary",
  },
];

/** The demo's pace. */
export interface DemoPace {
  /** The pause between one step finishing and the next starting, in ms. */
  gap: number;
  /** How fast a step's input streams in, in characters per second. */
  streamCps: number;
}

// The gap is long enough to read the finished step ("Searched the web")
// before the next one rolls in: one roll, then a beat, then the next.
const PACE: DemoPace = { gap: 650, streamCps: 38 };

/** When each demo step starts, finishes streaming and finishes, in ms. */
const planOf = (pace: DemoPace) => {
  let at = 0;
  const plan = DEMO.map((step) => {
    const start = at;
    const streamed = start + (streamLength(step.input) / pace.streamCps) * 1000;
    const done = streamed + step.runMs;
    at = done + pace.gap;
    return { done, start, streamed };
  });
  return { plan, total: at - pace.gap };
};

/** The demo's steps `elapsed` ms into a run (negative: not started). */
const demoStepsAt = (
  elapsed: number,
  pace: DemoPace,
  { plan }: ReturnType<typeof planOf>
): AgentStep[] =>
  DEMO.map((step, i) => {
    const { done, start, streamed } = plan[i] ?? {
      done: 0,
      start: 0,
      streamed: 0,
    };
    const base = {
      doneLabel: step.doneLabel,
      label: step.label,
      result: step.result,
      tool: step.tool,
      toolCallId: `demo-${i}`,
    };
    if (elapsed < start) {
      return { ...base, state: "pending" };
    }
    if (elapsed < streamed) {
      const count = ((elapsed - start) / 1000) * pace.streamCps;
      return {
        ...base,
        input: partialOf(step.input, count) ?? {},
        state: "input-streaming",
      };
    }
    if (elapsed < done) {
      return { ...base, input: step.input, state: "input-available" };
    }
    return {
      ...base,
      durationMs: done - start,
      input: step.input,
      output: step.output,
      state: "output-available",
    };
  });

/**
 * The built-in demo: nothing moves until Run is pressed, then the steps
 * play in turn and the run rests, finished. In a hidden tab the browser
 * stops the frames, and the run waits. `elapsed` and `plan` let a layout
 * time its own touches (a row lingering open, say) to the run.
 */
export const useAgentDemo = (pace: Partial<DemoPace> = {}) => {
  const gap = pace.gap ?? PACE.gap;
  const streamCps = pace.streamCps ?? PACE.streamCps;
  const timing = useMemo(() => planOf({ gap, streamCps }), [gap, streamCps]);
  const [elapsed, setElapsed] = useState(-1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    let at = 0;
    const tick = (now: number) => {
      at += Math.min(100, now - last);
      last = now;
      if (at >= timing.total) {
        setElapsed(timing.total);
        setRunning(false);
        return;
      }
      setElapsed(at);
      frame = requestAnimationFrame(tick);
    };
    setElapsed(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, timing]);

  return {
    doneTitle: DEMO_DONE_TITLE,
    elapsed,
    plan: timing.plan,
    run: () => setRunning(true),
    running,
    steps: demoStepsAt(elapsed, { gap, streamCps }, timing),
    title: DEMO_TITLE,
  };
};

const isFinished = (state: AgentStepState) =>
  state === "output-available" || state === "output-error";

/**
 * How long each step took: `durationMs` when given, else measured from
 * the first time it was seen working to the moment it finished. A step
 * that arrives already finished has no measured time.
 */
const useDurations = (steps: AgentStep[]) => {
  const [marks, setMarks] = useState<
    Record<string, { end?: number; start?: number }>
  >({});

  useEffect(() => {
    const now = performance.now();
    setMarks((current) => {
      const changes: typeof current = {};
      for (const step of steps) {
        const mark = current[step.toolCallId] ?? {};
        if (step.state !== "pending" && mark.start === undefined) {
          if (!isFinished(step.state)) {
            changes[step.toolCallId] = { start: now };
          }
        } else if (
          isFinished(step.state) &&
          mark.start !== undefined &&
          mark.end === undefined
        ) {
          changes[step.toolCallId] = { ...mark, end: now };
        }
      }
      return Object.keys(changes).length > 0
        ? { ...current, ...changes }
        : current;
    });
  }, [steps]);

  return (step: AgentStep) => {
    if (step.durationMs !== undefined) {
      return step.durationMs;
    }
    const mark = marks[step.toolCallId];
    return mark?.start !== undefined && mark.end !== undefined
      ? mark.end - mark.start
      : undefined;
  };
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const working = (state: AgentStepState) =>
  state === "input-streaming" || state === "input-available";

/* ─────────────────────────────────────────────────────────────────────────
 * Motion. Every value that sets a beat lives here.
 * ───────────────────────────────────────────────────────────────────────── */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const MOTION = {
  /** The blur a label or call swaps through, in px. */
  blur: 3,
  /** The done check draws its stroke in, in seconds. */
  checkDraw: 0.22,
  /** The done mark lands, in seconds. */
  mark: 0.2,
  /** And grows in from this scale. */
  markFrom: 0.6,
  /** A finished step's dot pops back from this scale. */
  pop: 1.6,
  /** And takes this long to settle, in seconds. */
  popDuration: 0.2,
  /** A working step's dot pulses once per this long, in seconds. */
  pulse: 1,
  /** How far a label or call rises as it swaps, in px. */
  rise: 6,
  /** A new label or call fades in, in seconds. */
  swapIn: 0.22,
  /** The old one fades out, quicker. */
  swapOut: 0.15,
} as const;

/** A swap between two lines of text: the new rises in, the old rises out. */
const useSwap = () => {
  const reduce = useReducedMotion();
  const blur = (px: number) => (reduce ? "blur(0px)" : `blur(${px}px)`);
  const y = (px: number) => (reduce ? 0 : px);
  return {
    animate: {
      filter: blur(0),
      opacity: 1,
      transition: { duration: MOTION.swapIn, ease: EASE_OUT },
      y: 0,
    },
    exit: {
      filter: blur(MOTION.blur),
      opacity: 0,
      transition: { duration: MOTION.swapOut, ease: EASE_OUT },
      y: y(-MOTION.rise),
    },
    initial: { filter: blur(MOTION.blur), opacity: 0, y: y(MOTION.rise) },
  };
};

/* ─────────────────────────────────────────────────────────────────────────
 * What the line says.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * A finished step's result in a few words: `result`, else the output's
 * first value; a failed one's error. Nothing before it finishes.
 */
const resultOf = (step: AgentStep): string => {
  if (step.state === "output-error") {
    return step.errorText ?? "Failed";
  }
  if (step.state !== "output-available") {
    return "";
  }
  if (step.result !== undefined) {
    return step.result;
  }
  const first =
    step.output && typeof step.output === "object"
      ? Object.values(step.output)[0]
      : step.output;
  return first === undefined ? "" : String(first);
};

/** What the line says, and the orb beside it, for the run as it stands. */
const lineOf = (
  steps: AgentStep[],
  busy: boolean,
  { doneTitle, title }: { doneTitle?: string; title?: string }
): { orb: DotOrbState; text: string } => {
  const failed = steps.find((step) => step.state === "output-error");
  if (failed) {
    return { orb: "fail", text: `Failed: ${failed.label ?? failed.tool}` };
  }
  const current = steps.find((step) => working(step.state));
  if (current) {
    return { orb: "run", text: current.label ?? `Calling ${current.tool}` };
  }
  const finished = steps.filter((step) => isFinished(step.state));
  if (steps.length > 0 && finished.length === steps.length && !busy) {
    return { orb: "done", text: doneTitle ?? title ?? "Finished" };
  }
  const last = finished.at(-1);
  if (last) {
    return { orb: "run", text: last.doneLabel ?? `Called ${last.tool}` };
  }
  return { orb: "idle", text: title ?? "Agent run" };
};

/** The line's quiet half: the count, and the time once there is one. */
const metaOf = (steps: AgentStep[], total: number) => {
  const failed = steps.some((step) => step.state === "output-error");
  const ok = steps.filter((step) => step.state === "output-available").length;
  const tools = `${steps.length} ${steps.length === 1 ? "tool" : "tools"}`;
  const count = failed ? `${ok} of ${tools}` : tools;
  const time = total > 0 ? seconds(total) : undefined;
  return { count, text: time ? `${count} · ${time}` : count, time };
};

/** The run as a sentence, for screen readers. */
const sentenceOf = (steps: AgentStep[], text: string, meta: string) => {
  const at = steps.findIndex((step) => working(step.state));
  if (at !== -1) {
    return `Step ${at + 1} of ${steps.length}: ${text}`;
  }
  return `${text}, ${meta}`;
};

/* ─────────────────────────────────────────────────────────────────────────
 * Pieces.
 * ───────────────────────────────────────────────────────────────────────── */

/** Text that swaps to the next with a rise and a blur, stacked in place. */
const Swap = ({
  children,
  className,
  clip = true,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Cuts long text with an ellipsis. Off for marks that pulse past it. */
  clip?: boolean;
  id: string;
}) => {
  const swap = useSwap();
  return (
    <span aria-hidden className={cn("grid min-w-0", className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          animate={swap.animate}
          className={cn("col-start-1 row-start-1 min-w-0", clip && "truncate")}
          exit={swap.exit}
          initial={swap.initial}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

/** A step's mark on the rail: faint planned, pulsing at work, green done. */
const StepDot = ({
  className,
  step,
}: {
  className?: string;
  step: AgentStep;
}) => {
  const busy = working(step.state);
  return (
    <motion.span
      aria-hidden
      animate={{ scale: busy ? [1, 1.35, 1] : 1 }}
      className={cn(
        "block size-1.5 shrink-0 rounded-full transition-colors duration-200 ease-out",
        // Planned: a hollow ring, opaque, so the rail doesn't show through.
        step.state === "pending" && "bg-card border-muted-foreground/45 border",
        busy && "bg-foreground",
        step.state === "output-available" && "bg-(--gen-done)",
        step.state === "output-error" && "bg-destructive",
        className
      )}
      // Keyed on the state so finishing restarts the motion as a pop.
      initial={isFinished(step.state) ? { scale: MOTION.pop } : false}
      key={isFinished(step.state) ? "end" : "live"}
      transition={
        busy
          ? { duration: MOTION.pulse, ease: "easeInOut", repeat: Infinity }
          : { duration: MOTION.popDuration, ease: EASE_OUT }
      }
    />
  );
};

/** A chevron that turns on the panels' spring, with the panel it opens. */
const Chevron = ({
  className,
  open,
}: {
  className?: string;
  open: boolean;
}) => (
  <motion.svg
    animate={{ rotate: open ? 180 : 0 }}
    aria-hidden
    className={cn("size-3.5 shrink-0", className)}
    fill="none"
    initial={false}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.6}
    transition={open ? PANEL_SPRING.open : PANEL_SPRING.close}
    viewBox="0 0 16 16"
  >
    <path d="m4 6 4 4 4-4" />
  </motion.svg>
);

/**
 * The run's done mark: a filled check circle. The geometry is Hugeicons'
 * CheckmarkCircle02 (the 24-unit circle and its check), drawn solid: the
 * circle filled in the done colour and the check knocked out of it in the
 * card colour. It lands with a short pop, then the check draws in.
 */
const DoneMark = ({ className }: { className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <svg
      aria-hidden
      className={cn("shrink-0 text-(--gen-done)", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <motion.path
        animate={{ opacity: 1, scale: 1 }}
        d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12Z"
        fill="currentColor"
        initial={{ opacity: 0, scale: MOTION.markFrom }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        transition={{ duration: MOTION.mark, ease: EASE_OUT }}
      />
      <motion.path
        animate={{ pathLength: 1 }}
        className="stroke-card"
        d="M8 12.5L10.5 15L16 9"
        initial={{ pathLength: reduce ? 1 : 0 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        transition={{
          delay: MOTION.mark * 0.5,
          duration: MOTION.checkDraw,
          ease: EASE_OUT,
        }}
      />
    </svg>
  );
};

/** An arrow turning back on itself, for Run again. */
const AgainGlyph = () => (
  <svg
    aria-hidden
    className="size-3.5"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.6}
    viewBox="0 0 16 16"
  >
    <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3" />
  </svg>
);

const ARG_CLASS = {
  boolean: "text-(--gen-literal)",
  number: "text-(--gen-number)",
  other: "text-muted-foreground",
  string: "text-(--gen-string)",
} as const;

const toneOf = (value: unknown): keyof typeof ARG_CLASS => {
  if (Array.isArray(value)) {
    return "string";
  }
  const kind = typeof value;
  return kind === "string" || kind === "number" || kind === "boolean"
    ? kind
    : "other";
};

/** A step's call as one line: `visit_page(url: "https://acme.com/about")`. */
const CallLine = ({ step }: { step: AgentStep }) => {
  const entries =
    step.input && typeof step.input === "object" && !Array.isArray(step.input)
      ? Object.entries(step.input)
      : [];
  const result = resultOf(step);
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="min-w-0 truncate">
        <span className="text-foreground font-medium">{step.tool}</span>
        <span className="text-muted-foreground">(</span>
        {entries.map(([name, value], i) => (
          <span key={name}>
            {i > 0 && <span className="text-muted-foreground">, </span>}
            <span className="text-(--gen-key)">{name}</span>
            <span className="text-muted-foreground">: </span>
            <span className={ARG_CLASS[toneOf(value)]}>
              {JSON.stringify(value)}
            </span>
          </span>
        ))}
        {step.state === "input-streaming" ? (
          <span
            aria-hidden
            className="bg-foreground ml-px inline-block h-[1.1em] w-[0.45em] align-[-0.2em]"
          />
        ) : (
          <span className="text-muted-foreground">)</span>
        )}
      </span>
      {step.state === "input-available" && <ScanLoader columns={8} />}
      {result && (
        <span
          className={cn(
            "shrink-0 font-sans",
            step.state === "output-error"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {result}
        </span>
      )}
    </span>
  );
};

/** A labelled half of a step's code panel. */
const CodeSection = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <div className="grid gap-1 px-3 py-2.5">
    <span className="text-muted-foreground text-xs">{label}</span>
    {children}
  </div>
);

/** A step's input and output, in one panel. */
// Real outputs can run to hundreds of lines: the panel stops at 15rem and
// scrolls inside, so one call never pushes the run off the page.
const StepCode = ({ step }: { step: AgentStep }) => (
  <div
    aria-label={`${step.tool} input and output`}
    className="bg-muted/60 divide-border/70 max-h-60 divide-y overflow-y-auto overscroll-contain rounded-lg [scrollbar-width:thin]"
    role="region"
    // A region that scrolls must take focus, so keys can scroll it
    // (WCAG 2.1.1; axe: scrollable-region-focusable).
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    tabIndex={0}
  >
    <CodeSection label="Input">
      <JsonCode
        streaming={step.state === "input-streaming"}
        value={step.input ?? {}}
      />
    </CodeSection>
    <CodeSection label="Output">
      {step.state === "output-available" && (
        <JsonCode value={step.output ?? null} />
      )}
      {step.state === "output-error" && (
        <p className="text-destructive font-mono text-xs leading-relaxed">
          {step.errorText ?? "The tool call failed."}
        </p>
      )}
      {working(step.state) && (
        <span className="text-muted-foreground flex h-5 items-center gap-2 text-xs">
          <ScanLoader columns={8} />
          Running
        </span>
      )}
    </CodeSection>
  </div>
);

// The rail: the orb's column (1.5rem) 1rem in from the card's edge, so its
// centre line is 1.75rem in; text starts 0.75rem past it, 3.25rem in. A
// step row is 2.25rem tall, so its dot sits 1.125rem down.
const RAIL = "left-7 w-px -translate-x-1/2";

/** One call on the timeline; it opens to its input and output. */
const StepRow = ({
  duration,
  first,
  last,
  onToggle,
  open,
  step,
}: {
  duration?: number;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  open: boolean;
  step: AgentStep;
}) => {
  const id = useId();
  const result = resultOf(step);
  const pending = step.state === "pending";
  return (
    <li className="relative">
      {/* The hairline joining this step's dot to its neighbours'. */}
      {!(first && last) && (
        <span
          aria-hidden
          className={cn(
            "bg-border absolute",
            RAIL,
            first ? "top-[1.125rem]" : "top-0",
            last ? "h-[1.125rem]" : "bottom-0"
          )}
        />
      )}
      <button
        aria-controls={id}
        aria-expanded={open}
        className="group/row focus-visible:ring-ring/50 relative flex h-9 w-full items-center gap-3 px-4 text-left text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-inset disabled:cursor-default"
        disabled={pending}
        onClick={onToggle}
        type="button"
      >
        <span className="flex w-6 shrink-0 justify-center">
          {/* The card colour round the dot cuts the hairline. */}
          <StepDot className="ring-card ring-4" step={step} />
        </span>
        <span
          className={cn(
            "shrink-0 font-mono font-medium",
            pending && "text-muted-foreground"
          )}
        >
          {step.tool}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            step.state === "output-error"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {working(step.state) ? <ScanLoader columns={6} /> : result}
        </span>
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {duration === undefined ? "" : seconds(duration)}
        </span>
        <Chevron
          className={cn(
            "text-muted-foreground group-hover/row:text-foreground transition-colors duration-150",
            pending && "invisible"
          )}
          open={open}
        />
      </button>
      <AutoHeight id={id} open={open}>
        <div className="pr-4 pb-3 pl-13">
          <StepCode step={step} />
        </div>
      </AutoHeight>
    </li>
  );
};

/**
 * The line's quiet half: a dot per step while the run works, then the
 * count and the time. Phones keep just the time once there is one, so
 * the title keeps its room.
 */
const LineMeta = ({
  busy,
  meta,
  steps,
}: {
  busy: boolean;
  meta: ReturnType<typeof metaOf>;
  steps: AgentStep[];
}) => (
  <Swap
    className="text-muted-foreground pointer-events-none shrink-0 text-xs tabular-nums"
    clip={false}
    id={busy ? "dots" : meta.text}
  >
    {busy ? (
      <span className="flex h-4 items-center gap-1">
        {steps.map((step) => (
          <StepDot key={step.toolCallId} step={step} />
        ))}
      </span>
    ) : (
      <>
        <span className={cn(meta.time && "max-sm:hidden")}>{meta.count}</span>
        {meta.time && (
          <>
            <span className="max-sm:hidden"> · </span>
            {meta.time}
          </>
        )}
      </>
    )}
  </Swap>
);

/** The line's trailing button: Run before the run, Run again after it. */
const RunButton = ({
  ended,
  run,
  started,
}: {
  ended: boolean;
  run?: (event: MouseEvent<HTMLButtonElement>) => void;
  started: boolean;
}) => {
  if (!run) {
    return null;
  }
  if (!started) {
    return (
      <Button
        className="relative -mr-1 shrink-0 transition-transform active:scale-[0.97]"
        onClick={run}
        size="sm"
      >
        Run
      </Button>
    );
  }
  if (!ended) {
    return null;
  }
  return (
    <Button
      aria-label="Run again"
      className="text-muted-foreground hover:text-foreground relative -mx-1.5 shrink-0 transition-transform active:scale-[0.97]"
      onClick={run}
      size="icon-sm"
      variant="ghost"
    >
      <AgainGlyph />
    </Button>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
 * The block.
 * ───────────────────────────────────────────────────────────────────────── */

export const AgentRun = ({
  className,
  defaultExpanded = false,
  doneTitle,
  onRun,
  running,
  steps,
  title,
  ...props
}: AgentRunProps) => {
  const demo = useAgentDemo();
  const isDemo = steps === undefined;
  const list = steps ?? demo.steps;
  const busy = isDemo
    ? demo.running
    : (running ?? list.some((step) => working(step.state)));
  const run = isDemo ? demo.run : onRun;
  const durationOf = useDurations(list);
  const [expanded, setExpanded] = useState(defaultExpanded);
  // One step open at a time: opening another closes the last, so the card
  // keeps a steady height and only ever shows one call's JSON.
  const [openStep, setOpenStep] = useState<string>();
  const listId = useId();
  const lineRef = useRef<HTMLButtonElement>(null);
  // Run and Run again leave once pressed; focus moves on to the line (the
  // next control) instead of falling back to the page.
  const [focusLine, setFocusLine] = useState(false);
  const start =
    run &&
    ((event: MouseEvent<HTMLButtonElement>) => {
      setFocusLine(document.activeElement === event.currentTarget);
      run();
    });

  const started = list.some((step) => step.state !== "pending");
  const ended = started && !busy;
  useEffect(() => {
    if (focusLine && started && !ended) {
      lineRef.current?.focus();
      setFocusLine(false);
    }
  }, [ended, focusLine, started]);
  // The live call: the working step, else the one that just finished, so
  // the panel holds the last result through the gap before the next.
  const shown =
    list.find((step) => working(step.state)) ??
    list.findLast((step) => isFinished(step.state));
  const total = list.reduce((sum, step) => sum + (durationOf(step) ?? 0), 0);
  const line = lineOf(list, busy, {
    doneTitle: doneTitle ?? (isDemo ? demo.doneTitle : undefined),
    title: title ?? (isDemo ? demo.title : undefined),
  });
  const meta = metaOf(list, total);

  return (
    <MotionConfig reducedMotion="user">
      <Card
        data-slot="agent-run"
        className={cn(
          GEN_COLORS,
          "w-full max-w-md gap-0 overflow-hidden py-0",
          className
        )}
        {...props}
      >
        <style>{GEN_CSS}</style>
        <p aria-live="polite" className="sr-only">
          {sentenceOf(list, line.text, meta.text)}
        </p>
        <div className="relative flex min-h-14 items-center gap-3 px-4 py-2.5">
          {/* The line is the disclosure: this button covers all of it,
              under everything but Run again, which sits above it. */}
          <button
            aria-controls={listId}
            aria-expanded={started ? expanded : undefined}
            aria-label="Steps"
            className="peer focus-visible:ring-ring/50 absolute inset-0 outline-none focus-visible:ring-[3px] focus-visible:ring-inset disabled:cursor-default"
            disabled={!started}
            onClick={() => setExpanded((value) => !value)}
            ref={lineRef}
            type="button"
          />
          {/* Done, the orb gives way to a filled check; working, idle
              and failed stay in the dot matrix. */}
          {line.orb === "done" ? (
            <DoneMark className="pointer-events-none size-6" />
          ) : (
            <DotOrb className="pointer-events-none size-6" state={line.orb} />
          )}
          <Swap className="pointer-events-none flex-1 text-sm" id={line.text}>
            {line.text}
          </Swap>
          <LineMeta busy={busy} meta={meta} steps={list} />
          <RunButton ended={ended} run={start} started={started} />
          {started && (
            <Chevron
              className="text-muted-foreground peer-hover:text-foreground pointer-events-none transition-colors duration-150"
              open={expanded}
            />
          )}
        </div>
        <AutoHeight open={busy && Boolean(shown)}>
          <div className="pr-4 pb-3.5 pl-13 font-mono text-xs leading-5">
            {shown && (
              <Swap id={shown.toolCallId}>
                <CallLine step={shown} />
              </Swap>
            )}
          </div>
        </AutoHeight>
        <AutoHeight id={listId} open={expanded && started}>
          <ol className="border-t py-1.5">
            {list.map((step, i) => (
              <StepRow
                key={step.toolCallId}
                duration={isFinished(step.state) ? durationOf(step) : undefined}
                first={i === 0}
                last={i === list.length - 1}
                onToggle={() =>
                  setOpenStep((id) =>
                    id === step.toolCallId ? undefined : step.toolCallId
                  )
                }
                open={openStep === step.toolCallId}
                step={step}
              />
            ))}
          </ol>
        </AutoHeight>
      </Card>
    </MotionConfig>
  );
};

export default AgentRun;
