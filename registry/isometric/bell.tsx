"use client";

import { useInView, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  Extrude,
  FacePath,
  IsoStage,
  Rig,
  project,
  roundedRect,
  sample,
  useClock,
  useRigged,
} from "./iso-core";
import type {
  IsoKey,
  IsoPose,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An all-clear state told by one object, in line: a bell that rings once
 * and falls quiet. A fine outline, near-white faces, the clapper the one
 * brand mark, facing the screen, no shadow. Under it, the state's own
 * words: a heading, a line, a button. Each value is ms after it comes
 * into view.
 *
 *    0ms   the bell hangs still
 *  400ms   it is rung: it swings 11° to one side (200ms)
 *  490ms   the clapper follows 90ms behind and swings wider, to the rim
 *  600ms   back through the middle and 8° the other way, then 5°, 2.5°,
 *          1°, each swing smaller and a little quicker
 * 1890ms   still: hanging straight, exactly as it started
 *
 * A click (or `loop`, after a 5.2s hold) rings it again.
 * Reduced motion (or autoPlay off): the bell hanging straight, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click the bell is rung this soon.
  again: 80,
  // How long it rests before a loop starts again.
  hold: 5200,
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
// `h` its height above it.
const BODY = { depth: 0.6, h: 4.2, w: 4.6 };
const BODY_TOP = RIM_TOP + BODY.h;
const BODY_AT: Vec3 = [-BODY.w / 2, 0, BODY_TOP];

// The body's outline (u across from its left edge, v down from the top of
// the dome): up the flare, over the dome and down the other side. Every
// part of it leans in by 13° or more, so the far edge stays in view on
// both sides however the bell swings.
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
const KNOB_Y = -(BODY.depth - KNOB.depth) / 2;

// The clapper: a ball hanging in the mouth, half of it below the rim. It
// swings from a point high inside the dome.
const CLAPPER = { depth: 0.45, hang: 3.4, r: 0.52, z: 0.92 };
const CLAPPER_Y = -(BODY.depth - CLAPPER.depth) / 2;
const CLAPPER_PIVOT: Vec3 = [0, 0, RIM_TOP + CLAPPER.hang];

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

// The frame fits the bell hanging straight: as wide as the rim, from the
// foot of the clapper to the top of the knob. The swings reach a little
// wider; that runs into the stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [-RIM.w / 2, 0, CLAPPER.z - CLAPPER.r],
  [RIM.w / 2, 0, CLAPPER.z - CLAPPER.r],
  [-RIM.w / 2, -BODY.depth, KNOB_TOP],
  [RIM.w / 2, -BODY.depth, KNOB_TOP],
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

// The first run waits a moment after coming into view; a click does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const r2 = (n: number) => Math.round(n * 100) / 100;

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

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

// A quarter circle as a cubic: the handle length for a unit radius.
const ARC = 0.5523;

/** A circle of radius `r` as a path, its box's corner at the origin. */
const disc = (r: number) => {
  const k = r2(r * ARC);
  const d = r * 2;
  return [
    `M${r} 0`,
    `C${r2(r + k)} 0 ${d} ${r2(r - k)} ${d} ${r}`,
    `C${d} ${r2(r + k)} ${r2(r + k)} ${d} ${r} ${d}`,
    `C${r2(r - k)} ${d} 0 ${r2(r + k)} 0 ${r}`,
    `C0 ${r2(r - k)} ${r2(r - k)} 0 ${r} 0`,
    "Z",
  ].join(" ");
};

/** A straight edge between world points, sent through the rigs around it. */
const Edge = ({ points }: { points: readonly Vec3[] }) => {
  const rigged = useRigged();
  const d = `M${points.map((p) => project(rigged(p)).join(",")).join(" L")}`;
  return <path d={d} style={LINE} />;
};

/**
 * The body. Its outline flares, so it is not convex and the engine cannot
 * find its far edge. So after the extrusion the same outline is drawn on
 * the back plane, the two short edges that join back to front at the
 * mouth's corners are added, and the front face is painted once more over
 * all of it: what is left showing of the back outline is exactly the far
 * edge, at any lean.
 */
const Body = () => (
  <>
    <Extrude
      at={BODY_AT}
      d={BODY_PATH}
      depth={BODY.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={[BODY_AT[0], -BODY.depth, BODY_TOP]}
      d={BODY_PATH}
      plane="left"
      style={LINE}
    />
    {[-1, 1].map((side) => (
      <Edge
        key={side}
        points={[
          [(side * BODY.w) / 2, 0, RIM_TOP],
          [(side * BODY.w) / 2, -BODY.depth, RIM_TOP],
        ]}
      />
    ))}
    <FacePath
      at={BODY_AT}
      d={BODY_PATH}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-surface-left)" }}
    />
  </>
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

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** Rig props: animated on the clock, or the resting pose held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(INTRO.end));

/* ───────────────────────────── Shell ──────────────────────────────────── */

// Whether the visitor asked for less motion. It is read through a store
// and not in the first render: the server cannot know it, so the first
// render in the browser has to answer "no" as the server did, and switch
// once the page has taken over. Reading it straight away makes the two
// disagree, and React reports a failed hydration.
const REDUCE = "(prefers-reduced-motion: reduce)";
const watchReduce = (notify: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const useReduced = () =>
  useSyncExternalStore(
    watchReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false
  );

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
  const reduced = useReduced();
  const still = reduced || !autoPlay;
  // Run 0 waits a moment after coming into view; later runs start at once.
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
  return { canReplay, clip, clock: still ? undefined : clock, ref, replay };
};

// In ink the walls step down half as far as the house ramp (0.03 and 0.07
// under the top, not 0.06 and 0.13): a blocked state is a quiet line
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
 * and the outline on the side edges of rounded parts.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
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

/**
 * The state's own words, under the bell: the heading, a line of copy, and
 * the actions (the built-in button, or whatever is passed in).
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
    <Button className={BUTTON} onClick={onAction} variant="secondary">
      <SettingsIcon />
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

export interface BellProps {
  /** Heading under the bell, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 22 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the clapper; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The bell rings once when it scrolls into view. Off shows it hanging straight and nothing moving. */
  autoPlay?: boolean;
  /** Ring it again every few seconds. Off rings it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the bell rings it again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the bell is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-48`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Bell: a complete all-caught-up state ("You're all caught up") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * bell hanging by its knob; it is rung once, swings from side to side
 * with its clapper following a beat behind, each swing smaller, and hangs
 * still. One fine outline, near-white faces, no shadow, facing the
 * screen; the clapper carries the brand. Click the bell to ring it again.
 * Follows the shadcn theme.
 */
export const Bell = ({
  heading = "You're all caught up",
  description = "New notifications will show up here as they arrive.",
  actionLabel = "Notification settings",
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
}: BellProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
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
      {/* Everything hangs in one rig that turns it to face the screen. */}
      <Rig pivot={[0, 0, 0]} {...VIEW_POSE}>
        <Rig pivot={[0, 0, KNOB_TOP]} {...rigged(clock, bellPose(clip))}>
          {/* Written from the lowest part up: each one's top edge hides behind the next. */}
          <Rig pivot={CLAPPER_PIVOT} {...rigged(clock, clapperPose(clip))}>
            <Clapper />
          </Rig>
          <Rim />
          <Body />
          <Knob />
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
      data-slot="bell"
    >
      <div
        className={cn("w-48 max-w-full", artClassName)}
        data-slot="bell-art"
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

export default Bell;
