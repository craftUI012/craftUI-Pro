"use client";

import type { CSSProperties } from "react";
import { useId } from "react";

import {
  Box,
  EASE,
  FacePath,
  Rig,
  project,
  sample,
  useRigged,
} from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
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
 * "No archived items", told by one object in line: a banker's archive
 * box, seen at the true isometric angle, whose lid lifts and tips back,
 * lets two blank pages pop up out of it and drops shut once they are back
 * in. Use: empty state. Move: a lid lifted and tipped on its rear edge;
 * pages thrown up on arcs and pulled back. Each value is ms after the art
 * comes into view.
 *
 *    0ms   the box stands shut, lid on, two pages hidden inside
 *  400ms   the lid lifts 1.5 units, tips back 12° on its rear edge and
 *          slides back 2, opening the front of the box (280ms, a soft pop)
 *  560ms   the pages pop up one after the other (70ms apart), each on an
 *          arc: up fast, 3.5 units, drifting 0.75 apart more slowly
 *          (260ms + 160ms settle), standing in front of the lifted lid
 * 1050ms   they hang there, blank (360ms)
 * 1410ms   they are pulled swiftly back down (180ms, 40ms apart, last out
 *          first in)
 * 1650ms   the lid comes forward, drops and levels (220ms, speeding up)
 * 1870ms   it lands: the box gives 3%, the lid bounces once (0.15 units)
 * 2060ms   still: the box shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the box standing shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The lid drops this long.
  drop: 220,
  // The pages hang out this long.
  hold: 360,
  // The lid lifts this long.
  lift: 280,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built along the world axes, standing on z = 0: the box's short end (its
// front, with the label) faces +y, its long side faces +x.
const BODY = { d: 6, h: 4.5, w: 5 };
const X0 = -BODY.w / 2;
const X1 = BODY.w / 2;
const Y0 = -BODY.d / 2;
const Y1 = BODY.d / 2;
// Board thickness: the rim seen when the lid is up.
const WALL = 0.25;

// The lid: a shallow cap a quarter unit proud of the box all round, its
// skirt coming down over the box's top unit.
const LID = { h: 1, lip: 0.25, top: 0.25 };
const LID_Z = BODY.h + LID.top - LID.h;
const LID_AT: Vec3 = [X0 - LID.lip, Y0 - LID.lip, LID_Z];
const LID_SIZE: Vec3 = [BODY.w + 2 * LID.lip, BODY.d + 2 * LID.lip, LID.h];
// It tips back on its rear bottom edge.
const LID_HINGE: Vec3 = [0, Y0 - LID.lip, LID_Z];

// On each wall, in face units (v down from the box's top edge): the hand
// hole, a slot under the lid's skirt, and the base seam.
const HOLE = { h: 0.5, v: 1.25, w: 2 };
const SEAM_V = BODY.h - 0.5;
// On the front: the label holder and its card, the one brand mark.
const HOLDER = { h: 1.25, inset: 0.25, v: 2.25, w: 2.5 };

// The pages: blank sheets standing across the box near its front, low
// enough to hide under the rim. Each pops up `rise` and drifts `drift`
// along its own plane, staying upright (a turn in that plane, seen at
// this angle, shears the sheet and reads as a mistake).
const PAGE = { fold: 0.75, foot: 0.25, h: 2.75, w: 2.5 };
const PAGES = [
  { drift: 0.75, rise: 3.5, x: 0.5, y: 1.75 },
  { drift: -0.75, rise: 3.75, x: -0.5, y: 2.5 },
] as const;

// The frame fits the box shut. The lifted lid runs into the padding.
const EXTENT: Vec3[] = [
  [LID_AT[0], LID_AT[1], LID_Z + LID.h],
  [LID_AT[0], Y1 + LID.lip, LID_Z + LID.h],
  [X1 + LID.lip, LID_AT[1], LID_Z + LID.h],
  [X0, Y1, 0],
  [X1, Y1, 0],
  [X1, Y0, 0],
];
const BOUNDS = viewBounds("isometric", EXTENT);

