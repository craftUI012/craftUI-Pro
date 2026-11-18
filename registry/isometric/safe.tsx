"use client";

import {
  Box,
  EASE,
  FacePath,
  Rig,
  roundedRect,
  sample,
  useIsoId,
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
 * "Your vault is empty", told by one object in line: a small safe at the
 * true isometric angle whose dial spins, whose wheel handle turns, and
 * whose door swings open a little on its hinge to show nothing inside,
 * then shuts. Use: empty state. Move: turns about the door's normal, then
 * a hinge that opens and shuts without crossing its housing. Each value
 * is ms after the art comes into view.
 *
 *    0ms   the safe stands shut
 *  400ms   the dial spins 240° one way (380ms, fast out, soft in) and
 *          120° back (240ms), as if entering a combination
 * 1040ms   the wheel handle turns a third of a turn (300ms)
 * 1360ms   the door swings open 34° on its hinge (300ms, soft) and
 *          settles at 32° (100ms): the inside is empty
 * 1760ms   it holds open (280ms)
 * 2040ms   it swings shut (220ms, speeding up), knocks 1.5° off the frame
 *          and back (140ms)
 * 2400ms   the wheel turns back (260ms)
 * 2660ms   still: shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the safe, shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The dial's turn back.
  back: 240,
  // How long the door holds open.
  hold: 280,
  // The door's knock off the frame as it shuts.
  knock: 140,
  // The door's swing open, and its settle.
  open: 300,
  settle: 100,
  // The door's swing shut.
  shut: 220,
  // The dial's spin.
  spin: 380,
  start: 400,
  // The wheel's turn, and its turn back.
  turn: 300,
  unturn: 260,
};

