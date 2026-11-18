"use client";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
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
 * "This feature is off", told by one object in line: a pill toggle switch
 * whose knob tries to turn it on and is stopped. Use: blocked state.
 * Move: try and stop. Each value is ms after the art comes into view.
 *
 *    0ms   the knob rests on the off side; the "O" mark on the empty side
 *  400ms   the knob slides toward on, gathering speed (320ms)
 *  720ms   it is stopped a third of the way: squashes 10% against its
 *          leading edge, kicks back a quarter unit, and the "O" pops 18%
 * 1000ms   it waits there, still off (180ms)
 * 1180ms   it slides home (380ms) and lands against the end of the track
 *          with a 7% squash
 * 1860ms   still: off, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the switch resting off.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face of the track is the plane
// y = 0, the knob stands proud of it.

// The track: a pill, a rounded rect with ends of half its height.
const TRACK = { depth: 1.5, h: 4, w: 8 };
const TRACK_AT: Vec3 = [-TRACK.w / 2, 0, TRACK.h];

// The knob: a disc standing proud of the track's face, inset by PAD all
// round. Standing in front, it shows depth / √3 lower than its height, so
// it is raised a quarter unit to sit in the middle of the track.
const PAD = 0.5;
const KNOB = { depth: 0.5, r: TRACK.h / 2 - PAD };
const KNOB_Z = TRACK.h / 2 + 0.25;
// The track's middle, where the brand mark sits.
const MID_Z = TRACK.h / 2;
// Centre of the knob when off (left) and when on (right).
const OFF_X = -TRACK.w / 2 + PAD + KNOB.r;
const ON_X = -OFF_X;

// The brand mark: an "O" (off) printed on the side the knob would go to.
const MARK = { r: 0.6, w: 0.3 };

/** A circle round (cx, cy) as a face path, v down. */
const circle = (cx: number, cy: number, r: number) => {
  const k = r2(r * 0.5523);
  return [
    `M${r2(cx + r)} ${cy}`,
    `C${r2(cx + r)} ${r2(cy + k)} ${r2(cx + k)} ${r2(cy + r)} ${cx} ${r2(cy + r)}`,
    `C${r2(cx - k)} ${r2(cy + r)} ${r2(cx - r)} ${r2(cy + k)} ${r2(cx - r)} ${cy}`,
    `C${r2(cx - r)} ${r2(cy - k)} ${r2(cx - k)} ${r2(cy - r)} ${cx} ${r2(cy - r)}`,
    `C${r2(cx + k)} ${r2(cy - r)} ${r2(cx + r)} ${r2(cy - k)} ${r2(cx + r)} ${cy}`,
    "Z",
  ].join(" ");
};

// A ring on the front face: the outer circle with the inner one cut out.
const RING_PATH = `${circle(MARK.r, MARK.r, MARK.r)} ${circle(MARK.r, MARK.r, MARK.r - MARK.w)}`;

// The frame fits the switch at rest: the track's front face, its top strip
// (depth shows above it) and the knob standing in front.
const EXTENT: Vec3[] = [
  [-TRACK.w / 2, 0, 0],
  [TRACK.w / 2, 0, 0],
  [-TRACK.w / 2, -TRACK.depth, TRACK.h],
  [TRACK.w / 2, -TRACK.depth, TRACK.h],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Knob travel from off, world units (never below 0: it can't pass the end). */
  slide: IsoTrack;
  /** Width scale of the knob about its leading edge as it is stopped. */
  stop: IsoTrack;
  /** Width scale of the knob about its trailing edge as it lands home. */
  land: IsoTrack;
  /** Scale of the "O" mark. */
  mark: IsoTrack;
}

// A third of the way from off to on, rounded to the grid.
const TRY = 1.5;

const beat = (t0: number): Clip => {
  const hit = t0 + 320;
  const back = hit + 460;
  const home = back + 380;
  const slide: IsoKey[] = [
    [t0, 0, EASE.in],
    [hit, TRY, EASE.drop],
    [hit + 140, TRY - 0.25, EASE.easy],
    [hit + 280, TRY - 0.2, "hold"],
    [back, TRY - 0.2, EASE.snap],
    [home, 0],
  ];
  // Stopped: it squashes against nothing, springs back, settles round.
  const stop: IsoKey[] = [
    [hit - 20, 1, EASE.drop],
    [hit + 60, 0.9, EASE.easy],
    [hit + 180, 1.04, EASE.easy],
    [hit + 300, 1],
  ];
  // Home: a smaller squash against the end of the track.
  const land: IsoKey[] = [
    [home - 20, 1, EASE.drop],
    [home + 60, 0.93, EASE.easy],
    [home + 180, 1.02, EASE.easy],
    [home + 300, 1],
  ];
  const mark: IsoKey[] = [
    [hit - 20, 1, EASE.soft],
    [hit + 120, 1.18, EASE.easy],
    [hit + 360, 1],
  ];
  return { end: home + 300, land, mark, slide, stop };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const slidePose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [r2(sample(clip.slide, ms)), 0, 0],
  });

