"use client";

import { EASE, FacePath, Rig, roundedRect, sample } from "./iso-core";
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
 * "No documents yet", told by one object in line: a page (title bar,
 * image, lines, signature) with a folded corner that hops once, and the
 * landing flicks its corner open.
 * Use: empty state. Move: a hop with one bounce; a hinged corner that
 * follows the landing. Each value is ms after the art comes into view.
 *
 *    0ms   the page stands upright, its top right corner folded down
 *  400ms   it crouches: squashes 5% into its foot (140ms)
 *  540ms   it springs up 1.25 units (300ms, slowing at the top)
 *  840ms   it falls back (240ms, speeding up)
 * 1080ms   it lands: squashes 6%, one small bounce (0.2 units); the
 *          jolt flips the folded corner up off the page and over its
 *          fold, 165° toward the viewer, nearly open: the page shows
 *          whole for a moment, a crease across its corner (200ms)
 * 1280ms   the corner folds back down (240ms, speeding up) and slaps
 *          flat on the page in one move
 * 1520ms   still: the page upright, its corner folded, exactly as it
 *          started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the page standing
 * still, its corner folded.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the page is a face on the plane y = 0,
// standing on z = 0 (paper is a face, not a solid).

const PAGE = { h: 8, w: 6 };
// The folded corner: FOLD units cut off the top right, folded down over
// the front as a triangle.
const FOLD = 2;
const PAGE_AT: Vec3 = [-PAGE.w / 2, 0, PAGE.h];
const PAGE_PATH = [
  "M0 0",
  `H${PAGE.w - FOLD}`,
  `L${PAGE.w} ${FOLD}`,
  `V${PAGE.h}`,
  "H0",
  "Z",
].join(" ");
// The flap, in the page's face units: the fold line and the corner it
// folds the tip down to.
const FLAP_PATH = [
  `M${PAGE.w - FOLD} 0`,
  `L${PAGE.w} ${FOLD}`,
  `H${PAGE.w - FOLD}`,
  "Z",
].join(" ");
// The middle of the fold line, which the flap turns about.
const FOLD_MID: Vec3 = [PAGE_AT[0] + PAGE.w - FOLD / 2, 0, PAGE.h - FOLD / 2];

// The page's layout, in face units from its top-left corner, a 1-unit
// margin, every line a clear 0.5 from the next.
// The brand mark: the title bar at the top left, in the tone, and a short
// line under it (a date).
const TAG = { h: 0.5, u: 1, v: 1.25, w: 2.25 };
// An image block, outlined, a hill and a sun drawn in it.
const IMAGE = { h: 1.75, u: 1, v: 3.25, w: 2 };
const HILL = "M1 4.75 L1.75 4 L2.25 4.5 L2.5 4.25 L3 4.75";
const SUN = { r: 0.2, u: 2.5, v: 3.75 };
// Text lines of different lengths: beside the image, then the full width.
const RULES = [
  { len: 1.5, u: 1, v: 2.5 },
  { len: 1.5, u: 3.5, v: 3.5 },
  { len: 1.5, u: 3.5, v: 4 },
  { len: 1, u: 3.5, v: 4.5 },
  { len: 4, u: 1, v: 5.75 },
  { len: 3, u: 1, v: 6.25 },
  { len: 1.75, u: 3.25, v: 7.25 },
] as const;
// A signature over the last line.
const SIGNATURE =
  "M3.5 7 C3.75 6.5 3.9 7.2 4.1 6.85 C4.3 6.5 4.5 7.1 4.75 6.75";

// The page's foot, which it squashes into and lands on.
const FOOT: Vec3 = [0, 0, 0];

// The frame fits the page at rest. The hop runs into the stage's padding.
const EXTENT: Vec3[] = [
  [-PAGE.w / 2, 0, 0],
  [PAGE.w / 2, 0, 0],
  [-PAGE.w / 2, 0, PAGE.h],
  [PAGE.w / 2, 0, PAGE.h],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** Height above its foot, world units. */
  lift: IsoTrack;
  /** Height scale of the page about its foot. */
  squash: IsoTrack;
  /** The flap's turn off the page, degrees toward the viewer; never below 0. */
  flap: IsoTrack;
}

