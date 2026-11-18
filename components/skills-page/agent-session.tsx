"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

import { K } from "./primitives";

// The prompt cookbook on /skills/isometrics: four prompt styles on the left,
// and on the right a generic dark terminal that plays what the agent does
// with each one (no rendered output, only the conversation and the code).
// It starts in view, moves through the four in turn, pauses on hover, and a
// tab jumps to its prompt. Reduced motion shows the whole transcript.
// Code excerpts are the real storyboard comments of library objects.

interface Seg {
  t: string;
  k?: boolean;
}

type Step =
  | { kind: "user"; segs: Seg[] }
  | { kind: "reply"; text: string }
  | { kind: "agent"; text: string }
  | { kind: "tool"; name: string; arg: string; out?: string[] }
  | { kind: "code"; lines: string[] };

interface Prompt {
  label: string;
  segs: Seg[];
  steps: Step[];
}

const text = (segs: Seg[]) => segs.map((seg) => seg.t).join("");

const CHECK = (name: string, lines: string): Step => ({
  arg: `node .claude/skills/isometrics/scripts/check.mjs …/${name}`,
  kind: "tool",
  name: "Bash",
  out: [
    "PASS  plays when active (hover)",
    "PASS  the beat settles to the resting pose",
    `PASS  clean lines (sustained doubled outline ≤ 6%) · ${lines}`,
    "PASS  optical size 140–175 px · centred on the heading",
  ],
});

const PROMPTS: Prompt[] = [
  {
    label: "Start vague",
    segs: [
      { t: "/isometrics " },
      { k: true, t: "gallery" },
      { t: " " },
      { k: true, t: "empty state" },
    ],
    steps: [
      {
        arg: ".claude/skills/isometrics/SKILL.md",
        kind: "tool",
        name: "Read",
        out: ["Read 312 lines"],
      },
      {
        kind: "agent",
        text: "Subject: photos. State: empty. Message: “No photos yet”. Three concepts:",
      },
      {
        kind: "code",
        lines: [
          "   Object          The one beat",
          "A ★ Picture frame   the sun rises over the hills",
          "B   Photo folder    pages arc out, drop back in",
          "C   Camera          the shutter clicks, nothing there",
        ],
      },
      { kind: "agent", text: "Which one? A reads best in line." },
      { kind: "reply", text: "A" },
      {
        kind: "agent",
        text: "Flat thing, so front-on. Storyboard first:",
      },
      {
        arg: "components/isometrics/picture-frame.tsx",
        kind: "tool",
        name: "Write",
      },
      {
        kind: "code",
        lines: [
          "/* ANIMATION STORYBOARD",
          " *    0ms   two hills in the frame; the sun is down",
          " *  400ms   the sun rises over the far hill (700ms)",
          " * 1100ms   it eases back down to where it stays",
          " * 1300ms   still: the sun up",
          " */",
        ],
      },
      CHECK("picture-frame", "1.2%"),
      {
        kind: "agent",
        text: "Done: picture frame, front-on, one beat. Looked at the frames in light and dark.",
      },
    ],
  },
  {
    label: "Be specific",
    segs: [
      { t: "An " },
      { k: true, t: "isometric" },
      { t: " " },
      { k: true, t: "empty state" },
      { t: " for our file uploads page: an " },
      { k: true, t: "archive box" },
      { t: " whose " },
      { k: true, t: "lid lifts" },
      { t: " and " },
      { k: true, t: "pages pop out in an arc" },
      { t: '. Heading "' },
      { k: true, t: "No files yet" },
      { t: '".' },
    ],
    steps: [
      {
        kind: "agent",
        text: "The brief names the object and the beat, so no concepts. Boxy object: isometric view.",
      },
      {
        arg: "components/isometrics/archive-box.tsx",
        kind: "tool",
        name: "Write",
      },
      {
        kind: "code",
        lines: [
          "/* ANIMATION STORYBOARD",
          " *  400ms   the lid lifts 1.5 units and tips back 12°",
          " *  560ms   the pages pop up one after the other, each on",
          " *          an arc: up fast, drifting apart more slowly",
          " * 1410ms   pulled swiftly back down, last out first in",
          " * 2060ms   still: the box shut, exactly as it started",
          " */",
        ],
      },
      CHECK("archive-box", "0.4%"),
      {
        kind: "agent",
        text: "Done: archive box, isometric, heading “No files yet”.",
      },
    ],
  },
  {
    label: "A blocked state",
    segs: [
      { t: "A " },
      { k: true, t: "blocked state" },
      { t: " for when a feature is turned off: a " },
      { k: true, t: "toggle switch" },
      { t: ", " },
      { k: true, t: "front-on" },
      { t: ", that " },
      { k: true, t: "tries to switch on and stops" },
      { t: "." },
    ],
    steps: [
      {
        kind: "agent",
        text: "Blocked state: the beat tries and stops. Front-on, as asked.",
      },
      {
        arg: "components/isometrics/toggle-switch.tsx",
        kind: "tool",
        name: "Write",
      },
      {
        kind: "code",
        lines: [
          "/* ANIMATION STORYBOARD",
          " *  400ms   the knob slides toward on, gathering speed",
          " *  720ms   it is stopped a third of the way: squashes",
          " *          10% against its leading edge, kicks back",
          " * 1180ms   it slides home and lands with a 7% squash",
          " * 1860ms   still: off, exactly as it started",
          " */",
        ],
      },
      CHECK("toggle-switch", "0.9%"),
      {
        kind: "agent",
        text: "Done: toggle switch, front-on. It tries, and it can't.",
      },
    ],
  },
  {
    label: "Just the art",
    segs: [
      { t: "An " },
      { k: true, t: "isometric" },
      { t: " " },
      { k: true, t: "USB drive" },
      { t: " " },
      { k: true, t: "lying flat" },
      { t: ", " },
      { k: true, t: "art only" },
      { t: " at " },
      { k: true, t: "64 px" },
      { t: ", that " },
      { k: true, t: "plays on hover" },
      { t: ", in our Import button." },
    ],
    steps: [
      {
        kind: "agent",
        text: "Lying flat, so isometric. Art only: no heading, copy or button.",
      },
      {
        arg: "components/isometrics/usb-drive.tsx",
        kind: "tool",
        name: "Write",
        out: ["Wrote 238 lines"],
      },
      {
        arg: "components/import-button.tsx",
        kind: "tool",
        name: "Edit",
      },
      {
        kind: "code",
        lines: [
          "  <Button>",
          "+   <PlayOnHover>",
          '+     <UsbDrive heading="" description="" actionLabel=""',
          '+       artClassName="w-16" />',
          "+   </PlayOnHover>",
          "    Import from device",
          "  </Button>",
        ],
      },
      CHECK("usb-drive", "2.1%"),
      {
        kind: "agent",
        text: "Done: no button inside the art, so it's safe in yours.",
      },
    ],
  },
];

