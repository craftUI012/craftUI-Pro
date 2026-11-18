"use client";

import {
  Box,
  EASE,
  FacePath,
  Rig,
  lift,
  roundedRect,
  sample,
} from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LINE,
  LineState,
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
 * "No rewards yet", told by one object in line: a gift box whose lid lifts
 * to peek inside, shows the box empty, and drops back on.
 * Use: empty state. Move: a lid lifted, tipped up at the front, dropped.
 * Each value is ms after the art comes into view.
 *
 *    0ms   the box stands shut, ribbon tied, bow on top
 *  400ms   the lid pops up 2 units and tips its front up 6° (260ms):
 *          the open box shows, empty
 *  660ms   it hangs there, peeked into (360ms)
 * 1020ms   it drops, levelling as it falls (220ms, speeding up)
 * 1240ms   it lands: the box squashes 4%; the lid bounces once (0.24
 *          units) and sits (200ms)
 * 1440ms   still: the box shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the box standing shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // How long the lid hangs up, peeked into.
  hold: 360,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front of the box is the plane y = 0.

// The box: a plain block, its top the open mouth (covered by the lid).
const BODY = { d: 5, h: 6, w: 8.5 };
const BODY_AT: Vec3 = [-BODY.w / 2, -BODY.d, 0];

// The lid: a shallow block a quarter unit proud of the box all round,
// sliding down over its top half a unit.
const LID = { h: 1.5, lip: 0.25, over: 0.5 };
const LID_W = BODY.w + LID.lip * 2;
const LID_D = BODY.d + LID.lip * 2;
const LID_Z = BODY.h - LID.over;
const LID_TOP = LID_Z + LID.h;
const LID_AT: Vec3 = [-LID_W / 2, -BODY.d - LID.lip, LID_Z];
// It tips up at the front about its back bottom edge.
const LID_HINGE: Vec3 = [0, -BODY.d - LID.lip, LID_Z];

// The ribbon: one band down the middle of the front and over the lid,
// front to back, plain paper in line.
const BAND = 1.5;
const MID_Y = -BODY.d / 2;

// The bow, the one brand mark: two loops and a knot standing on the lid at
// its middle, two tails lying on it. Face units from the knot's foot, up is negative.
const BOW_AT: Vec3 = [0, MID_Y, LID_TOP];
const BOW_H = 2.25;
const bowLoop = (s: 1 | -1) =>
  [
    `M${s * 0.5} -0.75`,
    `C${s * 1.25} -2.25 ${s * 2.75} -2.25 ${s * 2.5} -1`,
    `C${s * 2.25} -0.25 ${s * 1.25} -0.25 ${s * 0.5} -0.25`,
    "Z",
  ].join(" ");
// The fold inside each loop, a line only.
const fold = (s: 1 | -1) =>
  `M${s * 0.75} -0.75 C${s * 1.25} -1.5 ${s * 2} -1.5 ${s * 2} -1`;
const KNOT = roundedRect(1, 1, 0.25, -0.5, -1);
// Two tails lying on the lid from under the knot toward the front, their
// ends notched. Top-plane units from the knot's foot (v toward the front).
const tail = (s: 1 | -1) =>
  [
    `M${s * 0.25} 0`,
    `L${s * 1.75} 2`,
    `L${s * 1.25} 1.75`,
    `L${s * 1} 2.25`,
    `L${s * -0.25} 0.5`,
    "Z",
  ].join(" ");

// The frame fits the box shut, from its foot to the top of the bow. The
// lifted lid runs into the stage's padding.
const EXTENT: Vec3[] = [
  [-LID_W / 2, 0, 0],
  [LID_W / 2, 0, 0],
  [-LID_W / 2, LID_AT[1], LID_TOP],
  [LID_W / 2, LID_AT[1], LID_TOP],
  [0, MID_Y, LID_TOP + BOW_H],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Height of the lid off the box, world units. */
  rise: IsoTrack;
  /** The lid's tip, degrees, front up; never below 0. */
  tip: IsoTrack;
  /** Height scale of the whole box as the lid lands. */
  squash: IsoTrack;
}

