"use client";

import { useInView, useMotionValueEvent, useReducedMotion } from "motion/react";
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
  FloorGrid,
  IsoStage,
  Rig,
  roundedRect,
  sample,
  shiftTrack,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoKey,
  IsoOrbit,
  IsoPose,
  IsoRotate,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object: a blank ID badge hanging from its
 * strap, a placeholder where the photo goes and a plus on its corner.
 * Nobody is on the team yet. Under it, the empty state's own words: a
 * heading, a line, a button. Drawn in ink, no shadow, facing the screen.
 * Each value is ms after it comes into view.
 *
 *    0ms   hanging straight and still
 *  400ms   flicked: the strap swings out and back, each swing smaller
 *          (about 1.4s); the badge twists on the strap, the same way
 *  490ms   the card follows on its eyelet, 90ms behind and the other way
 * 1500ms   as it comes to rest, the plus on the photo pulses once
 * 2100ms   still
 *
 * A click (or `loop`, after a 5.2s hold) flicks it again.
 * Reduced motion (or autoPlay off): hanging still, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The flick.
  flick: 400,
  // Milliseconds of one half swing of the strap.
  half: 230,
  // How long it hangs still before a loop flicks it again.
  hold: 5200,
  // How long the card lags the strap.
  lag: 90,
  // The plus pulses.
  pulse: 1500,
  // Everything is at rest.
  rest: 2100,
};

/* The flick: the first swing of each part, in degrees. Small on purpose:
 * mid-swing the badge is off the isometric axes, and a wide swing reads
 * as drawn wrong rather than as moving. */
const FLICK = {
  // The card on its eyelet.
  card: 5,
  // How much smaller each half swing is than the one before.
  decay: 0.62,
  // The strap about its top.
  strap: -6,
  // The badge about the strap.
  twist: 11,
};

/* How much the plus grows when it pulses. */
const PULSE = 0.3;

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The card: a rounded panel facing the viewer's left (+y), hanging clear
// of the floor. Behind its top edge, the clip's plate with the eyelet.
const CARD = { depth: 0.3, h: 6.6, r: 0.5, w: 5.4, z: 1.2 };
const CARD_TOP = CARD.z + CARD.h;
const FRONT_Y = CARD.depth / 2;
// The card's front face, top-left corner: the origin of its details.
const CARD_AT: Vec3 = [-CARD.w / 2, FRONT_Y, CARD_TOP];

// The clip's plate: mostly above the card, its foot hidden behind it.
const PLATE = { above: 0.85, depth: 0.2, foot: 0.5, r: 0.3, w: 1.8 };
const PLATE_Y = FRONT_Y - 0.1;
const PLATE_AT: Vec3 = [-PLATE.w / 2, PLATE_Y, CARD_TOP + PLATE.above];
// The eyelet in the plate, where the strap passes through and the card
// turns.
const EYELET = { hole: 0.13, r: 0.3, v: 0.44 };
const EYELET_AT: Vec3 = [0, PLATE_Y, CARD_TOP + PLATE.above - EYELET.v];

// The strap: a slim rounded bar rising from the eyelet to where it hangs.
const STRAP = { depth: 0.1, h: 1.75, w: 0.34 };
const ANCHOR: Vec3 = [0, PLATE_Y, EYELET_AT[2] + STRAP.h - STRAP.w / 2];
const STRAP_AT: Vec3 = [-STRAP.w / 2, PLATE_Y + STRAP.depth, ANCHOR[2]];

// On the card's face (u across, v down from its top edge): the photo
// window with a placeholder figure, two lines for a name and a role, and
// the plus on the window's corner.
const PHOTO = { r: 0.3, size: 3.3, u: (CARD.w - 3.3) / 2, v: 0.85 };
const FIGURE = {
  // The head: radius, and its centre below the window's top.
  head: 0.68,
  headV: 1.2,
  // The shoulders: half their width, and their top below the window's top.
  shoulders: 1.25,
  shouldersV: 2.15,
};
const LINES: { u: number; v: number; w: number }[] = [
  { u: 1.1, v: 4.75, w: 1.25 },
  { u: 2.55, v: 4.75, w: 1.75 },
  { u: 1.5, v: 5.3, w: 1.15 },
  { u: 2.85, v: 5.3, w: 1.05 },
];
const LINE_H = 0.2;
const PLUS = {
  // Half the length of each arm, and its thickness.
  arm: 0.24,
  bar: 0.11,
  r: 0.48,
  u: PHOTO.u + PHOTO.size - 0.12,
  v: PHOTO.v + PHOTO.size - 0.12,
};
const PLUS_AT: Vec3 = [CARD_AT[0] + PLUS.u, CARD_AT[1], CARD_AT[2] - PLUS.v];

