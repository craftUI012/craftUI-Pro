"use client";

import { EASE, FacePath, Rig, sample, useIsoId } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LINE,
  LineState,
  Slice,
  circle,
  faceFill,
  onClock,
  r2,
  ring,
  useLineShell,
  viewBounds,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "No cameras online", told by one object in line: a webcam on a small
 * stand at the true isometric angle (a round head with its lens in a
 * proud barrel, a privacy shutter over the lens, a status light, a neck
 * down to a round foot) that opens its shutter, looks one way and the
 * other, finds nothing and closes again. Use: empty state. Move: a slide
 * cut at its track, a pan about the neck, a pop. Each value is ms after
 * the art comes into view.
 *
 *    0ms   the webcam looks straight ahead, its shutter shut
 *  400ms   the shutter slides open into the barrel (300ms, soft): the
 *          lens shows
 *  760ms   the head pans 12° to one side about its neck (320ms), holds
 *          (120ms)
 * 1200ms   it pans across to 12° the other way (440ms), holds (120ms)
 * 1760ms   it turns back to straight ahead (280ms), a degree past and
 *          home (120ms): nothing there
 * 2200ms   the shutter slides shut (240ms, speeding up)
 * 2420ms   the status light pops 1.6× (300ms)
 * 2740ms   still: exactly as it started
 *
 * The shutter is clipped to the lens opening: the part slid into the
 * barrel is never drawn. Rest to rest, so one clip built twice: 400ms
 * wait in view, 80ms when `active` turns true.
 * Reduced motion, or `active` false before any play: the webcam looking
 * straight ahead, shutter shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The pan across, from one side to the other.
  across: 440,
  again: 80,
  // The shutter sliding shut.
  close: 240,
  // A hold at each side of the look.
  hold: 120,
  // The turn back home.
  home: 280,
  // The shutter sliding open.
  open: 300,
  // The pan out to the first side.
  out: 320,
  // The light's pop.
  pop: 300,
  // The small settle after the turn home.
  settle: 120,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // The pan to each side, degrees about the neck.
  look: 12,
  // The overshoot as the head turns home, degrees.
  over: 1,
  // The light grows this much as the shutter shuts.
  pop: 1.6,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built standing on z = 0 about the vertical x = y = 0, looking along +y
// (down left on screen).

// The foot: a low round base, a boss where the neck enters, the neck.
const FOOT = { h: 0.5, r: 2.5 };
const BOSS = { h: 0.5, r: 1 };
const NECK = { r: 0.5 };

// The head: a drum lying on its side, its axis along y, centred over the
// neck. It is cut into two slices so a seam runs round its side.
const HEAD = { d: 2, r: 3.5 };
const HEAD_Z = 2.5 + HEAD.r;
const HEAD_BACK = -HEAD.d / 2;
const HEAD_FRONT = HEAD.d / 2;

// The lens barrel: 0.5 proud of the head's front, the lens opening in it,
// and the lens's rings, each 0.5 inside the last.
const BARREL = { d: 0.5, r: 2 };
const BARREL_FRONT = HEAD_FRONT + BARREL.d;
const LENS = { open: 1.5, pupil: 0.5, ring: 1 };

// The shutter slides right into the barrel by the opening's width.
const SLIDE = LENS.open * 2;

// The status light on the head's front, up and right of the barrel: the
// one brand mark (face units from the head's centre, v down).
const LIGHT = { r: 0.25, u: 2, v: -2 };
const LIGHT_AT: Vec3 = [LIGHT.u, HEAD_FRONT, HEAD_Z - LIGHT.v];

const HEAD_C = (y: number): Vec3 => [0, y, HEAD_Z];

/** Points round a circle standing in a y plane (the head's rings). */
const upright = ([cx, cy, cz]: Vec3, r: number, n = 32): Vec3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy, cz + r * Math.sin(a)] as Vec3;
  });

// The frame fits the webcam at rest: the foot, the head's back and front
// rings and the barrel. The pan runs into the padding.
const EXTENT: Vec3[] = [
  ...ring([0, 0, 0], FOOT.r, 16),
  ...ring([0, 0, FOOT.h], FOOT.r, 16),
  ...upright(HEAD_C(HEAD_BACK), HEAD.r),
  ...upright(HEAD_C(HEAD_FRONT), HEAD.r),
  ...upright(HEAD_C(BARREL_FRONT), BARREL.r),
];
const BOUNDS = viewBounds("isometric", EXTENT);

// Lens glass: a step darker than the darkest wall; the pupil darker still.
const GLASS = {
  glass: "oklch(from var(--iso-surface-right-c) calc(l - 0.1) c h)",
  pupil: "oklch(from var(--iso-surface-right-c) calc(l - 0.16) c h)",
};

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** How far the shutter has slid open, world units (0 shut). */
  shutter: IsoTrack;
  /** The head's pan about the neck, degrees. */
  pan: IsoTrack;
  /** Scale of the status light. */
  light: IsoTrack;
}

