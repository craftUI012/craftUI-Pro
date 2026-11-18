"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { useRef, useState } from "react";

import { EASE, Extrude, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
  LINE,
  LineState,
  facing,
  onClock,
  r2,
  useLineShell,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A blocked state told by one object, in line: a closed padlock that is
 * tried twice and stays shut. A fine outline, near-white faces, the
 * keyhole the one brand mark, facing the screen, no shadow. Under it, the
 * state's own words: a heading, a line, a button. Each value is ms after
 * it comes into view.
 *
 *    0ms   a closed padlock, still
 *  400ms   the shackle is pulled up and stops hard on its catch (140ms)
 *  540ms   the pull carries the whole lock up with it (110ms)
 *  650ms   let go: the body falls back, the shackle drops home with a tap
 * 1020ms   a second, smaller pull does the same
 * 1560ms   still: locked, exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true (and again after a 5.2s hold with `loop`).
 * Reduced motion, or `active` false before any play: the closed padlock.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true the first pull starts this soon.
  again: 80,
  // The whole lock is carried up for this long once the catch bites.
  carry: 110,
  // The first pull starts this long after the lock comes into view.
  start: 400,
  // From one pull to the next.
  step: 620,
  // The shackle travels to its catch in this long.
  tug: 140,
};

/* How far things move, in world units. */
const MOVE = {
  // The whole lock is carried up this far by the first pull.
  hop: 0.36,
  // The shackle's play before its catch stops it.
  pull: 0.46,
  // The second pull, as a share of the first.
  second: 0.6,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The body: a rounded block, built facing +y and shown facing the screen.
const BODY = { depth: 1, h: 4, r: 0.85, w: 5.2, z: 0.6 };
const BODY_X = -BODY.w / 2;
const BODY_TOP = BODY.z + BODY.h;
const BODY_AT: Vec3 = [BODY_X, 0, BODY_TOP];

// The shackle: a round bar bent into an arch, set in the middle of the
// body's depth, so each leg goes into the body's top face. Seen from the
// front a round bar shows only its silhouette, so it is one flat face with
// one outline (a depth here drew its back arc a pixel beside the front one
// down the steep sides of the arch).
const SHACKLE = { bar: 0.62, rise: 2.5, w: 3.3 };
const SHACKLE_Y = -BODY.depth / 2;

// The keyhole on the body's face (u across, v down from its top edge): a
// round hole and a slot that widens toward its foot.
const KEYHOLE = { flare: 0.27, neck: 0.17, r: 0.43, tail: 1.2, v: 1.5 };

// The frame fits the lock at rest. The pulls lift it a little; that runs
// into the stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [BODY_X, 0, BODY.z],
  [BODY_X + BODY.w, 0, BODY.z],
  [BODY_X, SHACKLE_Y, BODY_TOP + SHACKLE.rise],
  [BODY_X + BODY.w, SHACKLE_Y, BODY_TOP + SHACKLE.rise],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  end: number;
  hop: IsoTrack;
  pull: IsoTrack;
}

// One pull, starting at `t`, `k` times as strong as the first. The shackle
// slams into its catch, the catch carries the body up, and both drop back
// with one small rebound.
const tug = (t: number, k: number) => {
  const bite = t + TIMING.tug;
  const top = bite + TIMING.carry;
  const hop: IsoTrack = [
    [bite, 0, EASE.drop],
    [top, MOVE.hop * k, EASE.in],
    [top + 150, 0, EASE.drop],
    [top + 220, MOVE.hop * k * 0.2, EASE.in],
    [top + 290, 0],
  ];
  const pull: IsoTrack = [
    [t, 0, EASE.in],
    [bite, MOVE.pull * k, "hold"],
    [top + 50, MOVE.pull * k, EASE.in],
    [top + 170, 0, EASE.drop],
    [top + 230, MOVE.pull * k * 0.14, EASE.in],
    [top + 290, 0],
  ];
  return { end: top + 290, hop, pull };
};

// The beat itself, starting `t0` ms into a run: two pulls.
const beat = (t0: number): Clip => {
  const first = tug(t0, 1);
  const second = tug(t0 + TIMING.step, MOVE.second);
  return {
    end: second.end,
    hop: [...first.hop, ...second.hop],
    pull: [...first.pull, ...second.pull],
  };
};

