"use client";

import { useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  Extrude,
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
 * An empty state told by one object, in line: a picture frame hung on a
 * nail, holding the picture every empty image slot shows: two hills and
 * a sun. A fine outline, near-white faces, the sun the one brand mark,
 * facing the screen, no shadow. Under it, the state's own words: a
 * heading, a line, a button. Each value is ms after it comes into view.
 *
 *    0ms   two hills in the frame; the sun is down behind them
 *  400ms   the sun rises over the far hill (700ms), a little past its
 *          place
 * 1100ms   it eases back down to where it stays (200ms)
 * 1300ms   still: the sun up
 *
 * A click (or `loop`, after a 5.2s hold) sets the sun and raises it again.
 * Reduced motion (or autoPlay off): the sun up, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // How long it rests before a loop starts again.
  hold: 5200,
  // The sun eases back to its place in this long.
  rest: 200,
  // The sun climbs in this long.
  rise: 700,
  // After a click: the sun sets in this long, then waits a moment.
  set: [300, 120] as const,
  // The sun starts to rise this long after the frame comes into view.
  start: 400,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The frame: built facing +y, about a centre line at x = 0, and shown
// facing the screen.
const FRAME = { depth: 0.4, h: 5, r: 0.5, w: 6.4, z: 0.9 };
const FRAME_X = -FRAME.w / 2;
const FRAME_TOP = FRAME.z + FRAME.h;
const FRAME_AT: Vec3 = [FRAME_X, 0, FRAME_TOP];

// The picture: set in from the frame's edge by the width of its moulding.
const MOULDING = 0.55;
const PICTURE = {
  h: FRAME.h - MOULDING * 2,
  r: 0.22,
  w: FRAME.w - MOULDING * 2,
};
const PICTURE_AT: Vec3 = [FRAME_X + MOULDING, 0, FRAME_TOP - MOULDING];
const PICTURE_PATH = roundedRect(PICTURE.w, PICTURE.h, PICTURE.r);

// What is in it (u across, v down from the picture's top edge): the far
// hill, the near hill in front of it, and the sun. The hills run past the
// picture's edges and are cut off by it.
const FAR_HILL = `M2.5 ${PICTURE.h} L3.85 2.6 Q4.1 2.38 4.35 2.6 L5.7 ${PICTURE.h} Z`;
const NEAR_HILL = `M-0.3 ${PICTURE.h} L1.75 1.85 Q2.05 1.55 2.35 1.85 L4.4 ${PICTURE.h} Z`;
// The sun: where across the picture it is, its height when up, and when
// down behind the far hill; how far past its place it climbs.
const SUN = { down: 3.5, over: 0.14, r: 0.52, u: 3.95, up: 1.15 };

// The wire it hangs by: from the back of the frame's top edge, either
// side of the middle, up to a nail.
const WIRE = { nail: 0.13, reach: 1.7, rise: 0.95 };
const NAIL_Z = FRAME_TOP + WIRE.rise;

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

// The frame fits the picture frame and its nail.
const EXTENT: Vec3[] = [
  [FRAME_X, 0, FRAME.z],
  [-FRAME_X, 0, FRAME.z],
  [FRAME_X, -FRAME.depth, NAIL_Z + WIRE.nail],
  [-FRAME_X, -FRAME.depth, NAIL_Z + WIRE.nail],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: the sun's height in the picture, and when it is at rest. */
interface Clip {
  end: number;
  sun: IsoTrack;
}

// The beat itself, starting `t0` ms into a run.
const beat = (t0: number): Clip => {
  const top = t0 + TIMING.rise;
  return {
    end: top + TIMING.rest,
    sun: [
      [t0, SUN.down, EASE.drop],
      [top, SUN.up - SUN.over, EASE.easy],
      [top + TIMING.rest, SUN.up],
    ],
  };
};

// The first run: the sun down, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: the sun sets first.
const NEXT = beat(TIMING.set[0] + TIMING.set[1]);
const AGAIN: Clip = {
  ...NEXT,
  sun: [[0, SUN.up, EASE.in], [TIMING.set[0], SUN.down, "hold"], ...NEXT.sun],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

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

/** A circle of radius `r` about (cx, cy), as a path. */
const circle = (cx: number, cy: number, r: number) => {
  const k = r * ARC;
  const p = (x: number, y: number) => `${r2(cx + x)} ${r2(cy + y)}`;
  return [
    `M${p(0, -r)}`,
    `C${p(k, -r)} ${p(r, -k)} ${p(r, 0)}`,
    `C${p(r, k)} ${p(k, r)} ${p(0, r)}`,
    `C${p(-k, r)} ${p(-r, k)} ${p(-r, 0)}`,
    `C${p(-r, -k)} ${p(-k, -r)} ${p(0, -r)}`,
    "Z",
  ].join(" ");
};

/** The nail and the wire, behind the frame: drawn first, so the frame covers the wire's ends. */
const Wire = () => (
  <>
    <FacePath
      at={[0, -FRAME.depth, NAIL_Z]}
      d={`M${-WIRE.reach} ${WIRE.rise} L0 0 L${WIRE.reach} ${WIRE.rise}`}
      plane="left"
      style={LINE}
    />
    <FacePath
      at={[0, -FRAME.depth, NAIL_Z]}
      d={circle(0, 0, WIRE.nail)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-ink)" }}
    />
  </>
);

/**
 * The picture, cut to its rounded opening: paper, the sun, the far hill
 * and the near hill, written back to front so each hides the one behind
 * it. `sun` is the sun's height. The opening's outline goes on last, over
 * the cut ends of the hills.
 */
const Picture = ({ sun }: { sun: number }) => {
  const id = `picture-${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
  const hill: CSSProperties = { ...LINE, fill: "var(--iso-surface-left)" };
  return (
    <>
      <clipPath id={id}>
        <FacePath at={PICTURE_AT} d={PICTURE_PATH} plane="left" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <FacePath
          at={PICTURE_AT}
          d={PICTURE_PATH}
          plane="left"
          style={{ fill: "var(--iso-surface-top)", stroke: "none" }}
        />
        <FacePath
          at={PICTURE_AT}
          d={circle(SUN.u, sun, SUN.r)}
          plane="left"
          style={{ ...LINE, fill: "var(--iso-main-left)" }}
        />
        <FacePath at={PICTURE_AT} d={FAR_HILL} plane="left" style={hill} />
        <FacePath at={PICTURE_AT} d={NEAR_HILL} plane="left" style={hill} />
      </g>
      <FacePath at={PICTURE_AT} d={PICTURE_PATH} plane="left" style={LINE} />
    </>
  );
};

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** The sun's height, re-rendered only when it changes. */
const useSun = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const read = (ms: number) => r2(sample(clip.sun, ms));
  const [value, setValue] = useState(() => read(0));
  const last = useRef(value);
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next !== last.current) {
      last.current = next;
      setValue(next);
    }
  });
  return clock ? value : SUN.up;
};

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
  // Run 0 is the intro; every run after it starts from the sun up.
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

/** The arrow on the button: up, for an upload. */
const UploadIcon = () => (
  <svg
    aria-hidden="true"
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

/**
 * The state's own words, under the frame: the heading, a line of copy,
 * and the actions (the built-in button, or whatever is passed in).
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
      <UploadIcon />
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

export interface PictureFrameProps {
  /** Heading under the frame, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the sun; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The sun rises when the frame scrolls into view. Off shows it up and nothing moving. */
  autoPlay?: boolean;
  /** Set the sun and raise it again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the frame sets the sun and raises it again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the frame is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-56`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Picture frame: a complete no-images state ("No images yet") with a line
 * illustration, a heading, a line of copy and a button, all props. A
 * frame hung on a nail, holding the picture an empty image slot always
 * shows: two hills, and a sun that rises over the far one and settles.
 * One fine outline, near-white faces, no shadow, facing the screen; the
 * sun carries the brand, like the button under it. Click the frame to
 * play it again. Follows the shadcn theme.
 */
export const PictureFrame = ({
  heading = "No images yet",
  description = "Upload your first image and it will show up here.",
  actionLabel = "Upload image",
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
}: PictureFrameProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const sun = useSun(clock, clip);
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
        <Wire />
        <Extrude
          at={FRAME_AT}
          convex
          d={roundedRect(FRAME.w, FRAME.h, FRAME.r)}
          depth={FRAME.depth}
          palette="surface"
          plane="left"
        />
        <Picture sun={sun} />
      </Rig>
    </IsoStage>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="picture-frame"
    >
      <div
        className={cn("w-56 max-w-full", artClassName)}
        data-slot="picture-frame-art"
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

export default PictureFrame;
