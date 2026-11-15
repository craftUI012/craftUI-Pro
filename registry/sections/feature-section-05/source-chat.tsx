"use client";

import {
  ArrowRight01Icon,
  Folder01Icon,
  NotionIcon,
  SlackIcon,
  StripeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Source chat. One question and its answer in two lines: what happened,
 * then who changed which file. Under them, the sources the answer read.
 *
 * ANIMATION STORYBOARD
 *
 * Read top to bottom. Each value is ms after `play` turns true.
 *
 *  before   the question is already asked, waiting; the window is at its
 *           full height
 *  400ms   "Reading 4 sources" shimmers where the answer will be
 * 1500ms   the answer replaces it
 * 2100ms   the second line rises in under it
 * 2600ms   the sources rise in (staggered 100ms)
 *
 * A piece arrives the same way each time: it fades in, rises 12px and
 * comes into focus from a 4px blur, over 300ms. Every piece keeps its
 * place from the start, so the window never changes size. With reduced
 * motion the whole conversation fades in at once, and nothing moves.
 * ───────────────────────────────────────────────────────────────────────── */

const TIMING = {
  /** The answer replaces the shimmer. */
  answer: 1500,
  /** The answer's second line rises in. */
  note: 2100,
  /** The sources start staggering in. */
  sources: 2600,
  /** The shimmer starts. */
  thinking: 400,
};

/** The stages, in order: each one adds to the last. */
const STAGE = {
  answer: 3,
  note: 4,
  question: 1,
  sources: 5,
  thinking: 2,
} as const;

/** The sources' stagger, in ms. */
const STAGGER = 100;

/**
 * The chat's text: the question, the answer and its second line. No lone
 * word on a last line, and a word too long for a line (a deep file path)
 * breaks instead of running out of the window.
 */
const TEXT = "text-sm font-normal text-pretty wrap-break-word";

/**
 * The answer's line height, 22px at 14px: it runs to five lines on a phone.
 * It goes after TEXT wherever the two meet, since a text size resets the
 * line height before it.
 */
const PROSE = "leading-[calc(22/14)]";

/**
 * A source chip, 24px tall: 3px of padding round an 18px icon tile, and a
 * little more on the text side so the two edges look even. The tile's
 * corner is the chip's corner less that padding, so the curves run parallel.
 */
const CHIP =
  "bg-muted text-foreground justify-start gap-1.5 rounded-[0.4375rem] border-0 px-0 py-[0.1875rem] pr-2 pl-[0.1875rem] text-[0.8125rem] leading-[calc(18/13)] font-normal w-auto sm:w-fit forced-colors:border";
const TILE = "bg-card grid size-4.5 place-items-center rounded-[0.25rem]";

/**
 * How a piece arrives: a fade, a 12px rise and a 4px blur clearing. The
 * rise and the blur are only for people who take motion; the fade stays.
 */
const RISE = "transition-[opacity,translate,filter] duration-300 ease-out";
const HIDDEN = "opacity-0 motion-safe:translate-y-3 motion-safe:blur-xs";

const CSS = `
@keyframes ctx-shimmer { from { background-position: 100% 0 } to { background-position: -100% 0 } }
.ctx-shimmer { background: linear-gradient(90deg, var(--muted-foreground) 40%, var(--foreground) 50%, var(--muted-foreground) 60%) 0 0 / 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ctx-shimmer 1.8s linear infinite; }
@media (prefers-reduced-motion: reduce) { .ctx-shimmer { animation: none; color: var(--muted-foreground); background: none; } }
`;

/** Something the answer read. */
export interface ChatSource {
  /** The source's name, shown on its chip. */
  name: string;
  /** Its icon: any icon from the Hugeicons core-free-icons package. */
  icon: IconSvgElement;
}

export interface SourceChatProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** The breadcrumb: where the chat lives, then its name. */
  crumbs?: [string, string];
  /** What the visitor asked, in the bubble on the right. */
  question?: string;
  /** The assistant's answer. */
  answer?: string;
  /** The answer's second line: who changed which file. */
  note?: string;
  /** The file that line names. Where it appears in `note` it is set apart
   * in the accent colour. */
  file?: string;
  /** What the answer read, as a row of chips under it. */
  sources?: ChatSource[];
  /** Starts the conversation. Flip it to true when the chat is in view. */
  play?: boolean;
}

export const DEMO_SOURCES: ChatSource[] = [
  { icon: SlackIcon, name: "Slack" },
  { icon: NotionIcon, name: "Notion" },
  { icon: StripeIcon, name: "Stripe" },
  { icon: Folder01Icon, name: "Files" },
];

/** The assistant's mark: a four-point spark. */
const Spark = () => (
  <svg aria-hidden className="size-3.5" fill="currentColor" viewBox="0 0 16 16">
    <path d="M8 1c.5 3.6 2.4 5.5 6 6v2c-3.6.5-5.5 2.4-6 6H8c-.5-3.6-2.4-5.5-6-6V7c3.6-.5 5.5-2.4 6-6Z" />
  </svg>
);

