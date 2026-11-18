"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";

import { EASE, Extrude, Face, FacePath, Rig, sample } from "./iso-core";
import type { IsoPose, IsoTrack, Vec3 } from "./iso-core";
import { ICON, LineState, facing, onClock, r2, useLineShell } from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object, in line: a pad of paper with a
 * second sheet showing behind it, and a pencil that writes the first two
 * lines. A fine outline, near-white faces, the eraser the one brand mark,
 * facing the screen, no shadow. Under it, the empty state's own words: a
 * heading, a line, a button. Each value is ms after it comes into view.
 *
 *    0ms   a blank pad; the pencil hovers over where the first line starts
 *  400ms   the pencil taps down; the pad dips under it and comes back
 *  500ms   it writes the first line (500ms)
 * 1000ms   it hops to the second line (250ms)
 * 1250ms   it writes the second, shorter line (400ms)
 * 1650ms   it lifts off, a little past its resting height, and settles
 * 2300ms   still: two lines written, the pencil resting over the page
 *
 * One way, so each later play (each time `active` turns true, 80ms in,
 * or `loop` after a 5.2s hold) first wipes the two lines and takes the
 * pencil back to the start (320ms), then plays the above again.
 * Reduced motion, or `active` false before any play: the two lines
 * written, the pencil resting over the page, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // How long the pencil takes to hop from one line to the next.
  hop: 250,
  // How long the lift-off takes to come to rest.
  settle: 650,
  // The pencil taps down.
  tap: 400,
  // On a later play: how long the wipe and the trip back take.
  wipe: 320,
  // Milliseconds to write the first and the second line.
  write: [500, 400] as const,
};