// The frame: the badge at rest with a little room, up to the anchor. The
// widest swings run into the stage's padding, which is not clipped.
const REACH = { x: CARD.w / 2 + 0.7, y: 0.6 };
const BOUNDS: Vec3[] = [
  [-REACH.x, FRONT_Y, CARD.z - 0.2],
  [REACH.x, FRONT_Y, CARD.z - 0.2],
  [-REACH.x, FRONT_Y, CARD_TOP],
  [REACH.x, FRONT_Y, CARD_TOP],
  [0, REACH.y, CARD.z],
  [0, -REACH.y, CARD_TOP],
  [0, PLATE_Y, ANCHOR[2] + STRAP.w / 2],
];

const GRID = { at: [-6, -6] as const, size: [12, 12] as const };
const PIVOT: readonly [number, number] = [0, 0];
/* ───────────────────────────── The view ───────────────────────────────── */

type View = "front" | "isometric";

/**
 * Facing the screen. The object is built facing +y, which the isometric
 * camera sees at an angle. In the front view the whole object is turned
 * 45° about the vertical, so its front points straight at the viewer and
 * its edges run level and plumb on the screen; and it is stretched
 * √(3/2) in height, because that camera looks down from 35.26° and
 * foreshortens heights by exactly that much, so the front keeps its true
 * proportions. It is still one exact parallel projection of a solid: its
 * thickness shows along its top edge, and down a side as it turns.
 */
const FRONT = { stretch: Math.sqrt(1.5), turn: -45 };
const VIEW_POSE: Record<View, IsoPose> = {
  front: { axis: "z", rotate: FRONT.turn, scale: [1, 1, FRONT.stretch] },
  isometric: {},
};

/** Where a point of the object lands once it faces the screen. */
const facing = ([x, y, z]: Vec3): Vec3 => [
  (x + y) * Math.SQRT1_2,
  (y - x) * Math.SQRT1_2,
  z * FRONT.stretch,
];
const boundsFor = (view: View) =>
  view === "front" ? BOUNDS.map(facing) : BOUNDS;

// How far it turns by default: evenly either way from the front. At the
// isometric angle the badge's face is 45° from edge-on on one side and it
// twists 11° on its strap, so the camera stops at 20° that way.
const ORBITS: Record<View, IsoOrbit> = { front: 16, isometric: [-12, 20] };

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/**
 * A swing that dies away, as an offset from rest: out to `amp`, back
 * through rest to the other side, each half swing smaller than the last.
 */
const swing = (amp: number, start: number, half: number): IsoTrack => {
  const keys: IsoKey[] = [[start, 0, EASE.soft]];
  let reach = amp;
  let at = start + Math.round(half * 0.7);
  for (let i = 0; i < 6; i += 1) {
    keys.push([at, reach, EASE.easy]);
    reach *= -FLICK.decay;
    at += half;
  }
  keys.push([at, 0]);
  return keys;
};

const STRAP_SWING = swing(FLICK.strap, TIMING.flick, TIMING.half);
// The card answers late and a little slower; the twist slower again.
const CARD_SWING = shiftTrack(
  swing(FLICK.card, TIMING.flick, TIMING.half + 20),
  TIMING.lag
);
const TWIST = swing(FLICK.twist, TIMING.flick, TIMING.half + 45);
const PLUS_PULSE: IsoTrack = [
  [TIMING.pulse, 0, EASE.soft],
  [TIMING.pulse + 160, PULSE, EASE.easy],
  [TIMING.pulse + 520, 0],
];

const r2 = (n: number) => Math.round(n * 100) / 100;

const strapPose = (ms: number): IsoPose => ({
  axis: "y",
  rotate: r2(sample(STRAP_SWING, ms)),
});
const cardPose = (ms: number): IsoPose => ({
  axis: "y",
  rotate: r2(sample(CARD_SWING, ms)),
});
const twistPose = (ms: number): IsoPose => ({
  axis: "z",
  rotate: r2(sample(TWIST, ms)),
});
const plusPose = (ms: number): IsoPose => ({
  scale: r2(1 + sample(PLUS_PULSE, ms)),
});

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/** A circle in face units, as four cubic quarter turns. */
const circlePath = (u: number, v: number, r: number) =>
  roundedRect(2 * r, 2 * r, r, u - r, v - r);