/** Runs the storyboard: one stage number, set by timers read from TIMING. */
const useStage = (play: boolean) => {
  const reduce = useReducedMotion();
  // The question is there from the start: the window waits on it.
  const [stage, setStage] = useState<number>(STAGE.question);
  useEffect(() => {
    if (!play) {
      return;
    }
    if (reduce) {
      setStage(STAGE.sources);
      return;
    }
    const timers = [
      setTimeout(() => setStage(STAGE.thinking), TIMING.thinking),
      setTimeout(() => setStage(STAGE.answer), TIMING.answer),
      setTimeout(() => setStage(STAGE.note), TIMING.note),
      setTimeout(() => setStage(STAGE.sources), TIMING.sources),
    ];
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [play, reduce]);
  return stage;
};

/**
 * The accent for the file's name. The theme's primary; on a dark ground it
 * is mixed toward white, since a deep primary is too dim there for text.
 */
const MARK =
  "text-primary dark:text-[color-mix(in_oklab,var(--primary)_60%,white)]";

/** A line of text with one phrase in it (the first match) set apart. */
const Marked = ({ mark, text }: { mark: string; text: string }) => {
  const at = mark ? text.indexOf(mark) : -1;
  if (at === -1) {
    return text;
  }
  return (
    <>
      {text.slice(0, at)}
      <span className={MARK}>{mark}</span>
      {text.slice(at + mark.length)}
    </>
  );
};

/** The sources the answer read, as a row of chips. */
const Sources = ({
  sources,
  stage,
}: {
  sources: ChatSource[];
  stage: number;
}) => (
  // No visible label: the chips say what they are. The list keeps a name
  // for screen readers.
  // On a phone the row is too short for four chips and would leave one
  // alone on a second line, so there they sit in two columns.
  <ul
    aria-label="Sources"
    className="mt-4 grid w-fit grid-cols-[auto_auto] gap-1.5 sm:flex sm:w-auto sm:flex-wrap"
    // Safari drops the list role from a list with no markers.
    role="list"
  >
    {sources.map((source, i) => (
      <Badge
        key={source.name}
        asChild
        className={cn(CHIP, RISE, stage < STAGE.sources && HIDDEN)}
        variant="secondary"
      >
        <li
          style={{
            transitionDelay:
              stage === STAGE.sources ? `${i * STAGGER}ms` : undefined,
          }}
        >
          <span className={TILE}>
            <HugeiconsIcon
              absoluteStrokeWidth
              aria-hidden
              icon={source.icon}
              size={12}
              strokeWidth={1}
            />
          </span>
          {source.name}
        </li>
      </Badge>
    ))}
  </ul>
);

export const SourceChat = ({
  // The no-break spaces keep "30 days" and "9 June" whole on a narrow line.
  answer = "The refund window went from 14 to 30\u00A0days on 9\u00A0June, so older orders now qualify. Product returns are flat over the same months.",
  className,
  crumbs = ["Chat", "Refund review"],
  file = "/policies/refunds.md",
  note = "Support ops made that change in /policies/refunds.md.",
  play = true,
  question = "Why are refunds up since June?",
  sources = DEMO_SOURCES,
  ...props
}: SourceChatProps) => {
  const stage = useStage(play);
  return (
    <div
      data-slot="source-chat"
      className={cn("flex w-full flex-col", className)}
      {...props}
    >
      <style>{CSS}</style>
      {/* The same size, weight and offset as the chart's title, so the two
          windows' first lines sit level. */}
      <div className="flex items-center gap-1.5 px-5 pt-5.5 pb-1.5 text-base font-normal">
        <span>{crumbs[0]}</span>
        <HugeiconsIcon
          absoluteStrokeWidth
          aria-hidden
          className="text-muted-foreground rtl:-scale-x-100"
          icon={ArrowRight01Icon}
          size={16}
          strokeWidth={1.5}
        />
        <span className="min-w-0 truncate">{crumbs[1]}</span>
      </div>

      <div className="flex flex-1 flex-col gap-6 px-5 pt-7 pb-6">
        {/* The bubble is as wide as its text allows, so its wrapping is
            the plain kind: the first line runs full and the bubble hugs
            it. Evening the lines out would leave the bubble wider than
            anything in it. */}
        <p
          className={cn(
            "bg-muted self-end rounded-lg px-3.5 py-2.5 forced-colors:border sm:max-w-[85%]",
            TEXT,
            "text-wrap",
            RISE,
            stage < STAGE.question && HIDDEN
          )}
        >
          <span className="sr-only">Question: </span>
          {question}
        </p>

        {/* On a phone the mark sits above the answer, not beside it: the
            40px it would take is a sixth of the line. */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <span
            className={cn(
              "bg-foreground text-background grid size-7 shrink-0 place-items-center rounded-lg",
              RISE,
              stage < STAGE.thinking && HIDDEN
            )}
          >
            <Spark />
          </span>
          {/* Capped near 70 characters a line: on a tablet the window is
              wide enough for 80. */}
          <div className="min-w-0 flex-1 sm:max-w-[29rem]">
            {/* The shimmer and the answer share one cell: the answer holds
                the height from the start, so nothing below it moves. */}
            <div className="grid">
              <p
                aria-hidden
                className={cn(
                  "ctx-shimmer col-start-1 row-start-1 w-fit text-sm font-normal transition-opacity duration-200 sm:pt-[0.1875rem]",
                  PROSE,
                  stage !== STAGE.thinking && "opacity-0"
                )}
              >
                Reading {sources.length} sources
              </p>
              <p
                className={cn(
                  "col-start-1 row-start-1 sm:pt-[0.1875rem]",
                  TEXT,
                  PROSE,
                  RISE,
                  stage < STAGE.answer && HIDDEN
                )}
              >
                <span className="sr-only">Answer: </span>
                {answer}
              </p>
            </div>
            <p
              className={cn(
                "mt-2.5",
                TEXT,
                PROSE,
                RISE,
                stage < STAGE.note && HIDDEN
              )}
            >
              <Marked mark={file} text={note} />
            </p>
            <Sources sources={sources} stage={stage} />
          </div>
        </div>
      </div>
    </div>
  );
};
