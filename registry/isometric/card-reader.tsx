"use client";

import {
  Box,
  EASE,
  Extrude,
  FacePath,
  Rig,
  roundedRect,
  sample,
} from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ICON,
  LINE,
  LineState,
  circle,
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
 * "No access cards", told by one object in line: a wall-mounted access
 * card reader at the true isometric angle (a mounting plate, a deep body
 * with a reading window, a contactless mark, a status light) and a blank
 * access card held in front of it, which taps the reader once. Use: empty
 * state. Move: a slide along the face's normal, a pop. Each value is ms
 * after the art comes into view.
 *
 *    0ms   the card waits in front of the reader, level with its window,
 *          over the body's lower left corner
 *  400ms   it moves in toward the reader's face, 3 units (320ms, speeding
 *          up, landing soft), stopping half a unit short of it
 *  720ms   it taps: comes off 0.3 and back to 0.1 off its stop (200ms);
 *          the status light pops (1.6×, 300ms)
 * 1120ms   it lifts back out to where it waited (420ms, soft), a hair
 *          past, and settles (120ms)
 * 1660ms   still: exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the reader with the
 * card waiting in front of it.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The card lifts back out this long.
  back: 420,
  // It stays at the reader this long after the tap.
  hold: 200,
  start: 400,
  // The move in to the reader.
  tap: 320,
};

/* How far things move. */
const MOVE = {
  // World units the card moves in toward the reader.
  in: 3,
  // The status light grows this much as the card taps.
  pop: 1.6,
  // The card comes off the reader this far as it taps.
  rebound: 0.3,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built along the world axes: the reader's face is the plane y = 0 (it
// faces +y, down left on screen), its depth runs back to the wall at −y.

// The body: an upright rounded block, 1.5 deep.
const BODY = { d: 1.5, h: 7, r: 0.75, w: 4, z: 0.5 };
const BODY_TOP = BODY.z + BODY.h;
const BODY_AT: Vec3 = [-BODY.w / 2, 0, BODY_TOP];

// The mounting plate behind it: a square-cornered plate against the wall,
// half a unit proud of the body all round.
const PLATE = { d: 0.5, h: 8, w: 5 };
const PLATE_AT: Vec3 = [-PLATE.w / 2, -BODY.d - PLATE.d, 0];

// On the body's face, in face units (u across from the left, v down from
// the top): the status light (the one brand mark), the reading window
// with the contactless mark in it, and the beeper slot under it.
const LIGHT = { r: 0.25, u: 2, v: 1 };
const LIGHT_AT: Vec3 = [BODY_AT[0] + LIGHT.u, 0, BODY_TOP - LIGHT.v];
const WINDOW = { h: 3.5, r: 0.5, u: 0.5, v: 2, w: 3 };
// Three arcs opening right about one centre, spread ±50°.
const WAVES = { radii: [0.5, 1, 1.5], spread: 50, u: 1, v: 3.75 };
const SLOT = { u: [1.5, 2.5] as const, v: 6.25 };

// The access card: a flat face parallel to the reader's, level with the
// window, waiting in front of it (y = CARD.y) with its right edge well
// over the body's lower left; it taps in to y = 0.5.
const CARD = { h: 2.25, r: 0.25, w: 3.5, x: 0.5, y: 3.5, z: 3.75 };
const CARD_AT: Vec3 = [CARD.x - CARD.w / 2, CARD.y, CARD.z + CARD.h / 2];
// On the card: a photo box and two printed lines.
const PHOTO = { h: 1.25, u: 0.5, v: 0.5, w: 1 };
const PRINTED = [
  { u: [2, 3] as const, v: 0.75 },
  { u: [2, 2.75] as const, v: 1.25 },
] as const;

// The frame fits the reader and the card at rest: each rounded outline's
// corners are the ends of its straight edges.
const EXTENT: Vec3[] = [
  // The card.
  [CARD_AT[0], CARD.y, CARD_AT[2]],
  [CARD_AT[0], CARD.y, CARD_AT[2] - CARD.h],
  [CARD_AT[0] + CARD.w, CARD.y, CARD_AT[2] - CARD.h],
  // The body's front bottom and its top back right.
  [BODY.w / 2 - BODY.r, 0, BODY.z],
  [BODY.w / 2, 0, BODY.z + BODY.r],
  // The plate's corners, behind the body.
  [-PLATE.w / 2, -BODY.d - PLATE.d, PLATE.h],
  [PLATE.w / 2, -BODY.d - PLATE.d, PLATE.h],
  [PLATE.w / 2, -BODY.d - PLATE.d, 0],
  [PLATE.w / 2, -BODY.d, 0],
];
const BOUNDS = viewBounds("isometric", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** How far the card has moved toward the reader, world units (−y). */
  card: IsoTrack;
  /** Scale of the status light. */
  light: IsoTrack;
}

const beat = (t0: number): Clip => {
  const at = t0 + TIMING.tap;
  const off = at + 100;
  const still = off + 100;
  const leave = still + TIMING.hold;
  const out = leave + TIMING.back;
  const card: IsoKey[] = [
    [t0, 0, EASE.snap],
    [at, MOVE.in, EASE.easy],
    [off, MOVE.in - MOVE.rebound, EASE.easy],
    [still, MOVE.in - 0.1, "hold"],
    [leave, MOVE.in - 0.1, EASE.soft],
    [out, -0.1, EASE.easy],
    [out + 120, 0],
  ];
  const light: IsoKey[] = [
    [at - 20, 1, EASE.soft],
    [at + 140, MOVE.pop, EASE.easy],
    [at + 300, 1],
  ];
  return { card, end: out + 120, light };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const cardPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [0, -r2(sample(clip.card, ms)), 0],
  });

const lightPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.light, ms));
    return { scale: [k, 1, k] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** An arc as a face path (degrees, v down), cubic segments. */
const arc = (cu: number, cv: number, r: number, a0: number, a1: number) => {
  const n = Math.ceil(Math.abs(a1 - a0) / 90);
  const step = ((a1 - a0) / n) * (Math.PI / 180);
  const k = (4 / 3) * Math.tan(step / 4);
  const start = (a0 * Math.PI) / 180;
  const parts = [
    `M${r2(cu + r * Math.cos(start))} ${r2(cv + r * Math.sin(start))}`,
  ];
  for (let i = 0; i < n; i += 1) {
    const a = start + i * step;
    const b = a + step;
    const p0 = [cu + r * Math.cos(a), cv + r * Math.sin(a)];
    const p3 = [cu + r * Math.cos(b), cv + r * Math.sin(b)];
    const p1 = [p0[0] - k * r * Math.sin(a), p0[1] + k * r * Math.cos(a)];
    const p2 = [p3[0] + k * r * Math.sin(b), p3[1] - k * r * Math.cos(b)];
    parts.push(
      `C${r2(p1[0])} ${r2(p1[1])} ${r2(p2[0])} ${r2(p2[1])} ${r2(p3[0])} ${r2(p3[1])}`
    );
  }
  return parts.join(" ");
};

/** The plate and the body, with the window, the mark and the slot. */
const Reader = () => (
  <>
    <Box at={PLATE_AT} palette="surface" size={[PLATE.w, PLATE.d, PLATE.h]} />
    <Extrude
      at={BODY_AT}
      convex
      d={roundedRect(BODY.w, BODY.h, BODY.r)}
      depth={BODY.d}
      palette="surface"
      plane="left"
    >
      <FacePath
        at={BODY_AT}
        d={roundedRect(WINDOW.w, WINDOW.h, WINDOW.r, WINDOW.u, WINDOW.v)}
        plane="left"
        style={LINE}
      />
      {WAVES.radii.map((r) => (
        <FacePath
          at={BODY_AT}
          d={arc(WAVES.u, WAVES.v, r, -WAVES.spread, WAVES.spread)}
          key={r}
          plane="left"
          style={LINE}
        />
      ))}
      <FacePath
        at={BODY_AT}
        d={`M${SLOT.u[0]} ${SLOT.v} H${SLOT.u[1]}`}
        plane="left"
        style={LINE}
      />
    </Extrude>
  </>
);

/** The status light on the body's face, the one brand mark. */
const Light = () => (
  <FacePath
    at={BODY_AT}
    d={circle(LIGHT.u, LIGHT.v, LIGHT.r)}
    plane="left"
    style={faceFill("main", "left")}
  />
);

/** The access card: a blank face with a photo box and two printed lines. */
const Card = () => (
  <>
    <FacePath
      at={CARD_AT}
      d={roundedRect(CARD.w, CARD.h, CARD.r)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <FacePath
      at={CARD_AT}
      d={`M${PHOTO.u} ${PHOTO.v} H${PHOTO.u + PHOTO.w} V${PHOTO.v + PHOTO.h} H${PHOTO.u} Z`}
      plane="left"
      style={LINE}
    />
    {PRINTED.map(({ u, v }) => (
      <FacePath
        at={CARD_AT}
        d={`M${u[0]} ${v} H${u[1]}`}
        key={v}
        plane="left"
        style={LINE}
      />
    ))}
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type CardReaderProps = LineStateProps;

/**
 * Card reader: a complete "no access cards" state with a line
 * illustration, a heading, a line of copy and a button. A wall-mounted
 * access card reader at the true isometric angle (a mounting plate, a
 * deep body with a reading window, a contactless mark and a beeper slot)
 * and a blank access card in front of it: the card taps the reader's face,
 * the status light pops, and the card lifts back. One fine outline, paper
 * faces, the status light the one brand mark, no shadow. Plays when it
 * comes into view, or each time `active` turns true (PlayOnHover, or your
 * own state). Follows the shadcn theme.
 */
export const CardReader = ({
  heading = "No access cards",
  description = "Issue a card to give someone access to the building.",
  actionLabel = "Issue card",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: CardReaderProps) => {
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
      defaultArtClassName="w-44"
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
      slot="card-reader"
      view="isometric"
    >
      {/* Back to front: the plate and the body, the status light, then the
          card in front of all of it. */}
      <Reader />
      <Rig pivot={LIGHT_AT} {...onClock(clock, lightPose(clip), clip.end)}>
        <Light />
      </Rig>
      <Rig pivot={[0, 0, 0]} {...onClock(clock, cardPose(clip), clip.end)}>
        <Card />
      </Rig>
    </LineState>
  );
};

export default CardReader;