// Seen inside the box, a step darker than its darkest outside wall.
const INSIDE = {
  back: "oklch(from var(--iso-surface-right-c) calc(l - 0.04) c h)",
  floor: "oklch(from var(--iso-surface-right-c) calc(l - 0.07) c h)",
  hole: "oklch(from var(--iso-surface-right-c) calc(l - 0.12) c h)",
  side: "oklch(from var(--iso-surface-right-c) calc(l - 0.1) c h)",
};

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface PageTracks {
  /** Along its plane, world units. */
  x: IsoTrack;
  /** Up, world units. */
  z: IsoTrack;
}

interface Clip {
  end: number;
  /** Height of the lid off the box, world units, never below 0. */
  rise: IsoTrack;
  /** How far the lid slides back (−y), world units, never below 0. */
  back: IsoTrack;
  /** The lid's tip back, degrees, never below 0. */
  tip: IsoTrack;
  /** Height scale of the box as the lid lands. */
  squash: IsoTrack;
  pages: PageTracks[];
}

const RISE = 1.5;
// It slides back as it tips, so the front of the box opens.
const BACK = 2;
const TIP = 12;
const BOUNCE = 0.15;
const SQUASH = 0.97;
// Out on an arc (up fast with a soft landing, across more slowly), a
// hold, then pulled straight back down.
const OUT = { delay: 160, rise: 260, settle: 160, stagger: 70 };
const BACK_IN = { ms: 180, stagger: 40 };