// The first run waits a moment after coming into view; `active` does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/** The whole lock, carried up by the pull and dropped back. */
const bodyPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.hop, ms))] });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/**
 * The shackle's outline in face units (u across from its left edge, v down
 * from the top of its arch): two legs joined by a half ring. The legs end
 * where they meet the body's top face, so pulling it up `pull` units makes
 * them that much longer: the bar slides out of the body, it is not lifted
 * off it.
 */
const shacklePath = (pull: number) => {
  const { bar, rise, w } = SHACKLE;
  const outer = w / 2;
  const inner = outer - bar;
  const ko = r2(outer * ARC);
  const ki = r2(inner * ARC);
  const foot = r2(rise + pull);
  return [
    `M0 ${foot}`,
    `V${outer}`,
    `C0 ${r2(outer - ko)} ${r2(outer - ko)} 0 ${outer} 0`,
    `C${r2(outer + ko)} 0 ${w} ${r2(outer - ko)} ${w} ${outer}`,
    `V${foot}`,
    `H${r2(w - bar)}`,
    `V${outer}`,
    `C${r2(w - bar)} ${r2(outer - ki)} ${r2(outer + ki)} ${bar} ${outer} ${bar}`,
    `C${r2(outer - ki)} ${bar} ${bar} ${r2(outer - ki)} ${bar} ${outer}`,
    `V${foot}`,
    "Z",
  ].join(" ");
};

/** The shackle, `pull` units out of the body. */
const Shackle = ({ pull }: { pull: number }) => (
  <FacePath
    at={[-SHACKLE.w / 2, SHACKLE_Y, BODY_TOP + SHACKLE.rise + pull]}
    d={shacklePath(pull)}
    plane="left"
    style={{ ...LINE, fill: "var(--iso-surface-left)" }}
  />
);

// The keyhole's outline: round the hole from one side of the slot to the
// other, then down the slot and across its foot.
const KEYHOLE_PATH = (() => {
  const { flare, neck, r, tail, v } = KEYHOLE;
  const cx = BODY.w / 2;
  const from = Math.asin(neck / r);
  const steps = 40;
  const round: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = from + ((2 * Math.PI - 2 * from) * i) / steps;
    round.push(`${r2(cx + r * Math.sin(a))} ${r2(v + r * Math.cos(a))}`);
  }
  return `M${round.join(" L")} L${r2(cx - flare)} ${r2(v + tail)} L${r2(cx + flare)} ${r2(v + tail)} Z`;
})();

/** The body, and the keyhole on its face: the one brand mark. */
const Body = () => (
  <>
    <Extrude
      at={BODY_AT}
      convex
      d={roundedRect(BODY.w, BODY.h, BODY.r)}
      depth={BODY.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={BODY_AT}
      d={KEYHOLE_PATH}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-main-left)" }}
    />
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** How far the shackle is out of the body, re-rendered only when it changes. */
const usePull = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const [value, setValue] = useState(0);
  const last = useRef(0);
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = r2(sample(clip.pull, ms));
    if (next !== last.current) {
      last.current = next;
      setValue(next);
    }
  });
  return clock ? value : 0;
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type PadlockProps = LineStateProps;

/**
 * Padlock: a complete no-access state ("You don't have access") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * closed padlock; its shackle is pulled up twice, stops on its catch each
 * time and drops back, still locked. One fine outline, near-white faces,
 * no shadow, facing the screen; the keyhole carries the brand, like the
 * button under it. It plays when it comes into view, or each time `active`
 * turns true (PlayOnHover, or your own state). Follows the shadcn theme.
 */
export const Padlock = ({
  heading = "You don't have access",
  description = "Ask the owner of this workspace to let you in, or switch to another account.",
  actionLabel = "Request access",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: PadlockProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const pull = usePull(clock, clip);
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
      }}
      shell={shell}
      slot="padlock"
    >
      <Rig pivot={[0, 0, BODY.z]} {...onClock(clock, bodyPose(clip), clip.end)}>
        <Body />
        <Shackle pull={pull} />
      </Rig>
    </LineState>
  );
};

export default Padlock;
