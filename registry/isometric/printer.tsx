"use client";

import { Box, EASE, FacePath, Rig, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
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
 * "Nothing to print", told by one object in line: a desktop printer at
 * the true isometric angle (a paper feeder leaning back at its rear, a
 * control panel on top, an output slot over a pull-out tray) that wakes,
 * feeds a blank page onto its tray and pulls it straight back. Use: empty
 * state. Move: a status light popping, a shudder, a slide out of a
 * housing and back. Each value is ms after the art comes into view.
 *
 *    0ms   the printer stands still, two sheets in its feeder
 *  400ms   its status light pops (1.6×, 300ms) as the body shudders side
 *          to side, 0.08 units at most, each shake smaller (260ms)
 *  620ms   a blank page feeds out of the slot onto the tray, 2 units
 *          (560ms, easing in and out)
 * 1180ms   it lies there, blank (360ms)
 * 1540ms   it is pulled swiftly back in (200ms, speeding up)
 * 1740ms   the body knocks once as it swallows it (140ms)
 * 1880ms   still: exactly as it started
 *
 * The page is cut at the slot: it grows out of the slot's edge, so the
 * part still inside is never drawn.
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the printer, still.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The page starts to feed this long after the start.
  feed: 220,
  // How long the blank page lies out.
  hold: 360,
  // The page feeds out this long.
  out: 560,
  // And is pulled back in this long.
  pull: 200,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built along the world axes, standing on z = 0: the front (slot, tray,
// status light) faces +y, the side with the vent faces +x.
const BODY = { d: 5, h: 3.25, w: 7 };
const X0 = -BODY.w / 2;
const X1 = BODY.w / 2;
const Y0 = -BODY.d / 2;
const Y1 = BODY.d / 2;

// On the front, in face units (u across from the left, v down from the
// top): the output slot, the badge and the status light (the brand mark).
const SLOT = { h: 0.5, u: 1.25, v: 1.5, w: 4.5 };
const BADGE = { h: 0.5, u: 0.5, v: 0.5, w: 1.25 };
const LIGHT = { r: 0.25, u: 6, v: 0.75 };
const LIGHT_AT: Vec3 = [X0 + LIGHT.u, Y1, BODY.h - LIGHT.v];

// The output tray: a shelf pulled out under the slot, its top flush with
// the slot's bottom edge.
const TRAY_TOP = BODY.h - SLOT.v - SLOT.h;
const TRAY = { d: 2.5, h: 0.5, w: 4.5 };
const TRAY_AT: Vec3 = [-TRAY.w / 2, Y1, TRAY_TOP - TRAY.h];

// The page, lying on the tray's bed, half a unit short of its end: it
// grows out of the slot's edge.
const PAGE = { d: 2, w: 3.5 };
const PAGE_AT: Vec3 = [-PAGE.w / 2, Y1, TRAY_TOP];

// The control panel on the top's front right (u across x, v toward the
// front): a small display with one line, and two round buttons.
const DISPLAY = { d: 1, r: 0.2, w: 1.75, x: -0.75, y: 1 };
const BUTTONS = [1.75, 2.75];
const BUTTON = { r: 0.25, y: 1.5 };

// The vent on the side: short upright slots (u from the front, v down).
const VENT = { from: 1.5, step: 0.5, to: 3.5, v: [1, 2] as const };

// The feeder: a narrow paper support leaning back 20° from the top's
// rear edge, standing above two wider sheets that rest against it (the
// back one offset left and up). All thin, so all faces on one plane,
// written back to front.
const FEEDER = { h: 3.75, lean: 20, w: 2 };
const FEEDER_PIVOT: Vec3 = [0, Y0, BODY.h];
const SHEETS = [
  { h: 3, x: -0.5 },
  { h: 2.5, x: 0 },
] as const;
const SHEET_W = 4;

// Where the feeder's top corners end up once it leans.
const leaned = (x: number, h: number): Vec3 => {
  const a = (FEEDER.lean * Math.PI) / 180;
  return [x, r2(Y0 - h * Math.sin(a)), r2(BODY.h + h * Math.cos(a))];
};

// The frame fits the printer at rest: body, tray and feeder.
const EXTENT: Vec3[] = [
  [X0, Y1, 0],
  [X1, Y1, 0],
  [X1, Y0, 0],
  [X0, Y1, BODY.h],
  [X1, Y0, BODY.h],
  [TRAY_AT[0], Y1 + TRAY.d, TRAY_AT[2]],
  [-TRAY_AT[0], Y1 + TRAY.d, TRAY_AT[2]],
  leaned(-FEEDER.w / 2, FEEDER.h),
  leaned(FEEDER.w / 2, FEEDER.h),
  leaned(SHEETS[0].x - SHEET_W / 2, SHEETS[0].h),
  leaned(SHEETS[0].x + SHEET_W / 2, SHEETS[0].h),
];
const BOUNDS = viewBounds("isometric", EXTENT);

// Seen into the slot: a step darker than the darkest wall.
const SLOT_FILL = "oklch(from var(--iso-surface-right-c) calc(l - 0.12) c h)";

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The body's shudder along x, world units. */
  shake: IsoTrack;
  /** How far the page is out, 0 to 1 of its length. */
  feed: IsoTrack;
  /** The status light's size. */
  light: IsoTrack;
}

const SHAKE = 0.08;
const POP = 1.6;

const beat = (t0: number): Clip => {
  const feed = t0 + TIMING.feed;
  const out = feed + TIMING.out;
  const back = out + TIMING.hold;
  const home = back + TIMING.pull;
  const shake: IsoKey[] = [
    [t0, 0, EASE.easy],
    [t0 + 60, SHAKE, EASE.easy],
    [t0 + 130, -SHAKE * 0.7, EASE.easy],
    [t0 + 200, SHAKE * 0.35, EASE.easy],
    [t0 + 260, 0, "hold"],
    // The knock as it swallows the page.
    [home, 0, EASE.easy],
    [home + 70, SHAKE * 0.5, EASE.easy],
    [home + 140, 0],
  ];
  const page: IsoKey[] = [
    [feed, 0, EASE.easy],
    [out, 1, "hold"],
    [back, 1, EASE.in],
    [home, 0],
  ];
  const light: IsoKey[] = [
    [t0, 1, EASE.soft],
    [t0 + 120, POP, EASE.easy],
    [t0 + 300, 1],
  ];
  return { end: home + 140, feed: page, light, shake };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const shakePose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    offset: [r2(sample(clip.shake, ms)), 0, 0],
  });

