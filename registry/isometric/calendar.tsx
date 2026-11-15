"use client";

import { useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  Extrude,
  Face,
  FacePath,
  IsoStage,
  Rig,
  roundedRect,
  sample,
  useClock,
} from "./iso-core";
import type { IsoPose, IsoTone, IsoTrack, IsoVariant, Vec3 } from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object, in line: a tear-off calendar. Its
 * top page, a month with days booked, is torn away, and the month under
 * it has nothing on it but today. A fine outline, near-white faces,
 * today's square the one brand mark, facing the screen, no shadow. Under
 * it, the state's own words: a heading, a line, a button. Each value is
 * ms after it comes into view.
 *
 *    0ms   the booked month is on top
 *  400ms   the page is pulled: it jerks down a little (110ms)
 *  510ms   it comes off and is thrown up to the right, turning and
 *          shrinking to nothing (420ms); the block kicks up and settles
 *  930ms   still: an empty month, today marked
 *
 * A click (or `loop`, after a 5.2s hold) puts a booked page back and
 * tears it off again.
 * Reduced motion (or autoPlay off): the empty month, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The torn page flies off and shrinks away in this long.
  fly: 420,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The pull before the page comes off.
  pull: 110,
  // After a click: a booked page pops back on in this long, then waits.
  refill: [260, 240] as const,
  // The pull starts this long after the calendar comes into view.
  start: 400,
};

/* The torn page's flight. */
const MOVE = {
  // World units the block kicks up when the page comes off.
  kick: 0.07,
  // World units the pull drags the page down.
  pull: 0.14,
  // Degrees the page turns as it flies.
  turn: -26,
  // Where it flies to: across and up, in world units.
  x: 3.1,
  z: 2.7,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The block of pages: built facing +y, about a centre line at x = 0, and
// shown facing the screen.
const BLOCK = { depth: 0.5, h: 6, r: 0.55, w: 5.8, z: 0.6 };
const BLOCK_X = -BLOCK.w / 2;
const BLOCK_TOP = BLOCK.z + BLOCK.h;
const BLOCK_AT: Vec3 = [BLOCK_X, 0, BLOCK_TOP];
const PAGE_PATH = roundedRect(BLOCK.w, BLOCK.h, BLOCK.r);
// The middle of a page, which the torn one turns and shrinks about.
const PAGE_MID: Vec3 = [0, 0, BLOCK.z + BLOCK.h / 2];

// A page (u across, v down from its top edge): a band across the top for
// the month, then the days as a grid of squares.
const BAND = 1.3;
const GRID = {
  cell: 0.74,
  cols: 5,
  pitch: 0.965,
  r: 0.16,
  rows: 4,
  u: 0.6,
  v: 1.8,
};
// Today, on the month underneath; and the days booked on the page that
// is torn off. Each is [column, row].
const TODAY = [3, 1] as const;
const BOOKED: readonly (readonly [number, number])[] = [
  [1, 0],
  [4, 0],
  [0, 1],
  [2, 2],
  [3, 2],
  [1, 3],
];

// The band's outline: it follows the page's rounded top corners.
const BAND_PATH = [
  `M0 ${BAND}`,
  `V${BLOCK.r}`,
  `Q0 0 ${BLOCK.r} 0`,
  `H${BLOCK.w - BLOCK.r}`,
  `Q${BLOCK.w} 0 ${BLOCK.w} ${BLOCK.r}`,
  `V${BAND}`,
  "Z",
].join(" ");

// In the front view, one unit toward the viewer shows as 1/√3 of a unit
// down the page (see "The view"). A part standing proud of the block is
// raised by that much, so on screen it sits where it touches.
const SINK = 1 / Math.sqrt(3);

// The two rings the pages hang on: either side of the middle, standing
// proud of the block and over its top edge.
const RING = { depth: 0.3, h: 1, r: 0.17, up: 0.5, w: 0.34, x: 1.5 };
const RING_TOP = BLOCK_TOP + RING.up + RING.depth * SINK;

/* ───────────────────────────── The view ───────────────────────────────── */

/**
 * Facing the screen. The object is built facing +y, which the isometric
 * camera sees at an angle. The whole of it is turned 45° about the
 * vertical, so its front points straight at the viewer and its edges run
 * level and plumb; and it is stretched √(3/2) in height, because that
 * camera looks down from 35.26° and foreshortens heights by exactly that
 * much, so the front keeps its true proportions. It is still one exact
 * parallel projection of a solid: its thickness shows along its top edges.
 */
const FRONT = { stretch: Math.sqrt(1.5), turn: -45 };
const VIEW_POSE: IsoPose = {
  axis: "z",
  rotate: FRONT.turn,
  scale: [1, 1, FRONT.stretch],
};

/** Where a point of the object lands once it faces the screen. */
const facing = ([x, y, z]: Vec3): Vec3 => [
  (x + y) * Math.SQRT1_2,
  (y - x) * Math.SQRT1_2,
  z * FRONT.stretch,
];

// The frame fits the calendar: as wide as the block, from its foot to the
// top of the rings. The torn page flies out past it; that runs into the
// stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [BLOCK_X, 0, BLOCK.z],
  [-BLOCK_X, 0, BLOCK.z],
  [BLOCK_X, 0, RING_TOP],
  [-BLOCK_X, 0, RING_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  end: number;
  // How far along its flight the torn page is, 0 to 1.
  fly: IsoTrack;
  kick: IsoTrack;
  pull: IsoTrack;
  // The torn page's size, 1 on the block and 0 once it is gone.
  size: IsoTrack;
}

// The beat itself, starting `t0` ms into a run.
const beat = (t0: number): Clip => {
  const off = t0 + TIMING.pull;
  const gone = off + TIMING.fly;
  return {
    end: gone,
    fly: [
      [off, 0, EASE.easy],
      [gone, 1],
    ],
    // The block, freed of the pull: up, down past rest, and still.
    kick: [
      [off, 0, EASE.drop],
      [off + 90, MOVE.kick, EASE.in],
      [off + 200, 0, EASE.drop],
      [off + 270, MOVE.kick * 0.25, EASE.in],
      [off + 340, 0],
    ],
    pull: [
      [t0, 0, EASE.in],
      [off, MOVE.pull, EASE.drop],
      [off + 140, 0],
    ],
    // It keeps its size for most of the flight, then shrinks away fast.
    size: [
      [off, 1, EASE.in],
      [gone, 0],
    ],
  };
};

// The first run: the booked page on top, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: a booked page pops
// back on first.
const NEXT = beat(TIMING.refill[0] + TIMING.refill[1]);
const AGAIN: Clip = {
  ...NEXT,
  size: [[0, 0, EASE.soft], [TIMING.refill[0], 1, "hold"], ...NEXT.size],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The block, kicking up as the page comes off it. */
const blockPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.kick, ms))] });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