const beat = (t0: number): Clip => {
  const out = t0 + OUT.delay;
  const landed = out + OUT.stagger * (PAGES.length - 1) + OUT.rise + OUT.settle;
  const home = landed + TIMING.hold;
  const inside = home + BACK_IN.stagger * (PAGES.length - 1) + BACK_IN.ms;
  // The lid waits until the last page is in, then drops.
  const drop = inside + 20;
  const land = drop + TIMING.drop;
  const pages = PAGES.map(({ drift, rise }, i): PageTracks => {
    const go = out + OUT.stagger * i;
    // The last one out is the first one back in.
    const back = home + BACK_IN.stagger * (PAGES.length - 1 - i);
    const peak = go + OUT.rise;
    return {
      x: [
        [go, 0, EASE.drop],
        [peak + OUT.settle, drift, "hold"],
        [back, drift, EASE.in],
        [back + BACK_IN.ms, 0],
      ],
      z: [
        [go, 0, EASE.soft],
        [peak, rise + 0.25, EASE.easy],
        [peak + OUT.settle, rise, "hold"],
        [back, rise, EASE.in],
        [back + BACK_IN.ms, 0],
      ],
    };
  });
  const rise: IsoKey[] = [
    [t0, 0, EASE.soft],
    [t0 + TIMING.lift, RISE, "hold"],
    [drop, RISE, EASE.in],
    [land, 0, EASE.drop],
    [land + 90, BOUNCE, EASE.in],
    [land + 190, 0],
  ];
  // Starts at rest and only ever tips back: the lid's front never dips
  // into the box. Level again as it lands.
  const tip: IsoKey[] = [
    [t0, 0, EASE.soft],
    [t0 + TIMING.lift, TIP, "hold"],
    [drop, TIP, EASE.in],
    [land, 0],
  ];
  const back: IsoKey[] = [
    [t0, 0, EASE.soft],
    [t0 + TIMING.lift, BACK, "hold"],
    [drop, BACK, EASE.in],
    [land, 0],
  ];
  const squash: IsoKey[] = [
    [land - 20, 1, EASE.drop],
    [land + 60, SQUASH, EASE.easy],
    [land + 190, 1],
  ];
  return { back, end: land + 190, pages, rise, squash, tip };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const lidPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "x",
    offset: [0, -r2(sample(clip.back, ms)), r2(sample(clip.rise, ms))],
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

const pagePose =
  (clip: Clip, i: number) =>
  (ms: number): IsoPose => {
    const tracks = clip.pages[i];
    return {
      offset: [r2(sample(tracks.x, ms)), 0, r2(sample(tracks.z, ms))],
    };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** A rectangle as a face path. */
const rect = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y} H${x + w} V${y + h} H${x} Z`;

/** A slot with round ends as a face path. */
const slot = (x: number, y: number, w: number, h: number) => {
  const r = h / 2;
  const k = r2(r * 0.5523);
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `C${r2(x + w - r + k)} ${y} ${x + w} ${r2(y + r - k)} ${x + w} ${y + r}`,
    `C${x + w} ${r2(y + r + k)} ${r2(x + w - r + k)} ${y + h} ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `C${r2(x + r - k)} ${y + h} ${x} ${r2(y + r + k)} ${x} ${y + r}`,
    `C${x} ${r2(y + r - k)} ${r2(x + r - k)} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
};

/** A flat polygon through world points, sent through the rigs around it. */
const Quad = ({ points, fill }: { points: readonly Vec3[]; fill: string }) => {
  const rigged = useRigged();
  const d = `M${points.map((p) => project(rigged(p)).join(",")).join(" L")} Z`;
  return <path d={d} style={{ ...LINE, fill } as CSSProperties} />;
};

/**
 * The open top, seen only while the lid is up: the board's rim, and
 * through it the box's inside (its far walls and floor), clipped to the
 * opening.
 */
const Mouth = ({ clip }: { clip: string }) => {
  const xi0 = X0 + WALL;
  const xi1 = X1 - WALL;
  const yi0 = Y0 + WALL;
  const yi1 = Y1 - WALL;
  const top = BODY.h;
  return (
    <>
      <clipPath id={clip}>
        <FacePath
          at={[xi0, yi0, top]}
          d={rect(0, 0, xi1 - xi0, yi1 - yi0)}
          plane="top"
        />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <Quad
          fill={INSIDE.back}
          points={[
            [xi0, yi0, WALL],
            [xi1, yi0, WALL],
            [xi1, yi0, top],
            [xi0, yi0, top],
          ]}
        />
        <Quad
          fill={INSIDE.side}
          points={[
            [xi0, yi0, WALL],
            [xi0, yi1, WALL],
            [xi0, yi1, top],
            [xi0, yi0, top],
          ]}
        />
        <Quad
          fill={INSIDE.floor}
          points={[
            [xi0, yi0, WALL],
            [xi1, yi0, WALL],
            [xi1, yi1, WALL],
            [xi0, yi1, WALL],
          ]}
        />
      </g>
      <FacePath
        at={[X0, Y0, top]}
        d={`${rect(0, 0, BODY.w, BODY.d)} ${rect(WALL, WALL, BODY.w - 2 * WALL, BODY.d - 2 * WALL)}`}
        fillRule="evenodd"
        plane="top"
        style={faceFill("surface", "top")}
      />
    </>
  );
};

/** One page: a blank sheet with a folded corner, standing across the box. */
const Page = ({ x, y }: { x: number; y: number }) => {
  const at: Vec3 = [x - PAGE.w / 2, y, PAGE.foot + PAGE.h];
  const { w, h, fold } = PAGE;
  return (
    <>
      <FacePath
        at={at}
        d={`M0 0 H${w - fold} L${w} ${fold} V${h} H0 Z`}
        plane="left"
        style={faceFill("surface", "top")}
      />
      <FacePath
        at={at}
        d={`M${w - fold} 0 V${fold} H${w}`}
        plane="left"
        style={LINE}
      />
    </>
  );
};

/**
 * Everything but the two walls you see, as a clip: a page is drawn only
 * where it is out of the box (on screen, off its walls).
 */
const OutsideWalls = ({ id }: { id: string }) => {
  const rigged = useRigged();
  const far = 1000;
  const walls: Vec3[] = [
    [X0, Y1, BODY.h],
    [X1, Y1, BODY.h],
    [X1, Y0, BODY.h],
    [X1, Y0, 0],
    [X1, Y1, 0],
    [X0, Y1, 0],
  ];
  const d = `M${-far},${-far} H${far} V${far} H${-far} Z M${walls.map((p) => project(rigged(p)).join(",")).join(" L")} Z`;
  return (
    <clipPath id={id}>
      <path clipRule="evenodd" d={d} />
    </clipPath>
  );
};

/**
 * The two walls you see: the front with its hand hole, label holder and card;
 * the long side with its hand hole; the base seam round both.
 */
const Walls = () => {
  const front: Vec3 = [X0, Y1, BODY.h];
  const side: Vec3 = [X1, Y1, BODY.h];
  const hole = { fill: INSIDE.hole, ...LINE } as CSSProperties;
  return (
    <>
      <FacePath
        at={front}
        d={rect(0, 0, BODY.w, BODY.h)}
        plane="left"
        style={faceFill("surface", "left")}
      />
      <FacePath
        at={front}
        d={slot((BODY.w - HOLE.w) / 2, HOLE.v, HOLE.w, HOLE.h)}
        plane="left"
        style={hole}
      />
      <FacePath
        at={front}
        d={rect((BODY.w - HOLDER.w) / 2, HOLDER.v, HOLDER.w, HOLDER.h)}
        plane="left"
        style={faceFill("surface", "top")}
      />
      <FacePath
        at={front}
        d={rect(
          (BODY.w - HOLDER.w) / 2 + HOLDER.inset,
          HOLDER.v + HOLDER.inset,
          HOLDER.w - 2 * HOLDER.inset,
          HOLDER.h - 2 * HOLDER.inset
        )}
        plane="left"
        style={{ fill: "var(--iso-main-left)" }}
      />
      <FacePath
        at={front}
        d={`M0 ${SEAM_V} H${BODY.w}`}
        plane="left"
        style={LINE}
      />
      <FacePath
        at={side}
        d={rect(0, 0, BODY.d, BODY.h)}
        plane="right"
        style={faceFill("surface", "right")}
      />
      <FacePath
        at={side}
        d={slot((BODY.d - HOLE.w) / 2, HOLE.v, HOLE.w, HOLE.h)}
        plane="right"
        style={hole}
      />
      <FacePath
        at={side}
        d={`M0 ${SEAM_V} H${BODY.d}`}
        plane="right"
        style={LINE}
      />
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type ArchiveBoxProps = LineStateProps;

/**
 * Archive box: a complete "no archived items" state with a line
 * illustration, a heading, a line of copy and a button. A banker's
 * archive box at the true isometric angle (an overhanging lid, a hand hole
 * in each wall you see, a label holder on its front) lifts its lid and
 * tips it back, two blank pages pop up and are pulled back in, and the lid
 * drops shut with one small bounce. One fine outline, paper faces, the
 * label card the one brand mark, no shadow. Plays when it comes into
 * view, or each time `active` turns true (PlayOnHover, or your own
 * state). Follows the shadcn theme.
 */
export const ArchiveBox = ({
  heading = "No archived items",
  description = "Items you archive will be kept here, out of the way.",
  actionLabel = "View all items",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: ArchiveBoxProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const uid = useId().replaceAll(":", "");
  const mouth = `${uid}-mouth`;
  const outside = `${uid}-outside`;
  return (
    <LineState
      bounds={BOUNDS}
      buttonVariant="secondary"
      defaultArtClassName="w-48"
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
      slot="archive-box"
      view="isometric"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, boxPose(clip), clip.end)}>
        {/* Back to front: the open top, the walls, the lid, then the
            pages over all of it, cut away wherever the walls are: inside
            the box they are hidden, out of it they stand in front of the
            lid, which has slid back out of their way. */}
        <Mouth clip={mouth} />
        <Walls />
        <Rig pivot={LID_HINGE} {...onClock(clock, lidPose(clip), clip.end)}>
          <Box at={LID_AT} palette="surface" size={LID_SIZE} />
        </Rig>
        <OutsideWalls id={outside} />
        <g clipPath={`url(#${outside})`}>
          {PAGES.map(({ x, y }, i) => (
            <Rig
              key={y}
              pivot={[x, y, PAGE.foot + PAGE.h / 2]}
              {...onClock(clock, pagePose(clip, i), clip.end)}
            >
              <Page x={x} y={y} />
            </Rig>
          ))}
        </g>
      </Rig>
    </LineState>
  );
};

export default ArchiveBox;
