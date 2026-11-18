"use client";

import { useInView, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  FacePath,
  IsoStage,
  Rig,
  project,
  useClock,
  useRigged,
} from "./iso-core";
import type {
  IsoPalette,
  IsoPose,
  IsoTone,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ---------------------------------------------------------------------------
 * The Line kit: everything an outline-style object shares, so an object's
 * own file holds only its geometry, its storyboard and its copy.
 *
 *   - the front view (FRONT_POSE, facing) that turns an object built facing
 *     +y to face the screen with its true proportions;
 *   - LINE, the one outline for marks a file strokes itself, and Edge, a
 *     straight 3D edge sent through the rigs around it;
 *   - useReduced, the hydration-safe reduced-motion read;
 *   - useLineShell, the clock driven by `active`, its clips, loop and
 *     onPlayEnd; PlayOnHover, which drives `active` from hover and focus;
 *   - lineStageStyle, the paper walls, the pixel outline, no rim, no
 *     hairline contour;
 *   - LineState, the complete empty state: the art (a real button that
 *     replays), the heading, the line of copy and the action.
 *
 * Read references/line-style.md before changing anything here.
 * ------------------------------------------------------------------------- */

/* ------------------------------- Numbers --------------------------------- */

/** Rounds to 2 decimals, so paths and poses don't churn on float noise. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** A quarter circle as a cubic: the handle length for a unit radius. */
export const ARC = 0.5523;

/** A circle of radius `r` as a face path, its box's top-left corner at 0,0. */
export const disc = (r: number) => {
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

/** A circle of radius `r` as a face path, centred on (cx, cy). */
export const circle = (cx: number, cy: number, r: number) => {
  const k = r2(r * ARC);
  return [
    `M${r2(cx + r)} ${cy}`,
    `C${r2(cx + r)} ${r2(cy + k)} ${r2(cx + k)} ${r2(cy + r)} ${cx} ${r2(cy + r)}`,
    `C${r2(cx - k)} ${r2(cy + r)} ${r2(cx - r)} ${r2(cy + k)} ${r2(cx - r)} ${cy}`,
    `C${r2(cx - r)} ${r2(cy - k)} ${r2(cx - k)} ${r2(cy - r)} ${cx} ${r2(cy - r)}`,
    `C${r2(cx + k)} ${r2(cy - r)} ${r2(cx + r)} ${r2(cy - k)} ${r2(cx + r)} ${cy}`,
    "Z",
  ].join(" ");
};

/* ------------------------------ Front view ------------------------------- */

/**
 * Facing the screen. Build every object facing +y, about a centre line at
 * x = 0, standing on z = 0. The isometric camera sees +y at an angle, so the
 * whole object is turned 45° about the vertical (its front then points at
 * the viewer, edges run level and plumb) and stretched √(3/2) in height
 * (the camera looks down from 35.26° and foreshortens heights by exactly
 * that). It stays one exact parallel projection of a solid: its thickness
 * shows along its top edges, at 1/√3 of its depth.
 */
export const FRONT = { stretch: Math.sqrt(1.5), turn: -45 } as const;

/** The outer rig's pose: wrap the whole object in `<Rig pivot={[0,0,0]} {...FRONT_POSE}>`. */
export const FRONT_POSE: IsoPose = {
  axis: "z",
  rotate: FRONT.turn,
  scale: [1, 1, FRONT.stretch],
};

/**
 * How an object is shown. "front": turned to face the screen (flat and
 * thin things: a page, a badge, a disk, a dial). "isometric": the true
 * three-quarter view, two walls and the top showing (boxy and deep things:
 * a printer, a box, a server, a tray, a stick lying on the floor). Boxes
 * shown front-on read as flat stickers, and their thin top strips draw as
 * doubled lines.
 */
export type LineView = "front" | "isometric";

/** Where a world point lands once the object faces the screen (for `bounds`). */
export const facing = ([x, y, z]: Vec3): Vec3 => [
  (x + y) * Math.SQRT1_2,
  (y - x) * Math.SQRT1_2,
  z * FRONT.stretch,
];

/** The frame's points for a view: through `facing` in front, as is in isometric. */
export const viewBounds = (view: LineView, extent: readonly Vec3[]) =>
  view === "front" ? extent.map(facing) : [...extent];

/* -------------------------------- Lines ---------------------------------- */

/** The one outline, for marks a file strokes itself. Never a second weight. */
export const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinecap: "round",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/** A straight edge through world points, sent through every rig around it. */
export const Edge = ({
  points,
  style,
}: {
  points: readonly Vec3[];
  style?: CSSProperties;
}) => {
  const rigged = useRigged();
  const d = `M${points.map((p) => project(rigged(p)).join(",")).join(" L")}`;
  return <path d={d} style={{ ...LINE, ...style }} />;
};

/**
 * The far edge of a straight-on, non-convex extrusion on the front plane
 * ("left"): the top run of its outline on the back plane, and one edge from
 * front to back at each point where the side turns on screen (extremes,
 * sharp corners, valley creases, tips). Exact when the object doesn't lean;
 * for a part that swings use the full back outline + repaint recipe
 * (references/line-style.md). Draw it right after the `Extrude`.
 */
export const FarEdge = ({
  at,
  depth,
  chain,
  joins,
}: {
  /** The extrusion's `at` (the face's u = v = 0 corner). */
  at: Vec3;
  depth: number;
  /** The top run of the outline, as a face path in the extrusion's units. */
  chain: string;
  /** [u, v] face points where the side turns on screen. */
  joins: readonly (readonly [number, number])[];
}) => (
  <>
    <FacePath
      at={[at[0], at[1] - depth, at[2]]}
      d={chain}
      plane="left"
      style={LINE}
    />
    {joins.map(([u, v]) => (
      <Edge
        key={`${u},${v}`}
        points={[
          [r2(at[0] + u), at[1], r2(at[2] - v)],
          [r2(at[0] + u), at[1] - depth, r2(at[2] - v)],
        ]}
      />
    ))}
  </>
);

/** A filled face in a palette's shade, edged with the one outline. */
export const faceFill = (
  palette: IsoPalette,
  face: "left" | "right" | "top"
): CSSProperties => ({ ...LINE, fill: `var(--iso-${palette}-${face})` });

/* ------------------------------ Round solids ----------------------------- */

type P2 = readonly [number, number];

/** Which way a → b turns about o (the cross product's sign). */
const turn = (o: P2, a: P2, b: P2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull of screen points (Andrew's monotone chain). */
const hull = (pts: readonly P2[]): P2[] => {
  const sorted = [...pts].toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: readonly P2[]) => {
    const out: P2[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        turn(out.at(-2) as P2, out.at(-1) as P2, p) <= 0
      ) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half(sorted.toReversed())];
};

/** Points round a level circle (constant z) in world units. */
export const ring = ([cx, cy, z]: Vec3, r: number, n = 48): Vec3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a), z] as Vec3;
  });

