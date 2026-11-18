"use client";

import { EASE, Extrude, FacePath, Rig, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  Edge,
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
 * "Nothing uploaded yet", told by one object in line: a cloud whose arrow
 * goes up once and comes back to wait. Use: empty state. Move: a launch
 * with one bounce. Each value is ms after the art comes into view.
 *
 *    0ms   the arrow stands on the cloud's face, pointing up
 *  400ms   it crouches 8% into its base; the cloud gives 3% under it (120ms)
 *  520ms   it shoots up 3 units, past the cloud's top, stretching (300ms)
 *  820ms   it overshoots and eases back a quarter unit (160ms), hangs (180ms)
 * 1160ms   it drops home (260ms, speeding up)
 * 1420ms   it lands: squashes 10%, the cloud gives 4%, one small bounce
 *          (0.25 units), then it settles
 * 1800ms   still: the arrow on the cloud, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play:
 * the cloud with its arrow, still.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face of the cloud is the plane
// y = 0, the arrow stands proud of it. Face units: u across from the
// cloud's left edge, v down from its top.

const CLOUD = { depth: 1.5, h: 6.5, w: 10 };
const CLOUD_AT: Vec3 = [-CLOUD.w / 2, 0, CLOUD.h];

// Three lobes, left to right, as circles [u, v, r]. The outer two touch
// the flat bottom and the sides; the big middle one sits over x = 0.
type Lobe = readonly [number, number, number];
const LOBES: readonly Lobe[] = [
  [2.25, 4.25, 2.25],
  [5, 3, 3],
  [8, 4.5, 2],
];

/** Where two lobes cross, the upper of the two points. */
const cusp = ([x1, y1, r1]: Lobe, [x2, y2, r2_]: Lobe) => {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2_ * r2_ + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const mx = x1 + (a * (x2 - x1)) / d;
  const my = y1 + (a * (y2 - y1)) / d;
  return [mx + (h * (y2 - y1)) / d, my - (h * (x2 - x1)) / d] as const;
};

/** The angle of a point seen from a lobe's centre, degrees, v down. */
const angle = ([cx, cy]: Lobe, [u, v]: readonly [number, number]) =>
  (Math.atan2(v - cy, u - cx) * 180) / Math.PI;

/** One circular arc as cubics (≤ 90° each), angles in degrees, v down. */
const arc = ([cx, cy, r]: Lobe, a0: number, a1: number) => {
  const n = Math.ceil(Math.abs(a1 - a0) / 90);
  const step = ((a1 - a0) / n) * (Math.PI / 180);
  const k = (4 / 3) * Math.tan(step / 4) * r;
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const s = (a0 * Math.PI) / 180 + i * step;
    const e = s + step;
    parts.push(
      `C${r2(cx + r * Math.cos(s) - k * Math.sin(s))} ${r2(cy + r * Math.sin(s) + k * Math.cos(s))}`,
      `${r2(cx + r * Math.cos(e) + k * Math.sin(e))} ${r2(cy + r * Math.sin(e) - k * Math.cos(e))}`,
      `${r2(cx + r * Math.cos(e))} ${r2(cy + r * Math.sin(e))}`
    );
  }
  return parts.join(" ");
};

const [LEFT, MIDDLE, RIGHT] = LOBES;
const CUSP_A = cusp(LEFT, MIDDLE);
const CUSP_B = cusp(MIDDLE, RIGHT);
// Angles run clockwise (v is down): 90 is the bottom, 180 the left, 270
// the top, 360 the right.
const A_LEFT = angle(LEFT, CUSP_A) + 360;
const A_MID_0 = angle(MIDDLE, CUSP_A) + 360;
const A_MID_1 = angle(MIDDLE, CUSP_B) + 360;
const A_RIGHT = angle(RIGHT, CUSP_B) + 360;

