"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";

import {
  EASE,
  Extrude,
  Face,
  FacePath,
  Rig,
  roundedRect,
  sample,
} from "./iso-core";
import type { IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
  ICON,
  LINE,
  LineState,
  facing,
  onClock,
  r2,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An all-clear state told by one object, in line: a clipboard with a
 * short checklist whose last box gets its tick. A fine outline,
 * near-white faces, that last tick the one brand mark, facing the screen,
 * no shadow. Under it, the state's own words: a heading, a line, a
 * button. Each value is ms after the art comes into view.
 *
 *    0ms   two boxes ticked, the third empty
 *  400ms   the third box fills: it pops a little past its size (160ms)
 *          and settles (120ms); the board dips under it and comes back
 *  530ms   the tick is drawn in it (220ms)
 *  780ms   still: all three ticked
 *
 * One way (it ends ticked), so `again` first clears the third box (240ms)
 * and then ticks it; it plays each time `active` turns true (or with
 * `loop`, after a 5.2s hold).
 * Reduced motion, or `active` false before any play: all three ticked,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true: how long the third box takes to clear.
  clear: 240,
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

const boardPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.dip, ms))] });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// A tick: the outline's own line at about twice its weight, round ended.
const MARK: CSSProperties = {
  ...LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: "calc(var(--iso-edge-w, 0.07) * 1.9)",
};

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

/**
 * The last box's fill and tick, re-rendered only when one changes. Read
 * from the clock at render, so the first play under `active` (straight
 * from the held, all-ticked pose) never shows a frame of the empty box.
 */
const useDone = (
  clock: MotionValue<number> | undefined,
  clip: Clip
): readonly [number, number] => {
  const idle = useMotionValue(0);
  const read = (ms: number): readonly [number, number] => [
    r2(sample(clip.fill, ms)),
    r2(sample(clip.tick, ms)),
  ];
  const [, setShown] = useState("");
  const last = useRef("");
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms).join(",");
    if (next !== last.current) {
      last.current = next;
      setShown(next);
    }
  });
  return clock ? read(clock.get()) : [1, 1];
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type ClipboardProps = LineStateProps;

/**
 * Clipboard: a complete all-done state ("All tasks done") with a line
 * illustration, a heading, a line of copy and a button, all props. A
 * clipboard with a three-row checklist; two boxes are ticked already, the
 * third fills with the brand colour, pops and gets its tick while the
 * board dips under it. One fine outline, near-white faces, no shadow,
 * facing the screen; that last tick carries the brand, like the button
 * under it. It plays when it comes into view, or each time `active`
 * turns true (PlayOnHover, or your own state): the last box clears and
 * is ticked again. Follows the shadcn theme.
 */
export const Clipboard = ({
  heading = "All tasks done",
  description = "Nothing left on your list. New tasks will show up here.",
  actionLabel = "New task",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ClipboardProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const [fill, tick] = useDone(clock, clip);
  return (
    <LineState
      bounds={BOUNDS}
      icon={ICON.plus}
      props={{
        actionLabel,
        description,
        heading,
        strokeWidth,
        tone,
        variant,
        ...rest,
      }}
      shell={shell}
      slot="clipboard"
    >
      <Rig
        pivot={[0, 0, BOARD.z]}
        {...onClock(clock, boardPose(clip), clip.end)}
      >
        <Board />
        <Done fill={fill} tick={tick} />
        <Clip />
      </Rig>
    </LineState>
  );
};

export default Clipboard;
