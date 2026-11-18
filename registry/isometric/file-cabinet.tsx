"use client";

import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  Box,
  EASE,
  FaceEllipse,
  FacePath,
  FloorGrid,
  IsoStage,
  projectWith,
  Rig,
  roundedRect,
  sample,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCast,
  IsoOrbit,
  IsoPose,
  IsoRotate,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";
import {
  ButtonIcon,
  ICON,
  onClock,
  r2,
  useLineShell,
  useReduced,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object: a two-drawer file cabinet. A drawer
 * rolls out on its slides, hits its stop, and there is nothing in it.
 * Under it, the empty state's own words: a heading, a line, a button.
 * Drawn in ink, no shadow. Each value is ms after it comes into view.
 *
 *    0ms   closed, still
 *  500ms   the drawer rolls out (420ms): leaves slowly, arrives fast
 *  920ms   it hits its stop and bounces back off it twice; the cabinet
 *          tips forward on its front feet and drops back
 * 1000ms   the other drawer slides out a hair and back (it lags the hit)
 * 1620ms   still: open and empty
 *
 * One way, so each later play (each time `active` turns true, or `loop`
 * after a 5.2s hold) first pushes the drawer shut (320ms, the cabinet
 * rocking back on its rear feet), then the roll plays again.
 * Reduced motion, or `active` false before any play: open and empty,
 * nothing moves. It leans with the pointer either way.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // How long the other drawer lags the hit.
  lag: 80,
  // The drawer starts to roll out.
  open: 500,
  // After the push shut, the pause before it rolls out again.
  pause: 520,
  // Milliseconds of the roll, from rest to the stop.
  roll: 420,
  // How long the cabinet takes to come to rest after a hit.
  settle: 700,
  // Milliseconds of the push shut.
  shut: 320,
};

/* The drawer hitting its stop. */
const STOP = {
  // World units the drawer bounces back off the stop.
  rebound: 0.4,
  // Degrees the cabinet tips forward on its front feet.
  tip: 1.6,
};

/* The drawer pushed shut. */
const SHUT = {
  // World units it bounces back out.
  rebound: 0.2,
  // Degrees the cabinet rocks back on its rear feet.
  tip: 1.1,
};

/* World units the other drawer slides out when the cabinet tips. */
const RATTLE = 0.22;

/* ───────────────────────── Geometry (world units) ─────────────────────── */

export type CabinetDrawer = "bottom" | "top";

// The cabinet: 5 wide (x), 5.5 deep (y), on four feet, its front facing
// the viewer's left (+y) so the drawers roll out down-left on screen.
// Feet stand 0.5 in from the body's sides, so their edges never run a
// hair beside the body's own.
const FOOT = { h: 0.5, inset: 0.5, w: 0.75 };
const BODY = { at: [-2.5, -3, FOOT.h] as Vec3, size: [5, 5.5, 8.75] as Vec3 };
const FRONT_Y = BODY.at[1] + BODY.size[1];
const BODY_TOP = BODY.at[2] + BODY.size[2];
// Every strip that shows (the top plate, the frame's rails and stiles, the
// drawer's front, walls and lift) is at least 0.5, so it stays a clear
// strip, not a doubled line, at the default size.
// The top: a separate plate, flush with the body.
const CAP = 0.5;

// The front's frame around the two drawer openings.
// The top rail is the lock's: deep enough that the lock sits clear of both
// its edges.
const FRAME = { bottom: 0.5, mid: 0.5, stile: 0.5, top: 1 };
const OPENING = {
  h: (BODY.size[2] - FRAME.top - FRAME.mid - FRAME.bottom) / 2,
  w: BODY.size[0] - 2 * FRAME.stile,
  x: BODY.at[0] + FRAME.stile,
};
// Height of each opening's bottom edge.
const BAY_Z: Record<CabinetDrawer, number> = {
  bottom: BODY.at[2] + FRAME.bottom,
  top: BODY.at[2] + FRAME.bottom + OPENING.h + FRAME.mid,
};
const BAYS: CabinetDrawer[] = ["bottom", "top"];

