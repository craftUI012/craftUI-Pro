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
 * An all-clear state told by one object, in line: a clipboard with a
 * short checklist whose last box gets its tick. A fine outline,
 * near-white faces, that last tick the one brand mark, facing the screen,
 * no shadow. Under it, the state's own words: a heading, a line, a
 * button. Each value is ms after it comes into view.
 *
 *    0ms   two boxes ticked, the third empty
 *  400ms   the third box fills: it pops a little past its size (160ms)
 *          and settles (120ms); the board dips under it and comes back
 *  530ms   the tick is drawn in it (220ms)
 *  780ms   still: all three ticked
 *
 * A click (or `loop`, after a 5.2s hold) clears the third box and ticks
 * it again.
 * Reduced motion (or autoPlay off): all three ticked, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click: how long the third box takes to clear.
  clear: 240,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The box pops past its size in this long, then settles.
  pop: 160,
  // The box settles to its size.
  settle: 120,
  // The box fills this long after the clipboard comes into view.
  start: 400,
  // The tick starts this long after the fill, and takes this long.
  tick: [130, 220] as const,
};

/* How far things move. */
const MOVE = {
  // World units the board dips when the box fills.
  dip: 0.08,
  // How far past its size the filling box pops.
  over: 1.12,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The board: built facing +y, about a centre line at x = 0, and shown
// facing the screen.
const BOARD = { depth: 0.35, h: 6.6, r: 0.7, w: 5.6, z: 0.6 };
const BOARD_X = -BOARD.w / 2;
const BOARD_TOP = BOARD.z + BOARD.h;
const BOARD_AT: Vec3 = [BOARD_X, 0, BOARD_TOP];

// The sheet on it: how far in it sits from each edge of the board.
const SHEET = { bottom: 0.42, r: 0.3, side: 0.42, top: 0.95 };

// The checklist, on the board's face (u across, v down from its top
// edge): a box and a bar per row. The last row is the one that gets
// ticked in the story.
const LAST = { len: 2.1, v: 4.75 };
const ROWS = [{ len: 2.4, v: 2.15 }, { len: 1.7, v: 3.45 }, LAST] as const;
const BOX = { r: 0.2, size: 0.78, u: 1 };
const BAR = { h: 0.2, u: 2.2 };

type P2 = readonly [number, number];

// A tick inside a box, as shares of the box's size: down the short
// stroke, up the long one.
const TICK: readonly [P2, P2, P2] = [
  [0.24, 0.52],
  [0.42, 0.7],
  [0.76, 0.32],
];

// In the front view, one unit toward the viewer shows as 1/√3 of a unit
// down the page (see "The view"). A part standing proud of the board is
// raised by that much, so on screen it sits where it touches.
const SINK = 1 / Math.sqrt(3);

// The clip: a bar across the top of the board and a tab above it with a
// hole to hang it by, both standing proud of the board.
const CLIP = {
  bar: { h: 0.75, r: 0.22, w: 2.6 },
  depth: 0.3,
  hole: 0.15,
  over: 0.12,
  tab: { h: 0.55, r: 0.27, w: 1.15 },
};
const CLIP_LIFT = CLIP.depth * SINK;
const BAR_TOP = BOARD_TOP + CLIP.over + CLIP_LIFT;
const TAB_TOP = BAR_TOP + CLIP.tab.h;

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

// The frame fits the clipboard: as wide as the board, from its foot to
// the top of the clip's tab.
const EXTENT: Vec3[] = [
  [BOARD_X, 0, BOARD.z],
  [-BOARD_X, 0, BOARD.z],
  [BOARD_X, 0, TAB_TOP],
  [-BOARD_X, 0, TAB_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  dip: IsoTrack;
  end: number;
  // The filled box's size, as a share of the box (0 is empty).
  fill: IsoTrack;
  // How much of the tick is drawn, 0 to 1.
  tick: IsoTrack;
}

// The beat itself, starting `t0` ms into a run.
const beat = (t0: number): Clip => {
  const popped = t0 + TIMING.pop;
  const sat = popped + TIMING.settle;
  const drawn = t0 + TIMING.tick[0] + TIMING.tick[1];
  return {
    // The board under the fill: down, back past rest, and still.
    dip: [
      [t0 + 20, 0, EASE.in],
      [t0 + 100, -MOVE.dip, EASE.drop],
      [t0 + 250, MOVE.dip * 0.3, EASE.easy],
      [t0 + 380, 0],
    ],
    end: Math.max(drawn, t0 + 380),
    fill: [
      [t0, 0, EASE.soft],
      [popped, MOVE.over, EASE.easy],
      [sat, 1],
    ],
    tick: [
      [t0 + TIMING.tick[0], 0, EASE.easy],
      [drawn, 1],
    ],
  };
};

// The first run: the third box empty, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: the box clears first.
const NEXT = beat(TIMING.clear);
const AGAIN: Clip = {
  ...NEXT,
  fill: [[0, 1, EASE.in], [TIMING.clear - 80, 0, "hold"], ...NEXT.fill],
  tick: [[0, 1, EASE.in], [TIMING.clear - 140, 0, "hold"], ...NEXT.tick],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

const boardPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.dip, ms))] });

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

