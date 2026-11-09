"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  Dispatch,
  ElementType,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Word wheel. A headline that completes itself on a picker wheel: a lead
 * ("Built for") and a list of words rolling through the line beside it,
 * the active one bold with its neighbours faded above and below, like an
 * iOS picker, so a visitor sees the whole range at a glance.
 *
 * Centred (the default), the headline splits on the centre line: the lead
 * ends just left of it and the audiences start just right of it, so the
 * sentence stays on one line and the composition stays centred whatever
 * the active word's length. On phones it stacks: the lead on its own line,
 * the audiences centred under it. `align="start"` sets it flush left.
 *
 * Everything is sized in em from its own font size, so it takes the size
 * you give it (`className="text-7xl"`) and fits any hero, card or column;
 * it takes the page's colour too. A client component only for which
 * audience is active; every motion is CSS.
 *
 * ANIMATION STORYBOARD (one step, every `dwell` seconds)
 *
 *      0ms   every word rolls up one place (550ms, ease-in-out); the one
 *            reaching the middle row grows to full size and turns bold;
 *            the one leaving shrinks, thins and fades
 *
 * A word only wraps from one end of the list to the other while it's out
 * of view and fully transparent, so the loop has no seam; a short list is
 * repeated until that's true. It holds still while the pointer rests on
 * it, while it has focus, off screen and in a hidden tab; with `loops` it
 * settles on the first audience after that many rounds; with reduced
 * motion it doesn't roll on its own. Screen readers get it as a sentence:
 * the lead, then each audience.
 * ───────────────────────────────────────────────────────────────────────── */

/** Every beat's duration (ms). */
const TIMING = {
  /** The roll: words move one place and the new one comes forward. */
  step: 550,
} as const;

/** The curves, named; the CSS only refers to these. */
const EASE = {
  /** The roll: ease-in-out, so a step starts and lands softly. */
  roll: "cubic-bezier(0.645, 0.045, 0.355, 1)",
} as const;

const LOOK = {
  /** Opacity of the words two places from the middle (5 rows). */
  far: 0.12,
  /** Inactive words are drawn at this share of the active word's size. */
  inactiveScale: 0.9,
  /** Opacity of the words one place from the middle. */
  near: 0.3,
} as const;

/** Below this many audiences the list repeats, so no word wraps in sight. */
const MIN_ROWS = 6;

const CSS = `
.ww-row { translate: 0 calc(var(--row) * (var(--d) + var(--center))); transition: translate ${TIMING.step}ms ${EASE.roll}, opacity ${TIMING.step}ms ${EASE.roll}; }
.ww-row[data-near="1"] { opacity: ${LOOK.near}; }
.ww-row[data-near="2"] { opacity: ${LOOK.far}; }
.ww-row[data-near="far"] { opacity: 0; pointer-events: none; }
.ww-word { transform-origin: 0 50%; scale: ${LOOK.inactiveScale}; transition: scale ${TIMING.step}ms ${EASE.roll}; }
.ww-word:dir(rtl) { transform-origin: 100% 50%; }
.ww-row[data-near="0"] .ww-word { scale: 1; }
.ww-root[data-align="center"] .ww-row { justify-content: center; }
.ww-root[data-align="center"] .ww-word { transform-origin: 50% 50%; }
@media (min-width: 40rem) {
  .ww-root[data-align="center"][data-lead] .ww-row { justify-content: flex-start; }
  .ww-root[data-align="center"][data-lead] .ww-word { transform-origin: 0 50%; }
  .ww-root[data-align="center"][data-lead] .ww-word:dir(rtl) { transform-origin: 100% 50%; }
}
.ww-bold, .ww-regular { transition: opacity ${TIMING.step}ms ${EASE.roll}; }
.ww-bold, .ww-row[data-near="0"] .ww-regular { opacity: 0; }
.ww-row[data-near="0"] .ww-bold { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .ww-row, .ww-word, .ww-bold, .ww-regular { transition: none; }
}
`;