const beat = (t0: number): Clip => {
  const opened = t0 + TIMING.open;
  const out = opened + 60;
  const left = out + TIMING.out;
  const across = left + TIMING.hold;
  const right = across + TIMING.across;
  const back = right + TIMING.hold;
  const home = back + TIMING.home;
  const settled = home + TIMING.settle;
  const shut = settled + 40;
  const closed = shut + TIMING.close;
  const shutter: IsoKey[] = [
    [t0, 0, EASE.soft],
    [opened, SLIDE, "hold"],
    [shut, SLIDE, EASE.in],
    [closed, 0],
  ];
  const pan: IsoKey[] = [
    [out, 0, EASE.easy],
    [left, MOVE.look, "hold"],
    [across, MOVE.look, EASE.easy],
    [right, -MOVE.look, "hold"],
    [back, -MOVE.look, EASE.easy],
    [home, MOVE.over, EASE.easy],
    [settled, 0],
  ];
  const light: IsoKey[] = [
    [closed - 20, 1, EASE.soft],
    [closed + 140, MOVE.pop, EASE.easy],
    [closed + TIMING.pop, 1],
  ];
  return { end: closed + TIMING.pop, light, pan, shutter };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const panPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "z",
    rotate: r2(sample(clip.pan, ms)),
  });

const shutterPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [r2(sample(clip.shutter, ms)), 0, 0],
  });

const lightPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.light, ms));
    return { scale: [k, 1, k] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * A drum lying on its side, from y0 back to y1 in front: a level slice
 * turned to stand up (its top becomes the front face).
 */
const Drum = ({ y0, y1, r }: { y0: number; y1: number; r: number }) => {
  const at = HEAD_C(y0);
  return (
    <Rig axis="x" pivot={at} rotate={-90}>
      <Slice bottom={[at, r]} top={[[at[0], at[1], at[2] + (y1 - y0)], r]} />
    </Rig>
  );
};

/** The round foot, the boss and the neck, from the floor up. */
const Stand = () => (
  <>
    <Slice bottom={[[0, 0, 0], FOOT.r]} top={[[0, 0, FOOT.h], FOOT.r]} />
    <Slice
      bottom={[[0, 0, FOOT.h], BOSS.r]}
      top={[[0, 0, FOOT.h + BOSS.h], BOSS.r]}
    />
    <Slice
      bottom={[[0, 0, FOOT.h + BOSS.h], NECK.r]}
      top={[[0, 0, HEAD_Z - HEAD.r + 0.5], NECK.r]}
    />
  </>
);

/** The lens behind the shutter: dark glass, a ring and the pupil. */
const Lens = () => {
  const at = HEAD_C(BARREL_FRONT);
  return (
    <>
      <FacePath
        at={at}
        d={circle(0, 0, LENS.open)}
        plane="left"
        style={{ ...LINE, fill: GLASS.glass }}
      />
      <FacePath at={at} d={circle(0, 0, LENS.ring)} plane="left" style={LINE} />
      <FacePath
        at={at}
        d={circle(0, 0, LENS.pupil)}
        plane="left"
        style={{ ...LINE, fill: GLASS.pupil }}
      />
    </>
  );
};

/**
 * The privacy shutter: a plate a shade under the face, with three grip
 * ribs, over the lens. It is clipped to the opening, so as it slides
 * right the part inside the barrel is cut away; then the opening's edge
 * is drawn again over the cut.
 */
const Shutter = ({ slide }: { slide: ReturnType<typeof onClock> }) => {
  const id = useIsoId();
  const at = HEAD_C(BARREL_FRONT);
  const o = LENS.open;
  return (
    <>
      <defs>
        <clipPath id={`${id}-lens`}>
          <FacePath at={at} d={circle(0, 0, o)} plane="left" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-lens)`}>
        <Rig pivot={at} {...slide}>
          <FacePath
            at={at}
            d={`M${-o} ${-o} H${o} V${o} H${-o} Z`}
            plane="left"
            style={faceFill("surface", "right")}
          />
          {[-0.5, 0, 0.5].map((u) => (
            <FacePath
              at={at}
              d={`M${u} -0.5 V0.5`}
              key={u}
              plane="left"
              style={LINE}
            />
          ))}
        </Rig>
      </g>
      <FacePath at={at} d={circle(0, 0, o)} plane="left" style={LINE} />
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type WebcamProps = LineStateProps;

/**
 * Webcam: a complete "no cameras online" state with a line illustration,
 * a heading, a line of copy and a button. A webcam on a small stand at
 * the true isometric angle (a round head, its lens in a proud barrel
 * behind a sliding privacy shutter, a status light, a neck down to a
 * round foot): its shutter slides open, it looks one way and the other
 * about its neck, finds nothing, settles and slides its shutter shut, and
 * its light pops. One fine outline, paper faces, the status light the one
 * brand mark, no shadow. Plays when it comes into view, or each time
 * `active` turns true (PlayOnHover, or your own state). Follows the
 * shadcn theme.
 */
export const Webcam = ({
  heading = "No cameras online",
  description = "Connect a camera to see its feed here.",
  actionLabel = "Connect camera",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: WebcamProps) => {
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
      defaultArtClassName="w-40"
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
      slot="webcam"
      view="isometric"
    >
      <Stand />
      <Rig pivot={[0, 0, 0]} {...onClock(clock, panPose(clip), clip.end)}>
        <Drum r={HEAD.r} y0={HEAD_BACK} y1={0} />
        <Drum r={HEAD.r} y0={0} y1={HEAD_FRONT} />
        <Drum r={BARREL.r} y0={HEAD_FRONT} y1={BARREL_FRONT} />
        <Lens />
        <Shutter slide={onClock(clock, shutterPose(clip), clip.end)} />
        <Rig pivot={LIGHT_AT} {...onClock(clock, lightPose(clip), clip.end)}>
          <FacePath
            at={LIGHT_AT}
            d={circle(0, 0, LIGHT.r)}
            plane="left"
            style={faceFill("main", "left")}
          />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default Webcam;