const cellAt = (col: number, row: number) =>
  [GRID.u + col * GRID.pitch, GRID.v + row * GRID.pitch] as const;

const isBooked = (col: number, row: number) =>
  BOOKED.some(([c, r]) => c === col && r === row);

// Every day on a page, by column and row.
const DAYS = Array.from({ length: GRID.cols * GRID.rows }, (_, i) => ({
  col: i % GRID.cols,
  row: Math.floor(i / GRID.cols),
}));

/**
 * What is printed on a page: the month's band, and the days. On the
 * booked page the booked days are darker; on the page underneath every
 * day is empty and today is the one brand mark.
 */
const Printed = ({ booked }: { booked: boolean }) => {
  const [todayU, todayV] = cellAt(TODAY[0], TODAY[1]);
  return (
    <>
      <FacePath
        at={BLOCK_AT}
        d={BAND_PATH}
        opacity={0.1}
        plane="left"
        style={{ fill: "var(--iso-ink)", stroke: "none" }}
      />
      <FacePath
        at={BLOCK_AT}
        d={`M0 ${BAND} H${BLOCK.w}`}
        plane="left"
        style={LINE}
      />
      <Face at={BLOCK_AT} plane="left">
        {DAYS.map(({ col, row }) => {
          const [u, v] = cellAt(col, row);
          return (
            <rect
              fill="var(--iso-ink)"
              height={GRID.cell}
              key={`${col}-${row}`}
              opacity={booked && isBooked(col, row) ? 0.42 : 0.12}
              rx={GRID.r}
              width={GRID.cell}
              x={r2(u)}
              y={r2(v)}
            />
          );
        })}
      </Face>
      {booked ? null : (
        <FacePath
          at={BLOCK_AT}
          d={roundedRect(GRID.cell, GRID.cell, GRID.r, r2(todayU), r2(todayV))}
          plane="left"
          style={{ ...LINE, fill: "var(--iso-main-left)" }}
        />
      )}
    </>
  );
};

