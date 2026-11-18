"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { useState } from "react";

import {
  Box,
  EASE,
  Extrude,
  FacePath,
  Rig,
  roundedRect,
  sample,
  useIsoId,
} from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
  FarEdge,
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
 * "No mail yet", told by one object in line: a mailbox on its post whose
 * door drops open, shows nothing inside, and swings shut.
 * Use: empty state. Move: a door falling open on its bottom hinge.
 * Each value is ms after the art comes into view.
 *
 *    0ms   the mailbox stands shut, its flag down
 *  400ms   the door falls open on its bottom hinge, speeding up (360ms)
 *  760ms   it hits its stop at 78°, rebounds to 68° and rests at 74°
 *          (210ms): the box shows, empty to the back wall
 *  970ms   it hangs open (400ms)
 * 1370ms   it swings back up (340ms, speeding up) and knocks shut
 * 1710ms   it bounces 5° open and settles (220ms)
 * 1930ms   still: the mailbox shut, exactly as it started; the flag never
 *          moves (no mail, so it stays down)
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the mailbox standing shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // How long the door hangs open.
  hold: 400,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front of the door is the plane y = 0.

/**
 * An arch as a face path from its box's top-left corner: straight sides
 * `straight` high under a half circle as wide as the arch.
 */
const arch = (w: number, straight: number) => {
  const r = w / 2;
  const k = r2(r * ARC);
  const h = straight + r;
  return [
    `M0 ${h}`,
    `V${r}`,
    `C0 ${r - k} ${r - k} 0 ${r} 0`,
    `C${r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `V${h}`,
    "Z",
  ].join(" ");
};

// The post, and the board on top of it the box is bolted to. The board
// reaches the front of the box and half a unit past it each side, as far
// as the flag reaches on the right, so the drawing is even about x = 0.
// It is short front to back: from the front only its edge and a little of
// its top show, and a deep board showed as two tall rails beside the box.
const POST = { h: 3, w: 1.5 };
const BOARD = { d: 2, h: 0.5, w: 8 };
const BASE = POST.h + BOARD.h;

// The box: a tunnel of thin sheet, an arch at the front, DEPTH long. Its
// front is the plane y = 0, where the door sits.
const BODY = { straight: 2.5, w: 7 };
const BODY_PATH = arch(BODY.w, BODY.straight);
const DEPTH = 5;
const BODY_TOP = BASE + BODY.straight + BODY.w / 2;
const BODY_AT: Vec3 = [-BODY.w / 2, 0, BODY_TOP];
const BODY_Y = 0;
const BACK_Y = BODY_Y - DEPTH;
const POST_Y = -BOARD.d / 2;

// The mouth inside the front: the arch set in by the sheet's thickness.
const WALL = 0.5;
const MOUTH_W = BODY.w - WALL * 2;
const MOUTH_PATH = arch(MOUTH_W, BODY.straight - WALL);
const MOUTH_TOP = BODY_TOP - WALL;
const MOUTH_AT: Vec3 = [-MOUTH_W / 2, BODY_Y, MOUTH_TOP];
// The inside of the back wall, the far wall seen through the mouth.
const FAR_AT: Vec3 = [-MOUTH_W / 2, BACK_Y + WALL, MOUTH_TOP];

// The door: a sheet the shape of the box's front, hinged along its bottom
// edge on the board. Its pull near the top. It lies on the box's front
// with one outline: a door a little proud and a little wider drew its
// front edge, its back edge and the box's rim within a pixel or two of
// each other down both curved flanks.
const DOOR_W = BODY.w;
const DOOR_PATH = BODY_PATH;
const DOOR_TOP = BODY_TOP;
const DOOR_AT: Vec3 = BODY_AT;
const HINGE: Vec3 = [0, 0, BASE];
const PULL = { h: 0.5, w: 1.5, y: 0.75 };

// The flag, the one brand mark: down, its plate flat against the right
// side of the box near the front (its inner edge is the box's side line).
// From the front it shows end on, as a tab: the plate's end and its top.
// (Its arm runs back behind the plate and is hidden by it, so it is not
// drawn.)
const FLAG_X = BODY.w / 2;
const FLAG = { d: 1.5, h: 1.5, t: 0.5, y: BODY_Y - 0.5, z: BASE + 1.5 };
const FLAG_AT: Vec3 = [FLAG_X, FLAG.y - FLAG.d, FLAG.z];

// The frame fits the mailbox shut, from the post's foot to the top of the
// box's back, as wide as the board.
const EXTENT: Vec3[] = [
  [-BOARD.w / 2, 0, POST.h],
  [BOARD.w / 2, 0, POST.h],
  [-POST.w / 2, POST_Y + POST.w / 2, 0],
  [POST.w / 2, POST_Y + POST.w / 2, 0],
  [0, BACK_Y, BODY_TOP],
  [0, 0, DOOR_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The door's turn about its hinge, degrees; negative drops it open. */
  door: IsoTrack;
}

const beat = (t0: number): Clip => {
  const stop = t0 + 360;
  const open = stop + 210;
  const close = open + TIMING.hold;
  const shut = close + 340;
  // Starts at rest and only ever opens (negative): it never swings into
  // the box, even as it bounces shut.
  const door: IsoKey[] = [
    [t0, 0, EASE.in],
    [stop, -78, EASE.easy],
    [stop + 100, -68, EASE.easy],
    [open, -74, "hold"],
    [close, -74, EASE.in],
    [shut, 0, EASE.easy],
    [shut + 90, -5, EASE.easy],
    [shut + 220, 0],
  ];
  return { door, end: shut + 220 };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const doorPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "x",
    rotate: r2(sample(clip.door, ms)),
  });

// From 30° above, a face turned more than 60° down from upright is edge on
// and then faces away: past that the door shows its inside instead.
const EDGE_ON = -60;

/**
 * Whether the door has dropped past edge on, read from the clock as state
 * (which side to draw is a choice of what to write, not a pose).
 */
const useDoorInside = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const [inside, setInside] = useState(false);
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    setInside(sample(clip.door, ms) < EDGE_ON);
  });
  return clock ? inside : false;
};

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The box's outline from its foot up one side, over the arch and down
// the other (face units): on the back plane, all of the far edge that
// shows. Below the front's arch it lies exactly on the front's sides.
const BODY_RIM = (() => {
  const r = BODY.w / 2;
  const k = r2(r * ARC);
  const h = BODY.straight + r;
  return [
    `M0 ${h}`,
    `V${r}`,
    `C0 ${r2(r - k)} ${r2(r - k)} 0 ${r} 0`,
    `C${r2(r + k)} 0 ${BODY.w} ${r2(r - k)} ${BODY.w} ${r}`,
    `V${h}`,
  ].join(" ");
})();

/**
 * The post, the board on it, and the box. The box never moves, so its far
 * edge is drawn exactly (the engine's convex outline is a hull of sampled
 * points, which drew a faceted second line beside the round back edge).
 */
const Stand = () => (
  <>
    <Box
      at={[-POST.w / 2, POST_Y - POST.w / 2, 0]}
      palette="surface"
      size={[POST.w, POST.w, POST.h]}
    />
    <Box
      at={[-BOARD.w / 2, -BOARD.d, POST.h]}
      palette="surface"
      size={[BOARD.w, BOARD.d, BOARD.h]}
    />
    <Extrude
      at={BODY_AT}
      d={BODY_PATH}
      depth={DEPTH}
      palette="surface"
      plane="left"
    />
    <FarEdge at={BODY_AT} chain={BODY_RIM} depth={DEPTH} joins={[]} />
  </>
);

/**
 * Seen through the mouth: the floor, and above it the far wall, cut to
 * the mouth. The far wall is the mouth's own arch on the back plane, so its
 * bottom edge is exactly the floor's far edge. The mouth's outline goes on
 * last, over the cut.
 */
const Inside = () => {
  const id = useIsoId();
  return (
    <>
      <defs>
        <clipPath id={`${id}-mouth`}>
          <FacePath at={MOUTH_AT} d={MOUTH_PATH} plane="left" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-mouth)`}>
        <FacePath
          at={MOUTH_AT}
          d={MOUTH_PATH}
          plane="left"
          style={faceFill("surface", "left")}
        />
        <FacePath
          at={FAR_AT}
          d={MOUTH_PATH}
          plane="left"
          style={faceFill("surface", "right")}
        />
      </g>
      <FacePath at={MOUTH_AT} d={MOUTH_PATH} plane="left" style={LINE} />
    </>
  );
};