/** The clip's plate and its eyelet: a ring with the hole through it. */
const Clip = () => (
  <>
    <Extrude
      at={PLATE_AT}
      convex
      d={roundedRect(PLATE.w, PLATE.above + PLATE.foot, PLATE.r)}
      depth={PLATE.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={PLATE_AT}
      d={circlePath(PLATE.w / 2, EYELET.v, EYELET.r)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-surface-top)" }}
    />
    <FacePath
      at={PLATE_AT}
      d={circlePath(PLATE.w / 2, EYELET.v, EYELET.hole)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-inside)" }}
    />
  </>
);

/** The card, with the photo window, the placeholder figure and the lines. */
const Card = () => {
  const cu = CARD.w / 2;
  const bottom = PHOTO.v + PHOTO.size;
  const top = PHOTO.v + FIGURE.shouldersV;
  return (
    <>
      <Extrude
        at={CARD_AT}
        convex
        d={roundedRect(CARD.w, CARD.h, CARD.r)}
        depth={CARD.depth}
        palette="surface"
        plane="left"
      />
      <FacePath
        at={CARD_AT}
        d={roundedRect(PHOTO.size, PHOTO.size, PHOTO.r, PHOTO.u, PHOTO.v)}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-surface-top)" }}
      />
      <Face at={CARD_AT} plane="left">
        <g fill="var(--iso-ink)" opacity={0.16}>
          <path d={circlePath(cu, PHOTO.v + FIGURE.headV, FIGURE.head)} />
          <path
            d={`M${cu - FIGURE.shoulders} ${bottom} Q${cu - FIGURE.shoulders} ${top} ${cu} ${top} Q${cu + FIGURE.shoulders} ${top} ${cu + FIGURE.shoulders} ${bottom} Z`}
          />
          {LINES.map((l) => (
            <rect
              height={LINE_H}
              key={`${l.u},${l.v}`}
              rx={LINE_H / 2}
              width={l.w}
              x={l.u}
              y={l.v}
            />
          ))}
        </g>
      </Face>
    </>
  );
};

/** The plus on the photo's corner: the one brand mark. */
const Plus = () => (
  <>
    <FacePath
      at={CARD_AT}
      d={circlePath(PLUS.u, PLUS.v, PLUS.r)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-main-left)" }}
    />
    <Face at={CARD_AT} plane="left">
      <rect
        fill="var(--iso-on-main)"
        height={PLUS.bar}
        rx={PLUS.bar / 2}
        width={PLUS.arm * 2}
        x={PLUS.u - PLUS.arm}
        y={PLUS.v - PLUS.bar / 2}
      />
      <rect
        fill="var(--iso-on-main)"
        height={PLUS.arm * 2}
        rx={PLUS.bar / 2}
        width={PLUS.bar}
        x={PLUS.u - PLUS.bar / 2}
        y={PLUS.v - PLUS.arm}
      />
    </Face>
  </>
);

/** The strap: a slim bar from the eyelet up to where the badge hangs. */
const Strap = () => (
  <Extrude
    at={STRAP_AT}
    convex
    d={roundedRect(STRAP.w, STRAP.h, STRAP.w / 2)}
    depth={STRAP.depth}
    palette="surface"
    plane="left"
  />
);

/** Rig props: animated on the clock, or at rest. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : {});

/* ───────────────────────────── Shell ──────────────────────────────────── */

// A turnable scene is a focusable group that says how to turn it.
const turnableLabel = (rotate: IsoRotate, title?: string) =>
  rotate === "off"
    ? {}
    : {
        "aria-label": `${title ?? "Illustration"}. Move the pointer or use the left and right arrow keys to turn it.`,
        role: "group",
      };

interface PointerLike {
  button: number;
  clientX: number;
  clientY: number;
  currentTarget: Element;
  pointerId: number;
}
interface OrbitHandlers {
  onPointerDown?: (e: PointerLike) => void;
  onPointerUp?: () => void;
}

