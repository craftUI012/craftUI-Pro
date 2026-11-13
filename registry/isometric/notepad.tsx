"use client";

import {
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  Extrude,
  Face,
  FacePath,
  IsoStage,
  Rig,
  roundedRect,
  sample,
  useClock,
} from "./iso-core";
import type { IsoPose, IsoTone, IsoTrack, IsoVariant, Vec3 } from "./iso-core";

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
 * A click (or `loop`, after a 5.2s hold) wipes the two lines, takes the
 * pencil back to the start, and plays the above again.
 * Reduced motion (or autoPlay off): the two lines written, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // How long it rests before a loop starts again.
  hold: 5200,
  // How long the pencil takes to hop from one line to the next.
  hop: 250,
  // How long the lift-off takes to come to rest.
  settle: 650,
  // The pencil taps down.
  tap: 400,
  // After a click: how long the wipe and the trip back take.
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
// shown facing the screen. Behind it, a second sheet, lower and to the
// left so two of its edges show.
const PAD = { depth: 0.45, h: 6.4, r: 0.7, w: 6, x: -2.6, z: 0.9 };
const PAD_TOP = PAD.z + PAD.h;
const PAD_AT: Vec3 = [PAD.x, 0, PAD_TOP];
const BEHIND = { depth: 0.2, shift: 0.75 };

// In the front view, one unit toward the viewer shows as 1/√3 of a unit
// down the page (see "The view"). A part standing proud of the paper is
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
// lying in front of the page and pointing down-left at 45°. It is drawn
// pointing along +x with its tip at the first line's start, then a rig
// turns it about its tip and carries it along the lines.
const PENCIL = {
  angle: -45,
  body: 3.2,
  cone: 1.2,
  depth: 0.45,
  eraser: 0.9,
  ferrule: 0.45,
  lead: 0.4,
  w: 0.9,
};
const PENCIL_LENGTH =
  PENCIL.cone + PENCIL.body + PENCIL.ferrule + PENCIL.eraser;
const [X1, Z1] = lineStart(0);
const [X2, Z2] = lineStart(1);
// Its tip on the front face, where the rig turns it.
const TIP: Vec3 = [X1, PENCIL.depth, Z1 + PENCIL.depth * SINK];
// One unit along the pencil, from tip to eraser, in world x and z.
const ALONG = Math.SQRT1_2;

/* ───────────────────────────── The view ───────────────────────────────── */

/**
 * Facing the screen. The object is built facing +y, which the isometric
 * camera sees at an angle. The whole of it is turned 45° about the
 * vertical, so its front points straight at the viewer and its edges run
 * level and plumb; and it is stretched √(3/2) in height, because that
 * camera looks down from 35.26° and foreshortens heights by exactly that
 * much, so the front keeps its true proportions. It is still one exact
 * parallel projection of a solid: its thickness shows along its top edges.
 */
const FRONT = { stretch: Math.sqrt(1.5), turn: -45 };
const VIEW_POSE: IsoPose = {
  axis: "z",
  rotate: FRONT.turn,
  scale: [1, 1, FRONT.stretch],
};

/** Where a point of the object lands once it faces the screen. */
const facing = ([x, y, z]: Vec3): Vec3 => [
  (x + y) * Math.SQRT1_2,
  (y - x) * Math.SQRT1_2,
  z * FRONT.stretch,
];

// The frame is centred on the pad, not on the whole drawing: the pad is
// the mass the eye lines up with the heading and the button under it. So
// the frame reaches as far right of the pad's middle as the second sheet
// reaches left of it, and as high as the resting pencil. The pencil
// overhangs that on the right, and reaches further during the beat; what
// falls outside runs into the stage's padding, which is not clipped.
const AXIS = PAD.x + PAD.w / 2;
const HALF = AXIS - BEHIND_AT[0];
const REST_TOP =
  Z2 +
  (MOVE.hover + PENCIL_LENGTH + PENCIL.w / 2) * ALONG +
  PENCIL.depth * SINK;