/** The flag, down: a plate flat against the box's side. */
const Flag = () => (
  <Box at={FLAG_AT} palette="main" size={[FLAG.t, FLAG.d, FLAG.h]} />
);

/**
 * The door: a flat sheet with one outline. Upright it shows its pull.
 * Dropped past edge on, its outside faces away and its plain inside is
 * the face that shows.
 */
const Door = ({ inside }: { inside: boolean }) => (
  <>
    <FacePath
      at={DOOR_AT}
      d={DOOR_PATH}
      plane="left"
      style={faceFill("surface", "left")}
    />
    {inside ? null : (
      <FacePath
        at={DOOR_AT}
        d={roundedRect(
          PULL.w,
          PULL.h,
          PULL.h / 2,
          (DOOR_W - PULL.w) / 2,
          PULL.y
        )}
        plane="left"
        style={faceFill("surface", "left")}
      />
    )}
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type MailboxProps = LineStateProps;

/**
 * Mailbox: a complete "no mail yet" state with a line illustration, a
 * heading, a line of copy and a button. A mailbox on its post drops its
 * door open, shows it holds nothing, and swings the door shut. One fine
 * outline, paper faces, the flag (down) the one brand mark, facing the
 * screen, no shadow. Pass `active` (PlayOnHover, or your own state) to
 * play it again. Follows the shadcn theme.
 */
export const Mailbox = ({
  heading = "No mail yet",
  description = "Messages you receive will show up here.",
  actionLabel = "Compose",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: MailboxProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const inside = useDoorInside(clock, clip);
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
      slot="mailbox"
    >
      {/* Back to front: stand and box, what the mouth shows, the flag on
          the side, then the door over the mouth. */}
      <Stand />
      <Inside />
      <Flag />
      <Rig pivot={HINGE} {...onClock(clock, doorPose(clip), clip.end)}>
        <Door inside={inside} />
      </Rig>
    </LineState>
  );
};

export default Mailbox;