/** In view, reduced motion, the clock, the camera and the pointer. */
const useShell = ({
  autoPlay,
  loop,
  orbit,
  replayOnClick,
  rotate,
}: {
  autoPlay: boolean;
  loop: boolean;
  orbit: IsoOrbit;
  replayOnClick: boolean;
  rotate: IsoRotate;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const still = reduced || !autoPlay;
  // Each run is one flick, from rest to rest.
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  // One new run per finished run, however many frames or clicks ask.
  const asked = useRef(-1);
  const again = () => {
    if (asked.current !== run) {
      asked.current = run;
      setRun((n) => n + 1);
    }
  };
  useMotionValueEvent(clock, "change", (ms) => {
    if (loop && !still && ms >= TIMING.rest + TIMING.hold) {
      again();
    }
  });
  // A plain click (no drag) flicks it again, once it hangs still.
  const pressed = useRef({ x: 0, y: 0 });
  const handlers = orbitProps as OrbitHandlers;
  const pointer = {
    onPointerDown: (e: PointerLike) => {
      pressed.current = { x: e.clientX, y: e.clientY };
      handlers.onPointerDown?.(e);
    },
    onPointerUp: (e: PointerLike) => {
      handlers.onPointerUp?.();
      const moved =
        Math.hypot(
          e.clientX - pressed.current.x,
          e.clientY - pressed.current.y
        ) > 6;
      if (replayOnClick && !still && !moved && clock.get() >= TIMING.rest) {
        again();
      }
    },
  };
  return { camera, clock: still ? undefined : clock, orbitProps, pointer, ref };
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
 * the outline on the side edges of rounded parts, and the value seen
 * through the eyelet.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-inside": "oklch(from var(--iso-surface-right-c) calc(l - 0.1) c h)",
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* ───────────────────────────── Copy ───────────────────────────────────── */

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
 * The empty state's own words, under the badge: the heading, a line of
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
    <Button className="rounded-full" onClick={onAction}>
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

export interface IdBadgeProps {
  /** Heading under the badge, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the plus at the photo's corner; the rest of the badge stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The badge is flicked and swings to rest when it scrolls into view. Off shows it hanging still. */
  autoPlay?: boolean;
  /** Flick it again every few seconds. Off plays it once, which suits an empty state people sit in front of. */
  loop?: boolean;
  /** Clicking the badge flicks it again. */
  replayOnClick?: boolean;
  /** How it faces: "front" (default) turns it square to the screen, level and plumb, its thickness along the top edge; "isometric" shows it at the isometric three-quarter angle. */
  view?: "front" | "isometric";
  /** Dashed construction grid on the floor. */
  grid?: boolean;
  /**
   * Let the viewer turn the badge: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default 16 in the front view, [-12, 20] in the isometric one (keep that one under 25, or the twisting badge goes edge-on). */
  orbit?: IsoOrbit;
  /** Accessible description of the illustration. Without it the badge is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-52`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole empty state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * ID badge: a complete empty state ("No members yet") with an isometric
 * ink illustration, a heading, a line of copy and a button, all props.
 * A blank ID badge hangs from its strap: a clip plate with an eyelet, a
 * photo window with a placeholder figure, two lines for a name and a
 * role. It is flicked once, swings and twists to rest, and the plus on
 * the photo's corner (the one brand mark, like the button under it)
 * pulses. One even outline, no shadow. Click the badge to flick it
 * again; it leans with the pointer. Follows the shadcn theme.
 */
export const IdBadge = ({
  heading = "No members yet",
  description = "Start by adding your first member to collaborate and get things rolling.",
  actionLabel = "Add new member",
  onAction,
  children,
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  autoPlay = true,
  loop = false,
  replayOnClick = true,
  view = "front",
  grid = false,
  rotate = "pointer",
  orbit,
  title,
  artClassName,
  className,
}: IdBadgeProps) => {
  const turn = orbit ?? ORBITS[view];
  const { camera, clock, orbitProps, pointer, ref } = useShell({
    autoPlay,
    loop,
    orbit: turn,
    replayOnClick,
    rotate,
  });
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="id-badge"
    >
      <div
        {...turnableLabel(rotate, title)}
        className={cn(
          "w-52 max-w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
          artClassName
        )}
        data-slot="id-badge-art"
        ref={ref}
        {...orbitProps}
        onPointerDown={pointer.onPointerDown}
        onPointerUp={pointer.onPointerUp}
      >
        <IsoStage
          bounds={boundsFor(view)}
          camera={camera}
          orbit={rotate === "off" ? 0 : turn}
          shadow={false}
          strokeWidth={strokeWidth}
          style={stageStyle(variant)}
          title={title}
          tone={tone}
          variant={variant}
        >
          {/* Everything hangs in one rig that turns it to face the screen
              (or leaves it at the isometric angle). */}
          <Rig pivot={[0, 0, 0]} {...VIEW_POSE[view]}>
            {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
            {/* The strap swings about where it hangs; the badge twists on
              it; the card turns on its eyelet. All three come to rest
              straight: plumb and square. */}
            <Rig axis="y" pivot={ANCHOR} {...rigged(clock, strapPose)}>
              <Rig
                axis="z"
                pivot={[0, PLATE_Y, 0]}
                {...rigged(clock, twistPose)}
              >
                <Rig axis="y" pivot={EYELET_AT} {...rigged(clock, cardPose)}>
                  <Clip />
                  <Card />
                  <Rig pivot={PLUS_AT} {...rigged(clock, plusPose)}>
                    <Plus />
                  </Rig>
                </Rig>
                <Strap />
              </Rig>
            </Rig>
          </Rig>
        </IsoStage>
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

export default IdBadge;