/* The pencil's moves. */
const MOVE = {
  // World units the pad dips when the pencil taps it.
  dip: 0.08,
  // How far the pencil lifts along its own length in a hop between lines.
  hop: 0.45,
  // How far it rests off the page, along its own length.
  hover: 0.55,
  // Degrees it rocks as it lifts off, before it settles at its angle.
  rock: 4,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The pad: a block of paper standing on its edge, built facing +y and
// shown facing the screen. Its top, the bound edge, is square: front-on
// its thickness shows along the top, and round top corners tapered that
// strip into doubled lines down the sides. Its foot is rounded. Behind
// it, a second sheet of the same shape, lower and to the left so two of
// its edges show: a flat face (as a thin solid its rim drew double).
const PAD = { depth: 0.5, h: 6.4, r: 0.7, w: 6, x: -2.6, z: 0.9 };
const SHEET_PATH = [
  "M0 0",
  `H${PAD.w}`,
  `V${PAD.h - PAD.r}`,
  `Q${PAD.w} ${PAD.h} ${PAD.w - PAD.r} ${PAD.h}`,
  `H${PAD.r}`,
  `Q0 ${PAD.h} 0 ${PAD.h - PAD.r}`,
  "Z",
].join(" ");
const PAD_TOP = PAD.z + PAD.h;
const PAD_AT: Vec3 = [PAD.x, 0, PAD_TOP];
// The sheet behind reaches as far left of the pad as the resting pencil
// reaches right of it, so the drawing and the pad share a centre. (The
// pencil crosses the pad's side mid-body: a seam of the pencil landing
// on that crossing drew a wedge of short doubled lines.)
const BEHIND = { shift: 1.25 };

// In the front view, one unit toward the viewer shows as 1/√3 of a unit
// down the page (see FRONT in the kit). A part standing proud of the paper is
// raised by that much, so on screen it sits where it touches.
const SINK = 1 / Math.sqrt(3);

const BEHIND_AT: Vec3 = [
  PAD.x - BEHIND.shift,
  -PAD.depth,
  PAD_TOP - BEHIND.shift - PAD.depth * SINK,
];

// The two lines the pencil writes, on the pad's face (u across, v down
// from its top edge), and how thick a written line is.
const LINES = [
  { len: 2.4, u: 1, v: 2 },
  { len: 1.6, u: 1, v: 3 },
] as const;
const LINE_H = 0.17;
const lineStart = (i: 0 | 1): readonly [number, number] => [
  PAD.x + LINES[i].u,
  PAD_TOP - LINES[i].v,
];

// The pencil: a body with a sharpened cone, a ferrule and an eraser,
// held in front of the page and pointing down-left at 45°. It is flat
// faces (as a thin solid its cone's sides converged into doubled lines),
// `lift` in front of the page. It is drawn pointing along +x with its
// tip at the first line's start, then a rig turns it about its tip and
// carries it along the lines.
const PENCIL = {
  angle: -45,
  body: 3.2,
  cone: 1.2,
  eraser: 0.9,
  ferrule: 0.45,
  lead: 0.4,
  lift: 0.45,
  w: 0.9,
};
const PENCIL_LENGTH =
  PENCIL.cone + PENCIL.body + PENCIL.ferrule + PENCIL.eraser;
const [X1, Z1] = lineStart(0);
const [X2, Z2] = lineStart(1);
// Its tip on the front face, where the rig turns it.
const TIP: Vec3 = [X1, PENCIL.lift, Z1 + PENCIL.lift * SINK];
// One unit along the pencil, from tip to eraser, in world x and z.
const ALONG = Math.SQRT1_2;

// The frame is centred on the pad, not on the whole drawing: the pad is
// the mass the eye lines up with the heading and the button under it. So
// the frame reaches as far right of the pad's middle as the second sheet
// reaches left of it, and as high as the resting pencil. The pencil
// overhangs that on the right, and reaches further during the beat; what
// falls outside runs into the stage's padding, which is not clipped.
const AXIS = PAD.x + PAD.w / 2;
const HALF = AXIS - BEHIND_AT[0];
const REST_TOP =
  Z2 + (MOVE.hover + PENCIL_LENGTH + PENCIL.w / 2) * ALONG + PENCIL.lift * SINK;
const EXTENT: Vec3[] = [
  [AXIS - HALF, -PAD.depth, BEHIND_AT[2] - PAD.h],
  [AXIS + HALF, 0, PAD.z],
  [AXIS - HALF, -PAD.depth, PAD_TOP],
  [AXIS + HALF, PENCIL.lift, REST_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  dip: IsoTrack;
  end: number;
  len1: IsoTrack;
  len2: IsoTrack;
  raise: IsoTrack;
  rock: IsoTrack;
  tipX: IsoTrack;
  tipZ: IsoTrack;
}

// The beat itself, starting `t0` ms into a run.
const beat = (t0: number): Clip => {
  const tap = t0 + TIMING.tap;
  const w1 = tap + 100;
  const w1e = w1 + TIMING.write[0];
  const w2 = w1e + TIMING.hop;
  const w2e = w2 + TIMING.write[1];
  return {
    // The pad under the tap: down, back past rest, and still.
    dip: [
      [tap - 20, 0, EASE.in],
      [tap + 70, -MOVE.dip, EASE.drop],
      [tap + 220, MOVE.dip * 0.3, EASE.easy],
      [tap + 360, 0],
    ],
    end: w2e + TIMING.settle,
    len1: [
      [w1, 0, EASE.easy],
      [w1e, LINES[0].len],
    ],
    len2: [
      [w2, 0, EASE.easy],
      [w2e, LINES[1].len],
    ],
    // Off the page along its own length: hovering, down on the tap, a hop
    // between the lines, then up a little past its resting height and back.
    raise: [
      [t0, MOVE.hover, "hold"],
      [tap - 120, MOVE.hover, EASE.in],
      [tap, 0, "hold"],
      [w1e, 0, EASE.soft],
      [w1e + TIMING.hop / 2, MOVE.hop, EASE.in],
      [w2, 0, "hold"],
      [w2e, 0, EASE.soft],
      [w2e + 220, MOVE.hover * 1.3, EASE.easy],
      [w2e + 440, MOVE.hover * 0.92, EASE.easy],
      [w2e + 600, MOVE.hover],
    ],
    rock: [
      [w2e, 0, EASE.soft],
      [w2e + 170, -MOVE.rock, EASE.easy],
      [w2e + 360, MOVE.rock * 0.4, EASE.easy],
      [w2e + 540, 0],
    ],
    tipX: [
      [t0, X1, "hold"],
      [w1, X1, EASE.easy],
      [w1e, X1 + LINES[0].len, EASE.easy],
      [w2, X2, EASE.easy],
      [w2e, X2 + LINES[1].len],
    ],
    tipZ: [
      [t0, Z1, "hold"],
      [w1e, Z1, EASE.easy],
      [w2, Z2],
    ],
  };
};

// The first run: a blank pad, then the beat.
const INTRO = beat(0);
// Every later run starts from the end of the last: the lines are wiped,
// the pencil goes back to the start, then the beat again.
const NEXT = beat(TIMING.wipe);
const AGAIN: Clip = {
  ...NEXT,
  len1: [
    [0, LINES[0].len, EASE.in],
    [TIMING.wipe - 100, 0, "hold"],
    ...NEXT.len1,
  ],
  len2: [
    [0, LINES[1].len, EASE.in],
    [TIMING.wipe - 100, 0, "hold"],
    ...NEXT.len2,
  ],
  tipX: [[0, X2 + LINES[1].len, EASE.easy], ...NEXT.tipX],
  tipZ: [[0, Z2, EASE.easy], ...NEXT.tipZ],
};

/** The pencil: turned about its tip, carried along the lines, lifted. */
const pencilPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const raise = sample(clip.raise, ms) * ALONG;
    return {
      axis: "y",
      offset: [
        r2(sample(clip.tipX, ms) - X1 + raise),
        0,
        r2(sample(clip.tipZ, ms) - Z1 + raise),
      ],
      rotate: r2(PENCIL.angle + sample(clip.rock, ms)),
    };
  };

const padPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.dip, ms))] });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline). Kept here, not
// the kit's LINE: that one adds round caps, which would lengthen the open
// strokes on the pencil.
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

// The sheet behind the pad, a shade under the page's darkest wall.
const BEHIND_FILL = "oklch(from var(--iso-surface-right-c) calc(l - 0.03) c h)";