/* How far things move, degrees. */
const MOVE = {
  // The dial's spin, then its turn back.
  back: 120,
  // The door's knock off the frame as it shuts.
  knock: 1.5,
  // How far the door opens, and how far it swings before settling.
  open: 32,
  over: 34,
  spin: 240,
  // The wheel's turn: a third, so its spokes land where they were.
  turn: 120,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Seen in isometric, standing on z = 0: the door is on the +y face (down
// left on screen), its hinge on the left; the plain side faces +x.

// Four short feet, flush with the body's corners.
const FOOT = { h: 0.5, w: 1 };
const BODY = { d: 6, h: 6.5, w: 8 };
const BODY_AT: Vec3 = [-BODY.w / 2, -BODY.d / 2, FOOT.h];
const FRONT_Y = BODY.d / 2;
const SIDE_X = BODY.w / 2;
const TOP_Z = FOOT.h + BODY.h;

// The door: a slab standing 0.5 proud of the front, set in 1 from its
// edges (not 0.5, or its front edge lands on the body's edge on screen).
// Face units on its front: u across from its left, v down from its top.
const DOOR = { d: 0.5, inset: 1 };
const DOOR_W = BODY.w - DOOR.inset * 2;
const DOOR_H = BODY.h - DOOR.inset * 2;
const DOOR_X = -DOOR_W / 2;
const DOOR_Z = FOOT.h + DOOR.inset;
const DOOR_FRONT = FRONT_Y + DOOR.d;
const DOOR_AT: Vec3 = [DOOR_X, DOOR_FRONT, DOOR_Z + DOOR_H];
// It swings about its back left edge, so all of it stays in front of the
// body as it opens.
const HINGE: Vec3 = [DOOR_X, FRONT_Y, 0];
// Two hinge plates on the door's left edge, above and below the dial.
const PLATES = { h: 0.5, v: [0.5, DOOR_H - 1], w: 0.75 };

/** A point on the door's front, from face units. */
const onDoor = (u: number, v: number): Vec3 => [
  DOOR_X + u,
  DOOR_FRONT,
  DOOR_Z + DOOR_H - v,
];

// The opening behind the door, 0.5 in from its edges; the walls are 0.5
// thick, so the inside runs back to 0.5 short of the back.
const OPENING = { inset: 0.5, wall: 0.5 };
const IN_X0 = DOOR_X + OPENING.inset;
const IN_X1 = -IN_X0;
const IN_Z0 = DOOR_Z + OPENING.inset;
const IN_Z1 = DOOR_Z + DOOR_H - OPENING.inset;
const IN_BACK = -FRONT_Y + OPENING.wall;

// The dial, flat on the door: twelve ticks round its rim and its knob.
// The index mark above it is the one brand mark.
const DIAL = {
  knob: 0.5,
  r: 1.25,
  tick: [0.75, 1] as const,
  ticks: 12,
  u: 1.75,
  v: 2.25,
};
const DIAL_C = onDoor(DIAL.u, DIAL.v);
// It points down at the dial, its tip on the dial's rim.
const INDEX = { tip: 1, top: 0.5, w: 0.75 };

// The wheel handle: three spokes round a hub.
const WHEEL = { hub: 0.5, spoke: 1, u: 4.5, v: 2.25, w: 0.5 };
const WHEEL_C = onDoor(WHEEL.u, WHEEL.v);
const SPOKES = [0, 120, 240] as const;

// The frame fits the safe at rest: the body, its feet and the proud door.
// The open door runs into the padding.
const EXTENT: Vec3[] = [
  [-SIDE_X, FRONT_Y, FOOT.h],
  [-SIDE_X, -FRONT_Y, TOP_Z],
  [SIDE_X, -FRONT_Y, FOOT.h],
  [SIDE_X, -FRONT_Y, TOP_Z],
  [-SIDE_X, FRONT_Y, 0],
  [SIDE_X, FRONT_Y, 0],
  [SIDE_X, -FRONT_Y, 0],
  [DOOR_X, DOOR_FRONT, DOOR_Z],
  [-DOOR_X, DOOR_FRONT, DOOR_Z],
];
const BOUNDS = viewBounds("isometric", EXTENT);

// Inside faces, a step darker than the darkest wall: the back darkest,
// the floor lightest.
const INSIDE = {
  back: "oklch(from var(--iso-surface-right-c) calc(l - 0.12) c h)",
  floor: "oklch(from var(--iso-surface-right-c) calc(l - 0.06) c h)",
  side: "oklch(from var(--iso-surface-right-c) calc(l - 0.09) c h)",
};

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The dial's turn, degrees. */
  dial: IsoTrack;
  /** The door's swing, degrees (never below 0: shut is its stop). */
  door: IsoTrack;
  /** The wheel's turn, degrees. */
  wheel: IsoTrack;
}

const beat = (t0: number): Clip => {
  const spun = t0 + TIMING.spin;
  const dialed = spun + TIMING.back;
  const turn = dialed + 20;
  const turned = turn + TIMING.turn;
  const out = turned + 20;
  const open = out + TIMING.open;
  const close = open + TIMING.settle + TIMING.hold;
  const shut = close + TIMING.shut;
  const knocked = shut + TIMING.knock;
  const dial: IsoKey[] = [
    [t0, 0, EASE.snap],
    [spun, MOVE.spin, EASE.snap],
    [dialed, MOVE.spin - MOVE.back],
  ];
  const door: IsoKey[] = [
    [out, 0, EASE.soft],
    [open, MOVE.over, EASE.easy],
    [open + TIMING.settle, MOVE.open, "hold"],
    [close, MOVE.open, EASE.in],
    [shut, 0, EASE.easy],
    [shut + TIMING.knock / 2, MOVE.knock, EASE.easy],
    [knocked, 0],
  ];
  const wheel: IsoKey[] = [
    [turn, 0, EASE.snap],
    [turned, MOVE.turn, "hold"],
    [knocked, MOVE.turn, EASE.snap],
    [knocked + TIMING.unturn, 0],
  ];
  return { dial, door, end: knocked + TIMING.unturn, wheel };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const doorPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "z",
    rotate: r2(sample(clip.door, ms)),
  });

// Twelve equal ticks: a turn of 30° looks the same, so the dial is held
// to the last 30° (it lands straight, and still reads as one long spin).
const dialPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.dial, ms) % (360 / DIAL.ticks)),
  });

const wheelPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.wheel, ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const rect = (w: number, h: number) => `M0 0 H${w} V${h} H0 Z`;
const PAPER = faceFill("surface", "top");

/** The feet and the body. */
const Body = () => {
  const [x, y] = BODY_AT;
  const feet = [
    [x, y],
    [SIDE_X - FOOT.w, y],
    [x, FRONT_Y - FOOT.w],
    [SIDE_X - FOOT.w, FRONT_Y - FOOT.w],
  ] as const;
  return (
    <>
      {feet.map(([fx, fy]) => (
        <Box
          at={[fx, fy, 0]}
          key={`${fx},${fy}`}
          palette="surface"
          size={[FOOT.w, FOOT.w, FOOT.h]}
        />
      ))}
      <Box at={BODY_AT} palette="surface" size={[BODY.w, BODY.d, BODY.h]} />
    </>
  );
};

/**
 * The empty inside, seen through the opening: the back wall, the left
 * wall and the floor, cut at the opening, then the opening's edge again.
 */