// A drawer: a front that fills its opening (flush when shut), and an open
// box behind it, narrower than the opening by the slides' gap.
const DRAWER = {
  // Thickness of the front.
  front: 0.5,
  // The slides' gap between the box and the opening, either side: 0.5,
  // so the box's edges stand clear of the opening's (a narrower gap drew
  // them as one doubled line).
  gap: 0.5,
  // Height of the box.
  h: 2.5,
  // Length of the box behind the front.
  length: 4.25,
  // The box's underside above the opening's bottom edge.
  lift: 0.5,
  // Thickness of the box's walls and floor.
  wall: 0.5,
};
// Full extension: the box's back reaches the cabinet's front plane, so its
// back corners sit a clear gap inside the opening's edges.
const PULL = DRAWER.front + DRAWER.length;

// The slide on the box's right side: a tall member fixed to the cabinet
// for the first part of the travel, a second one riding with the drawer.
// Both members are one height, so they meet in one seam line (a slimmer
// inner member drew a step of doubled edges).
const SLIDE = {
  // Height of the slide's centre above the opening's bottom edge.
  at: 1.25,
  // Height of the cabinet's member, and of the drawer's.
  h: [0.5, 0.5] as const,
  // Share of the pull the cabinet's member covers.
  outer: 0.45,
};

// On a drawer's front, in face units (u across, v down from its top edge):
// the label card, and the pull under it. The pull is a grip recessed into
// the front, flush with it: a thin bar standing proud drew its top and
// bottom edges as one doubled line.
const LABEL = { h: 1, u: (OPENING.w - 1.6) / 2, v: 0.7, w: 1.6 };
const GRIP = { h: 0.5, u: (OPENING.w - 1.8) / 2, v: 2.25, w: 1.8 };

// The lock, on the frame's top rail.
const LOCK: Vec3 = [
  BODY.at[0] + BODY.size[0] - 0.55,
  FRONT_Y,
  BODY_TOP - FRAME.top / 2,
];

// The cabinet tips forward about its front feet and back about its rear.
const FRONT_FEET: Vec3 = [0, FRONT_Y - FOOT.inset, 0];
const REAR_FEET: Vec3 = [0, BODY.at[1] + FOOT.inset, 0];

// The frame: the cabinet, and the open drawer with its pull.
const boundsFor = (drawer: CabinetDrawer): Vec3[] => {
  const [x, y] = BODY.at;
  const [w, d] = BODY.size;
  const reach = FRONT_Y + PULL;
  const z = BAY_Z[drawer];
  return [
    [x, y, 0],
    [x + w, y, 0],
    [x + w, y + d, 0],
    [x, y + d, 0],
    [x, y, BODY_TOP + CAP],
    [x + w, y, BODY_TOP + CAP],
    [x, y + d, BODY_TOP + CAP],
    [OPENING.x, reach, z],
    [OPENING.x + OPENING.w, reach, z],
    [OPENING.x, reach, z + OPENING.h],
  ];
};

// For the soft shadow: the cabinet and the open drawer.
const castsFor = (drawer: CabinetDrawer): IsoCast[] => [
  { box: [BODY.at[0], BODY.at[1], BODY.size[0], BODY.size[1], BODY_TOP + CAP] },
  {
    box: [OPENING.x, FRONT_Y, OPENING.w, PULL, DRAWER.h],
    z: BAY_Z[drawer],
  },
];

const GRID = { at: [-6, -6] as const, size: [12, 16] as const };
// The camera turns around the middle of the cabinet and its open drawer.
const PIVOT: readonly [number, number] = [0, 1.5];
// Turning toward the drawer fronts (+) reads better than away from them.
const DEFAULT_ORBIT: IsoOrbit = [-14, 24];

// The drawing's leftmost and rightmost points at rest, whichever drawer is
// open: the open drawer's front, and the body's far right corner.
const REST_EDGES: Vec3[] = [
  [OPENING.x, FRONT_Y + PULL, 0],
  [BODY.at[0] + BODY.size[0], BODY.at[1], 0],
];

