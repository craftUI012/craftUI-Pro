"use client";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
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
 * "No active alerts", told by one object in line: a radar scope facing the
 * screen (a round screen in a squared housing, range rings, crosshairs,
 * ticks round the bezel, two knobs below) whose sweep goes once round,
 * finds nothing, and stops pointing straight up. Use: all clear. Move: a
 * full turn of the sweep, then a pop of the centre dot. Each value is ms
 * after the art comes into view.
 *
 *    0ms   the scope stands still, its sweep pointing straight up
 *  400ms   the sweep sets off clockwise, gathering speed and slowing as
 *          it comes round (1400ms); a trailing wedge of three lines opens
 *          behind it as it speeds up (its width is how far the sweep went
 *          in the last 90ms) and folds back under it as it slows
 * 1800ms   it runs 4° past the top, comes back 1° short, and settles
 *          pointing up (280ms); the wedge is shut
 * 1800ms   the centre dot pops: it grows 50% and springs back (500ms)
 * 2300ms   still: exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the scope still, the
 * sweep pointing up.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The dot's pop.
  pop: 500,
  // The sweep goes round this long.
  round: 1400,
  // It settles on the top this long.
  settle: 280,
  start: 400,
  // The wedge spans how far the sweep went in this long.
  trail: 90,
};

/* How far things move. */
const MOVE = {
  // Degrees the sweep runs past the top before it settles.
  past: 4,
  // The dot's size at the top of its pop.
  pop: 1.5,
  // The widest the wedge opens, degrees.
  wedge: 34,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0; the front face of the housing is the plane
// y = 0. Only the housing has depth (a clear top strip); everything on its
// face is flush, so every part draws as one line (line-style.md, "Clean
// lines"). Positions are world x (across) and z (up) on that face.

// The housing: an upright rounded slab.
const BODY = { depth: 1, h: 9, r: 1, w: 7.5 };
const BODY_AT: Vec3 = [-BODY.w / 2, 0, BODY.h];

/** A point on the housing's face. */
const on = (x: number, z: number): Vec3 => [x, 0, z];

// The scope: a bezel round a darker screen, high in the housing.
const SCOPE = { bezel: 3, screen: 2.5, z: 5.5 };
const CENTRE = on(0, SCOPE.z);

// Two range rings inside the screen, a clear 0.75 apart.
const RINGS = [1, 1.75] as const;

// Ticks round the bezel, from the screen's edge out: quiet marks.
const TICK = { count: 24, len: 0.25 };
const TICKS = Array.from({ length: TICK.count }, (_, i) => {
  const a = (i / TICK.count) * Math.PI * 2;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const from = SCOPE.screen;
  const to = SCOPE.screen + TICK.len;
  return `M${r2(from * s)} ${r2(-from * c)} L${r2(to * s)} ${r2(-to * c)}`;
}).join(" ");

// The crosshairs: level and plumb through the centre, rim to rim.
const CROSS = `M${-SCOPE.screen} 0 H${SCOPE.screen} M0 ${-SCOPE.screen} V${SCOPE.screen}`;

// The sweep: a slim bar from the centre to the screen's edge, its sides
// parallel (a taper draws its two edges as one doubled line). Face units
// about the centre, v down: it points up to v = -screen.
const SWEEP = { w: 0.125 };
const SWEEP_PATH = `M${-SWEEP.w} 0 V${-SCOPE.screen} H${SWEEP.w} V0 Z`;
// The trailing wedge: radii behind the sweep at these shares of its width.
const WEDGE = [1, 2 / 3, 1 / 3] as const;
const RADIUS = `M0 0 V${-SCOPE.screen}`;

// The centre dot the sweep turns on: the one brand mark.
const DOT = { r: 0.375 };

// Two knobs below the screen, each a disc with a pointer to the top.
const KNOB = { r: 0.625, x: 2.25, z: 1.25 };
const KNOBS = [-KNOB.x, KNOB.x] as const;

// A vent between the knobs: three short upright slots.
const VENT = { gap: 0.5, h: 1, z: 0.75 };

// The frame fits the housing at rest: its front face and the top strip its
// depth shows. The sweep stays inside the screen.
const EXTENT: Vec3[] = [
  [-BODY.w / 2, 0, 0],
  [BODY.w / 2, 0, 0],
  [-BODY.w / 2, -BODY.depth, BODY.h],
  [BODY.w / 2, -BODY.depth, BODY.h],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The sweep's turn, degrees clockwise from straight up. */
  sweep: IsoTrack;
  /** The dot's size, 1 at rest. */
  pop: IsoTrack;
}

const beat = (t0: number): Clip => {
  const top = t0 + TIMING.round;
  const sweep: IsoKey[] = [
    [t0, 0, EASE.easy],
    [top, 360 + MOVE.past, EASE.easy],
    [top + TIMING.settle * 0.6, 359, EASE.easy],
    [top + TIMING.settle, 360],
  ];
  const pop: IsoKey[] = [
    [top, 1, EASE.soft],
    [top + 160, MOVE.pop, EASE.easy],
    [top + 300, 0.92, EASE.easy],
    [top + 410, 1.03, EASE.easy],
    [top + TIMING.pop, 1],
  ];
  return { end: top + TIMING.pop, pop, sweep };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/** A turn held between 0 and 360, so a whole turn lands on 0. */
const wrap = (deg: number) => r2(((deg % 360) + 360) % 360);

const sweepPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: wrap(sample(clip.sweep, ms)),
  });

