"use client";

import { EASE, FacePath, Rig, sample } from "./iso-core";
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
 * "Nothing to review", told by one object in line: an office letter tray
 * at the true isometric angle (sides sloping down to a low front lip with
 * a finger scoop) that a sheet drops into and is whisked straight back
 * out of. Use: empty state. Move: a drop the tray takes, then the sheet
 * thrown up and away on an arc, shrinking. Each value is ms after the art
 * comes into view.
 *
 *    0ms   the empty tray stands still
 *  400ms   a ruled sheet grows in 3.5 units above the tray (200ms)
 *  600ms   it falls in, speeding up (300ms)
 *  900ms   it lands: the tray dips 6% under it and springs back (280ms)
 * 1300ms   after a short rest the sheet is whisked up and away toward the
 *          back on an arc (up fast, back more slowly), shrinking to
 *          nothing by scale (450ms)
 * 1750ms   still: the tray empty, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the empty tray.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The sheet falls this long.
  fall: 300,
  // It grows in this long.
  grow: 200,
  // It lies in the tray this long.
  rest: 400,
  start: 400,
  // It is whisked away this long.
  whisk: 450,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built along the world axes, standing on z = 0: the open front with its
// lip faces +y, the long sides face ±x. Walls are thin sheets of plastic,
// drawn as faces: one clean line along every rim.
const TRAY = { d: 6.5, w: 5.5 };
const X0 = -TRAY.w / 2;
const X1 = TRAY.w / 2;
const Y0 = -TRAY.d / 2;
const Y1 = TRAY.d / 2;
// The back wall's height, and the front lip's: the sides slope between.
const BACK_H = 2.5;
const LIP_H = 1.25;
// The finger scoop, a dip in the middle of the lip.
const SCOOP = { d: 0.5, w: 2.5 };
// The label on the lip, the one brand mark, left of the scoop.
// On the lip's face, in face units (u across, v down from its top).
const LABEL = { h: 0.5, u: 0.25, v: 0.5, w: 1 };
// The long window in the near side (u from its front end, v down from
// the back's top), a recess drawn as one outline.
const WINDOW = { from: 1.5, h: 0.5, to: 1, v: 1.5 };

// The sheet, lying flat inside the tray (u across x, v along y).
const SHEET = { d: 4.5, lines: [1, 1.75, 2.5, 3.25], w: 3.75 };
const SHEET_AT: Vec3 = [-SHEET.w / 2, Y0 + 1, 0];
const SHEET_MID: Vec3 = [0, SHEET_AT[1] + SHEET.d / 2, 0];
// Where it grows in (height over the floor), and where it is whisked to.
const ABOVE = 3.5;
const AWAY = { back: 3, up: 4 };
// At rest the sheet is nothing, tucked behind the lip.
const HIDE: Vec3 = [0, Y1 - 0.25, 0];

// The frame fits the empty tray.
const EXTENT: Vec3[] = [
  [X0, Y0, BACK_H],
  [X1, Y0, BACK_H],
  [X0, Y1, LIP_H],
  [X0, Y1, 0],
  [X1, Y1, 0],
  [X1, Y0, 0],
];
const BOUNDS = viewBounds("isometric", EXTENT);

// Seen inside the tray, a step darker than the walls outside.
const INSIDE = {
  back: "var(--iso-surface-right)",
  floor: "var(--iso-surface-left)",
  side: "oklch(from var(--iso-surface-right-c) calc(l - 0.04) c h)",
};

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The sheet's height over the floor, world units. */
  z: IsoTrack;
  /** How far back (−y) it is whisked, world units. */
  back: IsoTrack;
  /** Its size: grows in, shrinks away. */
  size: IsoTrack;
  /** The tray's height scale as the sheet lands. */
  dip: IsoTrack;
}

const DIP = 0.94;

const beat = (t0: number): Clip => {
  const fall = t0 + TIMING.grow;
  const land = fall + TIMING.fall;
  const whisk = land + TIMING.rest;
  const gone = whisk + TIMING.whisk;
  const z: IsoKey[] = [
    [t0, ABOVE, "hold"],
    [fall, ABOVE, EASE.in],
    [land, 0, "hold"],
    [whisk, 0, EASE.soft],
    [gone, AWAY.up, "hold"],
    [gone + 1, 0],
  ];
  const back: IsoKey[] = [
    [whisk, 0, EASE.drop],
    [gone, AWAY.back, "hold"],
    [gone + 1, 0],
  ];
  const size: IsoKey[] = [
    [t0, 0, EASE.soft],
    [fall, 1, "hold"],
    [whisk + 100, 1, EASE.in],
    [gone, 0],
  ];
  const dip: IsoKey[] = [
    [land - 10, 1, EASE.drop],
    [land + 80, DIP, EASE.easy],
    [land + 200, 1.01, EASE.easy],
    [land + 280, 1],
  ];
  return { back, dip, end: gone + 20, size, z };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

// While it is nothing (before it grows in, after it is gone) the sheet
// waits behind the lip, so not even a dot shows.
const placePose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const s = sample(clip.size, ms);
    if (s <= 0) {
      return { offset: [0, r2(HIDE[1] - SHEET_MID[1]), 0] };
    }
    return {
      offset: [0, -r2(sample(clip.back, ms)), r2(sample(clip.z, ms))],
    };
  };