/** The block of pages, with the empty month on its face. */
const Block = () => (
  <>
    <Extrude
      at={BLOCK_AT}
      convex
      d={PAGE_PATH}
      depth={BLOCK.depth}
      palette="surface"
      plane="left"
    />
    <Printed booked={false} />
  </>
);

/** The booked page that is torn off. Paper is a face, not a solid. */
const TornPage = () => (
  <>
    <FacePath
      at={BLOCK_AT}
      d={PAGE_PATH}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-surface-left)" }}
    />
    <Printed booked />
  </>
);

/** The two rings. */
const Rings = () => (
  <>
    {[-1, 1].map((side) => (
      <Extrude
        at={[side * RING.x - RING.w / 2, RING.depth, RING_TOP]}
        convex
        d={roundedRect(RING.w, RING.h, RING.r)}
        depth={RING.depth}
        key={side}
        palette="surface"
        plane="left"
      />
    ))}
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** The torn page's flight, pull and size, re-rendered only when one changes. */
const useTear = (
  clock: MotionValue<number> | undefined,
  clip: Clip
): readonly [number, number, number] => {
  const idle = useMotionValue(0);
  const read = (ms: number): readonly [number, number, number] => [
    r2(sample(clip.fly, ms)),
    r2(sample(clip.pull, ms)),
    r2(sample(clip.size, ms)),
  ];
  const [value, setValue] = useState(() => read(0));
  const last = useRef(value.join(","));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next.join(",") !== last.current) {
      last.current = next.join(",");
      setValue(next);
    }
  });
  return clock ? value : [1, 0, 0];
};

/** Rig props: animated on the clock, or the resting pose held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(INTRO.end + 400));

/* ───────────────────────────── Shell ──────────────────────────────────── */