export interface WordWheelItem {
  /** The audience that completes the lead, e.g. "founders" for "Built for founders". Up to about 12 characters reads best. */
  label: string;
  /** Makes the audience a link, e.g. to its solutions page. Optional. */
  href?: string;
}

/** The demo audiences: who a website builder is for. Exported, so you
 * can start from them. */
export const wordWheelItems: WordWheelItem[] = [
  { label: "founders" },
  { label: "designers" },
  { label: "agencies" },
  { label: "startups" },
  { label: "enterprises" },
];

export interface WordWheelProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** Your audiences, in order; they loop. Four to eight read best. Defaults to `wordWheelItems`. */
  items?: WordWheelItem[];
  /** The words each audience completes, e.g. "Built for" or "The CRM for". Pass `null` for the audiences alone. Defaults to "Built for". */
  lead?: ReactNode;
  /** Rows in view: 3 (one audience above and below) or 5 (two each side). Defaults to 3. */
  rows?: 3 | 5;
  /** "center" splits the headline on the centre line (it stacks, centred, on phones); "start" sets it flush left. Defaults to "center". */
  align?: "start" | "center";
  /** Seconds each audience holds before the list rolls on. Defaults to 2. */
  dwell?: number;
  /** How many times it goes round before settling on the first audience; leave it out to keep rolling. Defaults to no limit. */
  loops?: number;
  /** Whether it rolls on its own when it comes into view. It never does with reduced motion. Defaults to `true`. */
  autoPlay?: boolean;
  /** The component used for linked audiences, for client-side routing: pass Next.js `Link`. Defaults to a plain `a`. */
  linkAs?: ElementType;
}

const distance = (index: number, active: number, n: number) => {
  const d = (((index - active) % n) + n) % n;
  return d >= n / 2 ? d - n : d;
};

const nearOf = (d: number) => {
  const a = Math.abs(d);
  return a <= 2 ? String(a) : "far";
};

const repeatToFill = (items: WordWheelItem[]) => {
  if (items.length === 0 || items.length >= MIN_ROWS) {
    return items;
  }
  const copies = Math.ceil(MIN_ROWS / items.length);
  return Array.from(
    { length: copies * items.length },
    (_, i) => items[i % items.length] as WordWheelItem
  );
};

/** Whether it's on screen, in a tab the visitor is looking at. */
const useOnScreen = (ref: RefObject<HTMLElement | null>) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let onScreen = false;
    const update = () => setVisible(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting);
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return visible;
};

/** Turns autoplay off while the visitor prefers reduced motion. */
const useReducedMotionStop = (
  setPlaying: Dispatch<SetStateAction<boolean>>
) => {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (query.matches) {
        setPlaying(false);
      }
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [setPlaying]);
};

/** The headline's layout classes. Centred, it splits on the centre line
 * from sm up (the lead ends just left of it, the audiences start just right
 * of it) and stacks, centred, on phones; flush left, the lead sits beside
 * the audiences from sm up. */
const layoutOf = (centred: boolean, hasLead: boolean) => {
  if (!centred) {
    return {
      grid: "inline-grid grid-cols-1 text-start sm:grid-cols-[auto_auto]",
      lead: "",
      list: "",
      root: "items-start",
    };
  }
  return {
    grid: cn("w-full grid-cols-1", hasLead && "sm:grid-cols-2"),
    lead: "sm:justify-end",
    list: cn("justify-self-center", hasLead && "sm:justify-self-start"),
    root: "w-full items-center text-center",
  };
};

/** One audience in the rolling list. Copies of a repeated short list are
 * hidden from screen readers and the Tab order; the sentence for screen
 * readers is the first copy of each. */