// Each prompt's full transcript: the prompt typed in, then the agent's steps.
const SCRIPTS: Step[][] = PROMPTS.map((item) => [
  { kind: "user", segs: item.segs },
  ...item.steps,
]);

// How long each unit takes to appear, ms, and the pause after each step.
const SPEED = {
  agent: 12,
  code: 90,
  hold: 2800,
  pause: 380,
  reply: 160,
  tool: 280,
  user: 26,
};

/** How many units (characters or lines) a step reveals. */
const unitsOf = (step: Step) => {
  switch (step.kind) {
    case "user": {
      return text(step.segs).length;
    }
    case "reply":
    case "agent": {
      return step.text.length;
    }
    case "tool": {
      return 1 + (step.out?.length ?? 0);
    }
    case "code": {
      return step.lines.length;
    }
    default: {
      return 1;
    }
  }
};

const KEYWORDS = [
  { label: "State", words: "empty · blocked · nothing found · all clear" },
  { label: "Object", words: "a printer · a safe · a folder" },
  { label: "Words", words: "heading · button label" },
  { label: "Beat", words: "the lid lifts · tries and stops" },
  { label: "View", words: "front-on · isometric · lying flat" },
  { label: "Size", words: "art only · 64 px · plays on hover" },
];

/** The prompt's segments, cut to `n` characters, keywords in blue. */
const Typed = ({ segs, n }: { segs: Seg[]; n: number }) => {
  let left = n;
  return (
    <>
      {segs.map((seg, i) => {
        const shown = seg.t.slice(0, Math.max(0, left));
        left -= seg.t.length;
        if (!shown) {
          return null;
        }
        return seg.k ? (
          // Fixed segments; position is their identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed list
          <span className="text-brand-text font-semibold" key={i}>
            {shown}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed list
          <span key={i}>{shown}</span>
        );
      })}
    </>
  );
};

const Caret = () => (
  <span
    aria-hidden="true"
    className="bg-brand-text ml-0.5 inline-block h-[1.1em] w-[0.5ch] translate-y-[0.2em] animate-pulse"
  />
);

const Dot = () => <span className="text-brand-text">⏺ </span>;

/** One step of the transcript, `n` units in. */
const Line = ({ step, n, live }: { step: Step; n: number; live: boolean }) => {
  switch (step.kind) {
    case "user": {
      return (
        <p className="text-foreground">
          <span className="text-muted-foreground">&gt; </span>
          <Typed n={n} segs={step.segs} />
          {live ? <Caret /> : null}
        </p>
      );
    }
    case "reply": {
      return (
        <p className="text-foreground">
          <span className="text-muted-foreground">&gt; </span>
          {step.text.slice(0, n)}
          {live ? <Caret /> : null}
        </p>
      );
    }
    case "agent": {
      return (
        <p className="text-foreground">
          <Dot />
          {step.text.slice(0, n)}
        </p>
      );
    }
    case "tool": {
      return (
        <div>
          <p className="text-foreground">
            <Dot />
            <span className="font-semibold">{step.name}</span>
            <span className="text-muted-foreground">({step.arg})</span>
          </p>
          {(step.out ?? []).slice(0, Math.max(0, n - 1)).map((out) => (
            <p className="text-muted-foreground pl-5" key={out}>
              ⎿ {out}
            </p>
          ))}
        </div>
      );
    }
    case "code": {
      return (
        <pre className="border-border bg-card text-muted-foreground ml-5 overflow-x-auto rounded-lg border px-3 py-2">
          {step.lines.slice(0, n).map((line) => (
            <span
              className={cn("block", line.startsWith("+") && "text-brand-text")}
              key={line}
            >
              {line}
            </span>
          ))}
        </pre>
      );
    }
    default: {
      return null;
    }
  }
};

