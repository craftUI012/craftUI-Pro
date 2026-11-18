"use client";

import { EASE, Extrude, FacePath, Rig, sample, useIsoId } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
  LINE,
  LineState,
  faceFill,
  onClock,
  r2,
  useLineShell,
  viewBounds,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "You're protected", told by one object in line: a security shield,
 * facing the screen, that lifts a little while a check draws itself on its
 * inner plate, then sets back down with a small settle. Use: all clear.
 * Move: a lift, a stroke drawn on, a landing that shows. Each value is ms
 * after the art comes into view.
 *
 *    0ms   the shield stands, its inner plate blank
 *  400ms   it lifts 0.375 units (240ms, soft)
 *  560ms   the check draws on, left to right: the short stroke down, then
 *          the long stroke up (460ms)
 * 1020ms   it drops back (160ms, speeding up), lands with a 5% squash that
 *          keeps its volume and one tiny bounce (340ms)
 * 1500ms   still: the shield with its check
 *
 * One way: the resting pose is the checked shield. Each play after the
 * first wipes the check off right to left (200ms), then plays the beat.
 * Reduced motion, or `active` false before any play: the checked shield.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The check is drawn on this long.
  draw: 460,
  // The shield is held up this long after it has lifted.
  held: 380,
  // The lift.
  lift: 240,
  start: 400,
  // A replay first wipes the check off this long.
  wipe: 200,
};

/* How far things move. */
const MOVE = {
  // The tiny bounce after it lands, world units.
  bounce: 0.06,
  // How high it lifts, world units.
  lift: 0.375,
  // Its height scale as it lands.
  squash: 0.95,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0, standing on its tip at z = 0; the front of
// the shield is the plane y = 0. Face units: u across from the shield's
// left edge, v down from its top.

/**
 * A shield outline: a level top with rounded corners, straight sides down
 * to `side`, then two curves meeting in a point at the foot. Convex, so the
 * engine draws its far and side edges.
 */
const shieldPath = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  side: number
) => {
  const k = r2(r * ARC);
  const mid = r2(x + w / 2);
  const fall = h - side;
  return [
    `M${r2(x + r)} ${y}`,
    `H${r2(x + w - r)}`,
    `C${r2(x + w - r + k)} ${y} ${x + w} ${r2(y + r - k)} ${x + w} ${r2(y + r)}`,
    `V${r2(y + side)}`,
    `C${x + w} ${r2(y + side + fall * 0.55)} ${r2(mid + w * 0.27)} ${r2(y + h - fall * 0.16)} ${mid} ${r2(y + h)}`,
    `C${r2(mid - w * 0.27)} ${r2(y + h - fall * 0.16)} ${x} ${r2(y + side + fall * 0.55)} ${x} ${r2(y + side)}`,
    `V${r2(y + r)}`,
    `C${x} ${r2(y + r - k)} ${r2(x + r - k)} ${y} ${r2(x + r)} ${y}`,
    "Z",
  ].join(" ");
};

/** The right half of the same outline, closed up its centre line. */
const shieldHalf = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  side: number
) => {
  const k = r2(r * ARC);
  const mid = r2(x + w / 2);
  const fall = h - side;
  return [
    `M${mid} ${y}`,
    `H${r2(x + w - r)}`,
    `C${r2(x + w - r + k)} ${y} ${x + w} ${r2(y + r - k)} ${x + w} ${r2(y + r)}`,
    `V${r2(y + side)}`,
    `C${x + w} ${r2(y + side + fall * 0.55)} ${r2(mid + w * 0.27)} ${r2(y + h - fall * 0.16)} ${mid} ${r2(y + h)}`,
    "Z",
  ].join(" ");
};

// The shield: a sturdy body with a clear top strip.
const SHIELD = { depth: 1, h: 8, r: 0.75, side: 3.5, w: 7 };
const SHIELD_AT: Vec3 = [-SHIELD.w / 2, 0, SHIELD.h];

// The inner plate, set in by its rim (0.75 at the sides, a little more at
// the tip, where the outline narrows), flush with the front: one line
// each. Its right half a whisper darker, so the plate reads as a ridge.
const PLATE = { h: 6.25, inset: 0.75, r: 0.375 };
const PLATE_W = SHIELD.w - PLATE.inset * 2;
const PLATE_SIDE = SHIELD.side - PLATE.inset;

// The check (the one brand mark): a stroke 0.75 wide through three points
// on the plate, centred on its middle and a little above half height.
const CHECK = {
  half: 0.375,
  points: [
    [2, 3.75],
    [3, 4.75],
    [5, 2.75],
  ] as const,
};

/** The unit normal of the line from p to q, turned left. */
const normal = (p: readonly number[], q: readonly number[]) => {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  return [-dy / len, dx / len] as const;
};

/** A face point, rounded. */
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

/** A stroke `half` either side of a two-segment line, mitred at its knee. */
const strokeOutline = (
  [a, b, c]: readonly (readonly [number, number])[],
  half: number
) => {
  const n1 = normal(a, b);
  const n2 = normal(b, c);
  // The mitre at the knee: along the two normals' bisector.
  const mx = n1[0] + n2[0];
  const my = n1[1] + n2[1];
  const dot = n1[0] * n2[0] + n1[1] * n2[1];
  const m = half / ((1 + dot) / Math.hypot(mx, my));
  const knee = [mx / Math.hypot(mx, my), my / Math.hypot(mx, my)];
  return [
    `M${pt(a[0] + n1[0] * half, a[1] + n1[1] * half)}`,
    `L${pt(b[0] + knee[0] * m, b[1] + knee[1] * m)}`,
    `L${pt(c[0] + n2[0] * half, c[1] + n2[1] * half)}`,
    `L${pt(c[0] - n2[0] * half, c[1] - n2[1] * half)}`,
    `L${pt(b[0] - knee[0] * m, b[1] - knee[1] * m)}`,
    `L${pt(a[0] - n1[0] * half, a[1] - n1[1] * half)}`,
    "Z",
  ].join(" ");
};

