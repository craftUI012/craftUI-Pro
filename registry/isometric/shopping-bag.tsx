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
  hop,
  press,
  roundedRect,
  sample,
  shiftTrack,
  useClock,
} from "./iso-core";
import type { IsoPose, IsoTone, IsoTrack, IsoVariant, Vec3 } from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object, in line: a paper shopping bag with
 * nothing in it, and a price tag on its handle. A fine outline,
 * near-white faces, the tag the one brand mark, facing the screen, no
 * shadow. Under it, the state's own words: a heading, a line, a button.
 * Each value is ms after it comes into view.
 *
 *    0ms   the bag stands still
 *  400ms   it hops: up half a unit (200ms) and back down
 *  780ms   it lands: the near handle is squashed and springs back, the
 *          far one 70ms behind it; the tag swings out on its string
 * 1500ms   still: the handles up, the tag hanging straight
 *
 * A click (or `loop`, after a 5.2s hold) makes it hop again.
 * Reduced motion (or autoPlay off): the bag standing, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click the hop starts this soon.
  again: 80,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The far handle follows the near one this much later.
  lag: 70,
  // From take-off to landing (the hop preset's own timing).
  land: 380,
  // The hop starts this long after the bag comes into view.
  start: 400,
};

/* How far things move. */
const MOVE = {
  // World units the bag leaves the floor.
  hop: 0.5,
  // How far the handles are squashed on landing, as a share of their height.
  squash: 0.24,
  // Degrees the tag swings out on landing.
  swing: 13,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The bag: built facing +y, about a centre line at x = 0, and shown
// facing the screen. It is deep, so its open top shows as a wide strip.
const BAG = { depth: 1.1, fold: 0.55, h: 5.2, r: 0.3, w: 5, z: 0.6 };
const BAG_X = -BAG.w / 2;
const BAG_TOP = BAG.z + BAG.h;
const BAG_AT: Vec3 = [BAG_X, 0, BAG_TOP];

// A handle: a flat loop standing on the bag's top edge, one on the near
// side and one on the far side. `r` rounds its two top corners.
const HANDLE = { bar: 0.26, r: 0.75, rise: 1.6, w: 2.4 };

// The tag: on a string from the foot of the near handle, hanging in
// front of the bag.
const TAG = {
  h: 1.25,
  hole: 0.1,
  r: 0.14,
  shoulder: 0.42,
  string: 0.75,
  w: 0.9,
  y: 0.08,
};
const TAG_ANCHOR: Vec3 = [
  -HANDLE.w / 2 + HANDLE.bar / 2,
  TAG.y,
  BAG_TOP - 0.02,
];

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

// The frame fits the bag at rest: as wide as the bag, from its foot to
// the top of the far handle. The hop lifts it a little; that runs into
// the stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [BAG_X, 0, BAG.z],
  [-BAG_X, 0, BAG.z],
  [BAG_X, -BAG.depth, BAG_TOP + HANDLE.rise],
  [-BAG_X, -BAG.depth, BAG_TOP + HANDLE.rise],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  end: number;
  far: IsoTrack;
  hop: IsoTrack;
  near: IsoTrack;
  tag: IsoTrack;
}

// The beat itself, starting `t0` ms into a run: the hop, then everything
// the landing sets off.
const beat = (t0: number): Clip => {
  const land = t0 + TIMING.land;
  const near = press(MOVE.squash, land);
  return {
    end: land + 720,
    far: shiftTrack(near, TIMING.lag),
    hop: hop(MOVE.hop, t0),
    near,
    // Thrown out by the landing, then swinging home, each swing smaller.
    tag: [
      [land, 0, EASE.drop],
      [land + 150, MOVE.swing, EASE.easy],
      [land + 320, -MOVE.swing * 0.6, EASE.easy],
      [land + 480, MOVE.swing * 0.3, EASE.easy],
      [land + 610, -MOVE.swing * 0.1, EASE.easy],
      [land + 720, 0],
    ],
  };
};

// The first run waits a moment after coming into view; a click does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The whole bag, off the floor and back. */
const bagPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.hop, ms))] });

/** A handle, squashed toward the bag's top edge and sprung back. */
const handlePose =
  (track: IsoTrack) =>
  (ms: number): IsoPose => ({ scale: [1, 1, r2(sample(track, ms))] });

/** The tag, swinging on its string. */
const tagPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ axis: "y", rotate: r2(sample(clip.tag, ms)) });

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

const PAPER_FILL = "var(--iso-surface-left)";

