"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  ComponentProps,
  FocusEvent,
  ReactNode,
} from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { DEMO_PICK, FreshnessChart } from "./freshness-chart";
import type { FreshnessChartProps } from "./freshness-chart";
import { SourceChat } from "./source-chat";
import type { SourceChatProps } from "./source-chat";

/* ─────────────────────────────────────────────────────────────────────────
 * Context section. Two product windows on one tray: a chart of how fast a
 * snapshot of your knowledge goes stale, and a chat whose answer names the
 * file it read. They share one grid column, and only one is in front:
 * pointing at a window brings it forward, and the other sinks a little and
 * fades out where the two would overlap. On the keyboard the front follows
 * focus: tabbing to a window or to its title brings it forward, and since
 * the chat has nothing to tab to, it also comes forward when focus leaves
 * the chart.
 *
 * THE GRID. Twelve columns with a 0.75rem gap (--gap). The chart's window
 * spans columns 1 to 7, the chat's 7 to 12, so column 7 is shared. Each
 * window sits 1.25rem (--inset) inside its span, with its top corners
 * rounded and its bottom flush with the tray. On a phone the inset is
 * 0.75rem: the windows are stacked there, and the 16px it gives back goes
 * to the length of their lines. Nothing is measured in
 * JavaScript: every position below is a calc() over --gap, --inset and the
 * window's own width, so the fades land on the grid's lines at any width.
 *
 * THE FADE. Each window carries a mask twice its own width: solid, then a
 * fade to nothing exactly one column step (a column plus a gap) wide. Only
 * the mask's position changes. Behind, the mask is parked so the window is
 * gone where the front window begins; in front, it slides one way until the
 * fade sits just outside the window's edge. A gradient can't be transitioned
 * but its position can, which is why the mask is double width.
 *
 * ANIMATION STORYBOARD
 *
 * Read top to bottom. Each value is ms after the tray scrolls into view.
 * The chat starts in front, so the story opens there:
 *
 *    0ms   the chat answers the question it was waiting on: reading,
 *          answer, second line, sources (its own storyboard, 2.6s).
 *          Behind it the chart sweeps in (1.4s) and its number counts down
 *
 * Nothing changes places by itself: point at the chart (or tab into it)
 * and it comes forward.
 *
 * With `defaultFront="chart"` the chart opens the story and hands over:
 *
 *    0ms   the chart sweeps in (1.4s); the snapshot's number counts down
 * 1700ms   the chart points at one change by itself: the refund policy
 * 4200ms   the chat comes forward (500ms) and answers. It cites the same
 *          file.
 *
 * Touch either window before then and that story stops: from there the
 * windows only move when you ask. Stacked (below lg) the chat waits until
 * it is on screen itself. With reduced motion nothing plays; both windows
 * are complete and switch without a transition.
 * ───────────────────────────────────────────────────────────────────────── */

/** The chart-first story (`defaultFront="chart"`). */
const STORY = {
  /** The chat comes forward and starts. */
  handover: 4200,
  /** The chart points at the demo's change. */
  pick: 1700,
};

/** The stages, in order. */
const STAGE = { handover: 2, pick: 1 } as const;

type Side = "chart" | "chat";

/** How many of the twelve columns each window spans, and how many they share. */
const SPAN = { chart: 7, chat: 6, shared: 1 } as const;

/**
 * One column plus one gap, worked out from a window's own width, which is
 * its span less the inset on each side. `whole` is that width in the units
 * of where the result is used: 50% inside the mask's gradient (the mask is
 * twice the window's width), and −100% inside mask-position, where
 * percentages count backwards because the mask is wider than its box.
 */
const step = (cols: number, whole: string) =>
  `(((${whole} + 2 * var(--inset) - ${cols - 1} * var(--gap)) / ${cols}) + var(--gap))`;

/**
 * A window's mask. The window on the left fades out toward the right, and
 * the other way round. Solid for every column it doesn't share, less one:
 * that last one is the fade.
 */
const maskOf = (cols: number, side: "left" | "right") => {
  const solid = cols - SPAN.shared - 1;
  const inGradient = step(cols, "50%");
  const inPosition = step(cols, "-100%");
  return {
    back: side === "left" ? "100% 0" : "0 0",
    front:
      side === "left"
        ? `calc(-${solid} * ${inPosition}) 0`
        : `calc(100% + ${solid} * ${inPosition}) 0`,
    image: `linear-gradient(to ${side === "left" ? "right" : "left"}, #fff calc(50% + ${solid} * ${inGradient}), transparent calc(50% + ${solid + 1} * ${inGradient}))`,
  };
};

const MASK = {
  chart: maskOf(SPAN.chart, "left"),
  chat: maskOf(SPAN.chat, "right"),
};

/** A window's mask and lift for where it stands: in front, or behind. */
const standing = (side: Side, front: boolean): CSSProperties => {
  const mask = MASK[side];
  const position = front ? mask.front : mask.back;
  return {
    WebkitMaskImage: mask.image,
    WebkitMaskPosition: position,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "200% 100%",
    maskImage: mask.image,
    maskPosition: position,
    maskRepeat: "no-repeat",
    maskSize: "200% 100%",
    transform: front ? "translateY(0)" : "translateY(var(--gap))",
  };
};