const Inside = () => {
  const id = useIsoId();
  const mouth: Vec3 = [IN_X0, FRONT_Y, IN_Z1];
  const w = IN_X1 - IN_X0;
  const h = IN_Z1 - IN_Z0;
  const deep = FRONT_Y - IN_BACK;
  return (
    <>
      <defs>
        <clipPath id={`${id}-mouth`}>
          <FacePath at={mouth} d={rect(w, h)} plane="left" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-mouth)`}>
        <FacePath
          at={[IN_X0, IN_BACK, IN_Z1]}
          d={rect(w, h)}
          plane="left"
          style={{ ...LINE, fill: INSIDE.back }}
        />
        <FacePath
          at={[IN_X0, FRONT_Y, IN_Z1]}
          d={rect(deep, h)}
          plane="right"
          style={{ ...LINE, fill: INSIDE.side }}
        />
        <FacePath
          at={[IN_X0, IN_BACK, IN_Z0]}
          d={rect(w, deep)}
          plane="top"
          style={{ ...LINE, fill: INSIDE.floor }}
        />
      </g>
      <FacePath at={mouth} d={rect(w, h)} plane="left" style={LINE} />
    </>
  );
};

/** The hinge plates and the dial's index mark (the brand) on the door. */
const DoorMarks = () => (
  <>
    {PLATES.v.map((v) => (
      <FacePath
        at={DOOR_AT}
        d={`M0 ${v} H${PLATES.w} V${v + PLATES.h} H0 Z`}
        key={v}
        plane="left"
        style={PAPER}
      />
    ))}
    <FacePath
      at={DOOR_AT}
      d={`M${DIAL.u - INDEX.w / 2} ${INDEX.top} H${DIAL.u + INDEX.w / 2} L${DIAL.u} ${INDEX.tip} Z`}
      plane="left"
      style={faceFill("main", "left")}
    />
  </>
);

/** The dial: its face, the ticks that spin, and its knob. */
const Dial = ({ spin }: { spin: ReturnType<typeof onClock> }) => (
  <>
    <FacePath at={DIAL_C} d={circle(0, 0, DIAL.r)} plane="left" style={PAPER} />
    <Rig pivot={DIAL_C} {...spin}>
      {Array.from({ length: DIAL.ticks }, (_, i) => {
        const a = (i / DIAL.ticks) * Math.PI * 2;
        const [r0, r1] = DIAL.tick;
        return (
          <FacePath
            at={DIAL_C}
            d={`M${r2(r0 * Math.sin(a))} ${r2(-r0 * Math.cos(a))} L${r2(r1 * Math.sin(a))} ${r2(-r1 * Math.cos(a))}`}
            key={a}
            plane="left"
            style={LINE}
          />
        );
      })}
    </Rig>
    <FacePath
      at={DIAL_C}
      d={circle(0, 0, DIAL.knob)}
      plane="left"
      style={faceFill("surface", "left")}
    />
  </>
);

/** The wheel handle: three spokes, then the hub over their feet. */
const Wheel = ({ turn }: { turn: ReturnType<typeof onClock> }) => (
  <Rig pivot={WHEEL_C} {...turn}>
    {SPOKES.map((deg) => (
      <Rig axis="y" key={deg} pivot={WHEEL_C} rotate={deg}>
        <FacePath
          at={WHEEL_C}
          d={roundedRect(
            WHEEL.w,
            WHEEL.spoke,
            WHEEL.w / 2,
            -WHEEL.w / 2,
            -WHEEL.spoke
          )}
          plane="left"
          style={PAPER}
        />
      </Rig>
    ))}
    <FacePath
      at={WHEEL_C}
      d={circle(0, 0, WHEEL.hub)}
      plane="left"
      style={faceFill("surface", "left")}
    />
  </Rig>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type SafeProps = LineStateProps;

/**
 * Safe: a complete "your vault is empty" state with a line illustration,
 * a heading, a line of copy and a button. A small safe at the true
 * isometric angle (feet, a proud door with two hinge plates, a combination
 * dial with ticks, a three-spoke wheel handle): its dial spins, its wheel
 * turns, and its door swings open a little on an empty inside and shuts.
 * One fine outline, paper faces, the dial's index mark the one brand mark,
 * no shadow. Plays when it comes into view, or each time `active` turns
 * true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const Safe = ({
  heading = "Your vault is empty",
  description = "Secrets you store will be kept here, encrypted.",
  actionLabel = "Add a secret",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: SafeProps) => {
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
      slot="safe"
      view="isometric"
    >
      <Body />
      <Inside />
      <Rig pivot={HINGE} {...onClock(clock, doorPose(clip), clip.end)}>
        <Box
          at={[DOOR_X, FRONT_Y, DOOR_Z]}
          palette="surface"
          size={[DOOR_W, DOOR.d, DOOR_H]}
        />
        <DoorMarks />
        <Dial spin={onClock(clock, dialPose(clip), clip.end)} />
        <Wheel turn={onClock(clock, wheelPose(clip), clip.end)} />
      </Rig>
    </LineState>
  );
};

export default Safe;