const middle = (xs: number[]) => (Math.min(...xs) + Math.max(...xs)) / 2;

/**
 * How far to slide the stage sideways, as a percentage of its width, so
 * the cabinet at rest sits centred over the heading and the button. The
 * stage fits its frame to every angle the cabinet can turn to, and it
 * turns further one way than the other, so at rest the drawing is off the
 * frame's middle. This is the frame's middle (angles and padding as
 * `IsoStage` uses them) minus the middle of the drawing at rest.
 */
const restShift = (bounds: readonly Vec3[], orbit: IsoOrbit) => {
  const [a, b] =
    typeof orbit === "number" ? [-Math.abs(orbit), Math.abs(orbit)] : orbit;
  const lo = Math.max(-40, Math.min(0, a));
  const hi = Math.min(40, Math.max(0, b));
  const across = (points: readonly Vec3[], yaw: number) =>
    points.map((point) => projectWith({ pivot: PIVOT, yaw }, point)[0]);
  const all = [lo, lo / 2, 0, hi / 2, hi].flatMap((yaw) => across(bounds, yaw));
  const width = Math.max(...all) - Math.min(...all) + 3;
  const off = middle(all) - middle(across(REST_EDGES, 0));
  return Math.round((off / width) * 10_000) / 100;
};

/* ───────────────────────────── Tracks ─────────────────────────────────── */

// The roll out: leaves slowly, slams into the stop, bounces off it twice.
const rollOut = (start: number): IsoTrack => {
  const hit = start + TIMING.roll;
  return [
    [start, 0, EASE.in],
    [hit, PULL, EASE.drop],
    [hit + 130, PULL - STOP.rebound, EASE.in],
    [hit + 250, PULL, EASE.drop],
    [hit + 320, PULL - STOP.rebound * 0.25, EASE.in],
    [hit + 390, PULL],
  ];
};

// The push shut, from fully open.
const SLAM: IsoTrack = [
  [0, PULL, EASE.in],
  [TIMING.shut, 0, EASE.drop],
  [TIMING.shut + 110, SHUT.rebound, EASE.in],
  [TIMING.shut + 200, 0, "hold"],
];

// The cabinet tipped by a hit: up on two feet, down, one small bounce.
// Never past rest, so no foot goes through the floor.
const tip = (at: number, deg: number): IsoTrack => [
  [at - 20, 0, EASE.drop],
  [at + 120, deg, EASE.in],
  [at + 280, 0, EASE.drop],
  [at + 360, deg * 0.25, EASE.in],
  [at + 440, 0],
];

// The other drawer, sliding out a hair as the cabinet tips, then back.
const rattle = (at: number): IsoTrack => [
  [at + TIMING.lag, 0, EASE.soft],
  [at + TIMING.lag + 120, RATTLE, EASE.easy],
  [at + TIMING.lag + 340, 0],
];

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  end: number;
  pull: IsoTrack;
  rattle: IsoTrack;
  tipBack: IsoTrack;
  tipForward: IsoTrack;
}

const HIT = TIMING.open + TIMING.roll;
// The first run: closed, then the roll out.
const INTRO: Clip = {
  end: HIT + TIMING.settle,
  pull: rollOut(TIMING.open),
  rattle: rattle(HIT),
  tipBack: [],
  tipForward: tip(HIT, -STOP.tip),
};
// Every later run starts open: pushed shut, a pause, the roll out again.
const REOPEN = TIMING.shut + TIMING.pause;
const AGAIN: Clip = {
  end: REOPEN + TIMING.roll + TIMING.settle,
  pull: [...SLAM, ...rollOut(REOPEN)],
  rattle: rattle(REOPEN + TIMING.roll),
  tipBack: tip(TIMING.shut, SHUT.tip),
  tipForward: tip(REOPEN + TIMING.roll, -STOP.tip),
};