// The page grows out of the slot's edge along +y: blank, so growing it
// reads exactly as sliding it out, and nothing inside is ever drawn.
const feedPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    scale: [1, Math.max(0.001, r2(sample(clip.feed, ms))), 1],
  });

const lightPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    scale: r2(sample(clip.light, ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y} H${x + w} V${y + h} H${x} Z`;

/** A rounded rectangle as a face path, corners as cubic quarter circles. */
const rounded = (x: number, y: number, w: number, h: number, r: number) => {
  const k = r2(r * 0.5523);
  return [
    `M${r2(x + r)} ${y}`,
    `H${r2(x + w - r)}`,
    `C${r2(x + w - r + k)} ${y} ${x + w} ${r2(y + r - k)} ${x + w} ${r2(y + r)}`,
    `V${r2(y + h - r)}`,
    `C${x + w} ${r2(y + h - r + k)} ${r2(x + w - r + k)} ${y + h} ${r2(x + w - r)} ${y + h}`,
    `H${r2(x + r)}`,
    `C${r2(x + r - k)} ${y + h} ${x} ${r2(y + h - r + k)} ${x} ${r2(y + h - r)}`,
    `V${r2(y + r)}`,
    `C${x} ${r2(y + r - k)} ${r2(x + r - k)} ${y} ${r2(x + r)} ${y}`,
    "Z",
  ].join(" ");
};

/**
 * The body: a block with, on its front, the slot and the badge; on its
 * side, the vent; on its top, the control panel.
 */
const Body = () => {
  const front: Vec3 = [X0, Y1, BODY.h];
  const side: Vec3 = [X1, Y1, BODY.h];
  const top: Vec3 = [X0, Y0, BODY.h];
  return (
    <>
      <Box at={[X0, Y0, 0]} palette="surface" size={[BODY.w, BODY.d, BODY.h]} />
      <FacePath
        at={front}
        d={rect(SLOT.u, SLOT.v, SLOT.w, SLOT.h)}
        plane="left"
        style={{ ...LINE, fill: SLOT_FILL }}
      />
      <FacePath
        at={front}
        d={rounded(BADGE.u, BADGE.v, BADGE.w, BADGE.h, 0.25)}
        plane="left"
        style={LINE}
      />
      {Array.from(
        { length: (VENT.to - VENT.from) / VENT.step + 1 },
        (_, i) => VENT.from + i * VENT.step
      ).map((u) => (
        <FacePath
          at={side}
          d={`M${u} ${VENT.v[0]} V${VENT.v[1]}`}
          key={u}
          plane="right"
          style={LINE}
        />
      ))}
      <FacePath
        at={top}
        d={rounded(
          DISPLAY.x - X0,
          DISPLAY.y - Y0,
          DISPLAY.w,
          DISPLAY.d,
          DISPLAY.r
        )}
        plane="top"
        style={faceFill("surface", "left")}
      />
      <FacePath
        at={top}
        d={`M${DISPLAY.x - X0 + 0.5} ${DISPLAY.y - Y0 + DISPLAY.d / 2} H${DISPLAY.x - X0 + DISPLAY.w - 0.5}`}
        plane="top"
        style={LINE}
      />
      {BUTTONS.map((x) => (
        <FacePath
          at={top}
          d={circle(x - X0, BUTTON.y - Y0, BUTTON.r)}
          key={x}
          plane="top"
          style={LINE}
        />
      ))}
    </>
  );
};

/** The feeder: the leaning support and the sheets resting against it. */
const Feeder = () => (
  <Rig axis="x" pivot={FEEDER_PIVOT} rotate={FEEDER.lean}>
    <FacePath
      at={[-FEEDER.w / 2, Y0, BODY.h + FEEDER.h]}
      d={rounded(0, 0, FEEDER.w, FEEDER.h, 0.25)}
      plane="left"
      style={faceFill("surface", "left")}
    />
    {SHEETS.map(({ h, x }) => (
      <FacePath
        at={[x - SHEET_W / 2, Y0, BODY.h + h]}
        d={rect(0, 0, SHEET_W, h)}
        key={h}
        plane="left"
        style={faceFill("surface", "top")}
      />
    ))}
  </Rig>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type PrinterProps = LineStateProps;

/**
 * Printer: a complete "nothing to print" state with a line illustration,
 * a heading, a line of copy and a button. A desktop printer at the true
 * isometric angle (a paper feeder leaning back with two sheets in it, a
 * control panel with a display and two buttons, a vent, an output slot
 * over a pull-out tray): its status light pops, it shudders, feeds a blank
 * page onto the tray and pulls it straight back. One fine outline, paper
 * faces, the status light the one brand mark, no shadow. Plays when it
 * comes into view, or each time `active` turns true (PlayOnHover, or your
 * own state). Follows the shadcn theme.
 */
export const Printer = ({
  heading = "Nothing to print",
  description = "Documents you send to print will queue here.",
  actionLabel = "Print a page",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: PrinterProps) => {
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
      slot="printer"
      view="isometric"
    >
      <Rig pivot={[0, 0, 0]} {...onClock(clock, shakePose(clip), clip.end)}>
        {/* Back to front: the body, the feeder rising behind its top, the
            tray, the page on it, then the status light. */}
        <Body />
        <Feeder />
        <Box at={TRAY_AT} palette="surface" size={[TRAY.w, TRAY.d, TRAY.h]} />
        {/* The tray's bed, a step under the paper so a page reads on it. */}
        <FacePath
          at={[TRAY_AT[0], Y1, TRAY_TOP]}
          d={rect(0, 0, TRAY.w, TRAY.d)}
          plane="top"
          style={faceFill("surface", "left")}
        />
        <Rig pivot={PAGE_AT} {...onClock(clock, feedPose(clip), clip.end)}>
          <FacePath
            at={PAGE_AT}
            d={rect(0, 0, PAGE.w, PAGE.d)}
            plane="top"
            style={faceFill("surface", "top")}
          />
        </Rig>
        <Rig pivot={LIGHT_AT} {...onClock(clock, lightPose(clip), clip.end)}>
          <FacePath
            at={[X0, Y1, BODY.h]}
            d={circle(LIGHT.u, LIGHT.v, LIGHT.r)}
            plane="left"
            style={{ fill: "var(--iso-main-left)" }}
          />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default Printer;
