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
 * An empty state told by one object, in line: a delivery truck with
 * nothing to deliver, seen from its side. A fine outline, near-white
 * faces, the label on its box the one brand mark, facing the screen, no
 * shadow. Under it, the state's own words: a heading, a line, a button.
 * Each value is ms after it comes into view.
 *
 *    0ms   the truck waits a little way back
 *  400ms   it rolls forward, wheels turning, and slows to a stop (700ms)
 *  960ms   braking tips its nose down 2° about the front wheel (160ms)
 * 1120ms   it rocks back past level, forward a touch, and sits
 * 1600ms   still: parked
 *
 * A click (or `loop`, after a 5.2s hold) backs the truck up and brings it
 * forward again.
 * Reduced motion (or autoPlay off): the truck parked, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click: the truck backs up in this long, then waits a moment.
  back: [420, 140] as const,
  // The nose starts down this long before the truck stops.
  brake: 140,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The roll forward.
  roll: 700,
  // The truck sets off this long after it comes into view.
  start: 400,
};

/* How far things move. */
const MOVE = {
  // Degrees the nose dips on braking, and the two swings after it.
  pitch: [2, -0.8, 0.25] as const,
  // World units the truck waits back from where it parks.
  roll: -1.1,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The truck is built facing +y, its cab to the right, and shown facing
// the screen. Its wheels stand on the floor at this height.
const FLOOR = 0.5;

// The wheels: a tyre and a hub with one slot across it, so a turn shows.
// They stand a little proud of the body.
const WHEEL = {
  at: [-1.9, 2.15] as const,
  depth: 0.36,
  hub: 0.3,
  r: 0.72,
  y: 0.16,
};
const AXLE = FLOOR + WHEEL.r;

// The chassis: one low rail under the box and the cab. Everything above
// it stands on its top edge.
const DEPTH = 1;
const RAIL = { h: 0.34, r: 0.12, w: 6.9, x: -3.46 };
const DECK = 1.6;

// The box: where its left edge is, its size, and the label on its side
// (u across from its left edge, v down from its top).
const BOX = { h: 3.4, r: 0.35, w: 4.25, x: -3.44 };
const BOX_AT: Vec3 = [BOX.x, 0, DECK + BOX.h];
const LABEL = { h: 1, r: 0.14, u: 0.6, v: 0.62, w: 1.5 };

// The cab: a little way in front of the box, a block with a raked
// windscreen and a short nose, the window
// in its upper half, a door handle and a headlight.
const CAB = { h: 2.55, r: 0.3, w: 2.3, x: 1.09 };
const CAB_AT: Vec3 = [CAB.x, 0, DECK + CAB.h];
const CAB_PATH = [
  `M0 ${CAB.h}`,
  `V${CAB.r}`,
  `Q0 0 ${CAB.r} 0`,
  `H${CAB.w - 1.15}`,
  `Q${CAB.w - 0.5} 0 ${CAB.w - 0.28} 0.95`,
  `L${CAB.w - 0.05} 1.55`,
  `Q${CAB.w} 1.7 ${CAB.w} 1.95`,
  `V${CAB.h - CAB.r}`,
  `Q${CAB.w} ${CAB.h} ${CAB.w - CAB.r} ${CAB.h}`,
  "Z",
].join(" ");
const WINDOW_PATH = [
  "M0.5 0.42",
  `H${CAB.w - 1.2}`,
  `Q${CAB.w - 0.72} 0.42 ${CAB.w - 0.55} 1`,
  `L${CAB.w - 0.48} 1.28`,
  "H0.5",
  "Z",
].join(" ");

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

// The frame fits the truck parked: from the floor to the top of its box.
// Waiting to roll in, it stands a little further left; that runs into the
// stage's padding, which is not clipped.
const EXTENT: Vec3[] = [
  [RAIL.x, WHEEL.y, FLOOR],
  [RAIL.x + RAIL.w, WHEEL.y, FLOOR],
  [RAIL.x, -DEPTH, DECK + BOX.h],
  [RAIL.x + RAIL.w, -DEPTH, DECK + BOX.h],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: where the truck is, its pitch, and when it is at rest. */
interface Clip {
  end: number;
  // Degrees the body tips about the front wheel, nose down positive.
  pitch: IsoTrack;
  // World units along the road, 0 where it parks.
  roll: IsoTrack;
}

// The beat itself, starting `t0` ms into a run. The roll eases away and
// eases to a stop; the body's weight arrives a moment after the wheels
// have slowed, tips the nose down, and rocks itself level.
const beat = (t0: number): Clip => {
  const stop = t0 + TIMING.roll;
  const dip = stop - TIMING.brake;
  const [down, back, forth] = MOVE.pitch;
  return {
    end: dip + 640,
    pitch: [
      [dip, 0, EASE.easy],
      [dip + 160, down, EASE.easy],
      [dip + 360, back, EASE.easy],
      [dip + 520, forth, EASE.easy],
      [dip + 640, 0],
    ],
    roll: [
      [t0, MOVE.roll, EASE.easy],
      [stop, 0],
    ],
  };
};

// The first run: the truck waiting back, then the beat.
const INTRO = beat(TIMING.start);
// Every later run starts from the end of the last: the truck backs up first.
const NEXT = beat(TIMING.back[0] + TIMING.back[1]);
const AGAIN: Clip = {
  ...NEXT,
  roll: [[0, 0, EASE.easy], [TIMING.back[0], MOVE.roll, "hold"], ...NEXT.roll],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The whole truck, along the road. */
const truckPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [r2(sample(clip.roll, ms)), 0, 0] });

/**
 * A wheel, turned by the road that has passed under it. About the depth
 * axis a positive turn is clockwise on the page, which is the way a wheel
 * turns when the truck rolls to the right.
 */
const wheelPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const travelled = sample(clip.roll, ms) - MOVE.roll;
    return {
      axis: "y",
      rotate: Math.round(((travelled / WHEEL.r) * 180) / Math.PI),
    };
  };