const tipPose =
  (track: IsoTrack) =>
  (ms: number): IsoPose => ({ axis: "x", rotate: r2(sample(track, ms)) });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (blueprint and lit
// variants have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/**
 * A box that is part of a drawer, cut at the cabinet's front: whatever is
 * still inside the cabinet is hidden by it, so only the part past the
 * front plane is drawn. `thin` keeps a face when nothing is out yet (the
 * drawer's front, flush with the frame when shut).
 */
const Solid = ({
  x,
  y,
  z,
  thin = false,
}: {
  x: readonly [number, number];
  y: readonly [number, number];
  z: readonly [number, number];
  thin?: boolean;
}) => {
  const from = Math.max(FRONT_Y, y[0]);
  const out = y[1] - from;
  if (out < 0.02 && !thin) {
    return null;
  }
  return (
    <Box
      at={[x[0], from, z[0]]}
      palette="surface"
      size={[x[1] - x[0], Math.max(out, 0.01), z[1] - z[0]]}
    />
  );
};

// The recessed grip: a rounded slot in the front, its inside a shade
// darker than the paper.
const GRIP_PATH = roundedRect(GRIP.w, GRIP.h, GRIP.h / 2, GRIP.u, GRIP.v);

/**
 * One drawer, `pull` world units out of its bay. Parts are written far to
 * near: the box's back and left walls, its floor, its right wall, the
 * slide on that wall, then the front with its label card and pull.
 */
const Drawer = ({
  bay,
  pull,
  lit,
}: {
  bay: CabinetDrawer;
  pull: number;
  lit: boolean;
}) => {
  const z0 = BAY_Z[bay];
  // World y of the front's outer face, its inner face, and the box's back.
  const face = FRONT_Y + pull;
  const inner = face - DRAWER.front;
  const rear = inner - DRAWER.length;
  const x0 = OPENING.x + DRAWER.gap;
  const x1 = OPENING.x + OPENING.w - DRAWER.gap;
  const zb = z0 + DRAWER.lift;
  const zt = zb + DRAWER.h;
  const slideZ = z0 + SLIDE.at;
  const split = FRONT_Y + pull * SLIDE.outer;
  // The front's top-left corner: the origin of its face details.
  const corner: Vec3 = [OPENING.x, face, z0 + OPENING.h];
  return (
    <>
      {/* The back sits between the side walls, so each side is one face
          with no seam a wall's thickness from its end. */}
      <Solid
        x={[x0 + DRAWER.wall, x1 - DRAWER.wall]}
        y={[rear, rear + DRAWER.wall]}
        z={[zb, zt]}
      />
      <Solid x={[x0, x0 + DRAWER.wall]} y={[rear, inner]} z={[zb, zt]} />
      <Solid
        x={[x0 + DRAWER.wall, x1 - DRAWER.wall]}
        y={[rear + DRAWER.wall, inner]}
        z={[zb, zb + DRAWER.wall]}
      />
      <Solid x={[x1 - DRAWER.wall, x1]} y={[rear, inner]} z={[zb, zt]} />
      <Solid
        x={[x1, x1 + DRAWER.gap]}
        y={[FRONT_Y, Math.min(split, inner)]}
        z={[slideZ - SLIDE.h[0] / 2, slideZ + SLIDE.h[0] / 2]}
      />
      <Solid
        x={[x1, x1 + DRAWER.gap]}
        y={[split, inner]}
        z={[slideZ - SLIDE.h[1] / 2, slideZ + SLIDE.h[1] / 2]}
      />
      <Solid
        thin
        x={[OPENING.x, OPENING.x + OPENING.w]}
        y={[inner, face]}
        z={[z0, z0 + OPENING.h]}
      />
      {/* The label card, flush with the front: one outline (a holder frame
          round it drew two outlines a hair apart). The open drawer's card is
          the one lit thing; the other is blank, a shade off the front. */}
      <FacePath
        at={corner}
        d={roundedRect(LABEL.w, LABEL.h, 0.1, LABEL.u, LABEL.v)}
        plane="left"
        style={{
          ...LINE,
          fill: lit ? "var(--iso-main-left)" : "var(--iso-surface-top)",
        }}
      />
      {/* The pull: a grip recessed into the front. */}
      <FacePath
        at={corner}
        d={GRIP_PATH}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-inside-wall)" }}
      />
    </>
  );
};

/**
 * The cabinet's shell: feet, the body with its two bays cut into the
 * front, the lock and the top plate. Seen through a bay: the cabinet's
 * inner left wall, and its floor running back from the bay's bottom edge
 * (one unit of depth is one unit right and one up on the front's face).
 */
const Shell = () => {
  const [x, y] = BODY.at;
  const [w, d] = BODY.size;
  const feet: [number, number][] = [
    [x + FOOT.inset, y + FOOT.inset],
    [x + w - FOOT.inset - FOOT.w, y + FOOT.inset],
    [x + FOOT.inset, y + d - FOOT.inset - FOOT.w],
    [x + w - FOOT.inset - FOOT.w, y + d - FOOT.inset - FOOT.w],
  ];
  return (
    <>
      {feet.map(([fx, fy]) => (
        <Box
          at={[fx, fy, 0]}
          key={`${fx},${fy}`}
          palette="surface"
          size={[FOOT.w, FOOT.w, FOOT.h]}
        />
      ))}
      <Box
        at={BODY.at}
        left={(_, h) =>
          BAYS.map((bay) => {
            const u = FRAME.stile;
            const v = h - (BAY_Z[bay] - BODY.at[2]) - OPENING.h;
            return (
              <g key={bay}>
                <rect
                  fill="var(--iso-inside-wall)"
                  height={OPENING.h}
                  width={OPENING.w}
                  x={u}
                  y={v}
                />
                <path
                  d={`M${u} ${v + OPENING.h} L${u + OPENING.h} ${v} H${u + OPENING.w} V${v + OPENING.h} Z`}
                  fill="var(--iso-inside-floor)"
                />
              </g>
            );
          })
        }
        palette="surface"
        size={BODY.size}
      />
      {/* One solid dot: a ring round a hole drew two circles a hair apart. */}
      <FaceEllipse center={LOCK} fill="var(--iso-ink)" plane="left" r={0.15} />
      <Box at={[x, y, BODY_TOP]} palette="surface" size={[w, d, CAP]} />
    </>
  );
};

/* ───────────────────────────── Clock ──────────────────────────────────── */

// At rest: the drawer open, the other one shut.
const OPEN = { opening: PULL, other: 0 };

/**
 * How far each drawer is out, re-rendered only when it changes. Held (no
 * clock) the drawer is open; it starts there too when it is held at first,
 * so the first play doesn't flash a shut drawer.
 */
const useDrawers = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const read = (ms: number) => ({
    opening: r2(sample(clip.pull, ms)),
    other: r2(sample(clip.rattle, ms)),
  });
  const [value, setValue] = useState(() => (clock ? read(0) : OPEN));
  const last = useRef(JSON.stringify(value));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    const key = JSON.stringify(next);
    if (key !== last.current) {
      last.current = key;
      setValue(next);
    }
  });
  return clock ? value : OPEN;
};