const closed = (pts: readonly P2[]) =>
  `M${pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" L")} Z`;

/**
 * A level circle (a lid, a coin lying flat, a spot on the floor), sent
 * through the rigs around it: an exact ellipse at any lean.
 */
export const Ring = ({
  center,
  r,
  palette,
  style,
}: {
  center: Vec3;
  r: number;
  /** Fill it with this palette's top shade; leave out for an outline only. */
  palette?: IsoPalette;
  style?: CSSProperties;
}) => {
  const rigged = useRigged();
  const pts = ring(center, r).map((p) => project(rigged(p)) as P2);
  return (
    <path
      d={closed(pts)}
      style={{ ...(palette ? faceFill(palette, "top") : LINE), ...style }}
    />
  );
};

/**
 * A round solid between two level circles (a can, a cup, a cone's slice, a
 * pot): its side is the convex hull of both rings, its top the upper ring.
 * Paint slices from the foot up: each one covers the far half of the ring
 * it stands on, which leaves exactly the visible edges, at any lean. Pass
 * `open` for a mouth (the top filled a shade darker: from 30° above a deep
 * vessel shows only its far inside wall).
 */
export const Slice = ({
  bottom,
  top,
  palette = "surface",
  open = false,
}: {
  /** Centre and radius of the lower circle. */
  bottom: readonly [Vec3, number];
  /** Centre and radius of the upper circle. */
  top: readonly [Vec3, number];
  palette?: IsoPalette;
  open?: boolean;
}) => {
  const rigged = useRigged();
  const lo = ring(bottom[0], bottom[1]).map((p) => project(rigged(p)) as P2);
  const hi = ring(top[0], top[1]).map((p) => project(rigged(p)) as P2);
  return (
    <g>
      <path
        d={closed(hull([...lo, ...hi]))}
        style={faceFill(palette, "left")}
      />
      <path d={closed(hi)} style={faceFill(palette, open ? "right" : "top")} />
    </g>
  );
};