const beat = (t0: number): Clip => {
  const up = t0 + 260;
  const drop = up + TIMING.hold;
  const land = drop + 220;
  // The engine's `lift`: pops up, hangs, drops, one small bounce.
  const rise = lift(2, t0, TIMING.hold);
  // Starts at rest and only ever tips up: the lid's front never dips into
  // the box. Level again by the time it lands.
  const tip: IsoKey[] = [
    [t0, 0, EASE.soft],
    [up, 6, "hold"],
    [drop, 6, EASE.in],
    [land, 0],
  ];
  const squash: IsoKey[] = [
    [land - 20, 1, EASE.drop],
    [land + 60, 0.96, EASE.easy],
    [land + 200, 1],
  ];
  return { end: land + 200, rise, squash, tip };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const lidPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "x",
    offset: [0, 0, r2(sample(clip.rise, ms))],
    rotate: r2(sample(clip.tip, ms)),
  });

const boxPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const s = r2(sample(clip.squash, ms));
    // Volume is kept: as it squashes in height it widens.
    const w = r2(1 / Math.sqrt(s));
    return { scale: [w, w, s] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The box: a block, its top covered by the open mouth (from 30° above a
 * deep box shows only its far inside wall, one darker fill), and the
 * ribbon down its front.
 */
const Body = () => (
  <>
    <Box at={BODY_AT} palette="surface" size={[BODY.w, BODY.d, BODY.h]} />
    <FacePath
      at={[BODY_AT[0], BODY_AT[1], BODY.h]}
      d={roundedRect(BODY.w, BODY.d, 0)}
      plane="top"
      style={faceFill("surface", "right")}
    />
    <FacePath
      at={[-BAND / 2, 0, BODY.h]}
      d={roundedRect(BAND, BODY.h, 0)}
      plane="left"
      style={faceFill("surface", "left")}
    />
  </>
);

/** The lid, its ribbon, and the bow standing on it. */
const Lid = () => (
  <>
    <Box at={LID_AT} palette="surface" size={[LID_W, LID_D, LID.h]} />
    <FacePath
      at={[-BAND / 2, LID.lip, LID_TOP]}
      d={roundedRect(BAND, LID.h, 0)}
      plane="left"
      style={faceFill("surface", "left")}
    />
    <FacePath
      at={[-BAND / 2, LID_AT[1], LID_TOP]}
      d={roundedRect(BAND, LID_D, 0)}
      plane="top"
      style={faceFill("surface", "top")}
    />
    {([-1, 1] as const).map((s) => (
      <FacePath
        at={BOW_AT}
        d={tail(s)}
        key={`tail${s}`}
        plane="top"
        style={faceFill("main", "top")}
      />
    ))}
    {([-1, 1] as const).map((s) => (
      <g key={`loop${s}`}>
        <FacePath
          at={BOW_AT}
          d={bowLoop(s)}
          plane="left"
          style={faceFill("main", "left")}
        />
        <FacePath at={BOW_AT} d={fold(s)} plane="left" style={LINE} />
      </g>
    ))}
    <FacePath
      at={BOW_AT}
      d={KNOT}
      plane="left"
      style={faceFill("main", "left")}
    />
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type GiftBoxProps = LineStateProps;

/**
 * Gift box: a complete "no rewards yet" state with a line illustration, a
 * heading, a line of copy and a button. A gift box lifts its lid to peek
 * inside, shows it empty, and drops the lid back on with one small bounce.
 * One fine outline, paper faces, the bow the one brand mark, facing the
 * screen, no shadow. Pass `active` (PlayOnHover, or your own state) to
 * play it again. Follows the shadcn theme.
 */
export const GiftBox = ({
  heading = "No rewards yet",
  description = "Invite a friend and you'll both get a reward.",
  actionLabel = "Invite a friend",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: GiftBoxProps) => {
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
      defaultArtClassName="w-44"
      slot="gift-box"
    >
      <Rig pivot={[0, MID_Y, 0]} {...onClock(clock, boxPose(clip), clip.end)}>
        {/* The box first: the lid, written after it, covers its mouth. */}
        <Body />
        <Rig pivot={LID_HINGE} {...onClock(clock, lidPose(clip), clip.end)}>
          <Lid />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default GiftBox;
