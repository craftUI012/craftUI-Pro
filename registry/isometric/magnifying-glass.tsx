"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { useId, useState } from "react";

import {
  EASE,
  Extrude,
  Face,
  FacePath,
  Rig,
  roundedRect,
  sample,
} from "./iso-core";
import type { IsoTrack, Vec3 } from "./iso-core";
import { LineState, facing, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A nothing-found state told by one object, in line: a magnifying glass
 * that looks over a card of rows and comes to rest. Whatever is under the
 * glass shows enlarged. A fine outline, near-white faces, the collar of
 * the handle the one brand mark, facing the screen, no shadow. Under it,
 * the state's own words: a heading, a line, a button. Each value is ms
 * after it comes into view.
 *
 *    0ms   the glass rests over the left of the first row
 *  400ms   it sweeps along the first row (520ms)
 *  920ms   it comes back across and down to the second (440ms)
 * 1360ms   it sweeps out to the right of the third and stops (500ms)
 * 1860ms   still: the glass at the lower right, its handle off the card
 *
 * One way: the resting pose is the glass at the lower right. Each play
 * after the first (`active` turning true, or `loop` after a 5.2s hold)
 * takes it back to the first row (380ms) and looks again.
 * Reduced motion, or `active` false before any play: the glass at rest,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // Before a replay: how long the trip back to the first row takes.
  back: 380,
  // The search starts this long after the card comes into view.
  start: 400,
  // Milliseconds for each of the three sweeps.
  sweep: [520, 440, 500] as const,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The card: built facing +y, about a centre line at x = 0, and shown
// facing the screen. It is a flat face: a thin depth showed as a strip
// whose two edges ran a pixel apart round its rounded corners.
const CARD = { h: 5.2, r: 0.7, w: 6.4, z: 1.5 };
const CARD_X = -CARD.w / 2;
const CARD_TOP = CARD.z + CARD.h;
const CARD_AT: Vec3 = [CARD_X, 0, CARD_TOP];

// The rows on it (u across, v down from its top edge): a square and two
// bars each, as a list of results is laid out.
const ROWS = [1.25, 2.6, 3.95] as const;
const THUMB = { r: 0.22, size: 0.9, u: 0.75 };
const BAR = { h: 0.2, u: 2.05 };
const BARS = [
  { dv: -0.21, len: 3.1 },
  { dv: 0.22, len: 2 },
] as const;

/** Everything drawn on the card, as rounded rectangles. */
interface Mark {
  h: number;
  rx: number;
  w: number;
  x: number;
  y: number;
}
const MARKS: Mark[] = ROWS.flatMap((v) => [
  {
    h: THUMB.size,
    rx: THUMB.r,
    w: THUMB.size,
    x: THUMB.u,
    y: v - THUMB.size / 2,
  },
  ...BARS.map(({ dv, len }) => ({
    h: BAR.h,
    rx: BAR.h / 2,
    w: len,
    x: BAR.u,
    y: v + dv - BAR.h / 2,
  })),
]);

// In the front view, one unit toward the viewer shows as 1/√3 of a unit
// down the page (see FRONT in iso-line).
const SINK = 1 / Math.sqrt(3);

// The glass: a ring held in front of the card (`y`), its outer radius,
// the width of its band, and how much what is under it is enlarged. The
// ring is a flat face: front-on, a ring's depth shows as a strip that
// tapers to nothing down both its sides, two outlines a pixel apart.
const GLASS = { band: 0.3, r: 1.45, y: 0.55, zoom: 1.5 };
const HOLE = GLASS.r - GLASS.band;

// The handle, built pointing along +x from the ring and turned down to
// the right: a collar where it meets the ring, then the grip. Straight,
// so it keeps a depth, deep enough that its strip reads as a face; its
// front is level with the ring and it runs back behind it. The collar is
// as wide as the grip, one line down each side: a collar a little wider
// drew its edges a pixel or two beside the grip's.
const HANDLE = {
  angle: 45,
  collar: { len: 0.6, w: 0.62 },
  depth: 0.5,
  grip: { len: 2, w: 0.62 },
  tuck: 0.12,
};
const HANDLE_Y = GLASS.y;

type P2 = readonly [number, number];

// Where the glass looks, as the place its middle shows on the card (u, v):
// the left of the first row, its right, the left of the second, and its
// resting place at the lower right. The ring never leaves the card; only
// the handle does.
const REST: P2 = [4.3, 3.3];
const STOPS: readonly P2[] = [[1.9, 1.95], [4.4, 1.95], [2.2, 3.2], REST];

/**
 * The ring's middle in the world, for the place it shows on the card. It
 * hangs in front of the card, and a point nearer the viewer shows lower
 * on the page, so it is raised by that much to show where it should.
 */
const glassAt = ([u, v]: P2): Vec3 => [
  CARD_X + u,
  GLASS.y,
  CARD_TOP - v + GLASS.y * SINK,
];

/* ───────────────────────────── Frame ──────────────────────────────────── */

// The frame is centred on the card, the mass the eye lines up with the
// heading under it: as wide as the card, from the foot of the resting
// handle to the card's top. The handle overhangs on the right; that runs
// into the stage's padding, which is not clipped.
const HANDLE_REACH =
  (GLASS.r + HANDLE.collar.len + HANDLE.grip.len + HANDLE.grip.w / 2) *
  Math.SQRT1_2;
const FOOT = CARD_TOP - REST[1] - HANDLE_REACH;
const EXTENT: Vec3[] = [
  [CARD_X, 0, FOOT],
  [-CARD_X, 0, FOOT],
  [CARD_X, 0, CARD_TOP],
  [-CARD_X, 0, CARD_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: where the glass looks, and when it is at rest. */
interface Clip {
  end: number;
  u: IsoTrack;
  v: IsoTrack;
}

// The beat itself, starting `t0` ms into a run: three sweeps from stop to
// stop, each easing away and easing in.
const beat = (t0: number): Clip => {
  let t = t0;
  const times = [
    t0,
    ...TIMING.sweep.map((ms) => {
      t += ms;
      return t;
    }),
  ];
  const track = (i: 0 | 1): IsoTrack =>
    STOPS.map((stop, n) => [times[n], stop[i], EASE.easy] as const);
  return { end: t, u: track(0), v: track(1) };
};

// The first run: the glass waits over the first row, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: the glass goes back to
// the first row, then the beat again.
const NEXT = beat(TIMING.back);
const AGAIN: Clip = {
  ...NEXT,
  u: [[0, REST[0], EASE.easy], ...NEXT.u],
  v: [[0, REST[1], EASE.easy], ...NEXT.v],
};

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

// The ring's outline in its own box (the box's corner at the origin): the
// outer circle and the hole.
const RING_HOLE = circle(GLASS.r, GLASS.r, HOLE);
const RING = `${circle(GLASS.r, GLASS.r, GLASS.r)} ${RING_HOLE}`;

// A flat face: paper, edged with the one outline.
const FILL: CSSProperties = { ...LINE, fill: "var(--iso-surface-left)" };

const MARK_FILL = { fill: "var(--iso-ink)", opacity: 0.16 };

const Marks = ({ marks }: { marks: readonly Mark[] }) => (
  <g {...MARK_FILL}>
    {marks.map((mark) => (
      <rect
        height={r2(mark.h)}
        key={`${mark.x},${mark.y}`}
        rx={r2(mark.rx)}
        width={r2(mark.w)}
        x={r2(mark.x)}
        y={r2(mark.y)}
      />
    ))}
  </g>
);

/** The card and the rows on it. */
const Card = () => (
  <>
    <FacePath
      at={CARD_AT}
      d={roundedRect(CARD.w, CARD.h, CARD.r)}
      plane="left"
      style={FILL}
    />
    <Face at={CARD_AT} plane="left">
      <Marks marks={MARKS} />
    </Face>
  </>
);

/**
 * What shows through the glass, drawn on the card where the glass is: a
 * clear disc, and on it the card's rows enlarged about the middle of the
 * opening; the ring, drawn after this, edges it.
 */
const Lens = ({ at: [u, v] }: { at: P2 }) => {
  const id = `lens-${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
  const grow = (n: number, about: number) => about + (n - about) * GLASS.zoom;
  const enlarged = MARKS.map((mark) => ({
    h: mark.h * GLASS.zoom,
    rx: mark.rx * GLASS.zoom,
    w: mark.w * GLASS.zoom,
    x: grow(mark.x, u),
    y: grow(mark.y, v),
  }));
  return (
    <Face at={CARD_AT} plane="left">
      <clipPath id={id}>
        <circle cx={u} cy={v} r={HOLE} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <circle cx={u} cy={v} fill="var(--iso-surface-top-c)" r={HOLE} />
        <Marks marks={enlarged} />
      </g>
    </Face>
  );
};

/**
 * The handle: the grip, then the collar, the one brand mark. Written from
 * the far end in: turned down to the right, each part's top edge hides
 * behind the next one up.
 */
const Handle = ({ centre: [x, , z] }: { centre: Vec3 }) => {
  const { collar, grip, tuck } = HANDLE;
  const gripFrom = GLASS.r + collar.len - tuck;
  const len = grip.len + tuck;
  const half = grip.w / 2;
  return (
    <>
      <Extrude
        at={[x + gripFrom, HANDLE_Y, z + half]}
        convex
        d={`M0 0 H${r2(len - half)} Q${len} 0 ${len} ${half} Q${len} ${grip.w} ${r2(len - half)} ${grip.w} H0 Z`}
        depth={HANDLE.depth}
        palette="surface"
        plane="left"
      />
      <Extrude
        at={[x + GLASS.r - tuck, HANDLE_Y, z + collar.w / 2]}
        convex
        d={`M0 0 H${r2(collar.len + tuck)} V${collar.w} H0 Z`}
        depth={HANDLE.depth}
        palette="main"
        plane="left"
      />
    </>
  );
};

/** The ring: one flat face with a hole, in front of the handle's end. */
const Ring = ({ centre: [x, , z] }: { centre: Vec3 }) => (
  <FacePath
    at={[x - GLASS.r, GLASS.y, z + GLASS.r]}
    d={RING}
    fillRule="evenodd"
    plane="left"
    style={FILL}
  />
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/**
 * Where the glass looks, re-rendered only when it changes. Each clip starts
 * from its own first frame: held at rest nothing was drawn, so the first
 * play must not show the last look of a clip that never ran.
 */
const useLook = (clock: MotionValue<number> | undefined, clip: Clip): P2 => {
  const idle = useMotionValue(0);
  const read = (ms: number): P2 => [
    r2(sample(clip.u, ms)),
    r2(sample(clip.v, ms)),
  ];
  const [look, setLook] = useState(() => ({ clip, value: read(0) }));
  if (look.clip !== clip) {
    setLook({ clip, value: read(0) });
  }
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    setLook((prev) =>
      prev.clip === clip && prev.value.join(",") === next.join(",")
        ? prev
        : { clip, value: next }
    );
  });
  return clock ? look.value : REST;
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type MagnifyingGlassProps = LineStateProps;

// The cross on the button.
const CLEAR = "M6 6l12 12M18 6L6 18";

/**
 * Magnifying glass: a complete no-results state ("No results found")
 * with a line illustration, a heading, a line of copy and a button, all
 * props. A card of three placeholder rows and a magnifying glass that
 * sweeps along the first, back across the second and out to the right of
 * the third, where it rests; the rows under the glass show enlarged. One
 * fine outline, near-white faces, no shadow, facing the screen; the
 * handle's collar carries the brand, like the button under it. It plays
 * when it comes into view; pass `active` (PlayOnHover, or your own state)
 * to play it each time `active` turns true. Follows the shadcn theme.
 */
export const MagnifyingGlass = ({
  heading = "No results found",
  description = "Try a different search, or clear your filters to see everything.",
  actionLabel = "Clear filters",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: MagnifyingGlassProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const look = useLook(shell.clock, shell.clip);
  const centre = glassAt(look);
  return (
    <LineState
      bounds={BOUNDS}
      defaultArtClassName="w-44"
      icon={CLEAR}
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
      slot="magnifying-glass"
    >
      <Card />
      <Lens at={look} />
      <Rig axis="y" pivot={centre} rotate={HANDLE.angle}>
        <Handle centre={centre} />
      </Rig>
      <Ring centre={centre} />
    </LineState>
  );
};

export default MagnifyingGlass;