/* ───────────────────────────── Shell ──────────────────────────────────── */

// A turnable scene is a focusable group that says how to turn it.
const turnableLabel = (rotate: IsoRotate, title?: string) =>
  rotate === "off"
    ? {}
    : {
        "aria-label": `${title ?? "Illustration"}. Move the pointer or use the left and right arrow keys to turn it.`,
        role: "group",
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
 * and the two values seen through an open bay (the cabinet's inner wall
 * and floor), a step darker than its darkest outside face in every theme.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-inside-floor":
      "oklch(from var(--iso-surface-right-c) calc(l - 0.05) c h)",
    "--iso-inside-wall":
      "oklch(from var(--iso-surface-right-c) calc(l - 0.1) c h)",
  }) as CSSProperties;

/* ───────────────────────────── Scene ──────────────────────────────────── */

// Optical padding: an icon carries its own white space, so the label's
// side gets 2px more than the icon's side (12px and 14px) or the label
// looks pushed against the edge. The second class wins over a Button that
// already nudges this side itself.
const BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/**
 * The empty state's own words, under the cabinet: the heading, a line of
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
      <ButtonIcon d={ICON.plus} />
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

export interface FileCabinetProps extends LineStateProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the open drawer's label card; the rest of the cabinet stays neutral. */
  tone?: IsoTone;
  /** Which drawer rolls open: "bottom" or "top". */
  drawer?: "bottom" | "top";
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** Rolls the drawer open each time it turns true (hover, focus, an import finishing…), pushing it shut first. Left out, it rolls open once when the cabinet scrolls into view. Pass false to keep it open and still until you say. */
  active?: boolean;
  /** Push the drawer shut and roll it open again after a long hold (while `active`, or always when `active` is left out). Off (default) suits an empty state people sit in front of. */
  loop?: boolean;
  /** No shadow (default), or the soft cast shadow. */
  shadow?: "soft" | "none";
  /** Dashed construction grid on the floor. */
  grid?: boolean;
  /**
   * Let the viewer turn the cabinet: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default [-14, 24]. */
  orbit?: IsoOrbit;
  /** Accessible description of the illustration. Without it the cabinet is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-48`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole empty state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * File cabinet: a complete empty state ("No data yet") with an isometric
 * ink illustration, a heading, a line of copy and a button, all props.
 * A two-drawer cabinet; one drawer rolls out on its slides, hits its stop
 * and shows there is nothing in it; the cabinet tips with the hit and the
 * other drawer rattles. Built from real parts (label cards, recessed pulls, a
 * lock, telescoping slides, feet), one even outline, no shadow; the open
 * drawer's label card carries the brand, like the button under it. It
 * plays when it comes into view, or each time `active` turns true
 * (PlayOnHover, or your own state); it leans with the pointer. Follows the
 * shadcn theme.
 */
