"use client";

import {
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
  Edge,
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
 * "Nothing saved yet", told by one object in line: a floppy disk whose
 * shutter slides open on an empty window and snaps shut. Use: empty
 * state. Move: a slide in a housing, then a hop. Each value is ms after
 * it comes into view, or after `active` turns true.
 *
 *    0ms   the disk stands straight, its shutter closed over the window
 *  400ms   the shutter slides right 1.5 units, into its track's end
 *          (380ms): the window it uncovers is empty, only the medium's
 *          two tracks crossing it
 *  780ms   it holds open (380ms)
 * 1160ms   it snaps back on its spring (160ms, speeding up) and knocks
 *          0.125 off its stop
 * 1320ms   the snap makes the disk hop 0.375 (170ms up, 150ms down); it
 *          lands with a 6% squash and one tiny bounce
 * 1820ms   still: closed and standing, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms when it comes into view,
 * 80ms each time `active` turns true.
 * Reduced motion, or `active` false before any play: the disk, shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* How far things move, world units. */
const MOVE = {
  // How far the disk hops when the shutter snaps shut.
  hop: 0.375,
  // How far the shutter comes off its stop when it snaps back.
  knock: 0.125,
  // How far the shutter slides open.
  open: 1.5,
  // The disk's height scale as it lands.
  squash: 0.94,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face of the disk is the plane
// y = 0. Face units: u across from the disk's left edge, v down from its
// top. Flat things on it (track, shutter, label) are faces.

// The disk: a square with its top right corner cut, the other corners
// rounded a little. Convex, so the engine draws its far and side edges.
const DISK = { cut: 0.75, depth: 0.5, r: 0.25, w: 6 };
const DISK_AT: Vec3 = [-DISK.w / 2, 0, DISK.w];
const DISK_PATH = (() => {
  const { cut, r, w } = DISK;
  return [
    `M${r} 0`,
    `H${w - cut}`,
    `L${w} ${cut}`,
    `V${w - r}`,
    `Q${w} ${w} ${w - r} ${w}`,
    `H${r}`,
    `Q0 ${w} 0 ${w - r}`,
    `V${r}`,
    `Q0 0 ${r} 0`,
    "Z",
  ].join(" ");
})();

/** A rectangle in face units, from (u0, v0) to (u1, v1). */
const rect = (u0: number, v0: number, u1: number, v1: number) =>
  `M${u0} ${v0} H${u1} V${v1} H${u0} Z`;

/**
 * A rectangle hanging from the disk's top edge, open at the top: the disk's
 * own edge is its top line, so the two never draw side by side.
 */
const hang = (u0: number, u1: number, v1: number) =>
  `M${u0} 0 V${v1} H${u1} V0`;

// The track the shutter slides in, hanging from the top edge (the shutter
// wraps over it, as on a real disk). Its right end is the housing the
// shutter slides under, so the shutter is cut there.
const TRACK = { h: 2.5, u0: 0.75, u1: 5 };
// The shutter, closed, and the slot in it.
const SHUTTER = { u0: 1.5, u1: 4.25 };
const SLOT = { u0: 3.25, u1: 3.75, v0: 0.5, v1: 2 };
// The disk's window under the shutter: a shade darker, two tracks of the
// medium crossing it (arcs about the disk's middle), and nothing else.
const WINDOW = { u0: 1.75, u1: 2.75, v0: 0.5, v1: 2 };
const MEDIUM = { radii: [1.75, 2.25], steps: 8, u: 3, v: 3 };

/** An arc of the medium across the window, ending on its two sides. */
const mediumArc = (r: number) =>
  `M${Array.from({ length: MEDIUM.steps + 1 }, (_, i) => {
    const u = WINDOW.u0 + ((WINDOW.u1 - WINDOW.u0) * i) / MEDIUM.steps;
    return `${r2(u)} ${r2(MEDIUM.v - Math.sqrt(r * r - (u - MEDIUM.u) ** 2))}`;
  }).join(" L")}`;

// The label on the lower half: a short stripe at its top left (the brand
// mark) and two ruled lines, every line a clear 0.5 from the next.
const LABEL = { u0: 1.25, u1: 4.75, v0: 3.25, v1: 5.5 };
const STRIPE = { r: 0.125, u0: 1.75, u1: 3, v0: 3.75, v1: 4 };
const RULES = [4.5, 5] as const;
const RULE = { u0: 1.75, u1: 4.25 };

// The write-protect window in the lower left corner, its slider pushed
// down over the lower half.
const PROTECT = { slide: 5.125, u0: 0.5, u1: 1, v0: 4.75, v1: 5.5 };

// The frame fits the disk at rest: its face and the strip its depth shows.
const EXTENT: Vec3[] = [
  [-DISK.w / 2, 0, 0],
  [DISK.w / 2, 0, 0],
  [-DISK.w / 2, -DISK.depth, DISK.w],
  [DISK.w / 2, -DISK.depth, DISK.w],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The disk's height off its rest, world units (never below 0). */
  hop: IsoTrack;
  /** The shutter's travel to the right, world units (never below 0). */
  shutter: IsoTrack;
  /** The disk's height scale about its foot. */
  squash: IsoTrack;
}

const beat = (t0: number): Clip => {
  const open = t0 + 380;
  const shut = open + 380;
  const snap = shut + 160;
  const top = snap + 170;
  const land = top + 150;
  const shutter: IsoKey[] = [
    [t0, 0, EASE.snap],
    [open, MOVE.open, "hold"],
    [shut, MOVE.open, EASE.in],
    [snap, 0, EASE.easy],
    [snap + 60, MOVE.knock, EASE.easy],
    [snap + 140, 0],
  ];
  const hop: IsoKey[] = [
    [snap, 0, EASE.soft],
    [top, MOVE.hop, EASE.in],
    [land, 0, EASE.drop],
    [land + 80, 0.05, EASE.in],
    [land + 160, 0],
  ];
  const squash: IsoKey[] = [
    [land - 20, 1, EASE.drop],
    [land + 60, MOVE.squash, EASE.easy],
    [land + 200, 1.01, EASE.easy],
    [land + 340, 1],
  ];
  return { end: land + 340, hop, shutter, squash };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const diskPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const s = r2(sample(clip.squash, ms));
    // Volume is kept: as it squashes in height it widens.
    const w = r2(1 / Math.sqrt(s));
    return {
      offset: [0, 0, r2(sample(clip.hop, ms))],
      scale: [w, 1, s],
    };
  };

const shutterPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [r2(sample(clip.shutter, ms)), 0, 0],
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** A flat mark on the disk's face. */
const Mark = ({ d, fill }: { d: string; fill?: "top" | "right" }) => (
  <FacePath
    at={DISK_AT}
    d={d}
    plane="left"
    style={fill ? faceFill("surface", fill) : LINE}
  />
);

/**
 * The shutter, cut to its track so it slides under the track's right end
 * instead of floating past it. The track's outline goes on last, over the
 * cut.
 */
const Shutter = ({ slide }: { slide: ReturnType<typeof onClock> }) => {
  const id = useIsoId();
  const track = rect(TRACK.u0, 0, TRACK.u1, TRACK.h);
  return (
    <>
      <defs>
        <clipPath id={`${id}-track`}>
          <FacePath at={DISK_AT} d={track} plane="left" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-track)`}>
        <Rig pivot={DISK_AT} {...slide}>
          <FacePath
            at={DISK_AT}
            d={rect(SHUTTER.u0, 0, SHUTTER.u1, TRACK.h)}
            plane="left"
            style={{ ...faceFill("surface", "top"), stroke: "none" }}
          />
          <Mark d={hang(SHUTTER.u0, SHUTTER.u1, TRACK.h)} />
          <FacePath
            at={DISK_AT}
            d={rect(SLOT.u0, SLOT.v0, SLOT.u1, SLOT.v1)}
            plane="left"
            style={faceFill("surface", "left")}
          />
        </Rig>
      </g>
      <Mark d={hang(TRACK.u0, TRACK.u1, TRACK.h)} />
      {/* The disk's top edge again, over the fills that met it. */}
      <Mark d={`M${TRACK.u0} 0 H${TRACK.u1}`} />
    </>
  );
};

/** The empty window under the shutter, the medium's tracks crossing it. */
const Window = () => (
  <>
    <Mark d={rect(WINDOW.u0, WINDOW.v0, WINDOW.u1, WINDOW.v1)} fill="right" />
    {MEDIUM.radii.map((r) => (
      <Mark d={mediumArc(r)} key={r} />
    ))}
  </>
);

/** The label, its short brand stripe and its ruled lines. */
const Label = () => (
  <>
    <Mark d={rect(LABEL.u0, LABEL.v0, LABEL.u1, LABEL.v1)} fill="top" />
    <FacePath
      at={DISK_AT}
      d={roundedRect(
        STRIPE.u1 - STRIPE.u0,
        STRIPE.v1 - STRIPE.v0,
        STRIPE.r,
        STRIPE.u0,
        STRIPE.v0
      )}
      plane="left"
      style={faceFill("main", "left")}
    />
    <Mark d={RULES.map((v) => `M${RULE.u0} ${v} H${RULE.u1}`).join(" ")} />
  </>
);

/** The write-protect window, its slider over the lower half. */
const Protect = () => (
  <>
    <Mark
      d={rect(PROTECT.u0, PROTECT.v0, PROTECT.u1, PROTECT.v1)}
      fill="right"
    />
    <Mark
      d={rect(PROTECT.u0, PROTECT.slide, PROTECT.u1, PROTECT.v1)}
      fill="top"
    />
  </>
);

/**
 * The crease where the top edge meets the cut corner, from front to back:
 * the one sharp corner of the silhouette the engine doesn't join.
 */
const Crease = () => {
  const x = DISK_AT[0] + DISK.w - DISK.cut;
  return (
    <Edge
      points={[
        [x, 0, DISK_AT[2]],
        [x, -DISK.depth, DISK_AT[2]],
      ]}
    />
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type FloppyDiskProps = LineStateProps;

/**
 * Floppy disk: a complete "nothing saved yet" state with a line
 * illustration, a heading, a line of copy and a button. The classic save
 * disk: its shutter slides open on an empty window, holds, snaps shut, and
 * the disk gives a small hop. One fine outline, paper faces, a short stripe
 * on the label the one brand mark, facing the screen, no shadow. Plays when
 * it comes into view, or each time `active` turns true (PlayOnHover, or
 * your own state). Follows the shadcn theme.
 */
export const FloppyDisk = ({
  heading = "Nothing saved yet",
  description = "Save your work and your drafts will be kept here.",
  actionLabel = "Save a draft",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: FloppyDiskProps) => {
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
      defaultArtClassName="w-52"
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
      slot="floppy-disk"
      view="front"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, diskPose(clip), clip.end)}>
        <Extrude
          at={DISK_AT}
          convex
          d={DISK_PATH}
          depth={DISK.depth}
          palette="surface"
          plane="left"
        >
          <Crease />
          <Window />
          <Shutter slide={onClock(clock, shutterPose(clip), clip.end)} />
          <Label />
          <Protect />
        </Extrude>
      </Rig>
    </LineState>
  );
};

export default FloppyDisk;
