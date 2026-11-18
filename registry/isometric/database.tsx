"use client";

import type { ReactNode } from "react";

import { EASE, FacePath, Rig, lift, sample, shiftTrack } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
  ICON,
  LINE,
  LineState,
  Slice,
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
 * "No data yet", told by one object in line: the classic database, a
 * stack of three round layers of one radius that open one after another
 * like a wave running up it. Use: empty state. Move: a staggered lift
 * across three parts, each with one small bounce. Each value is ms after
 * the art comes into view.
 *
 *    0ms   the stack stands closed, three layers, one seam line between
 *          each two
 *  400ms   the bottom layer, its foot planted, presses down 8% (110ms)
 *          and springs back 3% past its height, kicking the stack up
 *  490ms   the middle layer lifts off it 0.5 units (260ms, a soft pop),
 *          opening a gap and carrying the top layer
 *  580ms   the top layer lifts off the middle one (90ms behind)
 *  750ms   each hangs open for 240ms, then drops back in turn (220ms,
 *          speeding up) with one small bounce: the stack closes from
 *          the bottom up
 * 1300ms   as the top layer lands, its status light pops 40% and settles
 *          (440ms)
 * 1740ms   still: the stack closed, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the stack closed.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // How long each layer hangs lifted.
  hang: 240,
  // How far each layer lags the one below it.
  stagger: 90,
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built standing on z = 0 about the vertical axis x = y = 0, facing +y.

// Three round layers of one radius, stacked flush: each seam is the one
// ring where a layer stands on the one below (the upper slice covers the
// lower one's far half, and its near half is the seam).
const R = 3.5;
const LAYER_H = 1.5;
const LAYERS = [0, 1, 2] as const;
/** Height of a layer's foot. */
const footOf = (i: number) => i * LAYER_H;
const TOP_Z = footOf(LAYERS.length);

// How far the middle and top layers lift off the layer below, and how
// far the bottom one presses into its foot (a height scale).
const LIFT = 0.5;
const PRESS = { deep: 0.92, past: 1.03 };

// A row of two small status lights on each layer's front, right of the
// middle, half way up the layer. Each sits on the wall where it is: its
// plane touches the wall at its centre, and it is drawn narrower by the
// wall's turn there so it lies on the curve.
const LIGHT = { r: 0.25, x: [1.25, 2.25] as const };
// The top layer's second light is the one brand mark.
const LIT = { layer: 2, light: 1 };

const lightAt = (x: number, i: number): Vec3 => [
  x,
  r2(Math.sqrt(R * R - x * x)),
  footOf(i) + LAYER_H / 2,
];

// The frame fits the stack at rest: its widest sides, the front of its
// foot and the back of its top. The lift runs into the stage's padding.
const EXTENT: Vec3[] = [
  [-R, 0, 0],
  [R, 0, 0],
  [0, R, 0],
  [-R, 0, TOP_Z],
  [R, 0, TOP_Z],
  [0, -R, TOP_Z],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The bottom layer's height scale about its foot. */
  press: IsoTrack;
  /** The middle and top layers' lift off the one below, world units (never below 0). */
  lifts: IsoTrack[];
  /** Scale of the brand light. */
  light: IsoTrack;
}

const beat = (t0: number): Clip => {
  // The engine's `lift`: pops up, hangs, drops, one small bounce.
  const one = lift(LIFT, t0, TIMING.hang);
  const lifts = [1, 2].map((i) => shiftTrack(one, TIMING.stagger * i));
  // The foot stays planted: the bottom layer presses and springs back,
  // and its spring is what sends the middle one up.
  const press: IsoKey[] = [
    [t0, 1, EASE.in],
    [t0 + 110, PRESS.deep, EASE.soft],
    [t0 + 260, PRESS.past, EASE.easy],
    [t0 + 400, 1],
  ];
  // The top layer lands 260 + hang + 220ms after it starts.
  const landed = t0 + TIMING.stagger * 2 + 260 + TIMING.hang + 220;
  const light: IsoKey[] = [
    [landed, 1, EASE.soft],
    [landed + 160, 1.4, EASE.easy],
    [landed + 320, 0.92, EASE.easy],
    [landed + 440, 1],
  ];
  return { end: landed + 440, lifts, light, press };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/** Layer 1 (middle) or 2 (top) lifting off the one below. */
const liftPose =
  (clip: Clip, i: 1 | 2) =>
  (ms: number): IsoPose => ({
    offset: [0, 0, r2(sample(clip.lifts[i - 1], ms))],
  });

const pressPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    scale: [1, 1, r2(sample(clip.press, ms))],
  });

const lightPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.light, ms));
    return { scale: [k, 1, k] };
  };

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** An oval centred on (cx, cy), rx across and ry down, as a face path. */
const oval = (cx: number, cy: number, rx: number, ry: number) => {
  const kx = r2(rx * ARC);
  const ky = r2(ry * ARC);
  return [
    `M${r2(cx + rx)} ${cy}`,
    `C${r2(cx + rx)} ${r2(cy + ky)} ${r2(cx + kx)} ${r2(cy + ry)} ${cx} ${r2(cy + ry)}`,
    `C${r2(cx - kx)} ${r2(cy + ry)} ${r2(cx - rx)} ${r2(cy + ky)} ${r2(cx - rx)} ${cy}`,
    `C${r2(cx - rx)} ${r2(cy - ky)} ${r2(cx - kx)} ${r2(cy - ry)} ${cx} ${r2(cy - ry)}`,
    `C${r2(cx + kx)} ${r2(cy - ry)} ${r2(cx + rx)} ${r2(cy - ky)} ${r2(cx + rx)} ${cy}`,
    "Z",
  ].join(" ");
};

/** One light on the wall: outlined, or the brand mark. */
const Light = ({ x, i, lit }: { x: number; i: number; lit?: boolean }) => {
  const [, y, z] = lightAt(x, i);
  const narrow = r2((LIGHT.r * y) / R);
  return (
    <FacePath
      at={[0, y, z]}
      d={oval(x, 0, narrow, LIGHT.r)}
      plane="left"
      style={lit ? faceFill("main", "left") : LINE}
    />
  );
};

/**
 * One layer: its round slice, then its row of lights. `brand` replaces the
 * lit light (it pops in its own rig).
 */
const Layer = ({ i, brand }: { i: number; brand?: ReactNode }) => {
  const z = footOf(i);
  return (
    <>
      <Slice bottom={[[0, 0, z], R]} top={[[0, 0, z + LAYER_H], R]} />
      {LIGHT.x.map((x, n) =>
        brand && n === LIT.light ? (
          <g key={x}>{brand}</g>
        ) : (
          <Light i={i} key={x} x={x} />
        )
      )}
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type DatabaseProps = LineStateProps;

/**
 * Database: a complete "no data yet" state with a line illustration, a
 * heading, a line of copy and a button. The classic stack of three round
 * layers of one radius, a row of two status lights on each, lifts in a
 * wave from the bottom up and closes again; the top layer's status light
 * pops as it lands. One fine outline, paper faces, that light the one
 * brand mark, facing the screen, no shadow. Plays when it comes into
 * view, or each time `active` turns true (PlayOnHover, or your own
 * state). Follows the shadcn theme.
 */
export const Database = ({
  heading = "No data yet",
  description = "Connect a source to start bringing in data.",
  actionLabel = "Connect source",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: DatabaseProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  // Each layer rides on the one below it, so a lift opens a gap above
  // it and carries the rest of the stack.
  const pivot = (i: number): Vec3 => [0, 0, footOf(i)];
  const litX = LIGHT.x[LIT.light];
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
      slot="database"
    >
      {/* From the foot up: each layer covers the far half of the one below. */}
      <Rig pivot={pivot(0)} {...onClock(clock, pressPose(clip), clip.end)}>
        <Layer i={0} />
        <Rig pivot={pivot(1)} {...onClock(clock, liftPose(clip, 1), clip.end)}>
          <Layer i={1} />
          <Rig
            pivot={pivot(2)}
            {...onClock(clock, liftPose(clip, 2), clip.end)}
          >
            <Layer
              brand={
                <Rig
                  pivot={lightAt(litX, LIT.layer)}
                  {...onClock(clock, lightPose(clip), clip.end)}
                >
                  <Light i={LIT.layer} lit x={litX} />
                </Rig>
              }
              i={2}
            />
          </Rig>
        </Rig>
      </Rig>
    </LineState>
  );
};

export default Database;