// A handle's outline (u across from its left edge, v down from its top):
// up one leg, across the top and down the other, then back inside it.
const HANDLE_PATH = (() => {
  const { bar, r, rise, w } = HANDLE;
  const inner = Math.max(r - bar, 0.12);
  return [
    `M0 ${rise}`,
    `V${r}`,
    `Q0 0 ${r} 0`,
    `H${r2(w - r)}`,
    `Q${w} 0 ${w} ${r}`,
    `V${rise}`,
    `H${r2(w - bar)}`,
    `V${r2(bar + inner)}`,
    `Q${r2(w - bar)} ${bar} ${r2(w - bar - inner)} ${bar}`,
    `H${r2(bar + inner)}`,
    `Q${bar} ${bar} ${bar} ${r2(bar + inner)}`,
    `V${rise}`,
    "Z",
  ].join(" ");
})();

/** One handle, standing on the bag's top edge at depth `y`. Paper is a face, not a solid. */
const Handle = ({ y }: { y: number }) => (
  <FacePath
    at={[-HANDLE.w / 2, y, BAG_TOP + HANDLE.rise]}
    d={HANDLE_PATH}
    plane="left"
    style={{ ...LINE, fill: PAPER_FILL }}
  />
);

/** The bag: its open top shows as the strip along its top edge; one fold across the front. */
const Bag = () => (
  <>
    <Extrude
      at={BAG_AT}
      convex
      d={roundedRect(BAG.w, BAG.h, BAG.r)}
      depth={BAG.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={BAG_AT}
      d={`M0 ${BAG.fold} H${BAG.w}`}
      plane="left"
      style={LINE}
    />
  </>
);

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

// The tag's outline, its point at the origin: two shoulders, straight
// sides and a rounded foot.
const TAG_PATH = (() => {
  const { h, r, shoulder, w } = TAG;
  const half = w / 2;
  return [
    "M0 0",
    `L${half} ${shoulder}`,
    `V${r2(h - r)}`,
    `Q${half} ${h} ${r2(half - r)} ${h}`,
    `H${r2(r - half)}`,
    `Q${-half} ${h} ${-half} ${r2(h - r)}`,
    `V${shoulder}`,
    "Z",
  ].join(" ");
})();

/** The tag and its string: the one brand mark. */
const Tag = () => {
  const [x, y, z] = TAG_ANCHOR;
  const top: Vec3 = [x, y, z - TAG.string];
  return (
    <>
      <FacePath
        at={TAG_ANCHOR}
        d={`M0 0 V${TAG.string}`}
        plane="left"
        style={LINE}
      />
      <FacePath
        at={top}
        d={TAG_PATH}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-main-left)" }}
      />
      <FacePath
        at={top}
        d={circle(0, TAG.shoulder, TAG.hole)}
        plane="left"
        style={{ ...LINE, fill: PAPER_FILL }}
      />
    </>
  );
};

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

/**
 * The state's own words, under the bag: the heading, a line of copy, and
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
    <Button className="rounded-full" onClick={onAction}>
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

export interface ShoppingBagProps {
  /** Heading under the bag, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the price tag; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The bag hops when it scrolls into view. Off shows it standing and nothing moving. */
  autoPlay?: boolean;
  /** Hop again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the bag makes it hop again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the bag is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-44`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Shopping bag: a complete empty-cart state ("Your cart is empty") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * paper bag with nothing in it; it hops, and on landing its two handles
 * are squashed and spring back, one a beat after the other, while the
 * price tag swings on its string. One fine outline, near-white faces, no
 * shadow, facing the screen; the tag carries the brand, like the button
 * under it. Click the bag to play it again. Follows the shadcn theme.
 */
export const ShoppingBag = ({
  heading = "Your cart is empty",
  description = "Add a few things and they will show up here.",
  actionLabel = "Browse products",
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
}: ShoppingBagProps) => {
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
      {/* Everything stands in one rig that turns it to face the screen. */}
      <Rig pivot={[0, 0, 0]} {...VIEW_POSE}>
        <Rig pivot={[0, 0, BAG.z]} {...rigged(clock, bagPose(clip))}>
          {/* The far handle, the bag in front of it, then the near handle and the tag. */}
          <Rig
            pivot={[0, -BAG.depth, BAG_TOP]}
            {...rigged(clock, handlePose(clip.far))}
          >
            <Handle y={-BAG.depth} />
          </Rig>
          <Bag />
          <Rig
            pivot={[0, 0, BAG_TOP]}
            {...rigged(clock, handlePose(clip.near))}
          >
            <Handle y={0} />
          </Rig>
          <Rig pivot={TAG_ANCHOR} {...rigged(clock, tagPose(clip))}>
            <Tag />
          </Rig>
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
      data-slot="shopping-bag"
    >
      <div
        className={cn("w-44 max-w-full", artClassName)}
        data-slot="shopping-bag-art"
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

export default ShoppingBag;