/* ------------------------------ Reduced motion --------------------------- */

// Read through a store, never in the first render: the server cannot know
// the visitor's setting, so the browser's first render must answer "no" as
// the server did and switch straight after. Reading it at once (motion's
// useReducedMotion) makes the trees differ and React reports a failed
// hydration for every visitor with reduced motion on.
const REDUCE = "(prefers-reduced-motion: reduce)";
const watchReduce = (notify: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

/** Whether the visitor asked for less motion; false on the server and at hydration. */
export const useReduced = () =>
  useSyncExternalStore(
    watchReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false
  );

/* -------------------------------- Clock ---------------------------------- */

/** A run of the clock: its tracks, and `end`, the ms at which it is at rest. */
export interface LineClip {
  end: number;
}

/**
 * The clock and its clips, driven by `active`.
 *
 * - `active` left out: the beat plays once when the art is 40% in view
 *   (`intro`, which waits ~400 ms), and again after `hold` if `loop`.
 * - `active` passed: the caller decides. The beat plays each time `active`
 *   turns true (`again`, which starts at ~80 ms), never on its own; until
 *   the first play the object holds its resting pose. A start asked for
 *   while a beat is still running waits until that beat has settled, so
 *   fast toggling never stutters, and turning `active` off mid-beat lets
 *   the beat finish.
 * - Reduced motion: nothing plays; the resting pose holds.
 *
 * `onPlayEnd` fires once each time a beat settles. A clip that ends where
 * it started can be the same beat built twice; one that ends elsewhere
 * needs an `again` that first undoes it.
 */
export const useLineShell = <C extends LineClip>({
  active,
  onPlayEnd,
  loop = false,
  intro,
  again,
  hold = 5200,
}: {
  active?: boolean;
  onPlayEnd?: () => void;
  loop?: boolean;
  intro: C;
  again: C;
  /** Rest before a loop starts again, ms. */
  hold?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReduced();
  const controlled = active !== undefined;
  const [run, setRun] = useState(0);
  // Run 0 is the in-view intro (uncontrolled only); every later run is a
  // play asked for by `active`, a loop, or a waiting start.
  const running = !reduced && inView && (run > 0 || !controlled);
  const clock = useClock(running, run);
  const clip = run === 0 ? intro : again;
  // One new run per finished run, however many frames ask.
  const asked = useRef(-1);
  const next = () => {
    if (asked.current !== run) {
      asked.current = run;
      setRun((n) => n + 1);
    }
  };
  // A start that came in while a beat was still running.
  const waiting = useRef(false);
  const ended = useRef(-1);
  useMotionValueEvent(clock, "change", (ms) => {
    if (ms < clip.end) {
      return;
    }
    if (ended.current !== run && (run > 0 || !controlled)) {
      ended.current = run;
      onPlayEnd?.();
    }
    if (waiting.current) {
      waiting.current = false;
      next();
    } else if (loop && (active ?? true) && ms >= clip.end + hold) {
      next();
    }
  });
  // `active` turning true asks for a play.
  const was = useRef<boolean | null>(null);
  useEffect(() => {
    const rose = active === true && was.current !== true;
    was.current = active ?? null;
    if (!rose || reduced) {
      return;
    }
    const busy = (run > 0 || !controlled) && running && clock.get() < clip.end;
    if (busy) {
      waiting.current = true;
    } else {
      next();
    }
  });
  // Held at rest: reduced motion, or controlled and never played yet.
  const held = reduced || (controlled && run === 0);
  return {
    clip,
    /** Undefined when held: rigs then hold their resting pose. */
    clock: held ? undefined : clock,
    ref,
  };
};

/**
 * Rig props for a part: on the clock while it runs, or held at `rest` (the
 * pose at the end of the intro) when still. Spread into a `<Rig>`.
 */
export const onClock = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose,
  rest: number
) => (clock ? { clock, pose } : pose(rest));

/* -------------------------------- Stage ---------------------------------- */

// Ink walls step 0.03 and 0.07 under the top (the engine's default ramp is
// 0.06 and 0.13): a quiet line drawing with a whisper of form.
const PAPER: Record<string, string> = {
  "--iso-surface-left-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.03) c h)",
  "--iso-surface-right-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.07) c h)",
};

// The blueprint (`line`) at this size: its outline held at ink's pixel
// weight instead of a canvas-unit one (three times too heavy here).
const BLUEPRINT: Record<string, string> = {
  "--iso-edge-w": "calc(var(--iso-stroke-width) * 4.33px)",
  "--iso-vector": "non-scaling-stroke",
};

// The engine's rim highlight has no width in outlined variants but still
// paints a pale hairline over each extrusion's front outline. Clear it.
const NO_RIM: Record<string, string> = {
  "--iso-accent-rim": "transparent",
  "--iso-main-rim": "transparent",
  "--iso-surface-rim": "transparent",
};

/**
 * Stage overrides for every Line object: no hairline contour (every edge
 * already carries the outline), paper walls in ink, the pixel outline in
 * `line`, no rim, and the outline on the side edges of rounded parts.
 */
export const lineStageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* -------------------------------- Icons ---------------------------------- */

/**
 * A 24px stroke icon for the button, drawn in currentColor: one path `d`,
 * or any shapes as children (circles, several paths). `flip` mirrors it in
 * right-to-left layouts (arrows that point "back").
 */
export const ButtonIcon = ({
  d,
  flip = false,
  children,
}: {
  d?: string;
  flip?: boolean;
  children?: ReactNode;
}) => (
  <svg
    aria-hidden="true"
    className={flip ? "rtl:-scale-x-100" : undefined}
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    {d ? <path d={d} /> : null}
    {children}
  </svg>
);

/** Icon paths that follow the button's verb (a plus only where it adds). */
export const ICON = {
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
} as const;

/* -------------------------------- State ---------------------------------- */

/** Props every Line object takes, besides its own copy defaults. */
export interface LineStateProps {
  /** Heading under the art, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 22 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy, in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. Shows on the one brand mark only. */
  tone?: IsoTone;
  /** "ink" (default): a 1 px outline over paper walls. "line": the outline alone, faces the page colour. */
  variant?: IsoVariant;
  /** Line weight: the default 0.23 is a 1 px outline at any size. */
  strokeWidth?: number;
  /** Plays the beat each time it turns true (hover, focus, an upload finishing…). Left out, the beat plays once when the art scrolls into view. Pass false to keep it still until you say. */
  active?: boolean;
  /** Called each time the beat has played and settled. */
  onPlayEnd?: () => void;
  /** Plays it again after a long hold (while `active`, or always when `active` is left out). Off (default) suits a state people sit in front of. */
  loop?: boolean;
  /** Accessible description of the art. Without it the art is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the art alone; size it with width (it keeps its aspect ratio). */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (a centred column, `max-w-sm`). */
  className?: string;
}

/**
 * The state button's classes. Optical padding: an icon carries its own
 * white space, so the label's side gets 2px more than the icon's (12px and
 * 14px). Exported for objects that build their own button.
 */
export const LINE_BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/**
 * The complete state: the stage, then the heading, the line of copy and the
 * action. The art is a plain element (no button), so it is safe inside a
 * link or a button; playing it is up to `active`. `slot` names the
 * data-slot attributes (`<slot>` and `<slot>-art`).
 */
export const LineState = ({
  slot,
  bounds,
  view = "front",
  shell,
  stageClassName,
  defaultArtClassName = "w-48",
  icon,
  buttonVariant = "default",
  props,
  children,
}: {
  slot: string;
  /** World points the frame must hold, already through `viewBounds(view, …)`. */
  bounds: readonly Vec3[];
  /** "front" (default) turns the object to face the screen; "isometric" shows it at the true three-quarter angle. */
  view?: LineView;
  shell: ReturnType<typeof useLineShell>;
  /** Extra classes on the stage (a `translate` to centre the main mass). */
  stageClassName?: string;
  defaultArtClassName?: string;
  /** The button's icon paths (see ICON), or none. */
  icon?: string;
  buttonVariant?: "default" | "secondary" | "outline";
  props: Required<
    Pick<
      LineStateProps,
      | "heading"
      | "description"
      | "actionLabel"
      | "tone"
      | "variant"
      | "strokeWidth"
    >
  > &
    Pick<
      LineStateProps,
      "onAction" | "children" | "title" | "artClassName" | "className"
    >;
  /** The object, built facing +y about x = 0 on z = 0 (the front view turns it). */
  children: ReactNode;
}) => {
  const art = (
    <IsoStage
      bounds={bounds}
      className={stageClassName}
      shadow={false}
      strokeWidth={props.strokeWidth}
      style={lineStageStyle(props.variant)}
      title={props.title}
      tone={props.tone}
      variant={props.variant}
    >
      {view === "front" ? (
        <Rig pivot={[0, 0, 0]} {...FRONT_POSE}>
          {children}
        </Rig>
      ) : (
        children
      )}
    </IsoStage>
  );
  const button = props.actionLabel ? (
    <Button
      className={LINE_BUTTON}
      onClick={props.onAction}
      variant={buttonVariant}
    >
      {icon ? <ButtonIcon d={icon} /> : null}
      {props.actionLabel}
    </Button>
  ) : null;
  const actions = props.children ?? button;
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        props.className
      )}
      data-slot={slot}
    >
      <div
        className={cn(defaultArtClassName, "max-w-full", props.artClassName)}
        data-slot={`${slot}-art`}
        ref={shell.ref}
      >
        {art}
      </div>
      {props.heading ? (
        <p className="mt-3 text-xl font-medium tracking-tight text-foreground">
          {props.heading}
        </p>
      ) : null}
      {props.description ? (
        <p className="mt-2 text-balance text-muted-foreground">
          {props.description}
        </p>
      ) : null}
      {actions ? <div className="mt-6">{actions}</div> : null}
    </div>
  );
};

/* ------------------------------- Play on hover --------------------------- */

/**
 * Plays the object inside it while the pointer is over it (touch counts:
 * a press enters) or while it holds focus: it passes `active` to its one
 * child. Use it as is, or wire `active` to your own state.
 *
 *   <PlayOnHover><Folder /></PlayOnHover>
 */
export const PlayOnHover = ({
  children,
  className,
}: {
  children: ReactElement<{ active?: boolean }>;
  className?: string;
}) => {
  const [active, setActive] = useState<boolean | undefined>();
  const on = () => setActive(true);
  const off = () => setActive(false);
  return (
    <div
      className={className}
      onBlur={off}
      onFocus={on}
      onPointerEnter={on}
      onPointerLeave={off}
    >
      {isValidElement(children) ? cloneElement(children, { active }) : children}
    </div>
  );
};
