"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { useState } from "react";

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
import { ICON, LineState, facing, onClock, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

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
 * One way: the resting pose is the empty month. Each play after the first
 * (`active` turning true, or `loop` after a 5.2s hold) pops a booked page
 * back on (260ms), waits (240ms), and tears it off again.
 * Reduced motion, or `active` false before any play: the empty month,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The torn page flies off and shrinks away in this long.
  fly: 420,
  // The pull before the page comes off.
  pull: 110,
  // Before a replay: a booked page pops back on in this long, then waits.
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
// down the page (see FRONT in iso-line). A part standing proud of the block is
// raised by that much, so on screen it sits where it touches.
const SINK = 1 / Math.sqrt(3);

// The two rings the pages hang on: either side of the middle, in front of
// the block and over its top edge. Flat faces: as solids this thin their
// caps drew two lines a pixel apart, and the block's top edges stopped
// short of their sides.
const RING = { depth: 0.3, h: 1, r: 0.17, up: 0.5, w: 0.34, x: 1.5 };
const RING_TOP = BLOCK_TOP + RING.up + RING.depth * SINK;

/* ───────────────────────────── Frame ──────────────────────────────────── */

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
      <FacePath
        at={[side * RING.x - RING.w / 2, RING.depth, RING_TOP]}
        d={roundedRect(RING.w, RING.h, RING.r)}
        key={side}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-surface-left)" }}
      />
    ))}
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/**
 * The torn page's flight, pull and size, re-rendered only when one changes.
 * Each clip starts from its own first frame: held at rest nothing was
 * drawn, so the first play must not show a frame of a clip that never ran.
 */
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
  const [tear, setTear] = useState(() => ({ clip, value: read(0) }));
  if (tear.clip !== clip) {
    setTear({ clip, value: read(0) });
  }
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    setTear((prev) =>
      prev.clip === clip && prev.value.join(",") === next.join(",")
        ? prev
        : { clip, value: next }
    );
  });
  return clock ? tear.value : [1, 0, 0];
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type CalendarProps = LineStateProps;

/**
 * Calendar: a complete nothing-scheduled state ("Nothing scheduled") with
 * a line illustration, a heading, a line of copy and a button, all props.
 * A tear-off calendar on two rings; its top page, a month with days
 * booked, is pulled, comes off and is thrown away, and the month under it
 * is empty but for today. One fine outline, near-white faces, no shadow,
 * facing the screen; today's square carries the brand, like the button
 * under it. It plays when it comes into view; pass `active` (PlayOnHover,
 * or your own state) to play it each time `active` turns true. Follows
 * the shadcn theme.
 */
export const Calendar = ({
  heading = "Nothing scheduled",
  description = "Your calendar is clear. Add an event to get started.",
  actionLabel = "New event",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: CalendarProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
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
      slot="calendar"
    >
      <Rig
        pivot={[0, 0, BLOCK.z]}
        {...onClock(clock, blockPose(clip), INTRO.end + 400)}
      >
        <Block />
        {fly > 0 ? null : torn}
        <Rings />
      </Rig>
      {fly > 0 ? torn : null}
    </LineState>
  );
};

export default Calendar;