/** The cell both windows and the tray sit in: the second row. */
const TRAY_ROW = "lg:row-start-2";

/** A window's span on the grid, and its own card when the grid is stacked. */
const SLOT = cn(
  "relative overflow-hidden px-(--inset) pt-(--inset)",
  "max-lg:bg-muted max-lg:rounded-2xl max-lg:forced-colors:border",
  "lg:flex",
  TRAY_ROW
);

/**
 * The window itself: a Card with its own spacing, shadow and bottom edge
 * taken off, so it reads as a window running off the tray: a hairline on
 * the top and sides only, and only the top corners rounded. Below lg the
 * two never overlap, so the mask and the lift are switched off (the
 * classes win over the inline styles).
 */
const FRAME = cn(
  "w-full min-w-0 gap-0 overflow-hidden py-0 shadow-none",
  "border-foreground/[0.075] rounded-t-xl rounded-b-none border-x-[0.5px] border-t-[0.5px] border-b-0",
  "transition-[mask-position,-webkit-mask-position,transform] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
  "max-lg:[mask-image:none]! max-lg:[transform:none]! max-lg:[-webkit-mask-image:none]!",
  "lg:flex-1"
);

/**
 * An arrow that shows when its link is pointed at: a fade, and a short
 * slide for those who take motion. It points with the reading direction.
 */
const Arrow = () => (
  <svg
    aria-hidden
    className="ms-1.5 inline size-[0.7em] align-baseline opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-safe:ltr:-translate-x-1 rtl:-scale-x-100 motion-safe:rtl:translate-x-1"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.4}
    viewBox="0 0 10 10"
  >
    <path d="M1 5h8M5.5 1.5 9 5 5.5 8.5" />
  </svg>
);

/** What sits above a window: its name and one line about it. */
export interface ContextColumn {
  /** The window's name, e.g. "Live context". */
  title: string;
  /** One sentence about it, in the muted colour. */
  body: string;
  /** Makes the title a link. */
  href?: string;
}

const Column = ({
  as: Title,
  body,
  className,
  href,
  title,
}: ContextColumn & { as: "h2" | "h3" | "h4"; className?: string }) => (
  <div className={cn("px-(--inset) max-lg:pb-5", className)}>
    <Title className="text-lg font-medium tracking-normal">
      {href ? (
        // The focus ring is the text colour, which stands out on every
        // surface of any theme (the theme's own ring colour is too pale
        // to count on). The pseudo-element makes the link 47px tall to
        // hit without moving anything.
        <a
          className="group focus-visible:outline-foreground relative rounded-sm after:absolute after:inset-x-0 after:-inset-y-3 focus-visible:outline-2 focus-visible:outline-offset-2"
          href={href}
        >
          {title}
          <Arrow />
        </a>
      ) : (
        title
      )}
    </Title>
    <p className="text-muted-foreground mt-1 max-w-[21rem] text-base leading-normal font-normal tracking-normal text-pretty">
      {body}
    </p>
  </div>
);

export interface ContextSectionProps extends Omit<
  ComponentProps<"section">,
  "children"
> {
  /** The section's headline. */
  heading?: ReactNode;
  /** The headline's level: 1 on a page it opens, 2 anywhere else. The two
   * column titles sit one level below it. */
  headingLevel?: 1 | 2 | 3;
  /** The copy above the chart, then above the chat. */
  columns?: [ContextColumn, ContextColumn];
  /** Which window starts in front: "chat" or "chart". With "chat" it answers
   * as the section comes into view; with "chart" the chart plays first, then
   * hands over to the chat. */
  defaultFront?: "chart" | "chat";
  /** The chart's own props: your changes, file count, snapshot day, sources
   * and title. Leave out for the demo. */
  chart?: FreshnessChartProps;
  /** The chat's own props: the question, the answer, its second line, the
   * file it names and the sources. Leave out for the demo. */
  chat?: SourceChatProps;
}

const COLUMNS: [ContextColumn, ContextColumn] = [
  {
    body: "Every change lands in your files as the work happens, so nothing drifts.",
    href: "#",
    title: "Live context",
  },
  {
    body: "Each answer names the file it read, who changed it and when.",
    href: "#",
    title: "Traceable answers",
  },
];

