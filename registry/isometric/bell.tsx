"use client";

import { Button } from "@/components/ui/button";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  LINE,
  LineState,
  disc,
  facing,
  onClock,
  r2,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An all-clear state told by one object, in line: a bell that rings once
 * and falls quiet. A fine outline, near-white faces, the clapper the one
 * brand mark, facing the screen, no shadow. Under it, the state's own
 * words: a heading, a line, a button. Each value is ms after the art
 * comes into view.
 *
 *    0ms   the bell hangs still
 *  400ms   it is rung: it swings 11° to one side (200ms)
 *  490ms   the clapper follows 90ms behind and swings wider, to the rim
 *  600ms   back through the middle and 8° the other way, then 5°, 2.5°,
 *          1°, each swing smaller and a little quicker
 * 1890ms   still: hanging straight, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true (or with `loop`, after a 5.2s hold).
 * Reduced motion, or `active` false before any play: the bell hanging
 * straight, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true the bell is rung this soon.
  again: 80,
  // The clapper follows the bell this much later.
  lag: 90,
  // The bell is rung this long after it comes into view.
  start: 400,
};

// The ringing: where each swing ends, in degrees (negative leans the
// mouth to the right), and how long it takes to get there.
const SWINGS = [
  { deg: -11, ms: 200 },
  { deg: 8, ms: 300 },
  { deg: -5, ms: 270 },
  { deg: 2.5, ms: 240 },
  { deg: -1, ms: 210 },
  { deg: 0, ms: 180 },
] as const;

/* The clapper against the bell. */
const CLAPPER_SWING = {
  // How much wider than the bell it swings.
  gain: 1.7,
  // The most it can lean inside the bell before it meets the rim, degrees.
  stop: 15,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Everything is built facing +y, about a centre line at x = 0, and shown
// facing the screen.

// The rim: the bar across the bell's mouth.
const RIM = { depth: 0.6, h: 0.55, r: 0.27, w: 5.7, z: 1 };
const RIM_TOP = RIM.z + RIM.h;

// The body: a dome that flares to the rim. `w` is its width at the rim,
// `h` its height above it. It is a flat face on the front plane, one
// outline: a depth here would show as a second outline a pixel or two
// above the steep flanks (a doubled line), so the rim and the knob carry
// the bell's thickness instead.
const BODY = { h: 4.2, w: 4.6 };
const BODY_TOP = RIM_TOP + BODY.h;
const BODY_AT: Vec3 = [-BODY.w / 2, 0, BODY_TOP];

// The body's outline (u across from its left edge, v down from the top of
// the dome): up the flare, over the dome and down the other side.
const BODY_PATH = [
  `M0 ${BODY.h}`,
  "C0.42 3.65 0.62 2.9 0.78 2.2",
  "C1 1.22 1.35 0 2.3 0",
  "C3.25 0 3.6 1.22 3.82 2.2",
  `C3.98 2.9 4.18 3.65 ${BODY.w} ${BODY.h}`,
  "Z",
].join(" ");

// The knob the bell hangs by, set into the top of the dome.
const KNOB = { depth: 0.45, h: 0.62, r: 0.3, sink: 0.15, w: 0.8 };
const KNOB_TOP = BODY_TOP - KNOB.sink + KNOB.h;
const KNOB_Y = 0;

// The clapper: a ball hanging in the mouth, half of it below the rim. It
// swings from a point high inside the dome.
const CLAPPER = { depth: 0.45, hang: 3.4, r: 0.52, z: 0.92 };
const CLAPPER_Y = -(RIM.depth - CLAPPER.depth) / 2;
const CLAPPER_PIVOT: Vec3 = [0, 0, RIM_TOP + CLAPPER.hang];

// The frame fits the bell hanging straight: as wide as the rim, from the
// foot of the clapper to the top of the knob. The swings reach a little
// wider; that runs into the stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [-RIM.w / 2, 0, CLAPPER.z - CLAPPER.r],
  [RIM.w / 2, 0, CLAPPER.z - CLAPPER.r],
  [-RIM.w / 2, -RIM.depth, KNOB_TOP],
  [RIM.w / 2, -RIM.depth, KNOB_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: the bell's lean in degrees, and when it is at rest. */
interface Clip {
  end: number;
  swing: IsoTrack;
}

// The beat itself, starting `t0` ms into a run. The first swing is thrown
// (fast, then slowing to its top); every one after it sways like a
// pendulum.
const beat = (t0: number): Clip => {
  const swing: IsoKey[] = [[t0, 0, EASE.drop]];
  let t = t0;
  for (const { deg, ms } of SWINGS) {
    t += ms;
    swing.push([t, deg, EASE.easy]);
  }
  return { end: t + TIMING.lag, swing };
};

// The first run waits a moment after coming into view; a play asked for by
// `active` does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/** The whole bell, swinging from the top of its knob. */
const bellPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.swing, ms)),
  });