const CHECK_PATH = strokeOutline(CHECK.points, CHECK.half);
// The wipe that draws the check: from just left of its start to just
// right of its end, the full height of the plate.
const WIPE = { u0: 1.5, u1: 5.5 };

// The frame fits the shield at rest: its face and the top strip its depth
// shows. The lift runs into the padding.
const EXTENT: Vec3[] = [
  [-SHIELD.w / 2, 0, 0],
  [SHIELD.w / 2, 0, 0],
  [-SHIELD.w / 2, -SHIELD.depth, SHIELD.h],
  [SHIELD.w / 2, -SHIELD.depth, SHIELD.h],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The shield's height off its rest, world units (never below 0). */
  lift: IsoTrack;
  /** Its height scale about its tip as it lands. */
  squash: IsoTrack;
  /** How much of the check is drawn, 0 to 1, left to right. */
  wipe: IsoTrack;
}

/** The beat starting at `t0`; `undo` first wipes the check off. */
const beat = (t0: number, undo: boolean): Clip => {
  const go = undo ? t0 + TIMING.wipe + 60 : t0;
  const up = go + TIMING.lift;
  const drawn = go + 160 + TIMING.draw;
  const down = up + TIMING.held;
  const land = down + 160;
  const lift: IsoKey[] = [
    [go, 0, EASE.soft],
    [up, MOVE.lift, "hold"],
    [down, MOVE.lift, EASE.in],
    [land, 0, EASE.drop],
    [land + 90, MOVE.bounce, EASE.in],
    [land + 170, 0],
  ];
  const squash: IsoKey[] = [
    [land - 20, 1, EASE.drop],
    [land + 70, MOVE.squash, EASE.easy],
    [land + 200, 1.015, EASE.easy],
    [land + 320, 1],
  ];
  const wipe: IsoKey[] = [
    ...(undo ? ([[t0, 1, EASE.in]] as IsoKey[]) : []),
    [undo ? t0 + TIMING.wipe : go, 0, "hold"],
    [go + 160, 0, EASE.easy],
    [drawn, 1],
  ];
  return { end: land + 320, lift, squash, wipe };
};

const INTRO = beat(TIMING.start, false);
const AGAIN = beat(TIMING.again, true);

const shieldPose =
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

const WIPE_AT: Vec3 = [SHIELD_AT[0] + WIPE.u0, 0, 0];
const wipePose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    scale: [Math.max(0.001, r2(sample(clip.wipe, ms))), 1, 1],
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** The inner plate, its darker right half and the ridge between them. */
const Plate = () => {
  const args = [
    PLATE.inset,
    PLATE.inset,
    PLATE_W,
    PLATE.h,
    PLATE.r,
    PLATE_SIDE,
  ] as const;
  return (
    <>
      <FacePath
        at={SHIELD_AT}
        d={shieldPath(...args)}
        plane="left"
        style={faceFill("surface", "top")}
      />
      <FacePath
        at={SHIELD_AT}
        d={shieldHalf(...args)}
        plane="left"
        style={faceFill("surface", "left")}
      />
    </>
  );
};

/** The check, drawn on by a wipe that grows from its left. */
const Check = ({ wipe }: { wipe: ReturnType<typeof onClock> }) => {
  const id = useIsoId();
  return (
    <>
      <defs>
        <clipPath id={`${id}-wipe`}>
          <Rig pivot={WIPE_AT} {...wipe}>
            <FacePath
              at={SHIELD_AT}
              d={`M${WIPE.u0} 0 H${WIPE.u1} V${SHIELD.h} H${WIPE.u0} Z`}
              plane="left"
            />
          </Rig>
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-wipe)`}>
        <FacePath
          at={SHIELD_AT}
          d={CHECK_PATH}
          plane="left"
          style={{ ...LINE, fill: "var(--iso-main-left)" }}
        />
      </g>
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type ShieldProps = LineStateProps;

/**
 * Shield: a complete "you're protected" state with a line illustration, a
 * heading, a line of copy and a button. A security shield facing the
 * screen, its inner plate set in by a rim with a ridge down its middle: it
 * lifts a little while a check draws itself on the plate, then sets back
 * down with a small settle. One fine outline, paper faces, the check the
 * one brand mark, no shadow. Plays when it comes into view, or each time
 * `active` turns true (PlayOnHover, or your own state). Follows the shadcn
 * theme.
 */
export const Shield = ({
  heading = "You're protected",
  description = "We'll let you know if anything needs your attention.",
  actionLabel = "Security settings",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ShieldProps) => {
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
      buttonVariant="secondary"
      defaultArtClassName="w-44"
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
      slot="shield"
      view="front"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, shieldPose(clip), clip.end)}>
        <Extrude
          at={SHIELD_AT}
          convex
          d={shieldPath(0, 0, SHIELD.w, SHIELD.h, SHIELD.r, SHIELD.side)}
          depth={SHIELD.depth}
          palette="surface"
          plane="left"
        >
          <Plate />
          <Check wipe={onClock(clock, wipePose(clip), clip.end)} />
        </Extrude>
      </Rig>
    </LineState>
  );
};

export default Shield;