// The top of the cloud, from its leftmost point over the three lobes to
// its rightmost point.
const TOP_CHAIN = [
  arc(LEFT, 180, A_LEFT),
  arc(MIDDLE, A_MID_0, A_MID_1),
  arc(RIGHT, A_RIGHT, 360),
].join(" ");

// The front outline: the flat bottom, then round the lobes.
const CLOUD_PATH = [
  `M${LEFT[0]} ${CLOUD.h}`,
  arc(LEFT, 90, 180),
  TOP_CHAIN,
  arc(RIGHT, 0, 90),
  "Z",
].join(" ");

const toWorld = (u: number, v: number, y = 0): Vec3 => [
  r2(u - CLOUD.w / 2),
  y,
  r2(CLOUD.h - v),
];

// Where the cloud's side joins front to back on screen: its leftmost and
// rightmost points, and the two valleys between lobes.
const CLOUD_JOINS: readonly (readonly [number, number])[] = [
  [0, LEFT[1]],
  CUSP_A,
  CUSP_B,
  [CLOUD.w, RIGHT[1]],
];

// The arrow: a head over a shaft, standing proud of the cloud's face.
const ARROW = { base: 1, depth: 0.5, head: 1.5, headW: 3, shaft: 2, shaftW: 1 };
const ARROW_H = ARROW.head + ARROW.shaft;
const ARROW_AT: Vec3 = [-ARROW.headW / 2, ARROW.depth, ARROW.base + ARROW_H];
const SHAFT_L = (ARROW.headW - ARROW.shaftW) / 2;
const SHAFT_R = SHAFT_L + ARROW.shaftW;
const ARROW_PATH = [
  `M${ARROW.headW / 2} 0`,
  `L${ARROW.headW} ${ARROW.head}`,
  `L${SHAFT_R} ${ARROW.head}`,
  `L${SHAFT_R} ${ARROW_H}`,
  `L${SHAFT_L} ${ARROW_H}`,
  `L${SHAFT_L} ${ARROW.head}`,
  `L0 ${ARROW.head}`,
  "Z",
].join(" ");
// The head's two sloping edges: the arrow's top, seen on its back.
const ARROW_TOP = `M0 ${ARROW.head} L${ARROW.headW / 2} 0 L${ARROW.headW} ${ARROW.head}`;
const ARROW_JOINS: readonly (readonly [number, number])[] = [
  [0, ARROW.head],
  [ARROW.headW / 2, 0],
  [ARROW.headW, ARROW.head],
];
const ARROW_BASE: Vec3 = [0, ARROW.depth, ARROW.base];

// The frame fits the cloud at rest; the launch runs into the padding.
const EXTENT: Vec3[] = [
  [-CLOUD.w / 2, 0, 0],
  [CLOUD.w / 2, 0, 0],
  [-CLOUD.w / 2, -CLOUD.depth, CLOUD.h],
  [CLOUD.w / 2, -CLOUD.depth, CLOUD.h],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Height of the arrow above its rest, world units. */
  lift: IsoTrack;
  /** Height scale of the arrow about its base. */
  squash: IsoTrack;
  /** Height scale of the cloud about its bottom. */
  give: IsoTrack;
}

const beat = (t0: number): Clip => {
  const crouch = t0 + 120;
  const apex = crouch + 300;
  const hang = apex + 160;
  const fall = hang + 180;
  const land = fall + 260;
  const lift: IsoKey[] = [
    [crouch, 0, EASE.soft],
    [apex, 3, EASE.easy],
    [hang, 2.75, "hold"],
    [fall, 2.75, EASE.in],
    [land, 0, EASE.drop],
    [land + 100, 0.25, EASE.in],
    [land + 200, 0],
  ];
  const squash: IsoKey[] = [
    [t0, 1, EASE.easy],
    [crouch, 0.92, EASE.soft],
    [crouch + 140, 1.06, EASE.easy],
    [hang, 1, "hold"],
    [land - 20, 1, EASE.drop],
    [land + 60, 0.9, EASE.easy],
    [land + 200, 1.03, EASE.easy],
    [land + 320, 1],
  ];
  const give: IsoKey[] = [
    [t0, 1, EASE.easy],
    [crouch, 0.97, EASE.easy],
    [crouch + 200, 1, "hold"],
    [land - 20, 1, EASE.drop],
    [land + 80, 0.96, EASE.easy],
    [land + 260, 1.01, EASE.easy],
    [land + 380, 1],
  ];
  return { end: land + 380, give, lift, squash };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const arrowPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const s = r2(sample(clip.squash, ms));
    // Volume is kept: as it squashes in height it widens.
    const w = r2(1 / Math.sqrt(s));
    return {
      offset: [0, 0, r2(sample(clip.lift, ms))],
      scale: [w, 1, s],
    };
  };

const cloudPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const s = r2(sample(clip.give, ms));
    return { scale: [r2(1 / Math.sqrt(s)), 1, s] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * A non-convex extrusion seen from the front: the engine fills its side
 * but draws no far edge. Its top (and nothing else) is the far edge here,
 * because the outline has no overhangs, so that chain is drawn on the back
 * plane with an edge from front to back where the side turns on screen.
 */
const FarEdge = ({
  at,
  depth,
  chain,
  joins,
}: {
  at: Vec3;
  depth: number;
  chain: string;
  joins: readonly (readonly [number, number])[];
}) => (
  <>
    <FacePath
      at={[at[0], at[1] - depth, at[2]]}
      d={chain}
      plane="left"
      style={LINE}
    />
    {joins.map(([u, v]) => (
      <Edge
        key={`${u},${v}`}
        points={[
          [r2(at[0] + u), at[1], r2(at[2] - v)],
          [r2(at[0] + u), at[1] - depth, r2(at[2] - v)],
        ]}
      />
    ))}
  </>
);

/** The cloud: three lobes over a flat bottom. */
const Cloud = () => (
  <>
    <Extrude
      at={CLOUD_AT}
      d={CLOUD_PATH}
      depth={CLOUD.depth}
      palette="surface"
      plane="left"
    />
    <FarEdge
      at={CLOUD_AT}
      chain={`M0 ${LEFT[1]} ${TOP_CHAIN}`}
      depth={CLOUD.depth}
      joins={CLOUD_JOINS}
    />
  </>
);

/** The arrow, the one brand mark. */
const Arrow = () => (
  <>
    <Extrude
      at={ARROW_AT}
      d={ARROW_PATH}
      depth={ARROW.depth}
      palette="main"
      plane="left"
    />
    <FarEdge
      at={ARROW_AT}
      chain={ARROW_TOP}
      depth={ARROW.depth}
      joins={ARROW_JOINS}
    />
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type CloudUploadProps = LineStateProps;

/**
 * Cloud upload: a complete "nothing uploaded yet" state with a line
 * illustration, a heading, a line of copy and a button. A cloud with an
 * arrow on its face: the arrow crouches, shoots up past the cloud's top,
 * drops back and lands with one bounce; the cloud gives under it. One fine
 * outline, paper faces, the arrow the one brand mark, facing the screen,
 * no shadow. Pass `active` (PlayOnHover, or your own state) to play it
 * again. Follows the shadcn theme.
 */
export const CloudUpload = ({
  heading = "Nothing uploaded yet",
  description = "Files you upload will be stored here.",
  actionLabel = "Upload files",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: CloudUploadProps) => {
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
      icon={ICON.upload}
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
      defaultArtClassName="w-52"
      slot="cloud-upload"
    >
      <Rig
        pivot={toWorld(CLOUD.w / 2, CLOUD.h)}
        {...onClock(clock, cloudPose(clip), clip.end)}
      >
        <Cloud />
      </Rig>
      <Rig pivot={ARROW_BASE} {...onClock(clock, arrowPose(clip), clip.end)}>
        <Arrow />
      </Rig>
    </LineState>
  );
};

export default CloudUpload;