const EXTENT: Vec3[] = [
  [AXIS - HALF, -PAD.depth, BEHIND_AT[2] - PAD.h],
  [AXIS + HALF, 0, PAD.z],
  [AXIS - HALF, -PAD.depth, PAD_TOP],
  [AXIS + HALF, PENCIL.depth, REST_TOP],
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

const r2 = (n: number) => Math.round(n * 100) / 100;

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
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/** The pad and the sheet behind it, a shade under the page. */
const Pad = () => (
  <>
    <Extrude
      at={BEHIND_AT}
      convex
      d={roundedRect(PAD.w, PAD.h, PAD.r)}
      depth={BEHIND.depth}
      frontStyle={{ fill: "var(--iso-behind)" }}
      palette="surface"
      plane="left"
    />
    <Extrude
      at={PAD_AT}
      convex
      d={roundedRect(PAD.w, PAD.h, PAD.r)}
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
 * v = 0 down its middle. Written tip to eraser: each part's top edge hides
 * behind the part above it once the pencil is turned up to the right. The
 * eraser is the one brand mark; everything else is paper and line.
 */
const Pencil = () => {
  const { cone, body, ferrule, eraser, lead, w } = PENCIL;
  const h = w / 2;
  const b0 = cone;
  const f0 = b0 + body;
  const e0 = f0 + ferrule;
  const e1 = e0 + eraser;
  const leadH = r2((h * lead) / cone);
  return (
    <>
      <Extrude
        at={TIP}
        convex
        d={`M0 0 L${b0} ${-h} L${b0} ${h} Z`}
        depth={PENCIL.depth}
        palette="surface"
        plane="left"
      />
      <Extrude
        at={TIP}
        convex
        d={`M${b0} ${-h} H${f0} V${h} H${b0} Z`}
        depth={PENCIL.depth}
        palette="surface"
        plane="left"
      />
      <Extrude
        at={TIP}
        convex
        d={`M${f0} ${-h} H${e0} V${h} H${f0} Z`}
        depth={PENCIL.depth}
        palette="surface"
        plane="left"
      />
      <Extrude
        at={TIP}
        convex
        d={`M${e0} ${-h} H${e1 - h} Q${e1} ${-h} ${e1} 0 Q${e1} ${h} ${e1 - h} ${h} H${e0} Z`}
        depth={PENCIL.depth}
        palette="main"
        plane="left"
      />
      {/* The lead, one flat side of the body, and the ferrule's band. */}
      <FacePath
        at={TIP}
        d={`M0 0 L${lead} ${-leadH} L${lead} ${leadH} Z`}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-ink)" }}
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

/** How much of each line is written, re-rendered only when it changes. */
const useWriting = (
  clock: MotionValue<number> | undefined,
  clip: Clip,
  still: boolean
): readonly [number, number] => {
  const idle = useMotionValue(0);
  const read = (ms: number): readonly [number, number] => [
    r2(sample(clip.len1, ms)),
    r2(sample(clip.len2, ms)),
  ];
  const [value, setValue] = useState(() => read(0));
  const last = useRef(value.join(","));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next.join(",") !== last.current) {
      last.current = next.join(",");
      setValue(next);
    }
  });
  return still ? [LINES[0].len, LINES[1].len] : value;
};

/** Rig props: animated on the clock, or the pose at the beat's end held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(INTRO.end));

/* ───────────────────────────── Shell ──────────────────────────────────── */

