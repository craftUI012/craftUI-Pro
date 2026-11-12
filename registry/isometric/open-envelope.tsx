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
  FloorGrid,
  IsoStage,
  press,
  Rig,
  roundedRect,
  sample,
  shiftTrack,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
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
 * A full inbox told by one object: an open envelope standing on its long
 * edge, so stuffed that a document is pushed out of it, with an alert
 * badge at its corner. Under it, the state's own words: a heading, a
 * line, two buttons. Drawn in ink, no shadow, facing the screen. Each
 * value is ms after it comes into view.
 *
 *    0ms   the envelope stands open, two sheets tucked in its pocket
 *  360ms   it swells: squashed a little, then back
 *  400ms   the document rises straight out of the pocket (720ms,
 *          overshoots and settles); the flap is knocked back and stands
 *          up again
 *  490ms   the sheet behind it follows, 90ms late
 * 1050ms   the alert badge pops at the corner (scale) and rocks to rest
 * 1700ms   still
 *
 * A click (or `loop`, after a 5.2s hold): the badge shrinks away, the
 * sheets drop back in (300ms, the envelope taking the thud), then the
 * above plays again.
 * Reduced motion (or autoPlay off): the document out, the badge up.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The alert badge pops.
  alert: 1050,
  // How long it holds before a loop tucks the document back in.
  hold: 5200,
  // How long the sheet behind lags the document.
  lag: 90,
  // After the sheets drop back in, the pause before they come out again.
  pause: 480,
  // The document starts to rise.
  rise: 400,
  // How long the badge takes to rock to rest.
  settle: 650,
  // Milliseconds of the drop back in.
  tuck: 300,
};

/* The document leaving the pocket. Everything comes to rest straight:
 * the sheets upright, the flap standing on its hinge. */