/**
 * The clapper inside the swinging bell: where the bell was a moment ago,
 * swung wider, less where the bell is now, and never past the rim.
 */
const clapperPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const own = CLAPPER_SWING.gain * sample(clip.swing, ms - TIMING.lag);
    const lean = own - sample(clip.swing, ms);
    const held = Math.max(
      -CLAPPER_SWING.stop,
      Math.min(CLAPPER_SWING.stop, lean)
    );
    return { axis: "y", rotate: r2(held) };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The body: a flat face on the front plane with one outline. Its swing
 * turns it in the picture plane, so there is no far edge to find.
 */
const Body = () => (
  <FacePath
    at={BODY_AT}
    d={BODY_PATH}
    plane="left"
    style={{ ...LINE, fill: "var(--iso-surface-left)" }}
  />
);

/** The rim across the mouth, and the knob on top. */
const Rim = () => (
  <Extrude
    at={[-RIM.w / 2, 0, RIM_TOP]}
    convex
    d={roundedRect(RIM.w, RIM.h, RIM.r)}
    depth={RIM.depth}
    palette="surface"
    plane="left"
  />
);

const Knob = () => (
  <Extrude
    at={[-KNOB.w / 2, KNOB_Y, KNOB_TOP]}
    convex
    d={roundedRect(KNOB.w, KNOB.h, KNOB.r)}
    depth={KNOB.depth}
    palette="surface"
    plane="left"
  />
);

/** The clapper: the one brand mark. */
const Clapper = () => (
  <Extrude
    at={[-CLAPPER.r, CLAPPER_Y, CLAPPER.z + CLAPPER.r]}
    convex
    d={disc(CLAPPER.r)}
    depth={CLAPPER.depth}
    palette="main"
    plane="left"
  />
);

/* ───────────────────────────── Copy ───────────────────────────────────── */

// The button is built here, not by LineState: its icon has two circles,
// and the kit's icon is one path (arcs in a path render a few pixels
// apart). Same classes as the kit's button. Optical padding: an icon
// carries its own white space, so the label's side gets 2px more than the
// icon's (12px and 14px).
const BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/** The sliders on the button: two tracks, a knob on each. */
const SettingsIcon = () => (
  <svg
    aria-hidden="true"
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M4 8h9M19 8h1M4 16h1M11 16h9" />
    <circle cx="16" cy="8" r="2.5" />
    <circle cx="8" cy="16" r="2.5" />
  </svg>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type BellProps = LineStateProps;

/**
 * Bell: a complete all-caught-up state ("You're all caught up") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * bell hanging by its knob; it is rung once, swings from side to side
 * with its clapper following a beat behind, each swing smaller, and hangs
 * still. One fine outline, near-white faces, no shadow, facing the
 * screen; the clapper carries the brand. It plays when it comes into
 * view, or each time `active` turns true (PlayOnHover, or your own
 * state). Follows the shadcn theme.
 */
export const Bell = ({
  heading = "You're all caught up",
  description = "New notifications will show up here as they arrive.",
  actionLabel = "Notification settings",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: BellProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const settings = actionLabel ? (
    <Button className={BUTTON} onClick={rest.onAction} variant="secondary">
      <SettingsIcon />
      {actionLabel}
    </Button>
  ) : null;
  return (
    <LineState
      bounds={BOUNDS}
      props={{
        actionLabel,
        description,
        heading,
        strokeWidth,
        tone,
        variant,
        ...rest,
        children: rest.children ?? settings,
      }}
      shell={shell}
      slot="bell"
    >
      <Rig
        pivot={[0, 0, KNOB_TOP]}
        {...onClock(clock, bellPose(clip), clip.end)}
      >
        {/* Written from the lowest part up: each one's top edge hides behind the next. */}
        <Rig
          pivot={CLAPPER_PIVOT}
          {...onClock(clock, clapperPose(clip), clip.end)}
        >
          <Clapper />
        </Rig>
        <Rim />
        <Body />
        <Knob />
      </Rig>
    </LineState>
  );
};

export default Bell;
