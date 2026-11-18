"use client";

import type { MotionValue } from "motion/react";
import { useEffect, useId, useState } from "react";

import { EASE, FacePath, Rig, sample } from "./iso-core";
import type { IsoKey, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LINE,
  LineState,
  Ring,
  Slice,
  faceFill,
  facing,
  r2,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "No projects yet", told by one object in line: a flower pot whose
 * sprout grows out of the soil. Use: first step. Move: grow, then two
 * leaves unfold one after the other. Each value is ms after the art comes
 * into view.
 *
 *    0ms   an empty pot, bare soil
 *  400ms   a shoot pushes up out of the middle of the soil (420ms), a
 *          small folded bud at its tip
 *  740ms   the right leaf unfolds 61°, swings back to 53° and settles at
 *          55° (640ms), growing to full size
 *  840ms   the left leaf follows, 100ms behind, the mirror image
 * 1480ms   still: the grown sprout, both leaves open
 *
 * One way: the resting pose is the grown sprout. Each play after the
 * first sinks it back into the soil (220ms), then grows it again.
 * Reduced motion, or `active` false before any play: the grown sprout,
 * nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // How long the sprout takes to sink back before a replay.
  sink: 220,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built standing on z = 0 about the vertical axis x = y = 0.

// The pot: a tapered body under a straight rim band. Inside the rim's lip
// the soil lies a little lower, so the far inside wall shows above it.
const BODY = { foot: 1.5, h: 2.5, top: 2 };
const RIM = { h: 0.75, lip: 0.25, r: 2.25 };
const RIM_TOP: Vec3 = [0, 0, BODY.h + RIM.h];
const MOUTH = RIM.r - RIM.lip;
const SOIL_Z = RIM_TOP[2] - 0.25;
const SOIL: Vec3 = [0, 0, SOIL_Z];

// The sprout, flat on the plane y = 0 through the pot's axis: a stem, its
// tip rounded, and two leaves that open from its tip.
// Its outline is open at the foot: the stem comes out of the soil, it
// does not stand on it.
const STEM = { h: 2.5, w: 0.25 };
const STEM_TOP = SOIL_Z + STEM.h;
const STEM_EDGE = [
  `M0 ${STEM.h}`,
  `V${STEM.w / 2}`,
  `Q0 0 ${STEM.w / 2} 0`,
  `Q${STEM.w} 0 ${STEM.w} ${STEM.w / 2}`,
  `V${STEM.h}`,
].join(" ");
const STEM_PATH = `${STEM_EDGE} Z`;

// A leaf drawn pointing straight up from its base at 0,0 (face units, v
// down); it opens by turning about that base. Its outer side is fuller
// and its tip curls back toward the stem, so once open it lifts at the
// tip. `side` mirrors it: 1 for the right leaf, -1 for the left.
const LEAF = { len: 1.75, open: 55 };
const leafPath = (side: number) =>
  [
    "M0 0",
    `C${0.875 * side} -0.375 ${side} -1.375 ${-0.125 * side} ${-LEAF.len}`,
    `C${-0.625 * side} -1.25 ${-0.5 * side} -0.375 0 0`,
    "Z",
  ].join(" ");
const veinPath = (side: number) =>
  `M0 -0.25 Q${0.125 * side} -0.875 ${-0.0625 * side} -1.375`;
const LEAF_AT: Vec3 = [0, 0, STEM_TOP];

// The frame fits the pot and the grown sprout: the pot's foot in front,
// its rim behind, and the tips of the open leaves.
const TIP = {
  x: LEAF.len * Math.sin((LEAF.open * Math.PI) / 180),
  z: STEM_TOP + LEAF.len * Math.cos((LEAF.open * Math.PI) / 180),
};
const EXTENT: Vec3[] = [
  [-RIM.r, 0, RIM_TOP[2]],
  [RIM.r, 0, RIM_TOP[2]],
  [0, BODY.foot, 0],
  [0, -RIM.r, RIM_TOP[2]],
  [-TIP.x, 0, TIP.z],
  [TIP.x, 0, TIP.z],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The stem's height scale about the soil, 0 → 1. */
  stem: IsoTrack;
  /** Each leaf's opening angle, degrees, and its size, 0 → 1. */
  right: IsoTrack;
  rightSize: IsoTrack;
  left: IsoTrack;
  leftSize: IsoTrack;
}

/**
 * One leaf opening at `t`: a bud by then, it unfolds past and settles.
 * `side` is 1 for the right leaf (clockwise), -1 for the left.
 */
const unfold = (t: number, side: number): [IsoKey[], IsoKey[]] => [
  [
    [t, 0, EASE.drop],
    [t + 380, side * (LEAF.open + 6), EASE.easy],
    [t + 520, side * (LEAF.open - 2), EASE.easy],
    [t + 640, side * LEAF.open],
  ],
  [
    [t, 0.35, EASE.soft],
    [t + 380, 1],
  ],
];

/** The grow from bare soil, starting at t0. */
const grow = (t0: number) => {
  const up = t0 + 420;
  const first = t0 + 340;
  const [right, rightSize] = unfold(first, 1);
  const [left, leftSize] = unfold(first + 100, -1);
  const bud: IsoKey[] = [
    [t0 + 120, 0, EASE.soft],
    [t0 + 340, 0.35, "hold"],
  ];
  return {
    end: first + 100 + 640,
    left,
    leftSize: [...bud, ...leftSize],
    right,
    rightSize: [...bud, ...rightSize],
    stem: [
      [t0, 0, EASE.soft],
      [up, 1],
    ] as IsoKey[],
  };
};

const INTRO: Clip = grow(TIMING.start);

// A replay starts from the grown sprout: it sinks back into the soil
// (leaves folding and shrinking as the stem drops), then grows again.
const AGAIN: Clip = (() => {
  const t0 = TIMING.again;
  const gone = t0 + TIMING.sink;
  const g = grow(gone + 60);
  const sink = (from: number): IsoKey[] => [
    [t0, from, EASE.in],
    [gone, 0, "hold"],
  ];
  return {
    end: g.end,
    left: [[t0, -LEAF.open, EASE.in], [gone - 60, 0, "hold"], ...g.left],
    leftSize: [...sink(1), ...g.leftSize],
    right: [[t0, LEAF.open, EASE.in], [gone - 60, 0, "hold"], ...g.right],
    rightSize: [...sink(1), ...g.rightSize],
    stem: [...sink(1), ...g.stem],
  };
})();

/** The clock's time as state (parts appear and vanish with it). */
const useBeatTime = (clock: MotionValue<number> | undefined, rest: number) => {
  const [ms, setMs] = useState(0);
  useEffect(() => clock?.on("change", setMs), [clock]);
  return clock ? ms : rest;
};

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The pot, from the foot up: the body, the rim band, then the mouth. The
 * mouth is filled as the far inside wall, the soil (a level circle lower
 * down) is cut to the mouth, and the mouth's edge is drawn again over the
 * cut.
 */
const Pot = () => {
  const mouth = `${useId().replaceAll(":", "")}-mouth`;
  return (
    <>
      <Slice bottom={[[0, 0, 0], BODY.foot]} top={[[0, 0, BODY.h], BODY.top]} />
      <Slice bottom={[[0, 0, BODY.h], RIM.r]} top={[RIM_TOP, RIM.r]} />
      <clipPath id={mouth}>
        <Ring center={RIM_TOP} r={MOUTH} />
      </clipPath>
      <Ring center={RIM_TOP} r={MOUTH} style={faceFill("surface", "right")} />
      <g clipPath={`url(#${mouth})`}>
        <Ring center={SOIL} r={MOUTH} style={faceFill("surface", "left")} />
      </g>
      <Ring center={RIM_TOP} r={MOUTH} />
    </>
  );
};

/** One leaf, open by `turn` degrees (clockwise is right), at `size`. */
const Leaf = ({
  side,
  turn,
  size,
}: {
  side: number;
  turn: number;
  size: number;
}) =>
  size < 0.02 ? null : (
    <Rig axis="y" pivot={LEAF_AT} rotate={r2(turn)} scale={r2(size)}>
      <FacePath
        at={LEAF_AT}
        d={leafPath(side)}
        plane="left"
        style={faceFill("main", "left")}
      />
      <FacePath at={LEAF_AT} d={veinPath(side)} plane="left" style={LINE} />
    </Rig>
  );

/** The sprout at a time on the clip: the stem, then the two leaves. */
const Sprout = ({ clip, ms }: { clip: Clip; ms: number }) => {
  const grown = r2(sample(clip.stem, ms));
  if (grown < 0.02) {
    return null;
  }
  // The leaves ride the stem's tip down into the soil.
  const drop = r2((grown - 1) * STEM.h);
  return (
    <>
      <Rig pivot={SOIL} scale={[1, 1, grown]}>
        <FacePath
          at={[-STEM.w / 2, 0, STEM_TOP]}
          d={STEM_PATH}
          plane="left"
          style={{ ...faceFill("surface", "top"), stroke: "none" }}
        />
        <FacePath
          at={[-STEM.w / 2, 0, STEM_TOP]}
          d={STEM_EDGE}
          plane="left"
          style={LINE}
        />
      </Rig>
      <Rig offset={[0, 0, drop]} pivot={SOIL}>
        <Leaf
          side={-1}
          size={sample(clip.leftSize, ms)}
          turn={sample(clip.left, ms)}
        />
        <Leaf
          side={1}
          size={sample(clip.rightSize, ms)}
          turn={sample(clip.right, ms)}
        />
      </Rig>
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type SproutPotProps = LineStateProps;

/**
 * Sprout pot: a complete "no projects yet" state with a line illustration,
 * a heading, a line of copy and a button. A sprout grows out of the soil
 * of a small flower pot and opens two leaves. One fine outline, paper
 * faces, the leaves the one brand mark, facing the screen, no shadow. Pass
 * `active` (PlayOnHover, or your own state) to play it again. Follows the
 * shadcn theme.
 */
export const SproutPot = ({
  heading = "No projects yet",
  description = "Create your first project and watch it grow.",
  actionLabel = "New project",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: SproutPotProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const ms = useBeatTime(clock, clip.end);
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
      slot="sprout-pot"
    >
      <Pot />
      <Sprout clip={clip} ms={ms} />
    </LineState>
  );
};

export default SproutPot;