export const ContextSection = ({
  chart,
  chat,
  className,
  columns = COLUMNS,
  defaultFront = "chat",
  heading = "Answers are only as fresh as the context behind them",
  headingLevel = 2,
  ...props
}: ContextSectionProps) => {
  const Heading = `h${headingLevel}` as const;
  const columnTitle = `h${headingLevel + 1}` as "h2" | "h3" | "h4";
  const tray = useRef<HTMLDivElement>(null);
  const inView = useInView(tray, { amount: 0.4, once: true });
  // The chat's own slot: stacked, it can be a screen below the tray's top.
  const chatSlot = useRef<HTMLDivElement>(null);
  const chatSeen = useInView(chatSlot, { amount: 0.4, once: true });
  const reduce = useReducedMotion();
  const [front, setFront] = useState<Side>(defaultFront);
  const [stage, setStage] = useState(0);
  const [chatOn, setChatOn] = useState(false);
  // Set the first time the visitor points at a window: the story stops.
  const touched = useRef(false);
  // Whether focus last entered the chart's side from the keyboard.
  const fromKeys = useRef(false);

  useEffect(() => {
    if (!inView) {
      return;
    }
    // The chat is already in front (or nothing is to move): it starts now.
    if (reduce || defaultFront === "chat") {
      setChatOn(true);
      return;
    }
    const timers = [
      setTimeout(() => {
        if (!touched.current) {
          setStage(STAGE.pick);
        }
      }, STORY.pick),
      setTimeout(() => {
        if (!touched.current) {
          setStage(STAGE.handover);
          setFront("chat");
          setChatOn(true);
        }
      }, STORY.handover),
    ];
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [defaultFront, inView, reduce]);

  const bring = (side: Side) => {
    touched.current = true;
    setStage(STAGE.handover);
    setFront(side);
    if (side === "chat") {
      setChatOn(true);
    }
  };

  /** Focus on the chart or its title brings the chart forward. */
  const enterChart = (event: FocusEvent<HTMLDivElement>) => {
    fromKeys.current = event.target.matches(":focus-visible");
    bring("chart");
  };

  /**
   * The chat has nothing to tab to, so a keyboard user could never bring
   * it back: when their focus leaves the chart's side, the chat comes
   * forward. A pointer still on the chart keeps the chart.
   */
  const leaveChart = (event: FocusEvent<HTMLDivElement>) => {
    const side = event.currentTarget;
    if (
      fromKeys.current &&
      !side.contains(event.relatedTarget) &&
      !side.matches(":hover")
    ) {
      bring("chat");
    }
  };

  return (
    <section
      data-slot="context-section"
      className={cn(
        "bg-background text-foreground px-4 [--gap:0.75rem] [--inset:0.75rem] sm:px-6 sm:[--inset:1.25rem]",
        className
      )}
      {...props}
    >
      {/* 72rem of columns, a gap of padding each side, and the two rails:
          twelve 85px columns at full width. */}
      <div className="border-foreground/5 mx-auto max-w-[calc(72rem+2*var(--gap)+2px)] border-x px-(--gap) pb-20 lg:pb-28">
        <Heading className="max-w-[36rem] px-(--inset) pt-20 pb-10 text-[1.75rem] leading-[calc(34/28)] font-normal tracking-[-0.02em] text-balance lg:pt-28 lg:pb-14 lg:text-4xl lg:leading-[calc(42/36)]">
          {heading}
        </Heading>

        {/* The padding and matching negative margin give the top row's
            focus rings room inside the clip. */}
        <div
          ref={tray}
          className="isolate lg:-mt-3 lg:grid lg:grid-cols-12 lg:gap-x-(--gap) lg:gap-y-11 lg:overflow-hidden lg:rounded-b-2xl lg:pt-3"
        >
          {/* The tray, and above everything its hairline edge, drawn as a
              separate layer so the windows never cover it. */}
          <div
            className={cn(
              "bg-muted col-span-full rounded-2xl max-lg:hidden",
              TRAY_ROW
            )}
          />
          <div
            className={cn(
              "ring-foreground/[0.075] pointer-events-none relative z-50 col-span-full rounded-2xl ring-[0.5px] ring-inset max-lg:hidden forced-colors:border",
              TRAY_ROW
            )}
          />

          {/* A side is a column and its window. The wrappers have no box
              of their own (the grid still places their children); they
              only listen for focus. */}
          <div className="contents" onBlur={leaveChart} onFocus={enterChart}>
            <Column
              {...columns[0]}
              as={columnTitle}
              className="lg:col-span-5 lg:col-start-1 lg:row-start-1"
            />
            <div
              className={cn(
                SLOT,
                "max-lg:mb-12 lg:col-span-7 lg:col-start-1",
                front === "chart" ? "lg:z-2" : "lg:z-1"
              )}
              onPointerEnter={() => bring("chart")}
            >
              <Card
                className={FRAME}
                style={standing("chart", front === "chart")}
              >
                <FreshnessChart
                  pick={stage === STAGE.pick ? DEMO_PICK : undefined}
                  play={inView}
                  quiet={front !== "chart"}
                  {...chart}
                />
              </Card>
            </div>
          </div>

          <div className="contents" onFocus={() => bring("chat")}>
            <Column
              {...columns[1]}
              as={columnTitle}
              className="lg:col-span-5 lg:col-start-7 lg:row-start-1"
            />
            <div
              ref={chatSlot}
              className={cn(
                SLOT,
                "lg:col-span-6 lg:col-start-7",
                front === "chat" ? "lg:z-2" : "lg:z-1"
              )}
              onPointerEnter={() => bring("chat")}
            >
              <Card
                className={FRAME}
                style={standing("chat", front === "chat")}
              >
                <SourceChat play={chatOn && chatSeen} {...chat} />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContextSection;