export const FileCabinet = ({
  heading = "No data yet",
  description = "Your data will appear here once you create or import your first records",
  actionLabel = "Add data",
  onAction,
  children,
  tone = "primary",
  drawer = "bottom",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  shadow = "none",
  grid = false,
  rotate = "pointer",
  orbit = DEFAULT_ORBIT,
  title,
  artClassName,
  className,
}: FileCabinetProps) => {
  const { clip, clock, ref } = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const reduced = useReduced();
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  const pulls = useDrawers(clock, clip);
  const bounds = boundsFor(drawer);
  // A still cabinet has no range to turn through.
  const turn: IsoOrbit = rotate === "off" ? 0 : orbit;
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="file-cabinet"
    >
      <div
        {...turnableLabel(rotate, title)}
        className={cn(
          "w-48 max-w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
          artClassName
        )}
        data-slot="file-cabinet-art"
        ref={ref}
        {...orbitProps}
      >
        <IsoStage
          bounds={bounds}
          camera={camera}
          casts={castsFor(drawer)}
          orbit={turn}
          shadow={shadow === "soft"}
          strokeWidth={strokeWidth}
          style={{
            ...stageStyle(variant),
            translate: `${restShift(bounds, turn)}% 0`,
          }}
          title={title}
          tone={tone}
          variant={variant}
        >
          {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
          <Rig
            axis="x"
            pivot={REAR_FEET}
            {...onClock(clock, tipPose(clip.tipBack), clip.end)}
          >
            <Rig
              axis="x"
              pivot={FRONT_FEET}
              {...onClock(clock, tipPose(clip.tipForward), clip.end)}
            >
              <Shell />
              {/* Bottom first: an open top drawer stands in front of it. */}
              {BAYS.map((bay) => (
                <Drawer
                  bay={bay}
                  key={bay}
                  lit={bay === drawer}
                  pull={bay === drawer ? pulls.opening : pulls.other}
                />
              ))}
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

export default FileCabinet;