// A tick: the outline's own line at about twice its weight, round ended.
const MARK: CSSProperties = {
  ...LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: "calc(var(--iso-edge-w, 0.07) * 1.9)",
};

// A quarter circle as a cubic: the handle length for a unit radius.
const ARC = 0.5523;

/** A circle of radius `r` about (cx, cy), as a path. */
const circle = (cx: number, cy: number, r: number) => {
  const k = r * ARC;
  const p = (x: number, y: number) => `${r2(cx + x)} ${r2(cy + y)}`;
  return [
    `M${p(0, -r)}`,
    `C${p(k, -r)} ${p(r, -k)} ${p(r, 0)}`,
    `C${p(r, k)} ${p(k, r)} ${p(0, r)}`,
    `C${p(-k, r)} ${p(-r, k)} ${p(-r, 0)}`,
    `C${p(-r, -k)} ${p(-k, -r)} ${p(0, -r)}`,
    "Z",
  ].join(" ");
};

/**
 * A tick in the box of a row, drawn as far as `share` of its length: the
 * short stroke first, then the long one.
 */
const tickPath = (v: number, share: number) => {
  const at = ([x, y]: P2): P2 => [
    BOX.u + x * BOX.size,
    v - BOX.size / 2 + y * BOX.size,
  ];
  const [a, b, c] = TICK.map(at);
  const first = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const second = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const drawn = share * (first + second);
  const along = (from: P2, to: P2, t: number) =>
    `${r2(from[0] + (to[0] - from[0]) * t)} ${r2(from[1] + (to[1] - from[1]) * t)}`;
  if (drawn <= first) {
    return `M${along(a, a, 0)} L${along(a, b, drawn / first)}`;
  }
  return `M${along(a, a, 0)} L${along(b, b, 0)} L${along(b, c, (drawn - first) / second)}`;
};

/** The board, the sheet on it, and each row's box and bar. */
const Board = () => (
  <>
    <Extrude
      at={BOARD_AT}
      convex
      d={roundedRect(BOARD.w, BOARD.h, BOARD.r)}
      depth={BOARD.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={BOARD_AT}
      d={roundedRect(
        BOARD.w - SHEET.side * 2,
        BOARD.h - SHEET.top - SHEET.bottom,
        SHEET.r,
        SHEET.side,
        SHEET.top
      )}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-surface-top)" }}
    />
    <Face at={BOARD_AT} plane="left">
      <g fill="var(--iso-ink)" opacity={0.16}>
        {ROWS.map((row) => (
          <rect
            height={BAR.h}
            key={row.v}
            rx={BAR.h / 2}
            width={row.len}
            x={BAR.u}
            y={row.v - BAR.h / 2}
          />
        ))}
      </g>
    </Face>
    {ROWS.map((row) => (
      <FacePath
        at={BOARD_AT}
        d={roundedRect(BOX.size, BOX.size, BOX.r, BOX.u, row.v - BOX.size / 2)}
        key={row.v}
        plane="left"
        style={LINE}
      />
    ))}
    {/* The two rows done before the story starts: a quiet tick each. */}
    {ROWS.slice(0, -1).map((row) => (
      <FacePath
        at={BOARD_AT}
        d={tickPath(row.v, 1)}
        key={row.v}
        opacity={0.5}
        plane="left"
        style={{ ...MARK, stroke: "var(--iso-ink)" }}
      />
    ))}
  </>
);