const RISE = {
  // Degrees the flap is knocked back before it stands up again.
  flap: 9,
  // How much the envelope is squashed as it swells (z scale).
  swell: 0.05,
  // How much it is squashed when the sheets drop back in.
  thud: 0.07,
  // World units the sheets rise.
  travel: 2.2,
  // Degrees the sheets wobble on the way out.
  wobble: 2.5,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The envelope: 8 wide (x), 5 tall, standing on its long edge and facing
// the viewer's left (+y). Its body is behind y = 0; the pocket's front
// leaf is one sheet of paper on y = 0, its top edge dipping to a V. The
// sheets stand between the two.
const ENV = { depth: 0.4, h: 5, r: 0.45, w: 8 };
const X0 = -ENV.w / 2;
const POCKET = {
  // How far the front leaf's top edge dips at the centre.
  dip: 1.8,
  // Half the width of the V's rounded point.
  tip: 0.55,
};
// The open flap: a triangle standing straight up on the back's top edge.
const FLAP = { depth: 0.2, h: 3.2, inset: 0.3, tip: 0.5 };
const HINGE: Vec3 = [0, -ENV.depth + FLAP.depth / 2, ENV.h];

// The sheets: thin paper, the document in front with a folded corner.
const SHEET = {
  // Height of their bottom edge at rest, tucked in the pocket.
  base: 0.2,
  // Size of the folded corner.
  fold: 0.75,
  h: 4.3,
  // The sheet behind stands this far to the left of the document, and
  // this much higher, so its edges show past it without turning it.
  shift: -0.35,
  step: 0.35,
  w: 6.4,
};
// On the document (u across, v down from its top edge): a mark, a
// heading line and four lines of text.
const MARK = { size: 0.5, u: 0.55, v: 0.5 };
const TEXT: { u: number; v: number; w: number; strong?: boolean }[] = [
  { strong: true, u: 1.3, v: 0.62, w: 2.2 },
  { u: 0.55, v: 1.45, w: 4.9 },
  { u: 0.55, v: 1.95, w: 5.2 },
  { u: 0.55, v: 2.45, w: 4.3 },
  { u: 0.55, v: 2.95, w: 3.1 },
];
const TEXT_H = 0.17;

// The alert badge: a pill standing off the envelope's top right corner,
// clear of the document.
const BADGE = { depth: 0.3, h: 1.6, w: 2.3, x: 3.9, y: 0.7, z: 6.9 };
const BADGE_AT: Vec3 = [BADGE.x, BADGE.y, BADGE.z + BADGE.h];
const BADGE_CENTRE: Vec3 = [
  BADGE.x + BADGE.w / 2,
  BADGE.y - BADGE.depth / 2,
  BADGE.z + BADGE.h / 2,
];

// The frame: the envelope, the flap at its furthest back, the document at
// the top of its overshoot, and the badge at the top of its pop.
const BOUNDS: Vec3[] = [
  [X0, 0, 0],
  [-X0, 0, 0],
  [X0, -ENV.depth, 0],
  [-X0, -ENV.depth, 0],
  [X0, 0, ENV.h],
  [-X0, -ENV.depth, ENV.h],
  [0, -ENV.depth, ENV.h + FLAP.h],
  [
    -SHEET.w / 2 + SHEET.shift,
    0,
    SHEET.base + SHEET.step + SHEET.h + RISE.travel * 1.14,
  ],
  [SHEET.w / 2, 0, SHEET.base + SHEET.h + RISE.travel * 1.14],
  [BADGE.x + BADGE.w + 0.3, BADGE.y, BADGE.z - 0.2],
  [BADGE.x + BADGE.w + 0.3, BADGE.y, BADGE.z + BADGE.h + 0.2],
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

// How far it turns by default: evenly either way from the front; at the
// isometric angle, further toward its face than away from it.
const ORBITS: Record<View, IsoOrbit> = { front: 16, isometric: [-14, 24] };

/* ───────────────────────────── Tracks ─────────────────────────────────── */

// Out of the pocket: fast, past its place, back, and settled.
const rise = (start: number, travel: number): IsoTrack => [
  [start, 0, EASE.soft],
  [start + 260, travel * 1.14, EASE.easy],
  [start + 430, travel * 0.96, EASE.easy],
  [start + 580, travel * 1.02, EASE.easy],
  [start + 720, travel],
];

// A wobble on the way out: one way, back past straight, and straight.
const wobble = (start: number, deg: number): IsoTrack => [
  [start, 0, EASE.soft],
  [start + 260, deg, EASE.easy],
  [start + 430, -deg * 0.5, EASE.easy],
  [start + 580, deg * 0.2, EASE.easy],
  [start + 720, 0],
];

// The flap knocked back by the document: back, upright again, one small
// bounce. Never past upright, where the document is.
const knocked = (start: number): IsoTrack => [
  [start + 60, 0, EASE.soft],
  [start + 250, RISE.flap, EASE.in],
  [start + 430, 0, EASE.drop],
  [start + 520, RISE.flap * 0.25, EASE.in],
  [start + 610, 0],
];

// The badge: pops with scale, and rocks to rest.
const pop = (start: number): IsoTrack => [
  [start, 0, EASE.soft],
  [start + 200, 1.18, EASE.easy],
  [start + 380, 0.95, EASE.easy],
  [start + 520, 1],
];
const rock = (start: number): IsoTrack => [
  [start, 0, EASE.soft],
  [start + 110, 9, EASE.easy],
  [start + 290, -5, EASE.easy],
  [start + 450, 2, EASE.easy],
  [start + 590, 0],
];

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  badge: IsoTrack;
  behind: IsoTrack;
  behindWobble: IsoTrack;
  end: number;
  flap: IsoTrack;
  rock: IsoTrack;
  sheet: IsoTrack;
  squash: IsoTrack;
  wobble: IsoTrack;
}

// The beat itself, from the moment the document starts to rise.
const beat = (start: number): Clip => {
  const alert = start + TIMING.alert - TIMING.rise;
  return {
    badge: pop(alert),
    behind: shiftTrack(rise(start, RISE.travel), TIMING.lag),
    behindWobble: shiftTrack(wobble(start, -RISE.wobble), TIMING.lag),
    end: alert + TIMING.settle,
    flap: knocked(start),
    rock: rock(alert),
    sheet: rise(start, RISE.travel),
    squash: press(RISE.swell, start - 40),
    wobble: wobble(start, RISE.wobble),
  };
};

// The first run: tucked in, then the beat.
const INTRO = beat(TIMING.rise);
// Every later run starts from the end of the last: the badge shrinks
// away, the sheets drop back in, a pause, then the beat again.
const REPLAY = TIMING.tuck + TIMING.pause;
const NEXT = beat(REPLAY);
const AGAIN: Clip = {
  badge: [[0, 1, EASE.in], [160, 0, "hold"], ...NEXT.badge],
  behind: [
    [0, RISE.travel, EASE.in],
    [TIMING.tuck + 40, 0, "hold"],
    ...NEXT.behind,
  ],
  behindWobble: NEXT.behindWobble,
  end: NEXT.end,
  flap: NEXT.flap,
  rock: NEXT.rock,
  sheet: [[0, RISE.travel, EASE.in], [TIMING.tuck, 0, "hold"], ...NEXT.sheet],
  squash: [...press(RISE.thud, TIMING.tuck - 40), ...NEXT.squash],
  wobble: NEXT.wobble,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/**
 * The pocket's front leaf, in face units (u across, v down from the
 * envelope's top edge): the top edge dips from each corner to a rounded
 * point at the centre; the bottom corners are rounded like the back's.
 */
const pocketPath = () => {
  const { w, h, r } = ENV;
  const k = r * 0.5523;
  const slope = POCKET.dip / (w / 2);
  const tipV = r2(slope * (w / 2 - POCKET.tip));
  const cornerV = r2(slope * 0.5);
  return [
    "M0 0.45",
    `Q0 0 0.5 ${cornerV}`,
    `L${w / 2 - POCKET.tip} ${tipV}`,
    `Q${w / 2} ${POCKET.dip} ${w / 2 + POCKET.tip} ${tipV}`,
    `L${w - 0.5} ${cornerV}`,
    `Q${w} 0 ${w} 0.45`,
    `V${h - r}`,
    `C${w} ${r2(h - r + k)} ${r2(w - r + k)} ${h} ${w - r} ${h}`,
    `H${r}`,
    `C${r2(r - k)} ${h} 0 ${r2(h - r + k)} 0 ${h - r}`,
    "Z",
  ].join(" ");
};
const POCKET_PATH = pocketPath();

/**
 * The flap, in face units (u across, v down from its point): a triangle
 * standing on the hinge, its point rounded.
 */
const flapPath = () => {
  const w = ENV.w - 2 * FLAP.inset;
  const tipV = r2((FLAP.h / (w / 2)) * FLAP.tip);
  return [
    `M0 ${FLAP.h}`,
    `L${w / 2 - FLAP.tip} ${tipV}`,
    `Q${w / 2} 0 ${w / 2 + FLAP.tip} ${tipV}`,
    `L${w} ${FLAP.h}`,
    "Z",
  ].join(" ");
};
const FLAP_PATH = flapPath();
const FLAP_AT: Vec3 = [
  X0 + FLAP.inset,
  -ENV.depth + FLAP.depth,
  ENV.h + FLAP.h,
];

/** A sheet of paper standing in the pocket; `fold` cuts and turns a corner. */
const Sheet = ({ at, fold = false }: { at: Vec3; fold?: boolean }) => {
  const { w, h } = SHEET;
  const f = SHEET.fold;
  const outline = fold
    ? `M0 0 H${w - f} L${w} ${f} V${h} H0 Z`
    : `M0 0 H${w} V${h} H0 Z`;
  return (
    <>
      <FacePath
        at={at}
        d={outline}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-surface-top)" }}
      />
      {fold ? (
        <FacePath
          at={at}
          d={`M${w - f} 0 V${f} H${w} Z`}
          plane="left"
          style={{ ...LINE, fill: "var(--iso-surface-right)" }}
        />
      ) : null}
    </>
  );
};

/** What is printed on the document: a mark, a heading line, four lines. */
const Print = ({ at }: { at: Vec3 }) => (
  <Face at={at} plane="left">
    <g fill="var(--iso-ink)">
      <rect
        height={MARK.size}
        opacity={0.3}
        rx={0.12}
        width={MARK.size}
        x={MARK.u}
        y={MARK.v}
      />
      {TEXT.map((t) => (
        <rect
          height={t.strong ? TEXT_H * 1.5 : TEXT_H}
          key={`${t.u},${t.v}`}
          opacity={t.strong ? 0.42 : 0.16}
          rx={TEXT_H / 2}
          width={t.w}
          x={t.u}
          y={t.v}
        />
      ))}
    </g>
  </Face>
);

/** The alert badge: a pill in the brand, the one lit thing. */
const Badge = ({ mark }: { mark: string }) => (
  <Extrude
    at={BADGE_AT}
    convex
    d={roundedRect(BADGE.w, BADGE.h, BADGE.h / 2)}
    depth={BADGE.depth}
    palette="main"
    plane="left"
  >
    <Face at={BADGE_AT} plane="left">
      <text
        fill="var(--iso-on-main)"
        fontSize={0.95}
        fontWeight={800}
        letterSpacing={0.04}
        textAnchor="middle"
        x={BADGE.w / 2}
        y={BADGE.h / 2 + 0.33}
      >
        {mark}
      </text>
    </Face>
  </Extrude>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** Whether the badge is up, re-rendered only when it changes. */
const useBadgeShown = (
  clock: MotionValue<number> | undefined,
  clip: Clip,
  still: boolean
) => {
  const idle = useMotionValue(0);
  const read = (ms: number) => sample(clip.badge, ms) > 0.02;
  const [shown, setShown] = useState(() => read(0));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next !== shown) {
      setShown(next);
    }
  });
  return still || shown;
};

