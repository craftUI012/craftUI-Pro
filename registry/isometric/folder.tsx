"use client";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
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
 * "No files yet", told by one object in line: a document folder standing
 * upright whose front flap falls open, lets three blank sheets pop out in
 * arcs, swallows them back and shuts. Use: empty state. Move: a flap
 * tipping on its bottom fold, then sheets thrown out and pulled back.
 * Each value is ms after the art comes into view.
 *
 *    0ms   the folder stands shut, flap upright, three sheets hidden inside
 *  400ms   the flap tips forward on its bottom fold, speeding up (300ms)
 *  640ms   as it passes 15° the sheets pop out one after another (70ms
 *          apart): left, straight up and right, each on an arc (it rises
 *          fast and drifts out, 260ms), tilting up to 12° as it flies
 *  700ms   the flap reaches 25°, rebounds and rests at 23°
 * 1040ms   the sheets settle in the air, fanned over the folder
 * 1400ms   they drop swiftly back in (180ms, speeding up, 40ms apart),
 *          straightening as they go
 * 1640ms   the flap swings back shut (260ms, speeding up)
 * 1900ms   it knocks shut, bounces 3° forward and settles (220ms)
 * 2120ms   still: the folder shut, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the folder standing shut.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face of the flap is the plane y = 0.

// Two boards of the same width: the back panel (with its tab) and, half a
// unit in front of it, the shorter front flap. The gap between them is the
// inside of the folder.
const W = 9;
const BOARD = 0.5;
const GAP = 0.5;
const R = 0.5;

const FLAP = { h: 5.5 };
const BACK = { h: 6.5, shoulder: 1, tab: 1, tabW: 3.5 };
const BACK_TOP = BACK.h + BACK.tab;
const BACK_Y = -(BOARD + GAP);
const BACK_AT: Vec3 = [-W / 2, BACK_Y, BACK_TOP];

/**
 * The back panel's outline, face units from its top-left corner: the tab
 * along the left of the top, a smooth shoulder down to the panel's top
 * edge, rounded corners. The shoulder makes it non-convex, so its far edge
 * is drawn by hand (see `BackPanel`).
 */
const BACK_PATH = (() => {
  const k = r2(R * ARC);
  const t = BACK.tab;
  const s0 = BACK.tabW;
  const s1 = s0 + BACK.shoulder;
  const h = BACK_TOP;
  return [
    `M${R} 0`,
    `H${s0}`,
    // The shoulder: level at both ends, so there is no crease to edge.
    `C${s0 + 0.5} 0 ${s1 - 0.5} ${t} ${s1} ${t}`,
    `H${W - R}`,
    `C${W - R + k} ${t} ${W} ${t + R - k} ${W} ${t + R}`,
    `V${h - R}`,
    `C${W} ${h - R + k} ${W - R + k} ${h} ${W - R} ${h}`,
    `H${R}`,
    `C${R - k} ${h} 0 ${h - R + k} 0 ${h - R}`,
    `V${R}`,
    `C0 ${R - k} ${R - k} 0 ${R} 0`,
    "Z",
  ].join(" ");
})();

// The brand label on the tab: a small card in the tone.
const LABEL = { h: 0.5, w: 1.75, x: 0.75, y: 0.25 };

// The flap's front face, and the fold it tips on (its bottom front edge).
const FLAP_AT: Vec3 = [-W / 2, 0, FLAP.h];
const HINGE: Vec3 = [0, 0, 0];

// The sheets inside: blank pages standing in the gap between the panel and
// the flap, lower than the flap so they hide behind it while it is shut.
// Each flies to `to` (world x, z) on an arc, tilting `tilt` degrees.
// They sit low (top 3.5): even with the flap open they stay out of sight,
// so they appear only as they fly.
const SHEET = { foot: 0, h: 3.5, line: 0.5, w: 2.75 };
const SHEET_Y = -(BOARD + GAP / 2);
const SHEETS = [
  { tilt: -12, to: [-3, 3] as const, x: -1.5 },
  { tilt: 0, to: [0, 4.25] as const, x: 0 },
  { tilt: 12, to: [3, 3.5] as const, x: 1.5 },
] as const;