const sizePose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    scale: Math.max(0.001, r2(sample(clip.size, ms))),
  });

const trayPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const s = r2(sample(clip.dip, ms));
    // Volume is kept: as it squashes in height it widens.
    const w = r2(1 / Math.sqrt(s));
    return { scale: [w, w, s] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

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

// A side wall, on its plane (u from the front, v down from the back top):
// it slopes from the lip's height at the front up to the back's.
const SIDE = `M0 ${BACK_H - LIP_H} L${TRAY.d} 0 V${BACK_H} H0 Z`;

// The lip's face with the scoop dipped into its top edge: two smooth
// S-curves, level where they leave the edge and level at the bottom.
const LIP = (() => {
  const h = r2((SCOOP.w / 2) * 0.6);
  const a = (TRAY.w - SCOOP.w) / 2;
  const c = TRAY.w / 2;
  const b = a + SCOOP.w;
  return [
    `M0 0 H${a}`,
    `C${r2(a + h)} 0 ${r2(c - h)} ${SCOOP.d} ${c} ${SCOOP.d}`,
    `C${r2(c + h)} ${SCOOP.d} ${r2(b - h)} 0 ${b} 0`,
    `H${TRAY.w} V${LIP_H} H0 Z`,
  ].join(" ");
})();

/** The inside you see over the lip: the back wall, the far side, the floor. */
const Inside = () => (
  <>
    <FacePath
      at={[X0, Y0, BACK_H]}
      d={rect(0, 0, TRAY.w, BACK_H)}
      plane="left"
      style={{ ...LINE, fill: INSIDE.back }}
    />
    <FacePath
      at={[X0, Y1, BACK_H]}
      d={SIDE}
      plane="right"
      style={{ ...LINE, fill: INSIDE.side }}
    />
    <FacePath
      at={[X0, Y0, 0]}
      d={rect(0, 0, TRAY.w, TRAY.d)}
      plane="top"
      style={{ ...LINE, fill: INSIDE.floor }}
    />
  </>
);

/** The walls you see from outside: the near side and the lip. */
const Front = () => (
  <>
    <FacePath
      at={[X1, Y1, BACK_H]}
      d={SIDE}
      plane="right"
      style={faceFill("surface", "right")}
    />
    <FacePath
      at={[X1, Y1, BACK_H]}
      d={slot(
        WINDOW.from,
        WINDOW.v,
        TRAY.d - WINDOW.from - WINDOW.to,
        WINDOW.h
      )}
      plane="right"
      style={LINE}
    />
    <FacePath
      at={[X0, Y1, LIP_H]}
      d={LIP}
      plane="left"
      style={faceFill("surface", "left")}
    />
    <FacePath
      at={[X0, Y1, LIP_H]}
      d={rect(LABEL.u, LABEL.v, LABEL.w, LABEL.h)}
      plane="left"
      style={{ fill: "var(--iso-main-left)" }}
    />
  </>
);

/** The sheet: a page lying flat, ruled, the last line short. */
const Sheet = () => (
  <>
    <FacePath
      at={SHEET_AT}
      d={rect(0, 0, SHEET.w, SHEET.d)}
      plane="top"
      style={faceFill("surface", "top")}
    />
    {SHEET.lines.map((v, i) => (
      <FacePath
        at={SHEET_AT}
        d={`M0.75 ${v} H${i === SHEET.lines.length - 1 ? SHEET.w / 2 : SHEET.w - 0.75}`}
        key={v}
        plane="top"
        style={LINE}
      />
    ))}
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type InboxTrayProps = LineStateProps;

/**
 * Inbox tray: a complete "nothing to review" state with a line
 * illustration, a heading, a line of copy and a button. An office letter
 * tray at the true isometric angle (sides sloping down to a low lip with
 * a finger scoop, a window along each side): a ruled sheet grows in above
 * it, drops in, and is whisked up and away, shrinking, leaving it empty.
 * One fine outline, paper faces, the label on the lip the one brand mark,
 * no shadow. Plays when it comes into view, or each time `active` turns
 * true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const InboxTray = ({
  heading = "Nothing to review",
  description = "New requests that need your attention will land here.",
  actionLabel = "View history",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: InboxTrayProps) => {
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
      defaultArtClassName="w-56"
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
      slot="inbox-tray"
      view="isometric"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, trayPose(clip), clip.end)}>
        {/* Back to front: the inside, the sheet lying in it, then the
            walls that hide its near part. Once it is whisked up it is
            above them all. */}
        <Inside />
        <Rig pivot={SHEET_MID} {...onClock(clock, placePose(clip), clip.end)}>
          <Rig pivot={SHEET_MID} {...onClock(clock, sizePose(clip), clip.end)}>
            <Sheet />
          </Rig>
        </Rig>
        <Front />
      </Rig>
    </LineState>
  );
};

export default InboxTray;