// Whether the visitor asked for less motion. It is read through a store
// and not in the first render: the server cannot know it, so the first
// render in the browser has to answer "no" as the server did, and switch
// once the page has taken over. Reading it straight away makes the two
// disagree, and React reports a failed hydration.
const REDUCE = "(prefers-reduced-motion: reduce)";
const watchReduce = (notify: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const useReduced = () =>
  useSyncExternalStore(
    watchReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false
  );

/** In view, reduced motion, the clock and its clip, and the replay. */
const useShell = ({
  autoPlay,
  loop,
  replayOnClick,
}: {
  autoPlay: boolean;
  loop: boolean;
  replayOnClick: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReduced();
  const still = reduced || !autoPlay;
  // Run 0 is the intro; every run after it starts from the empty month.
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const clip = run === 0 ? INTRO : AGAIN;
  // One new run per finished run, however many frames or clicks ask.
  const asked = useRef(-1);
  const again = () => {
    if (asked.current !== run) {
      asked.current = run;
      setRun((n) => n + 1);
    }
  };
  useMotionValueEvent(clock, "change", (ms) => {
    if (loop && !still && ms >= clip.end + TIMING.hold) {
      again();
    }
  });
  const canReplay = replayOnClick && !still;
  const replay = () => {
    if (canReplay && clock.get() >= clip.end) {
      again();
    }
  };
  return { canReplay, clip, clock: still ? undefined : clock, ref, replay };
};

// In ink the walls step down half as far as the house ramp (0.03 and 0.07
// under the top, not 0.06 and 0.13): a blocked state is a quiet line
// drawing on the page, with only a whisper of form.
const PAPER: Record<string, string> = {
  "--iso-surface-left-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.03) c h)",
  "--iso-surface-right-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.07) c h)",
};

// The blueprint (`line`) drawn at this size: its outline held at the same
// pixel weight as ink instead of a canvas-unit one, which would be three
// times too heavy on a stage this small. Faces stay the page's colour.
const BLUEPRINT: Record<string, string> = {
  "--iso-edge-w": "calc(var(--iso-stroke-width) * 4.33px)",
  "--iso-vector": "non-scaling-stroke",
};

// The engine's rim highlight has no width in the outlined variants, yet it
// still paints a pale hairline over the front outline of every extrusion
// (seen at 4× in Chromium). Clear its colour so the outline keeps its
// full weight.
const NO_RIM: Record<string, string> = {
  "--iso-accent-rim": "transparent",
  "--iso-main-rim": "transparent",
  "--iso-surface-rim": "transparent",
};

/**
 * Stage overrides: no hairline contour (every edge already carries the
 * outline), the paper walls in ink, the pixel outline in the blueprint,
 * and the outline on the side edges of rounded parts.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* ───────────────────────────── Copy ───────────────────────────────────── */

// Optical padding: an icon carries its own white space, so the label's
// side gets 2px more than the icon's side (12px and 14px) or the label
// looks pushed against the edge. The second class wins over a Button that
// already nudges this side itself.
const BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/** The plus on the button. */
const PlusIcon = () => (
  <svg
    aria-hidden="true"
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The state's own words, under the calendar: the heading, a line of copy,
 * and the actions (the built-in button, or whatever is passed in).
 */
const Copy = ({
  heading,
  description,
  actionLabel,
  onAction,
  children,
}: {
  heading: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  children?: ReactNode;
}) => {
  const button = actionLabel ? (
    <Button className={BUTTON} onClick={onAction}>
      <PlusIcon />
      {actionLabel}
    </Button>
  ) : null;
  const actions = children ?? button;
  return (
    <>
      {heading ? (
        <p className="mt-3 text-xl font-medium tracking-tight text-foreground">
          {heading}
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-balance text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="mt-6">{actions}</div> : null}
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface CalendarProps {
  /** Heading under the calendar, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on today's square; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The booked page is torn off when the calendar scrolls into view. Off shows the empty month and nothing moving. */
  autoPlay?: boolean;
  /** Put a booked page back and tear it off again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the calendar puts a booked page back and tears it off again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the calendar is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-48`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Calendar: a complete nothing-scheduled state ("Nothing scheduled") with
 * a line illustration, a heading, a line of copy and a button, all props.
 * A tear-off calendar on two rings; its top page, a month with days
 * booked, is pulled, comes off and is thrown away, and the month under it
 * is empty but for today. One fine outline, near-white faces, no shadow,
 * facing the screen; today's square carries the brand, like the button
 * under it. Click the calendar to play it again. Follows the shadcn
 * theme.
 */
export const Calendar = ({
  heading = "Nothing scheduled",
  description = "Your calendar is clear. Add an event to get started.",
  actionLabel = "New event",
  onAction,
  children,
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  autoPlay = true,
  loop = false,
  replayOnClick = true,
  title,
  artClassName,
  className,
}: CalendarProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const [fly, pull, size] = useTear(clock, clip);
  // On the block the page hangs behind the rings; once it is off, it is
  // in front of them.
  const torn =
    size > 0.03 ? (
      <Rig
        axis="y"
        offset={[r2(MOVE.x * fly), 0, r2(MOVE.z * fly - pull)]}
        pivot={PAGE_MID}
        rotate={r2(MOVE.turn * fly)}
        scale={size}
      >
        <TornPage />
      </Rig>
    ) : null;
  const art = (
    <IsoStage
      bounds={BOUNDS}
      shadow={false}
      strokeWidth={strokeWidth}
      style={stageStyle(variant)}
      title={title}
      tone={tone}
      variant={variant}
    >
      {/* Everything stands in one rig that turns it to face the screen. */}
      <Rig pivot={[0, 0, 0]} {...VIEW_POSE}>
        <Rig pivot={[0, 0, BLOCK.z]} {...rigged(clock, blockPose(clip))}>
          <Block />
          {fly > 0 ? null : torn}
          <Rings />
        </Rig>
        {fly > 0 ? torn : null}
      </Rig>
    </IsoStage>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="calendar"
    >
      <div
        className={cn("w-48 max-w-full", artClassName)}
        data-slot="calendar-art"
        ref={ref}
      >
        {canReplay ? (
          <button
            aria-label={`${title ?? "Illustration"}. Press to play it again.`}
            className="block w-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={replay}
            type="button"
          >
            {art}
          </button>
        ) : (
          art
        )}
      </div>
      <Copy
        actionLabel={actionLabel}
        description={description}
        heading={heading}
        onAction={onAction}
      >
        {children}
      </Copy>
    </div>
  );
};

export default Calendar;