export const AgentSession = () => {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ n: 0, step: 0 });
  const [paused, setPaused] = useState(false);
  const prompt = PROMPTS[active];
  const steps = SCRIPTS[active];
  const done = pos.step >= steps.length;

  // Advance one unit at a time; pause between steps; then the next prompt.
  useEffect(() => {
    if (reduced || !inView || paused) {
      return;
    }
    if (done) {
      const id = window.setTimeout(() => {
        setActive((i) => (i + 1) % PROMPTS.length);
        setPos({ n: 0, step: 0 });
      }, SPEED.hold);
      return () => window.clearTimeout(id);
    }
    const step = steps[pos.step];
    const finished = pos.n >= unitsOf(step);
    const delay = finished ? SPEED.pause : SPEED[step.kind];
    const id = window.setTimeout(() => {
      setPos((p) =>
        finished ? { n: 0, step: p.step + 1 } : { ...p, n: p.n + 1 }
      );
    }, delay);
    return () => window.clearTimeout(id);
  }, [done, inView, paused, pos, reduced, steps]);

  // Keep the newest line in view, inside the terminal only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every step
  useEffect(() => {
    const el = body.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [pos, active]);

  const select = (i: number) => {
    setActive(i);
    setPos({ n: 0, step: 0 });
  };

  const shown = reduced ? steps.length : Math.min(pos.step + 1, steps.length);

  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-12"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      ref={ref}
    >
      <div className="flex flex-col gap-5 md:col-span-5">
        <p
          className={cn(
            TYPE.cardEyebrow,
            "text-brand-text font-medium tracking-wide uppercase"
          )}
        >
          Prompt cookbook
        </p>
        <h2
          className={cn(
            TYPE.headingSection,
            "scroll-mt-24 font-semibold tracking-tight"
          )}
          id="prompts"
        >
          Say it like this
        </h2>
        <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
          The <K>blue words</K> steer the skill. Pick a style and watch what
          your agent does with it.
        </p>
        <div className="flex flex-col gap-2">
          {PROMPTS.map((item, i) => (
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 transition-colors",
                i === active
                  ? "border-brand-text bg-card shadow-card"
                  : "border-border hover:bg-surface"
              )}
              key={item.label}
            >
              <button
                aria-pressed={i === active}
                className="flex min-w-0 flex-1 flex-col gap-1 text-left outline-none focus-visible:underline"
                onClick={() => select(i)}
                type="button"
              >
                <span
                  className={cn(
                    TYPE.cardEyebrow,
                    "text-muted-foreground font-medium tracking-wide uppercase"
                  )}
                >
                  {item.label}
                </span>
                <span className={cn(TYPE.cardCaption, "text-pretty")}>
                  <Typed n={Number.POSITIVE_INFINITY} segs={item.segs} />
                </span>
              </button>
              <CopyButton
                className="relative top-0 right-0 shrink-0"
                value={text(item.segs)}
              />
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {KEYWORDS.map((item) => (
            <div
              className="bg-surface dark:bg-card flex flex-col gap-0.5 rounded-lg px-3 py-2"
              key={item.label}
            >
              <dt className={cn(TYPE.cardCaption, "text-muted-foreground")}>
                {item.label}
              </dt>
              <dd
                className={cn(
                  TYPE.cardCaption,
                  "text-brand-text font-semibold"
                )}
              >
                {item.words}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="md:col-span-7">
        <div className="dark bg-background text-foreground shadow-card sticky top-24 overflow-hidden rounded-2xl">
          <div className="border-border flex items-center gap-2 border-b px-4 py-3">
            <span className="bg-muted size-2.5 rounded-full" />
            <span className="bg-muted size-2.5 rounded-full" />
            <span className="bg-muted size-2.5 rounded-full" />
            <span className="text-muted-foreground ml-2 font-mono text-xs">
              Claude Code · ~/your-app
            </span>
          </div>
          <div
            aria-label={`What your agent does with: ${text(prompt.segs)}`}
            className="h-[28rem] space-y-3 overflow-y-auto p-5 font-mono text-[0.8125rem] leading-relaxed"
            ref={body}
            role="log"
          >
            {steps.slice(0, shown).map((step, i) => (
              <Line
                // The script is fixed; position is the line's identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed script
                key={`${active}-${i}`}
                live={!reduced && i === pos.step && !done}
                n={reduced || i < pos.step ? Number.POSITIVE_INFINITY : pos.n}
                step={step}
              />
            ))}
            {done || reduced ? (
              <p className="text-muted-foreground">
                &gt; <Caret />
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