/** The pad and the sheet behind it, a shade under the page. */
const Pad = () => (
  <>
    <FacePath
      at={BEHIND_AT}
      d={SHEET_PATH}
      plane="left"
      style={{ ...LINE, fill: BEHIND_FILL }}
    />
    <Extrude
      at={PAD_AT}
      convex
      d={SHEET_PATH}
      depth={PAD.depth}
      palette="surface"
      plane="left"
    />
  </>
);

/** What has been written so far: each line as long as the pencil has drawn it. */
const Writing = ({ lengths }: { lengths: readonly [number, number] }) => (
  <Face at={PAD_AT} plane="left">
    {LINES.map((line, i) =>
      lengths[i] > 0.03 ? (
        <rect
          fill="var(--iso-ink)"
          height={LINE_H}
          key={line.v}
          opacity={0.45}
          rx={LINE_H / 2}
          width={Math.max(LINE_H, lengths[i])}
          x={line.u}
          y={line.v - LINE_H / 2}
        />
      ) : null
    )}
  </Face>
);

/**
 * The pencil, pointing along +x from its tip (u = 0), in face units with
 * v = 0 down its middle: flat faces meeting on shared edges. The eraser
 * is the one brand mark; everything else is paper and line.
 */
const Pencil = () => {
  const { cone, body, ferrule, eraser, lead, w } = PENCIL;
  const h = w / 2;
  const b0 = cone;
  const f0 = b0 + body;
  const e0 = f0 + ferrule;
  const e1 = e0 + eraser;
  const leadH = r2((h * lead) / cone);
  const paper = { ...LINE, fill: "var(--iso-surface-left)" };
  return (
    <>
      <FacePath
        at={TIP}
        d={`M0 0 L${b0} ${-h} L${b0} ${h} Z`}
        plane="left"
        style={paper}
      />
      <FacePath
        at={TIP}
        d={`M${b0} ${-h} H${f0} V${h} H${b0} Z`}
        plane="left"
        style={paper}
      />
      <FacePath
        at={TIP}
        d={`M${f0} ${-h} H${e0} V${h} H${f0} Z`}
        plane="left"
        style={paper}
      />
      <FacePath
        at={TIP}
        d={`M${e0} ${-h} H${e1 - h} Q${e1} ${-h} ${e1} 0 Q${e1} ${h} ${e1 - h} ${h} H${e0} Z`}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-main-left)" }}
      />
      {/* The lead (graphite, the shade of the written lines; a solid ink tip
          merged with the cone's edges into a blot), one flat side of the
          body, and the ferrule's band. */}
      <FacePath
        at={TIP}
        d={`M0 0 L${lead} ${-leadH} L${lead} ${leadH} Z`}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-ink)", fillOpacity: 0.45 }}
      />
      <FacePath
        at={TIP}
        d={`M${b0} ${r2(-h / 3)} H${f0}`}
        plane="left"
        style={LINE}
      />
      <FacePath
        at={TIP}
        d={`M${r2(f0 + ferrule / 2)} ${-h} V${h}`}
        plane="left"
        style={LINE}
      />
    </>
  );
};

/* ───────────────────────────── Clock ──────────────────────────────────── */

// Both lines written: the resting pose, and where every later play starts.
const WRITTEN: readonly [number, number] = [LINES[0].len, LINES[1].len];

/**
 * How much of each line is written, re-rendered only when it changes. Held
 * (no clock) it shows both lines written; it starts there too when it is
 * held at first, so the first play doesn't flash a blank pad.
 */
const useWriting = (
  clock: MotionValue<number> | undefined,
  clip: Clip
): readonly [number, number] => {
  const idle = useMotionValue(0);
  const read = (ms: number): readonly [number, number] => [
    r2(sample(clip.len1, ms)),
    r2(sample(clip.len2, ms)),
  ];
  const [value, setValue] = useState(() => (clock ? read(0) : WRITTEN));
  const last = useRef(value.join(","));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next.join(",") !== last.current) {
      last.current = next.join(",");
      setValue(next);
    }
  });
  return clock ? value : WRITTEN;
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type NotepadProps = LineStateProps;

/**
 * Notepad: a complete empty state ("No notes yet") with a line
 * illustration, a heading, a line of copy and a button, all props. A pad
 * of paper with a second sheet showing behind it; a pencil taps down,
 * writes two lines, hops between them and lifts off. One fine outline,
 * near-white faces, no shadow, facing the screen; the eraser carries the
 * brand, like the button under it. It plays when it comes into view, or
 * each time `active` turns true (PlayOnHover, or your own state), wiping
 * the lines first. Follows the shadcn theme.
 */
export const Notepad = ({
  heading = "No notes yet",
  description = "Write your first note and it will show up here.",
  actionLabel = "New note",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: NotepadProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  const lengths = useWriting(clock, clip);
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
      slot="notepad"
    >
      <Rig pivot={[0, 0, PAD.z]} {...onClock(clock, padPose(clip), clip.end)}>
        <Pad />
        <Writing lengths={lengths} />
      </Rig>
      <Rig pivot={TIP} {...onClock(clock, pencilPose(clip), clip.end)}>
        <Pencil />
      </Rig>
    </LineState>
  );
};

export default Notepad;