/** A squash in width about one edge; volume is kept, so it grows in height. */
const squashPose =
  (track: IsoTrack) =>
  (ms: number): IsoPose => {
    const s = r2(sample(track, ms));
    return { scale: [s, 1, r2(1 / Math.sqrt(s))] };
  };

const markPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.mark, ms));
    return { scale: [k, 1, k] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** The track: a pill, convex, so the engine draws its far and side edges. */
const Track = () => (
  <Extrude
    at={TRACK_AT}
    convex
    d={roundedRect(TRACK.w, TRACK.h, TRACK.h / 2)}
    depth={TRACK.depth}
    palette="surface"
    plane="left"
  />
);

/** The "O" printed on the track's face, the one brand mark. */
const Mark = () => (
  <FacePath
    at={[ON_X - MARK.r, 0, MID_Z + MARK.r]}
    d={RING_PATH}
    fillRule="evenodd"
    plane="left"
    style={faceFill("main", "left")}
  />
);

/** The knob: a disc standing proud of the track. */
const Knob = () => (
  <Extrude
    at={[OFF_X - KNOB.r, KNOB.depth, KNOB_Z + KNOB.r]}
    convex
    d={disc(KNOB.r)}
    depth={KNOB.depth}
    palette="surface"
    plane="left"
  />
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type ToggleSwitchProps = LineStateProps;

/**
 * Toggle switch: a complete "this feature is off" state with a line
 * illustration, a heading, a line of copy and a button. A pill switch,
 * off: its knob slides toward on, is stopped a third of the way with a
 * small bump, and slides back. One fine outline, paper faces, the "O" on
 * the track the one brand mark, facing the screen, no shadow. Pass
 * `active` (PlayOnHover, or your own state) to play it again. Follows the
 * shadcn theme.
 */
export const ToggleSwitch = ({
  heading = "This feature is off",
  description = "Ask an admin to turn it on for your workspace.",
  actionLabel = "Request access",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ToggleSwitchProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const markAt: Vec3 = [ON_X, 0, MID_Z];
  // The knob squashes about its leading edge when stopped, its trailing
  // edge when it lands home, and stays standing on its middle line.
  const leading: Vec3 = [OFF_X + KNOB.r, KNOB.depth, KNOB_Z];
  const trailing: Vec3 = [OFF_X - KNOB.r, KNOB.depth, KNOB_Z];
  return (
    <LineState
      bounds={BOUNDS}
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
      defaultArtClassName="w-60"
      slot="toggle-switch"
    >
      <Track />
      <Rig pivot={markAt} {...onClock(clock, markPose(clip), clip.end)}>
        <Mark />
      </Rig>
      <Rig pivot={trailing} {...onClock(clock, slidePose(clip), clip.end)}>
        <Rig
          pivot={leading}
          {...onClock(clock, squashPose(clip.stop), clip.end)}
        >
          <Rig
            pivot={trailing}
            {...onClock(clock, squashPose(clip.land), clip.end)}
          >
            <Knob />
          </Rig>
        </Rig>
      </Rig>
    </LineState>
  );
};

export default ToggleSwitch;