/**
 * The last row's box as it fills and is ticked: the one brand mark.
 * `fill` is its size as a share of the box, `tick` how much of the tick
 * is drawn.
 */
const Done = ({ fill, tick }: { fill: number; tick: number }) => {
  const { v } = LAST;
  const size = BOX.size * fill;
  const x = BOX.u + (BOX.size - size) / 2;
  const y = v - size / 2;
  return (
    <>
      {fill > 0.03 ? (
        <FacePath
          at={BOARD_AT}
          d={roundedRect(r2(size), r2(size), r2(BOX.r * fill), r2(x), r2(y))}
          plane="left"
          style={{ ...LINE, fill: "var(--iso-main-left)" }}
        />
      ) : null}
      {tick > 0.03 ? (
        <FacePath
          at={BOARD_AT}
          d={tickPath(v, tick)}
          plane="left"
          style={{ ...MARK, stroke: "var(--iso-on-main)" }}
        />
      ) : null}
    </>
  );
};

/** The clip: its bar, then the tab above it and the hole in the tab. */
const Clip = () => (
  <>
    <Extrude
      at={[-CLIP.bar.w / 2, CLIP.depth, BAR_TOP]}
      convex
      d={roundedRect(CLIP.bar.w, CLIP.bar.h, CLIP.bar.r)}
      depth={CLIP.depth}
      palette="surface"
      plane="left"
    />
    <Extrude
      at={[-CLIP.tab.w / 2, CLIP.depth, TAB_TOP]}
      convex
      d={roundedRect(CLIP.tab.w, CLIP.tab.h, CLIP.tab.r)}
      depth={CLIP.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={[-CLIP.tab.w / 2, CLIP.depth, TAB_TOP]}
      d={circle(CLIP.tab.w / 2, CLIP.tab.h / 2, CLIP.hole)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-card)" }}
    />
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** The last box's fill and tick, re-rendered only when one changes. */
const useDone = (
  clock: MotionValue<number> | undefined,
  clip: Clip
): readonly [number, number] => {
  const idle = useMotionValue(0);
  const read = (ms: number): readonly [number, number] => [
    r2(sample(clip.fill, ms)),
    r2(sample(clip.tick, ms)),
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
  return clock ? value : [1, 1];
};

/** Rig props: animated on the clock, or the resting pose held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(INTRO.end));

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
  // Run 0 is the intro; every run after it starts from the last box ticked.
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
 * The state's own words, under the clipboard: the heading, a line of
 * copy, and the actions (the built-in button, or whatever is passed in).
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

export interface ClipboardProps {
  /** Heading under the clipboard, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the last ticked box; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The last box is ticked when the clipboard scrolls into view. Off shows all three ticked and nothing moving. */
  autoPlay?: boolean;
  /** Clear the last box and tick it again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the clipboard clears the last box and ticks it again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the clipboard is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-48`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Clipboard: a complete all-done state ("All tasks done") with a line
 * illustration, a heading, a line of copy and a button, all props. A
 * clipboard with a three-row checklist; two boxes are ticked already, the
 * third fills with the brand colour, pops and gets its tick while the
 * board dips under it. One fine outline, near-white faces, no shadow,
 * facing the screen; that last tick carries the brand, like the button
 * under it. Click the clipboard to play it again. Follows the shadcn
 * theme.
 */
export const Clipboard = ({
  heading = "All tasks done",
  description = "Nothing left on your list. New tasks will show up here.",
  actionLabel = "New task",
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
}: ClipboardProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const [fill, tick] = useDone(clock, clip);
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
        <Rig pivot={[0, 0, BOARD.z]} {...rigged(clock, boardPose(clip))}>
          <Board />
          <Done fill={fill} tick={tick} />
          <Clip />
        </Rig>
      </Rig>
    </IsoStage>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="clipboard"
    >
      <div
        className={cn("w-48 max-w-full", artClassName)}
        data-slot="clipboard-art"
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

export default Clipboard;