/** The wedge's width: how far the sweep went in the last moment, never back. */
const wedgeAt = (clip: Clip, ms: number) => {
  const went = sample(clip.sweep, ms) - sample(clip.sweep, ms - TIMING.trail);
  return Math.min(MOVE.wedge, Math.max(0, went));
};

const wedgePose =
  (clip: Clip, share: number) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: wrap(sample(clip.sweep, ms) - wedgeAt(clip, ms) * share),
  });

const dotPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    scale: r2(sample(clip.pop, ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

type Posed = ReturnType<typeof onClock>;

/** A disc centred on a point of the face, in a palette shade. */
const Disc = ({
  at,
  r,
  shade,
}: {
  at: Vec3;
  r: number;
  shade: "top" | "right";
}) => (
  <FacePath
    at={at}
    d={circle(0, 0, r)}
    plane="left"
    style={faceFill("surface", shade)}
  />
);

/** The bezel and its ticks, the darker screen, its rings and crosshairs. */
const Scope = () => (
  <>
    <Disc at={CENTRE} r={SCOPE.bezel} shade="top" />
    <FacePath at={CENTRE} d={TICKS} plane="left" style={LINE} />
    <Disc at={CENTRE} r={SCOPE.screen} shade="right" />
    {RINGS.map((r) => (
      <FacePath
        at={CENTRE}
        d={circle(0, 0, r)}
        key={r}
        plane="left"
        style={LINE}
      />
    ))}
    <FacePath at={CENTRE} d={CROSS} plane="left" style={LINE} />
  </>
);

/** The wedge's radii, the sweep over them, and the dot it turns on. */
const Sweep = ({
  dot,
  sweep,
  wedge,
}: {
  dot: Posed;
  sweep: Posed;
  wedge: readonly Posed[];
}) => (
  <>
    {wedge.map((pose, i) => (
      <Rig key={WEDGE[i]} pivot={CENTRE} {...pose}>
        <FacePath at={CENTRE} d={RADIUS} plane="left" style={LINE} />
      </Rig>
    ))}
    <Rig pivot={CENTRE} {...sweep}>
      <FacePath
        at={CENTRE}
        d={SWEEP_PATH}
        plane="left"
        style={faceFill("surface", "top")}
      />
    </Rig>
    <Rig pivot={CENTRE} {...dot}>
      <FacePath
        at={CENTRE}
        d={circle(0, 0, DOT.r)}
        plane="left"
        style={faceFill("main", "left")}
      />
    </Rig>
  </>
);

/** A knob: a disc with a pointer from its middle to the top. */
const Knob = ({ x }: { x: number }) => (
  <>
    <Disc at={on(x, KNOB.z)} r={KNOB.r} shade="top" />
    <FacePath
      at={on(x, KNOB.z)}
      d={`M0 0 V${-KNOB.r}`}
      plane="left"
      style={LINE}
    />
  </>
);

/** The vent between the knobs: three short upright slots. */
const Vent = () => (
  <FacePath
    at={on(0, VENT.z)}
    d={[-VENT.gap, 0, VENT.gap].map((u) => `M${u} 0 V${-VENT.h}`).join(" ")}
    plane="left"
    style={LINE}
  />
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type RadarScopeProps = LineStateProps;

/**
 * Radar scope: a complete "no active alerts" state with a line
 * illustration, a heading, a line of copy and a button. A radar scope
 * facing the screen: its sweep goes once round the range rings, a thin
 * wedge of lines trailing it, finds nothing and stops pointing straight up;
 * the centre dot pops. One fine outline, paper faces, the centre dot the
 * one brand mark, no shadow. Plays when it comes into view, or each time
 * `active` turns true (PlayOnHover, or your own state). Follows the shadcn
 * theme.
 */
export const RadarScope = ({
  heading = "No active alerts",
  description = "Security alerts will show up here the moment they happen.",
  actionLabel = "Alert settings",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: RadarScopeProps) => {
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
      defaultArtClassName="w-44"
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
      slot="radar-scope"
      view="front"
    >
      <Extrude
        at={BODY_AT}
        convex
        d={roundedRect(BODY.w, BODY.h, BODY.r)}
        depth={BODY.depth}
        palette="surface"
        plane="left"
      >
        <Scope />
        <Sweep
          dot={onClock(clock, dotPose(clip), clip.end)}
          sweep={onClock(clock, sweepPose(clip), clip.end)}
          wedge={WEDGE.map((share) =>
            onClock(clock, wedgePose(clip, share), clip.end)
          )}
        />
        {KNOBS.map((x) => (
          <Knob key={x} x={x} />
        ))}
        <Vent />
      </Extrude>
    </LineState>
  );
};

export default RadarScope;