/** Rig props: animated on the clock, or the pose at the clip's end held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(INTRO.end));

/** The poses of one clip. */
const posesOf = (clip: Clip) => ({
  badge: (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.rock, ms)),
    scale: Math.max(0.001, r2(sample(clip.badge, ms))),
  }),
  behind: (ms: number): IsoPose => ({
    axis: "y",
    offset: [0, 0, r2(sample(clip.behind, ms))],
    rotate: r2(sample(clip.behindWobble, ms)),
  }),
  envelope: (ms: number): IsoPose => ({
    scale: [1, 1, Math.round(sample(clip.squash, ms) * 1000) / 1000],
  }),
  flap: (ms: number): IsoPose => ({
    axis: "x",
    rotate: r2(sample(clip.flap, ms)),
  }),
  sheet: (ms: number): IsoPose => ({
    axis: "y",
    offset: [0, 0, r2(sample(clip.sheet, ms))],
    rotate: r2(sample(clip.wobble, ms)),
  }),
});

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

/** In view, reduced motion, the clock and its clip, the camera, the pointer. */
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
  // Run 0 is the intro; every run after it starts from the document out.
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const clip = run === 0 ? INTRO : AGAIN;
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
    if (loop && !still && ms >= clip.end + TIMING.hold) {
      again();
    }
  });
  // A plain click (no drag) replays, once everything is at rest.
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
      if (replayOnClick && !still && !moved && clock.get() >= clip.end) {
        again();
      }
    },
  };
  return {
    camera,
    clip,
    clock: still ? undefined : clock,
    orbitProps,
    pointer,
    ref,
    still,
  };
};