const Row = ({
  item,
  d,
  copy,
  Link,
  onFocus,
}: {
  item: WordWheelItem;
  d: number;
  copy: boolean;
  Link: ElementType;
  onFocus: () => void;
}) => {
  const Word = item.href ? Link : "span";
  return (
    <li
      aria-hidden={copy ? true : undefined}
      className="ww-row absolute inset-x-0 top-0 flex h-(--row) items-center"
      data-near={nearOf(d)}
      style={{ "--d": d } as CSSProperties}
    >
      <Word
        className="ww-word grid rounded-[0.1em] whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-current/40"
        href={item.href}
        onFocus={onFocus}
        tabIndex={copy && item.href ? -1 : undefined}
      >
        <span className="ww-regular col-start-1 row-start-1 font-medium">
          {item.label}
        </span>
        <span
          aria-hidden="true"
          className="ww-bold col-start-1 row-start-1 font-bold"
        >
          {item.label}
        </span>
      </Word>
    </li>
  );
};

const WordWheel = ({
  items = wordWheelItems,
  lead = "Built for",
  rows: rowCount = 3,
  align = "center",
  dwell = 2,
  loops,
  autoPlay = true,
  linkAs = "a",
  className,
  style,
  onFocus,
  onBlur,
  onPointerEnter,
  onPointerLeave,
  ...props
}: WordWheelProps) => {
  const count = items.length;
  const rows = useMemo(() => repeatToFill(items), [items]);
  const n = rows.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [steps, setSteps] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [resting, setResting] = useState(false);
  const visible = useOnScreen(rootRef);
  useReducedMotionStop(setPlaying);
  const seconds = Math.max(0.6, dwell);
  // With `loops`, it stops once it's back on the first audience.
  const done = loops !== undefined && steps >= loops * count;

  useEffect(() => {
    if (!playing || resting || !visible || done || n < 2) {
      return;
    }
    const id = window.setTimeout(() => {
      setActive((a) => (a + 1) % n);
      setSteps((s) => s + 1);
    }, seconds * 1000);
    return () => window.clearTimeout(id);
  }, [active, playing, resting, visible, done, n, seconds]);

  if (count === 0) {
    return null;
  }
  const hasLead = lead !== null && lead !== false;
  const layout = layoutOf(align === "center", hasLead);

  return (
    <div
      className={cn(
        "ww-root flex flex-col font-sans text-4xl leading-none font-semibold tracking-[-0.035em] sm:text-5xl lg:text-6xl",
        layout.root,
        className
      )}
      data-align={align}
      data-lead={hasLead ? "" : undefined}
      data-slot="word-wheel"
      onBlur={(event) => {
        setResting(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setResting(true);
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        setResting(event.pointerType === "mouse");
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        setResting(false);
        onPointerLeave?.(event);
      }}
      ref={rootRef}
      style={
        {
          "--center": (rowCount - 1) / 2,
          "--row": "1.25em",
          "--rows": rowCount,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      <style>{CSS}</style>
      <div className={cn("grid gap-x-[0.3em]", layout.grid)}>
        {hasLead ? (
          // On phones the lead takes its own line above the rolling words;
          // from sm it sits beside them on the middle row (centred: ending
          // just left of the centre line).
          <div
            className={cn(
              "mb-[0.12em] sm:mb-0 sm:flex sm:h-(--row) sm:translate-y-[calc(var(--row)*var(--center))] sm:items-center sm:whitespace-nowrap",
              layout.lead
            )}
          >
            {lead}
          </div>
        ) : null}
        <div
          className={cn(
            "relative h-[calc(var(--row)*var(--rows))] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_22%,#000_78%,transparent)]",
            layout.list
          )}
        >
          {/* Sizes the column to the longest audience, so nothing jumps. */}
          <span aria-hidden="true" className="invisible grid">
            {items.map((item) => (
              <span
                className="col-start-1 row-start-1 font-bold whitespace-nowrap"
                key={item.label}
              >
                {item.label}
              </span>
            ))}
          </span>
          <ul className="absolute inset-0">
            {rows.map((item, index) => (
              <Row
                copy={index >= count}
                d={distance(index, active, n)}
                item={item}
                // oxlint-disable-next-line react/no-array-index-key -- a repeated short list has the same item twice; the row's place is its identity
                key={index}
                Link={linkAs}
                onFocus={() => setActive(index)}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WordWheel;