/** The body, tipped about the front wheel. */
const bodyPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.pitch, ms)),
  });

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

const GLASS_FILL = "var(--iso-surface-top)";

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

/** The rail everything stands on. Written first: its top edge hides behind the box and the cab. */
const Rail = () => (
  <Extrude
    at={[RAIL.x, 0, DECK]}
    convex
    d={roundedRect(RAIL.w, RAIL.h, RAIL.r)}
    depth={DEPTH}
    palette="surface"
    plane="left"
  />
);

/** The box, and the label on its side: the one brand mark. */
const Cargo = () => (
  <>
    <Extrude
      at={BOX_AT}
      convex
      d={roundedRect(BOX.w, BOX.h, BOX.r)}
      depth={DEPTH}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={BOX_AT}
      d={roundedRect(LABEL.w, LABEL.h, LABEL.r, LABEL.u, LABEL.v)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-main-left)" }}
    />
    <Face at={BOX_AT} plane="left">
      <g fill="var(--iso-on-main)" opacity={0.85}>
        <rect
          height={0.13}
          rx={0.065}
          width={0.88}
          x={LABEL.u + 0.28}
          y={LABEL.v + 0.28}
        />
        <rect
          height={0.13}
          rx={0.065}
          width={0.56}
          x={LABEL.u + 0.28}
          y={LABEL.v + 0.58}
        />
      </g>
    </Face>
  </>
);

/** The cab: its window, a door handle and a headlight. */
const Cab = () => (
  <>
    <Extrude
      at={CAB_AT}
      convex
      d={CAB_PATH}
      depth={DEPTH}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={CAB_AT}
      d={WINDOW_PATH}
      plane="left"
      style={{ ...LINE, fill: GLASS_FILL }}
    />
    <Face at={CAB_AT} plane="left">
      <g fill="var(--iso-ink)" opacity={0.3}>
        <rect height={0.12} rx={0.06} width={0.42} x={0.55} y={1.62} />
        <rect height={0.34} rx={0.08} width={0.18} x={CAB.w - 0.3} y={1.9} />
      </g>
    </Face>
  </>
);

/** One wheel, about its axle at `x`: the tyre, the hub, and the slot across the hub. */
const Wheel = ({ x }: { x: number }) => {
  const at: Vec3 = [x - WHEEL.r, WHEEL.y, AXLE + WHEEL.r];
  return (
    <>
      <Extrude
        at={at}
        convex
        d={circle(WHEEL.r, WHEEL.r, WHEEL.r)}
        depth={WHEEL.depth}
        palette="surface"
        plane="left"
      />
      <FacePath
        at={at}
        d={circle(WHEEL.r, WHEEL.r, WHEEL.hub)}
        plane="left"
        style={{ ...LINE, fill: GLASS_FILL }}
      />
      <FacePath
        at={at}
        d={`M${r2(WHEEL.r - WHEEL.hub * 0.6)} ${WHEEL.r} H${r2(WHEEL.r + WHEEL.hub * 0.6)}`}
        plane="left"
        strokeLinecap="round"
        style={LINE}
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
  // Run 0 is the intro; every run after it starts from the truck parked.
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
 * The state's own words, under the truck: the heading, a line of copy,
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

export interface DeliveryTruckProps {
  /** Heading under the truck, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the label on the truck's box; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The truck rolls in and parks when it scrolls into view. Off shows it parked and nothing moving. */
  autoPlay?: boolean;
  /** Back up and roll in again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the truck backs it up and rolls it in again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the truck is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-56`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Delivery truck: a complete no-orders state ("No orders yet") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * delivery truck seen from its side; it rolls forward, wheels turning,
 * brakes with its nose dipping, rocks level and sits parked. One fine
 * outline, near-white faces, no shadow, facing the screen; the label on
 * its box carries the brand, like the button under it. Click the truck to
 * play it again. Follows the shadcn theme.
 */
export const DeliveryTruck = ({
  heading = "No orders yet",
  description = "When someone places an order, it will show up here.",
  actionLabel = "Create order",
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
}: DeliveryTruckProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const [rear, front] = WHEEL.at;
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
        <Rig pivot={[0, 0, 0]} {...rigged(clock, truckPose(clip))}>
          <Rig pivot={[front, 0, AXLE]} {...rigged(clock, bodyPose(clip))}>
            <Rail />
            <Cargo />
            <Cab />
          </Rig>
          {[rear, front].map((x) => (
            <Rig
              key={x}
              pivot={[x, 0, AXLE]}
              {...rigged(clock, wheelPose(clip))}
            >
              <Wheel x={x} />
            </Rig>
          ))}
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
      data-slot="delivery-truck"
    >
      <div
        className={cn("w-56 max-w-full", artClassName)}
        data-slot="delivery-truck-art"
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

export default DeliveryTruck;