/** In view, reduced motion, the clock and its clip, and the replay. */
const useShell = ({
  autoPlay,
  loop,
  replayOnClick,
}: {
  autoPlay: boolean;
  loop: boolean;
  replayOnClick: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const still = reduced || !autoPlay;
  // Run 0 is the intro; every run after it starts from the lines written.
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const clip = run === 0 ? INTRO : AGAIN;
  // One new run per finished run, however many frames or clicks ask.
  const asked = useRef(-1);
  const again = () => {
    if (asked.current !== run) {
      asked.current = run;
      setRun((n) => n + 1);
    }
  };
  useMotionValueEvent(clock, "change", (ms) => {
    if (loop && !still && ms >= clip.end + TIMING.hold) {
      again();
    }
  });
  const canReplay = replayOnClick && !still;
  const replay = () => {
    if (canReplay && clock.get() >= clip.end) {
      again();
    }
  };
  return {
    canReplay,
    clip,
    clock: still ? undefined : clock,
    ref,
    replay,
    still,
  };
};

// In ink the walls step down half as far as the house ramp (0.03 and 0.07
// under the top, not 0.06 and 0.13): an empty state is a quiet line
// drawing on the page, with only a whisper of form.
const PAPER: Record<string, string> = {
  "--iso-surface-left-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.03) c h)",
  "--iso-surface-right-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.07) c h)",
};

// The blueprint (`line`) drawn at this size: its outline held at the same
// pixel weight as ink instead of a canvas-unit one, which would be three
// times too heavy on a stage this small. Faces stay the page's colour.
const BLUEPRINT: Record<string, string> = {
  "--iso-edge-w": "calc(var(--iso-stroke-width) * 4.33px)",
  "--iso-vector": "non-scaling-stroke",
};

// The engine's rim highlight has no width in the outlined variants, yet it
// still paints a pale hairline over the front outline of every extrusion
// (seen at 4× in Chromium). Clear its colour so the outline keeps its
// full weight.
const NO_RIM: Record<string, string> = {
  "--iso-accent-rim": "transparent",
  "--iso-main-rim": "transparent",
  "--iso-surface-rim": "transparent",
};

/**
 * Stage overrides: no hairline contour (every edge already carries the
 * outline), the paper walls in ink, the pixel outline in the blueprint,
 * the outline on the side edges of rounded parts, and the value of the
 * sheet behind the pad, a shade under the page.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-behind": "oklch(from var(--iso-surface-right-c) calc(l - 0.03) c h)",
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* ───────────────────────────── Copy ───────────────────────────────────── */

// Optical padding: an icon carries its own white space, so the label's
// side gets 2px more than the icon's side (12px and 14px) or the label
// looks pushed against the edge. The second class wins over a Button that
// already nudges this side itself.
const BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/** The plus on the button. */
const PlusIcon = () => (
  <svg
    aria-hidden="true"
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The empty state's own words, under the pad: the heading, a line of
 * copy, and the actions (the built-in button, or whatever is passed in).
 */
const Copy = ({
  heading,
  description,
  actionLabel,
  onAction,
  children,
}: {
  heading: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  children?: ReactNode;
}) => {
  const button = actionLabel ? (
    <Button className={BUTTON} onClick={onAction}>
      <PlusIcon />
      {actionLabel}
    </Button>
  ) : null;
  const actions = children ?? button;
  return (
    <>
      {heading ? (
        <p className="mt-3 text-xl font-medium tracking-tight text-foreground">
          {heading}
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-balance text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="mt-6">{actions}</div> : null}
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface NotepadProps {
  /** Heading under the pad, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the pencil's eraser; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The pencil writes when the pad scrolls into view. Off shows the two lines written and nothing moving. */
  autoPlay?: boolean;
  /** Wipe the lines and write them again every few seconds. Off plays it once, which suits an empty state people sit in front of. */
  loop?: boolean;
  /** Clicking the pad wipes the lines and writes them again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the pad is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-56`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole empty state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Notepad: a complete empty state ("No notes yet") with a line
 * illustration, a heading, a line of copy and a button, all props. A pad
 * of paper with a second sheet showing behind it; a pencil taps down,
 * writes two lines, hops between them and lifts off. One fine outline,
 * near-white faces, no shadow, facing the screen; the eraser carries the
 * brand, like the button under it. Click the pad to play it again.
 * Follows the shadcn theme.
 */
export const Notepad = ({
  heading = "No notes yet",
  description = "Write your first note and it will show up here.",
  actionLabel = "New note",
  onAction,
  children,
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  autoPlay = true,
  loop = false,
  replayOnClick = true,
  title,
  artClassName,
  className,
}: NotepadProps) => {
  const { canReplay, clip, clock, ref, replay, still } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const lengths = useWriting(clock, clip, still);
  const art = (
    <IsoStage
      bounds={BOUNDS}
      shadow={false}
      strokeWidth={strokeWidth}
      style={stageStyle(variant)}
      title={title}
      tone={tone}
      variant={variant}
    >
      {/* Everything stands in one rig that turns it to face the screen. */}
      <Rig pivot={[0, 0, 0]} {...VIEW_POSE}>
        <Rig pivot={[0, 0, PAD.z]} {...rigged(clock, padPose(clip))}>
          <Pad />
          <Writing lengths={lengths} />
        </Rig>
        <Rig pivot={TIP} {...rigged(clock, pencilPose(clip))}>
          <Pencil />
        </Rig>
      </Rig>
    </IsoStage>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="notepad"
    >
      <div
        className={cn("w-56 max-w-full", artClassName)}
        data-slot="notepad-art"
        ref={ref}
      >
        {canReplay ? (
          <button
            aria-label={`${title ?? "Illustration"}. Press to play it again.`}
            className="block w-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={replay}
            type="button"
          >
            {art}
          </button>
        ) : (
          art
        )}
      </div>
      <Copy
        actionLabel={actionLabel}
        description={description}
        heading={heading}
        onAction={onAction}
      >
        {children}
      </Copy>
    </div>
  );
};

export default Notepad;