// In ink the walls step down half as far as the house ramp (0.03 and 0.07
// under the top, not 0.06 and 0.13): this is a quiet line drawing on the
// page, with only a whisper of form.
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
 * envelope's inside, seen above the pocket's edge.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-inside": "oklch(from var(--iso-surface-right-c) calc(l - 0.03) c h)",
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* ───────────────────────────── Copy ───────────────────────────────────── */

const ICON = {
  "aria-hidden": true,
  "data-icon": "inline-start",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  viewBox: "0 0 24 24",
} as const;

/** Upgrade: an arrow up. */
const UpIcon = () => (
  <svg {...ICON}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </svg>
);

/** Clear: a bin. */
const BinIcon = () => (
  <svg {...ICON}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7" />
  </svg>
);

/**
 * The state's own words, under the envelope: the heading, a line of copy,
 * and the actions (the two built-in buttons, or whatever is passed in).
 */
const Copy = ({
  heading,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  children,
}: {
  heading: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  secondaryLabel: string;
  onSecondary?: () => void;
  children?: ReactNode;
}) => {
  const buttons =
    actionLabel || secondaryLabel ? (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actionLabel ? (
          <Button className="rounded-full" onClick={onAction}>
            <UpIcon />
            {actionLabel}
          </Button>
        ) : null}
        {secondaryLabel ? (
          <Button
            className="rounded-full"
            onClick={onSecondary}
            variant="secondary"
          >
            <BinIcon />
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    ) : null;
  const actions = children ?? buttons;
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

export interface OpenEnvelopeProps {
  /** Heading under the envelope, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the main button, up to about 18 characters. An empty string hides it. */
  actionLabel?: string;
  /** Called when the main button is clicked. */
  onAction?: () => void;
  /** Label of the second button, up to about 18 characters. An empty string hides it. */
  secondaryLabel?: string;
  /** Called when the second button is clicked. */
  onSecondary?: () => void;
  /** Your own actions under the copy, in place of the two built-in buttons. */
  children?: ReactNode;
  /** Mark on the alert badge, up to three characters. An empty string leaves the badge out. */
  alert?: string;
  /** Brand colour: a theme token name (primary, destructive, chart-2…) or any CSS colour. It shows on the alert badge; the envelope and the document stay neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The document is pushed out when the envelope scrolls into view. Off shows it out and still. */
  autoPlay?: boolean;
  /** Tuck the document back in and push it out again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the envelope tucks the document back in and pushes it out again. */
  replayOnClick?: boolean;
  /** How it faces: "front" (default) turns it square to the screen, level and plumb, its thickness along the top edge; "isometric" shows it at the isometric three-quarter angle. */
  view?: "front" | "isometric";
  /** Dashed construction grid on the floor. */
  grid?: boolean;
  /**
   * Let the viewer turn the envelope: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default 16 in the front view, [-14, 24] in the isometric one. */
  orbit?: IsoOrbit;
  /** Accessible description of the illustration. Without it the envelope is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-60`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Open envelope: a complete "your mail is full" state with an isometric
 * ink illustration, a heading, a line of copy and two buttons, all props.
 * An open envelope stands facing the screen, its flap straight up; it
 * swells, a document with a folded corner rises straight out of the
 * pocket, a second sheet following behind it, and an alert badge (the
 * one brand mark) pops at its corner. One even outline, no shadow. Click
 * the envelope to replay; it leans with the pointer. Follows the shadcn
 * theme.
 */
export const OpenEnvelope = ({
  heading = "Your mail is full",
  description = "Your inbox is out of space. Clear some by deleting files, or upgrade your storage.",
  actionLabel = "Upgrade storage",
  onAction,
  secondaryLabel = "Clear space",
  onSecondary,
  children,
  alert = "!!!",
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
}: OpenEnvelopeProps) => {
  const turn = orbit ?? ORBITS[view];
  const { camera, clip, clock, orbitProps, pointer, ref, still } = useShell({
    autoPlay,
    loop,
    orbit: turn,
    replayOnClick,
    rotate,
  });
  const badgeShown = useBadgeShown(clock, clip, still);
  const poses = posesOf(clip);
  const documentAt: Vec3 = [-SHEET.w / 2, 0, SHEET.base + SHEET.h];
  const behindAt: Vec3 = [
    documentAt[0] + SHEET.shift,
    0,
    documentAt[2] + SHEET.step,
  ];
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="open-envelope"
    >
      <div
        {...turnableLabel(rotate, title)}
        className={cn(
          "w-60 max-w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
          artClassName
        )}
        data-slot="open-envelope-art"
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
          {/* Everything stands in one rig that turns it to face the
              screen (or leaves it at the isometric angle). */}
          <Rig pivot={[0, 0, 0]} {...VIEW_POSE[view]}>
            {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
            {/* Far to near: the flap, the envelope's back, the sheets, the
              pocket's front leaf. The envelope squashes about its foot. */}
            <Rig pivot={[0, 0, 0]} {...rigged(clock, poses.envelope)}>
              <Rig axis="x" pivot={HINGE} {...rigged(clock, poses.flap)}>
                <Extrude
                  at={FLAP_AT}
                  d={FLAP_PATH}
                  depth={FLAP.depth}
                  palette="surface"
                  plane="left"
                />
              </Rig>
              <Extrude
                at={[X0, 0, ENV.h]}
                convex
                d={roundedRect(ENV.w, ENV.h, ENV.r)}
                depth={ENV.depth}
                frontStyle={{ fill: "var(--iso-inside)" }}
                palette="surface"
                plane="left"
              />
              <Rig
                pivot={[SHEET.shift, 0, SHEET.base + SHEET.step]}
                {...rigged(clock, poses.behind)}
              >
                <Sheet at={behindAt} />
              </Rig>
              <Rig pivot={[0, 0, SHEET.base]} {...rigged(clock, poses.sheet)}>
                <Sheet at={documentAt} fold />
                <Print at={documentAt} />
              </Rig>
              <FacePath
                at={[X0, 0, ENV.h]}
                d={POCKET_PATH}
                plane="left"
                style={{ ...LINE, fill: "var(--iso-surface-left)" }}
              />
            </Rig>
            {alert && badgeShown ? (
              <Rig pivot={BADGE_CENTRE} {...rigged(clock, poses.badge)}>
                <Badge mark={alert} />
              </Rig>
            ) : null}
          </Rig>
        </IsoStage>
      </div>
      <Copy
        actionLabel={actionLabel}
        description={description}
        heading={heading}
        onAction={onAction}
        onSecondary={onSecondary}
        secondaryLabel={secondaryLabel}
      >
        {children}
      </Copy>
    </div>
  );
};

export default OpenEnvelope;
