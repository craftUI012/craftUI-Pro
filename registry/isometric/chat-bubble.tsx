"use client";

import { EASE, Extrude, FacePath, Rig, sample } from "./iso-core";
import type { IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  Edge,
  ICON,
  LINE,
  LineState,
  disc,
  faceFill,
  facing,
  onClock,
  r2,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "No messages yet", told by one object in line: a speech bubble whose
 * three dots type once, like someone about to write, then stop. Use:
 * empty state. Move: a wave across three dots. Each value is ms after the
 * art comes into view.
 *
 *    0ms   the bubble stands on its tail, three dots in a row on its face
 *  400ms   the left dot hops 0.75 units, stretching 5% (280ms up,
 *          100ms hang)
 *  490ms   the middle dot follows, 90ms behind
 *  580ms   the right dot follows, 90ms behind
 *  780ms   each falls back (240ms, speeding up), lands with a 10% squash,
 *          bounces 0.15 units and settles
 * 1500ms   still: three dots in a row, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play:
 * the bubble with its dots, still.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face is the plane y = 0. Face
// units: u across from the bubble's left edge, v down from its top.

// The body: a rounded rect. The tail carries its left side straight down
// to a point and runs back up to the bottom edge.
const BODY = { depth: 1, h: 6, r: 1.5, w: 9 };
const TAIL = { h: 1.5, w: 2.5 };
const BUBBLE_H = BODY.h + TAIL.h;
const BUBBLE_AT: Vec3 = [-BODY.w / 2, 0, BUBBLE_H];
const K = r2(BODY.r * 0.5523);

const { w: W, h: H, r: R } = BODY;
const BUBBLE_PATH = [
  `M0 ${R}`,
  `C0 ${R - K} ${R - K} 0 ${R} 0`,
  `H${W - R}`,
  `C${W - R + K} 0 ${W} ${R - K} ${W} ${R}`,
  `V${H - R}`,
  `C${W} ${H - R + K} ${W - R + K} ${H} ${W - R} ${H}`,
  `H${TAIL.w}`,
  `L0 ${BUBBLE_H}`,
  "Z",
].join(" ");

// The far edge. The outline has no overhang (the tail's free side is
// plumb), so only its top shows behind: the two top corners and the edge
// between them, on the back plane, joined to the front where the sides
// meet them.
const TOP_CHAIN = [
  `M0 ${R}`,
  `C0 ${R - K} ${R - K} 0 ${R} 0`,
  `H${W - R}`,
  `C${W - R + K} 0 ${W} ${R - K} ${W} ${R}`,
].join(" ");
const JOINS: readonly (readonly [number, number])[] = [
  [0, R],
  [W, R],
];

// Three dots in a row across the middle of the body.
const DOT = { gap: 2, r: 0.6 };
const DOT_Z = TAIL.h + BODY.h / 2;
const DOTS = [-DOT.gap, 0, DOT.gap];

// The frame fits the bubble at rest, front face and top strip.
const EXTENT: Vec3[] = [
  [-BODY.w / 2, 0, 0],
  [BODY.w / 2, 0, 0],
  [-BODY.w / 2, -BODY.depth, BUBBLE_H],
  [BODY.w / 2, -BODY.depth, BUBBLE_H],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Height of each dot above its rest, world units, left to right. */
  hops: readonly IsoTrack[];
  /** Height scale of each dot about its foot, left to right. */
  squashes: readonly IsoTrack[];
}

// The wave's lag from one dot to the next.
const STAGGER = 90;

// One dot's hop: up fast, a short hang, down speeding up, one small
// bounce; it squashes a little as it lands.
const UP = 280;
const HANG = 100;
const FALL = 240;

const hopTrack = (t0: number): IsoTrack => {
  const top = t0 + UP;
  const land = top + HANG + FALL;
  return [
    [t0, 0, EASE.soft],
    [top, 0.75, "hold"],
    [top + HANG, 0.75, EASE.in],
    [land, 0, EASE.drop],
    [land + 100, 0.15, EASE.in],
    [land + 220, 0],
  ];
};

const squashTrack = (t0: number): IsoTrack => {
  const land = t0 + UP + HANG + FALL;
  return [
    [t0, 1, EASE.soft],
    [t0 + 120, 1.05, EASE.easy],
    [t0 + UP, 1, "hold"],
    [land - 20, 1, EASE.drop],
    [land + 60, 0.9, EASE.easy],
    [land + 180, 1.03, EASE.easy],
    [land + 300, 1],
  ];
};

const beat = (t0: number): Clip => {
  const hops = DOTS.map((_, i) => hopTrack(t0 + i * STAGGER));
  const squashes = DOTS.map((_, i) => squashTrack(t0 + i * STAGGER));
  const end = squashes.at(-1)?.at(-1)?.[0] ?? t0;
  return { end, hops, squashes };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const dotPose =
  (clip: Clip, i: number) =>
  (ms: number): IsoPose => {
    const s = r2(sample(clip.squashes[i], ms));
    // Volume is kept: as it squashes in height it widens.
    const w = r2(1 / Math.sqrt(s));
    return {
      offset: [0, 0, r2(sample(clip.hops[i], ms))],
      scale: [w, 1, s],
    };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The bubble. Its outline is not convex (the tail), so the engine draws no
 * far edge: the top chain is drawn on the back plane, with an edge from
 * front to back down each side where the corners begin.
 */
const Bubble = () => (
  <>
    <Extrude
      at={BUBBLE_AT}
      d={BUBBLE_PATH}
      depth={BODY.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={[BUBBLE_AT[0], -BODY.depth, BUBBLE_AT[2]]}
      d={TOP_CHAIN}
      plane="left"
      style={LINE}
    />
    {JOINS.map(([u, v]) => (
      <Edge
        key={u}
        points={[
          [BUBBLE_AT[0] + u, 0, BUBBLE_AT[2] - v],
          [BUBBLE_AT[0] + u, -BODY.depth, BUBBLE_AT[2] - v],
        ]}
      />
    ))}
  </>
);

/** One dot, printed on the face; the three together are the brand mark. */
const Dot = ({ x }: { x: number }) => (
  <FacePath
    at={[x - DOT.r, 0, DOT_Z + DOT.r]}
    d={disc(DOT.r)}
    plane="left"
    style={faceFill("main", "left")}
  />
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type ChatBubbleProps = LineStateProps;

/**
 * Chat bubble: a complete "no messages yet" state with a line
 * illustration, a heading, a line of copy and a button. A speech bubble
 * with three dots that hop once in a wave, like someone typing, then stop.
 * One fine outline, paper faces, the dots the one brand mark, facing the
 * screen, no shadow. Pass `active` (PlayOnHover, or your own state) to
 * play it again. Follows the shadcn theme.
 */
export const ChatBubble = ({
  heading = "No messages yet",
  description = "Start a conversation and it will show up here.",
  actionLabel = "New message",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ChatBubbleProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
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
      slot="chat-bubble"
    >
      <Bubble />
      {DOTS.map((x, i) => (
        <Rig
          key={x}
          pivot={[x, 0, DOT_Z - DOT.r]}
          {...onClock(clock, dotPose(clip, i), clip.end)}
        >
          <Dot x={x} />
        </Rig>
      ))}
    </LineState>
  );
};

export default ChatBubble;