const HOP = { bounce: 0.2, height: 1.25 };
// Degrees the landing flicks the corner up.
// Seen from the front, a flap tipping toward the viewer hides most of
// its turn (at 120° it is still a sliver on the fold), so the landing
// flips it nearly open: for a moment the page is whole, a crease across
// its corner. It comes back down in one move, no bounce: a small bounce
// shows only as a sliver beside the fold, which reads as a doubled crease.
const FLICK = { up: 165 };

const beat = (t0: number): Clip => {
  const crouch = t0 + 140;
  const apex = crouch + 300;
  const land = apex + 240;
  const bounce = land + 90;
  const lift: IsoKey[] = [
    [t0, 0, "hold"],
    [crouch, 0, EASE.drop],
    [apex, HOP.height, EASE.in],
    [land, 0, EASE.drop],
    [bounce, HOP.bounce, EASE.in],
    [bounce + 110, 0],
  ];
  const squash: IsoKey[] = [
    [t0, 1, EASE.easy],
    [crouch, 0.95, EASE.soft],
    [crouch + 120, 1.03, EASE.easy],
    [land - 20, 1, EASE.drop],
    [land + 60, 0.94, EASE.easy],
    [bounce + 60, 1.02, EASE.easy],
    [bounce + 200, 1],
  ];
  const up = land + 200;
  const down = up + 240;
  // Starts flat and only ever lifts off the page: it never folds through it.
  const flap: IsoKey[] = [
    [land, 0, EASE.soft],
    [up, FLICK.up, EASE.in],
    [down, 0],
  ];
  return { end: down, flap, lift, squash };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const pagePose =
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

const flapPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "x",
    rotate: r2(sample(clip.flap, ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The page: its outline with the corner cut, the title bar, the image
 * block, the text lines and the signature.
 */
const Page = () => (
  <>
    <FacePath
      at={PAGE_AT}
      d={PAGE_PATH}
      plane="left"
      style={faceFill("surface", "left")}
    />
    <FacePath
      at={PAGE_AT}
      d={roundedRect(TAG.w, TAG.h, TAG.h / 2, TAG.u, TAG.v)}
      plane="left"
      style={faceFill("main", "left")}
    />
    <FacePath
      at={PAGE_AT}
      d={roundedRect(IMAGE.w, IMAGE.h, 0, IMAGE.u, IMAGE.v)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <FacePath
      at={PAGE_AT}
      d={`${HILL} ${circle(SUN.u, SUN.v, SUN.r)}`}
      plane="left"
      style={LINE}
    />
    {RULES.map(({ len, u, v }) => (
      <FacePath
        at={PAGE_AT}
        d={`M${u} ${v} H${u + len}`}
        key={v}
        plane="left"
        style={LINE}
      />
    ))}
    <FacePath at={PAGE_AT} d={SIGNATURE} plane="left" style={LINE} />
  </>
);

/** The folded corner, lying on the page's front. */
const Flap = () => (
  <FacePath
    at={PAGE_AT}
    d={FLAP_PATH}
    plane="left"
    style={faceFill("surface", "left")}
  />
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type DocumentProps = LineStateProps;

/**
 * Document: a complete "no documents yet" state with a line illustration,
 * a heading, a line of copy and a button. A page with a folded corner
 * (title bar, image, text lines, a signature) hops once; the landing
 * flicks its corner up and it falls back flat. One fine outline, paper
 * faces, the title bar the one brand mark, facing the screen, no shadow.
 * Plays when it comes into view, or each time `active` turns true
 * (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const Document = ({
  heading = "No documents yet",
  description = "Create a document and it will show up here.",
  actionLabel = "New document",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: DocumentProps) => {
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
      slot="document"
      view="front"
    >
      <Rig pivot={FOOT} {...onClock(clock, pagePose(clip), clip.end)}>
        <Page />
        {/* The fold runs at 45°: turn it level, tip the flap toward the
            viewer about it, turn it back. */}
        <Rig axis="y" pivot={FOLD_MID} rotate={45}>
          <Rig pivot={FOLD_MID} {...onClock(clock, flapPose(clip), clip.end)}>
            <Rig axis="y" pivot={FOLD_MID} rotate={-45}>
              <Flap />
            </Rig>
          </Rig>
        </Rig>
      </Rig>
    </LineState>
  );
};

export default Document;