// The frame fits the folder shut, from the flap's foot to the tab's top.
const EXTENT: Vec3[] = [
  [-W / 2, 0, 0],
  [W / 2, 0, 0],
  [-W / 2, BACK_Y - BOARD, BACK_TOP],
  [W / 2, BACK_Y - BOARD, BACK_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface SheetTracks {
  /** Across, world units. */
  x: IsoTrack;
  /** Up, world units. */
  z: IsoTrack;
  /** In-plane tilt, degrees. */
  tilt: IsoTrack;
}

interface Clip {
  end: number;
  /** The flap's turn about its fold, degrees; negative tips it forward. */
  flap: IsoTrack;
  sheets: SheetTracks[];
}

// The sheets' flight: out on an arc (up fast with a soft landing, across
// more slowly, so the path curves), a hold, then swiftly back in.
const OUT = { rise: 260, settle: 160, stagger: 70 };
const BACK_IN = { ms: 180, stagger: 40 };
const HOLD = 360;

const beat = (t0: number): Clip => {
  const stop = t0 + 300;
  const open = stop + 220;
  const out = t0 + 240;
  const landed = out + OUT.stagger * 2 + OUT.rise + OUT.settle;
  const home = landed + HOLD;
  const close = home + BACK_IN.stagger * 2 + BACK_IN.ms + 60;
  const shut = close + 260;
  // Starts at rest and only ever tips forward (negative): the flap never
  // swings back into the folder, even as it bounces shut.
  const flap: IsoKey[] = [
    [t0, 0, EASE.in],
    [stop, -25, EASE.easy],
    [stop + 110, -21.5, EASE.easy],
    [open, -23, "hold"],
    [close, -23, EASE.in],
    [shut, 0, EASE.easy],
    [shut + 100, -3, EASE.easy],
    [shut + 220, 0],
  ];
  const sheets = SHEETS.map(({ tilt, to: [tx, tz] }, i): SheetTracks => {
    const go = out + OUT.stagger * i;
    // The last one out is the first one back in.
    const back = home + BACK_IN.stagger * (SHEETS.length - 1 - i);
    const peak = go + OUT.rise;
    return {
      tilt: [
        [go, 0, EASE.soft],
        [peak, tilt, "hold"],
        [back, tilt, EASE.in],
        [back + BACK_IN.ms, 0],
      ],
      x: [
        [go, 0, EASE.drop],
        [peak + OUT.settle, tx - SHEETS[i].x, "hold"],
        [back, tx - SHEETS[i].x, EASE.in],
        [back + BACK_IN.ms, 0],
      ],
      z: [
        [go, 0, EASE.soft],
        [peak, tz + 0.5, EASE.easy],
        [peak + OUT.settle, tz, "hold"],
        [back, tz, EASE.in],
        [back + BACK_IN.ms, 0],
      ],
    };
  });
  return { end: shut + 220, flap, sheets };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const flapPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "x",
    rotate: r2(sample(clip.flap, ms)),
  });

const sheetPose =
  (clip: Clip, i: number) =>
  (ms: number): IsoPose => {
    const tracks = clip.sheets[i];
    return {
      axis: "y",
      offset: [r2(sample(tracks.x, ms)), 0, r2(sample(tracks.z, ms))],
      rotate: r2(sample(tracks.tilt, ms)),
    };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The back panel and its tab. The outline is not convex (the shoulder), so
 * the engine cannot find its far edge: the same outline goes on the back
 * plane in line, then the front face is painted once more over it. What
 * still shows of the back outline is exactly the far edge. The label is
 * written last, on the repainted front.
 */
const BackPanel = () => (
  <>
    <Extrude
      at={BACK_AT}
      d={BACK_PATH}
      depth={BOARD}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={[BACK_AT[0], BACK_Y - BOARD, BACK_TOP]}
      d={BACK_PATH}
      plane="left"
      style={LINE}
    />
    <FacePath
      at={BACK_AT}
      d={BACK_PATH}
      plane="left"
      style={faceFill("surface", "left")}
    />
    <FacePath
      at={BACK_AT}
      d={roundedRect(LABEL.w, LABEL.h, LABEL.h / 2, LABEL.x, LABEL.y)}
      plane="left"
      style={faceFill("main", "left")}
    />
  </>
);

/**
 * One sheet: a page with a folded corner and three ruled lines, a face in
 * the gap between panel and flap (paper is a face, not a solid).
 */
const Sheet = ({ x }: { x: number }) => {
  const at: Vec3 = [x - SHEET.w / 2, SHEET_Y, SHEET.foot + SHEET.h];
  const { w, h } = SHEET;
  const fold = 0.75;
  const outline = `M0 0 H${w - fold} L${w} ${fold} V${h} H0 Z`;
  return (
    <>
      <FacePath
        at={at}
        d={outline}
        plane="left"
        style={faceFill("surface", "left")}
      />
      <FacePath
        at={at}
        d={`M${w - fold} 0 V${fold} H${w}`}
        plane="left"
        style={LINE}
      />
      {[1.25, 2, 2.75].map((v, i) => (
        <FacePath
          at={at}
          d={`M${SHEET.line} ${v} H${i === 2 ? w / 2 : w - SHEET.line}`}
          key={v}
          plane="left"
          style={LINE}
        />
      ))}
    </>
  );
};

/** The front flap: a plain rounded board, convex, so the engine edges it. */
const Flap = () => (
  <Extrude
    at={FLAP_AT}
    convex
    d={roundedRect(W, FLAP.h, R)}
    depth={BOARD}
    palette="surface"
    plane="left"
  />
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type FolderProps = LineStateProps;

/**
 * Folder: a complete "no files yet" state with a line illustration, a
 * heading, a line of copy and a button. A document folder standing upright
 * tips its front flap open on the bottom fold, three blank sheets pop out
 * in arcs and drop swiftly back in, and it knocks shut. One fine outline,
 * paper faces, the label on the tab the one brand mark, facing the screen,
 * no shadow. Pass `active` (PlayOnHover, or your own state) to play it
 * again. Follows the shadcn theme.
 */
export const Folder = ({
  heading = "No files yet",
  description = "Upload a file or drop it here to get started.",
  actionLabel = "Upload file",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: FolderProps) => {
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
      icon={ICON.upload}
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
      slot="folder"
    >
      {/* Back to front: the panel, the sheets in the gap, then the flap. */}
      <BackPanel />
      {SHEETS.map(({ x }, i) => (
        <Rig
          key={x}
          pivot={[x, SHEET_Y, SHEET.foot + SHEET.h / 2]}
          {...onClock(clock, sheetPose(clip, i), clip.end)}
        >
          <Sheet x={x} />
        </Rig>
      ))}
      <Rig pivot={HINGE} {...onClock(clock, flapPose(clip), clip.end)}>
        <Flap />
      </Rig>
    </LineState>
  );
};

export default Folder;
